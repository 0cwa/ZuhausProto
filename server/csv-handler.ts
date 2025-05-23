import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse'; // Import the csv-parse library
import { Apartment, Person, PersonCleartext, PersonPreferences } from '@shared/schema';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const APARTMENT_CSV = path.join(DATA_DIR, 'apartment_data.csv');
const PEOPLE_CSV = path.join(DATA_DIR, 'people.csv');
const PEOPLE_CLEARTEXT_CSV = path.join(DATA_DIR, 'peoplec.csv'); // New file for cleartext data

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
    const records = await parse(content, {
      columns: false, // Do not assume first row is headers
      skip_empty_lines: true,
      trim: true, // Trim whitespace from each cell
    });
    return records as string[][];
  }

  async stringifyCSV(data: string[][]): Promise<string> {
    return data.map(row => 
      row.map(cell => 
        // Check if cell contains comma, double quote, or newline
        // If so, enclose in double quotes and escape internal double quotes
        cell.includes(',') || cell.includes('"') || cell.includes('\n') 
          ? `"${cell.replace(/"/g, '""')}"` 
          : cell
      ).join(',')
    ).join('\n');
  }

  async loadApartments(): Promise<Apartment[]> {
    await this.ensureDataDirectory();
    
    try {
      const content = await fs.readFile(APARTMENT_CSV, 'utf8');
      const rows = await this.parseCSV(content);
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
      console.error('Error loading apartments, returning empty array:', error);
      return [];
    }
  }

  async saveApartments(apartments: Apartment[]): Promise<void> {
    await this.ensureDataDirectory();
    
    const headers = [
      'Name', 'SqMeters', 'NumWindows', 'WindowDirections', 'TotalWindowSize',
      'FloorLevel', 
      'NumBedrooms', 'NumBathrooms', 'HasDishwasher', 'HasWasher', 'HasDryer',
      'Tenants', 'AllowRoommates'
    ];
    
    const rows = apartments.map(apt => [
      apt.name,
      apt.sqMeters.toString(),
      apt.numWindows.toString(),
      apt.windowDirections.join(';'), // Corrected: Ensure join by semicolon
      apt.totalWindowSize.toString(),
      (apt as any).floorLevel || "1", 
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
      const content = await fs.readFile(PEOPLE_CSV, 'utf8');
      const rows = await this.parseCSV(content);
      const [headers, ...dataRows] = rows;
      
      const hasIdColumn = headers[0]?.trim().toLowerCase() === 'id';

      return dataRows.map((row, index) => {
        if (hasIdColumn) {
          return {
            id: row[0] || (index + 1).toString(), // Use existing ID or generate new if empty
            name: row[1] || '',
            encryptedData: row[2] || '',
            allowRoommates: row[3]?.toLowerCase() === 'true',
            assignedRoom: row[4] || undefined,
            requiredPayment: row[5] ? parseFloat(row[5]) : undefined,
          };
        } else {
          // Assuming format: Name, EncryptedData, AllowRoommates, AssignedRoom, RequiredPayment
          return {
            id: (index + 1).toString(), // Generate ID
            name: row[0] || '',
            encryptedData: row[1] || '',
            allowRoommates: row[2]?.toLowerCase() === 'true',
            assignedRoom: row[3] || undefined,
            requiredPayment: row[4] ? parseFloat(row[4]) : undefined,
          };
        }
      });
    } catch (error) {
      return [];
    }
  }

  async savePeople(people: Person[]): Promise<void> {
    await this.ensureDataDirectory();
    
    const headers = ['ID', 'Name', 'EncryptedData', 'AllowRoommates', 'AssignedRoom', 'RequiredPayment']; 
    
    const rows = people.map(person => [
      person.id, 
      person.name,
      person.encryptedData,
      person.allowRoommates.toString(),
      person.assignedRoom || '',
      person.requiredPayment?.toString() || '',
    ]);
    
    const csvContent = await this.stringifyCSV([headers, ...rows]);
    await fs.writeFile(PEOPLE_CSV, csvContent, 'utf8');
  }

  // New methods for cleartext people data (for debugging)
  async loadPeopleCleartext(): Promise<PersonCleartext[]> {
    await this.ensureDataDirectory();
    try {
      const content = await fs.readFile(PEOPLE_CLEARTEXT_CSV, 'utf8');
      console.log(`[CSVHandler] Read content from ${PEOPLE_CLEARTEXT_CSV}: ${content.substring(0, 200)}...`);
      const rows = await this.parseCSV(content);
      console.log(`[CSVHandler] Parsed ${rows.length} rows from peoplec.csv`);

      if (rows.length < 1) { // Check if there are any rows at all
          console.warn(`[CSVHandler] peoplec.csv is empty or contains no processable rows. Returning empty array.`);
          return [];
      }
      
      const [headers, ...dataRows] = rows;
      if (!headers || headers.length === 0) {
        console.warn(`[CSVHandler] peoplec.csv contains no header row. Returning empty array.`);
        return [];
      }
      console.log(`[CSVHandler] Headers from peoplec.csv: ${headers.join(', ')}`);

      if (dataRows.length === 0) {
        console.warn(`[CSVHandler] peoplec.csv contains no data rows after headers. Returning empty array.`);
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
          // console.log(`[CSVHandler] Row ${rowIndex} raw preferences string before JSON.parse: '${preferencesString}'`);

          const preferences: PersonPreferences = JSON.parse(preferencesString);
          
          const personData: PersonCleartext = {
            id: row[idColIdx],
            name: row[nameColIdx],
            allowRoommates: row[allowRoommatesColIdx!]?.toLowerCase() === 'true',
            assignedRoom: row[assignedRoomColIdx!] || undefined,
            requiredPayment: row[requiredPaymentColIdx!] ? parseFloat(row[requiredPaymentColIdx!]) : undefined,
            preferences: preferences,
          };
          // console.log(`[CSVHandler] Successfully parsed row ${rowIndex}: ${personData.name}`);
          return personData;

        } catch (parseRowError) {
          console.error(`[CSVHandler] Error parsing row ${rowIndex} in peoplec.csv. Row data: [${row.join(',')}]`, parseRowError);
          return null; // Return null for rows that fail to parse
        }
      }).filter(person => person !== null) as PersonCleartext[]; // Filter out nulls
    } catch (error) {
      console.error('[CSVHandler] Error loading or processing peoplec.csv:', error);
      return [];
    }
  }

  async savePeopleCleartext(people: PersonCleartext[]): Promise<void> {
    await this.ensureDataDirectory();
    const headers = ['ID', 'Name', 'AllowRoommates', 'AssignedRoom', 'RequiredPayment', 'Preferences'];
    const rows = people.map(person => [
      person.id,
      person.name,
      person.allowRoommates.toString(),
      person.assignedRoom || '',
      person.requiredPayment?.toString() || '',
      JSON.stringify(person.preferences), // Store preferences as JSON string
    ]);
    const csvContent = await this.stringifyCSV([headers, ...rows]);
    await fs.writeFile(PEOPLE_CLEARTEXT_CSV, csvContent, 'utf8');
  }
}

export const csvHandler = new CSVHandler();
