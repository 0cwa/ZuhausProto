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
        windowDirections: row[3] ? row[3].split(';') : ['N'],
        totalWindowSize: parseFloat(row[4]) || 10,
        numBedrooms: parseInt(row[5]) || 1,
        numBathrooms: parseInt(row[6]) || 1,
        hasDishwasher: row[7]?.toLowerCase() === 'true',
        hasWasher: row[8]?.toLowerCase() === 'true',
        hasDryer: row[9]?.toLowerCase() === 'true',
        tenants: parseInt(row[10]) || 0,
        allowRoommates: row[11]?.toLowerCase() !== 'false',
      }));
    } catch (error) {
      // Return sample data if file doesn't exist
      return this.createSampleApartments();
    }
  }

  async saveApartments(apartments: Apartment[]): Promise<void> {
    await this.ensureDataDirectory();
    
    const headers = [
      'Name', 'SqMeters', 'NumWindows', 'WindowDirections', 'TotalWindowSize',
      'NumBedrooms', 'NumBathrooms', 'HasDishwasher', 'HasWasher', 'HasDryer',
      'Tenants', 'AllowRoommates'
    ];
    
    const rows = apartments.map(apt => [
      apt.name,
      apt.sqMeters.toString(),
      apt.numWindows.toString(),
      apt.windowDirections.join(';'),
      apt.totalWindowSize.toString(),
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
      
      return dataRows.map((row, index) => ({
        id: (index + 1).toString(),
        name: row[0] || '',
        encryptedData: row[1] || '',
        allowRoommates: row[2]?.toLowerCase() === 'true',
        assignedRoom: row[3] || undefined,
        requiredPayment: row[4] ? parseFloat(row[4]) : undefined,
      }));
    } catch (error) {
      // Return empty array if file doesn't exist
      return [];
    }
  }

  async savePeople(people: Person[]): Promise<void> {
    await this.ensureDataDirectory();
    
    const headers = ['Name', 'EncryptedData', 'AllowRoommates', 'AssignedRoom', 'RequiredPayment'];
    
    const rows = people.map(person => [
      person.name,
      person.encryptedData,
      person.allowRoommates.toString(),
      person.assignedRoom || '',
      person.requiredPayment?.toString() || '',
    ]);
    
    const csvContent = await this.stringifyCSV([headers, ...rows]);
    await fs.writeFile(PEOPLE_CSV, csvContent, 'utf8');
  }

  private createSampleApartments(): Apartment[] {
    const apartments: Apartment[] = [];
    const names = [
      'Sunset View Studio', 'Garden Terrace 1B', 'City Heights 2B', 'Riverside Loft',
      'Mountain View 3B', 'Downtown Studio', 'Park Side 2B', 'Harbor View 1B',
      'Skyline Penthouse', 'Forest Glen 2B', 'Ocean Breeze 1B', 'Valley View 3B'
    ];
    
    const directions = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
    
    for (let i = 0; i < 50; i++) {
      const name = names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : '');
      const numBedrooms = Math.floor(Math.random() * 4) + 1;
      const numWindows = Math.floor(Math.random() * 6) + 2;
      const selectedDirections = directions.slice(0, Math.floor(Math.random() * 4) + 1);
      
      apartments.push({
        id: (i + 1).toString(),
        name,
        sqMeters: Math.floor(Math.random() * 100) + 30,
        numWindows,
        windowDirections: selectedDirections,
        totalWindowSize: Math.floor(Math.random() * 15) + 5,
        numBedrooms,
        numBathrooms: Math.floor(Math.random() * 3) + 1,
        hasDishwasher: Math.random() > 0.4,
        hasWasher: Math.random() > 0.3,
        hasDryer: Math.random() > 0.5,
        tenants: 0,
        allowRoommates: true,
      });
    }
    
    return apartments;
  }
}

export const csvHandler = new CSVHandler();
