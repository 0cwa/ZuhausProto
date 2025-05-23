import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { serverKeyPair } from "./crypto"; // Now a dummy
import { csvHandler } from "./csv-handler";
import { matchingEngine } from "./matching";
import { formSubmissionSchema, adminAuthSchema, PersonCleartext, MatchingResult } from "@shared/schema";
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs'; // Import the standard fs module
import { generateRandomPreferences } from "./utils"; // Import the new utility

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Get the current directory name in an ES module compatible way
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BIDDING_ASSIGNMENTS_CSV_PATH = path.resolve(__dirname, '../data/bidding_assignments.csv');

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize EC key pair (now a dummy, no actual key generation/loading)
  await serverKeyPair.init();

  // Initialize data from CSV files
  try {
    const apartments = await csvHandler.loadApartments();
    // FIX: Load people from peoplec.csv (cleartext) for storage in debug mode
    const peopleFromPeopleCSV = await csvHandler.loadPeopleCleartext(); 
    
    storage.setApartments(apartments);
    // Set people in storage from peoplec.csv data
    // The 'preferences' field will now contain the parsed JSON preferences
    storage.setPeople(peopleFromPeopleCSV);

  } catch (error) {
    console.error('Error loading CSV data:', error);
  }

  // Get apartment count based on filters
  app.get("/api/apartments/count", async (req, res) => {
    try {
      const apartments = await storage.getApartments();
      let filteredApartments = apartments;
      
      // Filter by sqMeters range
      if (req.query.sqMetersMin && req.query.sqMetersMax) {
        const min = parseInt(req.query.sqMetersMin as string);
        const max = parseInt(req.query.sqMetersMax as string);
        filteredApartments = filteredApartments.filter(apt => apt.sqMeters >= min && apt.sqMeters <= max);
      }
      
      // Filter by numWindows range
      if (req.query.numWindowsMin && req.query.numWindowsMax) {
        const min = parseInt(req.query.numWindowsMin as string);
        const max = parseInt(req.query.numWindowsMax as string);
        filteredApartments = filteredApartments.filter(apt => apt.numWindows >= min && apt.numWindows <= max);
      }
      
      if (req.query.windowDirections) {
        const selectedDirections = (req.query.windowDirections as string).split(','); 
        if (selectedDirections.length > 0) {
            // OR logic: apartment matches if it has at least one of the selected directions
            filteredApartments = filteredApartments.filter(apt => 
              selectedDirections.some(dir => apt.windowDirections.includes(dir))
            );
        }
      }
      
      // Filter by totalWindowSize range
      if (req.query.totalWindowSizeMin && req.query.totalWindowSizeMax) {
        const min = parseFloat(req.query.totalWindowSizeMin as string);
        const max = parseFloat(req.query.totalWindowSizeMax as string);
        filteredApartments = filteredApartments.filter(apt => apt.totalWindowSize >= min && apt.totalWindowSize <= max);
      }
      
      // Filter by numBedrooms range
      if (req.query.numBedroomsMin && req.query.numBedroomsMax) {
        const min = parseInt(req.query.numBedroomsMin as string);
        const max = parseInt(req.query.numBedroomsMax as string);
        filteredApartments = filteredApartments.filter(apt => apt.numBedrooms >= min && apt.numBedrooms <= max);
      }
      
      // Filter by numBathrooms range
      if (req.query.numBathroomsMin && req.query.numBathroomsMax) {
        const min = parseFloat(req.query.numBathroomsMin as string); 
        const max = parseFloat(req.query.numBathroomsMax as string); 
        filteredApartments = filteredApartments.filter(apt => apt.numBathrooms >= min && apt.numBathrooms <= max);
      }
      
      if (req.query.hasDishwasher === 'true') {
        filteredApartments = filteredApartments.filter(apt => apt.hasDishwasher);
      }
      
      if (req.query.hasWasher === 'true') {
        filteredApartments = filteredApartments.filter(apt => apt.hasWasher);
      }
      
      if (req.query.hasDryer === 'true') {
        filteredApartments = filteredApartments.filter(apt => apt.hasDryer);
      }

      res.json({ count: filteredApartments.length });
    } catch (error) {
      console.error("Error in /api/apartments/count:", error);
      res.status(500).json({ message: "Failed to get apartment count" });
    }
  });

  // Get all apartments
  app.get("/api/apartments", async (req, res) => {
    try {
      const apartments = await storage.getApartments();
      res.json(apartments);
    } catch (error) {
      res.status(500).json({ message: "Failed to get apartments" });
    }
  });

  // Get apartment min/max values for sliders
  app.get("/api/apartments/min-max", async (req, res) => {
    try {
      const apartments = await storage.getApartments();
      if (apartments.length === 0) {
        return res.json({
          sqMeters: { min: 0, max: 0 },
          numWindows: { min: 0, max: 0 },
          totalWindowSize: { min: 0, max: 0 },
          numBedrooms: { min: 0, max: 0 },
          numBathrooms: { min: 0, max: 0 },
        });
      }

      const minMax = {
        sqMeters: { min: Infinity, max: -Infinity },
        numWindows: { min: Infinity, max: -Infinity },
        totalWindowSize: { min: Infinity, max: -Infinity },
        numBedrooms: { min: Infinity, max: -Infinity },
        numBathrooms: { min: Infinity, max: -Infinity },
      };

      apartments.forEach(apt => {
        minMax.sqMeters.min = Math.min(minMax.sqMeters.min, apt.sqMeters);
        minMax.sqMeters.max = Math.max(minMax.sqMeters.max, apt.sqMeters);
        minMax.numWindows.min = Math.min(minMax.numWindows.min, apt.numWindows);
        minMax.numWindows.max = Math.max(minMax.numWindows.max, apt.numWindows);
        minMax.totalWindowSize.min = Math.min(minMax.totalWindowSize.min, apt.totalWindowSize);
        minMax.totalWindowSize.max = Math.max(minMax.totalWindowSize.max, apt.totalWindowSize);
        minMax.numBedrooms.min = Math.min(minMax.numBedrooms.min, apt.numBedrooms);
        minMax.numBedrooms.max = Math.max(minMax.numBedrooms.max, apt.numBedrooms);
        minMax.numBathrooms.min = Math.min(minMax.numBathrooms.min, apt.numBathrooms);
        minMax.numBathrooms.max = Math.max(minMax.numBathrooms.max, apt.numBathrooms);
      });

      res.json(minMax);
    } catch (error) {
      console.error("Error in /api/apartments/min-max:", error);
      res.status(500).json({ message: "Failed to get apartment min/max values" });
    }
  });

  // Submit preferences
  app.post("/api/submit-preferences", async (req, res) => {
    try {
      const data = formSubmissionSchema.parse(req.body);
      
      // Check if name already exists using storage (sourced from people.csv)
      const existingPerson = await storage.getPersonByName(data.name);
      if (existingPerson) {
        return res.status(409).json({ message: "Name already exists" });
      }
      
      // In debug mode, encryptedData is actually base64 encoded preferences JSON string
      const preferencesJsonString = Buffer.from(data.encryptedData, 'base64').toString('utf8');
      const preferences = JSON.parse(preferencesJsonString);

      // Create new person in storage
      const person = await storage.createPerson({
        name: data.name,
        preferences: preferences, // Store parsed preferences directly
        allowRoommates: data.allowRoommates,
      });
      
      // Update people.csv from storage
      const allPeopleFromStorage = await storage.getPeople();
      await csvHandler.savePeople(allPeopleFromStorage);

      // For peoplec.csv, it's now identical to people.csv in terms of content
      // but we keep it separate for historical context/potential future divergence.
      const newPersonCleartext: PersonCleartext = {
        id: person.id,
        name: person.name,
        allowRoommates: person.allowRoommates,
        assignedRoom: person.assignedRoom,
        requiredPayment: person.requiredPayment,
        preferences: person.preferences, // Use the same preferences
      };
      const allPeopleCleartext = await csvHandler.loadPeopleCleartext();
      allPeopleCleartext.push(newPersonCleartext);
      await csvHandler.savePeopleCleartext(allPeopleCleartext);
      
      res.json({ message: "Preferences submitted successfully", id: person.id });
    } catch (error) {
      console.error('Error submitting preferences:', error);
      res.status(400).json({ message: "Failed to submit preferences" });
    }
  });

  // Admin authentication
  app.post("/api/admin/auth", async (req, res) => {
    try {
      const data = adminAuthSchema.parse(req.body);
      
      if (data.password === ADMIN_PASSWORD) {
        res.json({ authenticated: true });
      } else {
        res.status(401).json({ message: "Invalid password" });
      }
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Get people status for admin
  app.get("/api/admin/people-status", async (req, res) => {
    try {
      // Load directly from peoplec.csv for admin panel display
      const peopleCleartext = await csvHandler.loadPeopleCleartext(); 
      
      const status = peopleCleartext.map(person => ({
        id: person.id,
        name: person.name,
        allowRoommates: person.allowRoommates,
        isAssigned: !!person.assignedRoom,
        assignedRoom: person.assignedRoom,
        requiredPayment: person.requiredPayment,
        // Preferences are not sent to client for this status endpoint
      }));
      
      res.json(status);
    } catch (error) {
      console.error("Error in /api/admin/people-status:", error);
      res.status(500).json({ message: "Failed to get people status" });
    }
  });

  // New endpoint to add dummy people
  app.post("/api/admin/add-dummy-people", async (req, res) => {
    try {
      const { count } = req.body;
      if (typeof count !== 'number' || count <= 0) {
        return res.status(400).json({ message: "Invalid count provided." });
      }

      // Get current people from storage (which was loaded from peoplec.csv)
      const currentPeople = await storage.getPeople();
      // Also load cleartext people directly for saving back to peoplec.csv
      const currentPeopleCleartext = await csvHandler.loadPeopleCleartext();

      for (let i = 0; i < count; i++) {
        const preferences = generateRandomPreferences();
        const allowRoommates = preferences.maxRoommates !== 0; 

        // Use storage.createPerson to generate a new ID and add to in-memory storage
        const newPerson = await storage.createPerson({ 
          name: `Dummy Person ${storage.getNextPersonId()}`, 
          preferences: preferences,
          allowRoommates: allowRoommates,
          assignedRoom: undefined,
          requiredPayment: undefined,
        });
        
        // Add the newly created person (with its generated ID) to the cleartext list for saving
        currentPeopleCleartext.push({
          id: newPerson.id,
          name: newPerson.name,
          allowRoommates: newPerson.allowRoommates,
          assignedRoom: newPerson.assignedRoom,
          requiredPayment: newPerson.requiredPayment,
          preferences: newPerson.preferences,
        });
      }

      // Save the updated lists back to CSVs
      // Save to people.csv (which holds base64 encoded preferences)
      await csvHandler.savePeople(await storage.getPeople()); 
      // Save to peoplec.csv (which holds cleartext preferences)
      await csvHandler.savePeopleCleartext(currentPeopleCleartext);

      res.json({ message: `Successfully added ${count} dummy people.` });
    } catch (error) {
      console.error("Error adding dummy people:", error);
      res.status(500).json({ message: "Failed to add dummy people." });
    }
  });

  // Run matching algorithm (now using TypeScript matching engine)
  app.post("/api/admin/run-matching", async (req, res) => {
    try {
      // Get people from storage (sourced from peoplec.csv, now with preferences directly)
      const peopleForMatching = await storage.getPeople();
      const apartments = await storage.getApartments();
      
      // Filter out already assigned people if desired, or re-match everyone
      const unassignedPeople = peopleForMatching.filter(person => !person.assignedRoom);
      
      if (unassignedPeople.length === 0) {
        return res.json({ message: "No unassigned people to match", results: [] });
      }
      
      const results = await matchingEngine.runMatching(unassignedPeople, apartments);
      
      // Save matching results to storage directly, no longer to bidding_assignments.csv
      await storage.saveMatchingResults(results);
      
      res.json({
        message: "Matching completed successfully",
        results,
        assignedCount: results.reduce((sum, r) => sum + r.assignedPeople.length, 0),
      });
    } catch (error) {
      console.error('Error running matching:', error);
      res.status(500).json({ message: "Failed to run matching algorithm" });
    }
  });

  // Assign rooms (finalize assignments)
  app.post("/api/admin/assign-rooms", async (req, res) => {
    try {
      // Load results from storage directly
      const matchingResults = await storage.getMatchingResults();

      if (matchingResults.length === 0) {
        return res.status(400).json({ message: "No matching results found in memory. Run matching first." });
      }

      // Update people in storage (which will then be saved to people.csv)
      for (const result of matchingResults) {
        for (const assignedPerson of result.assignedPeople) {
          await storage.updatePerson(assignedPerson.id, {
            assignedRoom: result.apartmentName,
            requiredPayment: assignedPerson.payment,
          });
        }
      }
      const updatedPeopleFromStorage = await storage.getPeople();
      await csvHandler.savePeople(updatedPeopleFromStorage); // Save updated people.csv

      // Also update peoplec.csv for debugging consistency
      const allPeopleCleartext = await csvHandler.loadPeopleCleartext();
      for (const result of matchingResults) {
        for (const assignedPerson of result.assignedPeople) {
          const personIndex = allPeopleCleartext.findIndex(p => p.id === assignedPerson.id);
          if (personIndex !== -1) {
            allPeopleCleartext[personIndex].assignedRoom = result.apartmentName;
            allPeopleCleartext[personIndex].requiredPayment = assignedPerson.payment;
          }
        }
      }
      await csvHandler.savePeopleCleartext(allPeopleCleartext);
      
      // Update apartments with new tenant counts and roommate availability
      for (const result of matchingResults) {
        const apartment = await storage.getApartment(result.apartmentId);
        if (apartment) {
          const newTenants = result.tenants;
          const allowRoommates = newTenants < apartment.numBedrooms; // Re-evaluate allowRoommates based on new tenants
          
          await storage.updateApartment(result.apartmentId, {
            tenants: newTenants,
            allowRoommates,
          });
        }
      }
      
      // Save updated apartments to CSV
      const apartments = await storage.getApartments();
      await csvHandler.saveApartments(apartments);
      
      // Clear matching results from storage after they've been "assigned"
      await storage.clearMatchingResults();

      res.json({
        message: "Rooms assigned successfully",
        assignedCount: matchingResults.reduce((sum, r) => sum + r.assignedPeople.length, 0),
      });
    } catch (error) {
      console.error('Error assigning rooms:', error);
      res.status(500).json({ message: "Failed to assign rooms" });
    }
  });

  // Get matching results (now reads from storage directly)
  app.get("/api/admin/matching-results", async (req, res) => {
    try {
      const results = await storage.getMatchingResults();
      res.json(results);
    } catch (error) {
      console.error("Error in /api/admin/matching-results:", error);
      res.status(500).json({ message: "Failed to get matching results" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
