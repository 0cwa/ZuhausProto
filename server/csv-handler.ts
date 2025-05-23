import fs from 'fs/promises';
import path from 'path';
import { Apartment, Person } from '@shared/schema';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const APARTMENT_CSV = path.join(DATA_DIR, 'apartment_data.csv');
const PEOPLE_CSV = path.join(DATA_DIR, 'people.csv');

export class CSVHandler {
  async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
  }

  async parseCSV(content: string): Promise<string[][]> {
    const lines = content.trim().split('\n');
    return lines.map(line => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current);
      return cells;
    });
  }

  async stringifyCSV(data: string[][]): Promise<string> {
    return data.map(row => 
      row.map(cell => 
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
        // Ensure split by comma and trim each direction
        windowDirections: row[3] ? row[3].split(',').map(d => d.trim()).filter(d => d) : [], 
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
      apt.windowDirections.join(','), // Ensure join by comma
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
}

export const csvHandler = new CSVHandler();
