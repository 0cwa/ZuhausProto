import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync'; // Import the synchronous parse function
import { Apartment, Person, PersonCleartext, PersonPreferences } from '@shared/schema';
import { fileURLToPath } from 'url'; // Import fileURLToPath

// Get the current directory name in an ES module compatible way
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assuming this file (csv-handler.ts) is in a 'server' directory,
// and the 'data' directory is a sibling to 'server' (e.g., project_root/data)
const DATA_DIR = path.resolve(__dirname, '../data');
const APARTMENT_CSV = path.join(DATA_DIR, 'apartment_data.csv');
const PEOPLE_CSV = path.join(DATA_DIR, 'people.csv');
const PEOPLE_CLEARTEXT_CSV = path.join(DATA_DIR, 'peoplec.csv'); // New file for cleartext data
const BIDDING_ASSIGNMENTS_CSV = path.join(DATA_DIR, 'bidding_assignments.csv'); // New constant for output

export class CSVHandler {
  async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
  }

  // Replaced custom parseCSV with csv-parse library
  async parseCSV(content: string): Promise<string[][]> {
    // console.log(`[CSVHandler] parseCSV received content length: ${content.length}`); // Disabled
    if (content.length === 0) {
      console.warn("[CSVHandler] parseCSV received empty content. Returning empty array.");
      return [];
    }

    let records: string[][] | undefined;
    try {
      // Use the synchronous parse function
      records = parse(content, {
        columns: false, // Do not assume first row is headers
        // skip_empty_lines: true, // Temporarily disable to debug if it's skipping valid lines
        trim: true, // Trim whitespace from each cell
        delimiter: ',', // Explicitly set delimiter to comma
        relax_column_count: true, // Allow rows to have a different number of columns
        skip_records_with_error: true, // Skip records that cause parsing errors
        cast: false, // Do not cast values, keep them as strings
        record_delimiter: ['\n', '\r\n'], // Explicitly define common record delimiters
        on_record_error: (err) => {
          console.error(`[CSVHandler] CSV parsing record error: ${err.message}`);
          return null; // Return null to skip the record
        },
      });
    } catch (parseError) {
      console.error(`[CSVHandler] Critical CSV parsing error:`, parseError);
      return [];; // Return empty array on critical parsing error
    }

    // Detailed logging for debugging the 'undefined records' issue
    if (!Array.isArray(records)) {
      console.warn(`[CSVHandler] parseCSV returned non-array records (type: ${typeof records}). Actual value:`, records);
      return [];
    }
    
    // console.log(`[CSVHandler] parseCSV returned ${records.length} records.`); // Disabled
    return records as string[][];
  }

  async stringifyCSV(data: string[][]): Promise<string> {
    return data.map(row => 
      row.map(cell => {
        if (cell === null || cell === undefined) {
          return ''; // Handle null/undefined cells
        }
        // Check if cell contains comma, double quote, newline, or semicolon
        // If so, enclose in double quotes and escape internal double quotes
        const cellStr = String(cell); // Ensure cell is a string
        return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes(';')
          ? `"${cellStr.replace(/"/g, '""')}"` 
          : cellStr;
      }).join(',') // Join with comma, as it's the column delimiter
    ).join('\n');
  }

  async loadApartments(): Promise<Apartment[]> {
    await this.ensureDataDirectory();
    
    try {
      // console.log(`[CSVHandler] Attempting to load apartments from: ${APARTMENT_CSV}`); // Disabled
      const content = await fs.readFile(APARTMENT_CSV, { encoding: 'utf8', flag: 'r' }); // Explicitly set flag 'r' and encoding
      // console.log(`[CSVHandler] Raw content of ${APARTMENT_CSV} (first 500 chars):\n${content.substring(0, 500)}`); // Disabled
      const rows = await this.parseCSV(content);
      // console.log(`[CSVHandler] Parsed rows from ${APARTMENT_CSV}:`, rows); // Disabled
      
      // Ensure rows is an array and has at least one row (headers)
      if (!Array.isArray(rows) || rows.length === 0) {
        console.warn(`[CSVHandler] ${APARTMENT_CSV} is empty or malformed. Returning empty array.`);
        return [];
      }

      const [headers, ...dataRows] = rows; 
      
      return dataRows.map((row, index) => ({
        id: (index + 1).toString(), 
        name: row[0] || `Apartment ${index + 1}`,
        sqMeters: parseFloat(row[1]) || 50,
        numWindows: parseInt(row[2]) || 2,
        // Corrected: Ensure split by semicolon and trim each direction
        windowDirections: row[3] ? row[3].split(';').map(d => d.trim()).filter(d => d) : [], 
        totalWindowSize: parseFloat(row[4]) || 10,
        // row[5] is Floor Level, currently not in schema
        numBedrooms: parseInt(row[6]) || 1, 
        numBathrooms: parseFloat(row[7]) || 1, 
        hasDishwasher: row[8]?.toLowerCase() === 'true', 
        hasWasher: row[9]?.toLowerCase() === 'true', 
        hasDryer: row[10]?.toLowerCase() === 'true', 
        tenants: parseInt(row[11]) || 0, 
        allowRoommates: row[12]?.toLowerCase() !== 'false', 
      }));
    } catch (error) {
      console.error(`Error loading apartments from ${APARTMENT_CSV}, returning empty array:`, error);
      return [];
    }
  }

  async saveApartments(apartments: Apartment[]): Promise<void> {
    await this.ensureDataDirectory();
    
    const headers = [
      'Name of Apartment', 'Sq. Meters', 'Number of Windows', 'Window Directions', 'Total Window Size (sq. meters)',
      'Floor Level', // Keep this header for consistency with original CSV
      'Number of Bedrooms', 'Number of Bathrooms', 'Includes Dishwasher', 'Includes Washer', 'Includes Dryer',
      'Tenants', 'Allow Roommates'
    ];
    
    const rows = apartments.map(apt => [
      apt.name,
      apt.sqMeters.toString(),
      apt.numWindows.toString(),
      apt.windowDirections.join(';'), // Corrected: Ensure join by semicolon
      apt.totalWindowSize.toString(),
      "1", // Dummy Floor Level, as it's not in the Apartment schema
      apt.numBedrooms.toString(),
      apt.numBathrooms.toString(),
      apt.hasDishwasher.toString(),
      apt.hasWasher.toString(),
      apt.hasDryer.toString(),
      apt.tenants.toString(),
      apt.allowRoommates.toString(),
    ]);
    
    const csvContent = await this.stringifyCSV([headers, ...rows]);
    await fs.writeFile(APARTMENT_CSV, csvContent, 'utf8');
  }

  async loadPeople(): Promise<Person[]> {
    await this.ensureDataDirectory();
    
    try {
      // console.log(`[CSVHandler] Attempting to load people from: ${PEOPLE_CSV}`); // Disabled
      const content = await fs.readFile(PEOPLE_CSV, { encoding: 'utf8', flag: 'r' }); // Explicitly set flag 'r' and encoding
      // console.log(`[CSVHandler] Raw content of ${PEOPLE_CSV} (first 500 chars):\n${content.substring(0, 500)}`); // Disabled
      const rows = await this.parseCSV(content);
      // console.log(`[CSVHandler] Parsed rows from ${PEOPLE_CSV}:`, rows); // Disabled
      
      // Ensure rows is an array and has at least one row (headers)
      if (!Array.isArray(rows) || rows.length < 1) {
        console.warn(`[CSVHandler] ${PEOPLE_CSV} is empty or malformed. Returning empty array.`);
        return [];
      }

      const [headers, ...dataRows] = rows;
      if (!headers || headers.length === 0) {
        return [];
      }

      const headerMap = new Map(headers.map((h, i) => [h.trim(), i]));

      return dataRows.map((row, rowIndex) => {
        try {
          const idColIdx = headerMap.get('ID');
          const nameColIdx = headerMap.get('Name');
          const encryptedDataColIdx = headerMap.get('EncryptedData'); // This column now holds JSON string
          const allowRoommatesColIdx = headerMap.get('AllowRoommates');
          const assignedRoomColIdx = headerMap.get('AssignedRoom');
          const requiredPaymentColIdx = headerMap.get('RequiredPayment');

          if (idColIdx === undefined || nameColIdx === undefined || encryptedDataColIdx === undefined) {
            console.error(`[CSVHandler] Missing critical columns (ID, Name, or EncryptedData) in people.csv headers. Row ${rowIndex} will be skipped.`);
            throw new Error("Missing critical columns in people.csv");
          }
          
          let preferencesString = row[encryptedDataColIdx] || '{}'; 
          // *** FIX: Base64 decode the preferences string before parsing JSON ***
          let decodedPreferencesString = Buffer.from(preferencesString, 'base64').toString('utf8');
          const preferences: PersonPreferences = JSON.parse(decodedPreferencesString);
          
          const personData: Person = {
            id: row[idColIdx],
            name: row[nameColIdx],
            preferences: preferences, // Directly assign parsed preferences
            allowRoommates: row[allowRoommatesColIdx!]?.toLowerCase() === 'true',
            assignedRoom: row[assignedRoomColIdx!] || undefined,
            requiredPayment: row[requiredPaymentColIdx!] ? parseFloat(row[requiredPaymentColIdx!]) : undefined,
          };
          return personData;

        } catch (parseRowError) {
          console.error(`[CSVHandler] Error parsing row ${rowIndex} in people.csv. Row data: [${row.join(',')}]`, parseRowError);
          return null; 
        }
      }).filter(person => person !== null) as Person[]; 
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`[CSVHandler] ${PEOPLE_CSV} not found. Returning empty array.`);
        return [];
      }
      console.error(`[CSVHandler] Error loading or processing ${PEOPLE_CSV}:`, error);
      return [];
    }
  }

  async savePeople(people: Person[]): Promise<void> {
    await this.ensureDataDirectory();
    
    const headers = ['ID', 'Name', 'EncryptedData', 'AllowRoommates', 'AssignedRoom', 'RequiredPayment']; 
    
    const rows = people.map(person => [
      person.id, 
      person.name,
      // *** FIX: Base64 encode the JSON string before saving ***
      Buffer.from(JSON.stringify(person.preferences)).toString('base64'), 
      person.allowRoommates.toString(),
      person.assignedRoom || '',
      person.requiredPayment?.toString() || '',
    ]);
    
    const csvContent = await this.stringifyCSV(rows); // Pass rows directly, headers are handled
    await fs.writeFile(PEOPLE_CSV, csvContent, 'utf8');
  }

  // New methods for cleartext people data (for debugging)
  async loadPeopleCleartext(): Promise<PersonCleartext[]> {
    await this.ensureDataDirectory();
    try {
      // console.log(`[CSVHandler] Attempting to load people_cleartext from: ${PEOPLE_CLEARTEXT_CSV}`); // Disabled
      const content = await fs.readFile(PEOPLE_CLEARTEXT_CSV, { encoding: 'utf8', flag: 'r' }); // Explicitly set flag 'r' and encoding
      // console.log(`[CSVHandler] Raw content of ${PEOPLE_CLEARTEXT_CSV} (first 500 chars):\n${content.substring(0, 500)}`); // Disabled
      const rows = await this.parseCSV(content);
      // console.log(`[CSVHandler] Parsed rows from ${PEOPLE_CLEARTEXT_CSV}:`, rows); // Disabled

      // Ensure rows is an array and has at least one row (headers)
      if (!Array.isArray(rows) || rows.length < 1) { 
          console.warn(`[CSVHandler] ${PEOPLE_CLEARTEXT_CSV} is empty or malformed. Returning empty array.`);
          return [];
      }
      
      const [headers, ...dataRows] = rows;
      if (!headers || headers.length === 0) {
        return [];
      }

      const headerMap = new Map(headers.map((h, i) => [h.trim(), i]));

      return dataRows.map((row, rowIndex) => {
        try {
          const idColIdx = headerMap.get('ID');
          const nameColIdx = headerMap.get('Name');
          const allowRoommatesColIdx = headerMap.get('AllowRoommates');
          const preferencesColIdx = headerMap.get('Preferences');
          const assignedRoomColIdx = headerMap.get('AssignedRoom');
          const requiredPaymentColIdx = headerMap.get('RequiredPayment');

          if (idColIdx === undefined || nameColIdx === undefined || preferencesColIdx === undefined) {
            console.error(`[CSVHandler] Missing critical columns (ID, Name, or Preferences) in peoplec.csv headers. Row ${rowIndex} will be skipped.`);
            throw new Error("Missing critical columns in peoplec.csv");
          }
          
          let preferencesString = row[preferencesColIdx] || '{}';
          
          const preferences: PersonPreferences = JSON.parse(preferencesString);
          
          const personData: PersonCleartext = {
            id: row[idColIdx],
            name: row[nameColIdx],
            allowRoommates: row[allowRoommatesColIdx!]?.toLowerCase() === 'true',
            assignedRoom: row[assignedRoomColIdx!] || undefined,
            requiredPayment: row[requiredPaymentColIdx!] ? parseFloat(row[requiredPaymentColIdx!]) : undefined,
            preferences: preferences,
          };
          return personData;

        } catch (parseRowError) {
          console.error(`[CSVHandler] Error parsing row ${rowIndex} in peoplec.csv. Row data: [${row.join(',')}]`, parseRowError);
          return null; 
        }
      }).filter(person => person !== null) as PersonCleartext[]; 
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`[CSVHandler] ${PEOPLE_CLEARTEXT_CSV} not found. Returning empty array.`);
        return [];
      }
      console.error(`[CSVHandler] Error loading or processing ${PEOPLE_CLEARTEXT_CSV}:`, error);
      return [];
    }
  }

  async savePeopleCleartext(peopleToSave: PersonCleartext[]): Promise<void> {
    await this.ensureDataDirectory();
    const headers = ['ID', 'Name', 'AllowRoommates', 'AssignedRoom', 'RequiredPayment', 'Preferences'];
    
    // The peopleToSave parameter is assumed to be the complete, authoritative list.
    const rows = peopleToSave.map(person => [
      person.id,
      person.name,
      person.allowRoommates.toString(),
      person.assignedRoom || '',
      person.requiredPayment?.toString() || '',
      JSON.stringify(person.preferences), 
    ]);
    
    const dataToWrite = [headers, ...rows];

    const csvContent = await this.stringifyCSV(dataToWrite);
    await fs.writeFile(PEOPLE_CLEARTEXT_CSV, csvContent, 'utf8');
  }

  async saveBiddingAssignments(assignments: any[]): Promise<void> {
    await this.ensureDataDirectory();
    const headers = [
      'ApartmentName', 'PersonID', 'PersonName', 'ExpectedPayment', 
      'AdjustedBid', 'GroupWinningBid', 'SecondHighestBidForApt', 'GroupMembersInWinningBid'
    ];
    
    const rows = assignments.map(assignment => [
      assignment.apartment_name,
      assignment.person_id,
      assignment.person_name,
      assignment.expected_payment.toFixed(2), // Format to 2 decimal places
      assignment.adjusted_bid.toFixed(2),
      assignment.group_winning_bid.toFixed(2),
      assignment.second_highest_bid_for_apt.toFixed(2),
      assignment.group_members_in_winning_bid,
    ]);
    
    const dataToWrite = [headers, ...rows];
    const csvContent = await this.stringifyCSV(dataToWrite);
    await fs.writeFile(BIDDING_ASSIGNMENTS_CSV, csvContent, 'utf8');
  }
}

export const csvHandler = new CSVHandler();
