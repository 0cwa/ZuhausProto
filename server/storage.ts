import { Apartment, Person, MatchingResult } from "@shared/schema";

export interface IStorage {
  // Apartment operations
  getApartments(): Promise<Apartment[]>;
  getApartment(id: string): Promise<Apartment | undefined>;
  updateApartment(id: string, apartment: Partial<Apartment>): Promise<Apartment>;
  
  // Person operations
  getPeople(): Promise<Person[]>;
  getPerson(id: string): Promise<Person | undefined>;
  getPersonByName(name: string): Promise<Person | undefined>;
  createPerson(person: Omit<Person, 'id'>): Promise<Person>;
  updatePerson(id: string, person: Partial<Person>): Promise<Person>;
  
  // Matching operations
  saveMatchingResults(results: MatchingResult[]): Promise<void>;
  getMatchingResults(): Promise<MatchingResult[]>;
  clearMatchingResults(): Promise<void>;
}

export class MemStorage implements IStorage {
  private apartments: Map<string, Apartment>;
  private people: Map<string, Person>;
  private matchingResults: MatchingResult[];
  private currentId: number;

  constructor() {
    this.apartments = new Map();
    this.people = new Map();
    this.matchingResults = [];
    this.currentId = 1;
  }

  // Apartment operations
  async getApartments(): Promise<Apartment[]> {
    return Array.from(this.apartments.values());
  }

  async getApartment(id: string): Promise<Apartment | undefined> {
    return this.apartments.get(id);
  }

  async updateApartment(id: string, apartment: Partial<Apartment>): Promise<Apartment> {
    const existing = this.apartments.get(id);
    if (!existing) {
      throw new Error(`Apartment with id ${id} not found`);
    }
    const updated = { ...existing, ...apartment };
    this.apartments.set(id, updated);
    return updated;
  }

  // Person operations
  async getPeople(): Promise<Person[]> {
    return Array.from(this.people.values());
  }

  async getPerson(id: string): Promise<Person | undefined> {
    return this.people.get(id);
  }

  async getPersonByName(name: string): Promise<Person | undefined> {
    return Array.from(this.people.values()).find(person => person.name === name);
  }

  async createPerson(person: Omit<Person, 'id'>): Promise<Person> {
    const id = this.currentId.toString();
    this.currentId++;
    const newPerson: Person = { ...person, id };
    this.people.set(id, newPerson);
    return newPerson;
  }

  async updatePerson(id: string, person: Partial<Person>): Promise<Person> {
    const existing = this.people.get(id);
    if (!existing) {
      throw new Error(`Person with id ${id} not found`);
    }
    const updated = { ...existing, ...person };
    this.people.set(id, updated);
    return updated;
  }

  // Matching operations
  async saveMatchingResults(results: MatchingResult[]): Promise<void> {
    this.matchingResults = results;
  }

  async getMatchingResults(): Promise<MatchingResult[]> {
    return this.matchingResults;
  }

  async clearMatchingResults(): Promise<void> {
    this.matchingResults = [];
  }

  // Initialization methods
  setApartments(apartments: Apartment[]): void {
    this.apartments.clear();
    apartments.forEach(apartment => {
      this.apartments.set(apartment.id, apartment);
    });
  }

  setPeople(people: Person[]): void {
    this.people.clear();
    people.forEach(person => {
      this.people.set(person.id, person);
    });
  }
}

export const storage = new MemStorage();
