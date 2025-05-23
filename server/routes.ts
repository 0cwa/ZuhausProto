import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { serverKeyPair } from "./crypto";
import { csvHandler } from "./csv-handler";
import { matchingEngine } from "./matching";
import { formSubmissionSchema, adminAuthSchema } from "@shared/schema";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize data from CSV files
  try {
    const apartments = await csvHandler.loadApartments();
    const people = await csvHandler.loadPeople();
    storage.setApartments(apartments);
    storage.setPeople(people);
  } catch (error) {
    console.error('Error loading CSV data:', error);
  }

  // Get server public key
  app.get("/api/public-key", async (req, res) => {
    try {
      const publicKeyPEM = serverKeyPair.getPublicKeyPEM();
      const publicKeyHash = serverKeyPair.getPublicKeyHash();
      
      res.json({
        publicKey: publicKeyPEM,
        hash: publicKeyHash,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get public key" });
    }
  });

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
            const requiredMatches = Math.ceil(selectedDirections.length * 0.75);
            filteredApartments = filteredApartments.filter(apt => {
                const matchCount = selectedDirections.filter(dir => apt.windowDirections.includes(dir)).length;
                return matchCount >= requiredMatches;
            });
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

  // Submit preferences
  app.post("/api/submit-preferences", async (req, res) => {
    try {
      const data = formSubmissionSchema.parse(req.body);
      
      // Check if name already exists
      const existingPerson = await storage.getPersonByName(data.name);
      if (existingPerson) {
        return res.status(409).json({ message: "Name already exists" });
      }
      
      // Create new person
      const person = await storage.createPerson({
        name: data.name,
        encryptedData: data.encryptedData,
        allowRoommates: data.allowRoommates,
      });
      
      // Update CSV file
      const people = await storage.getPeople();
      await csvHandler.savePeople(people);
      
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
      const people = await storage.getPeople();
      
      const status = people.map(person => ({
        id: person.id,
        name: person.name,
        allowRoommates: person.allowRoommates,
        isAssigned: !!person.assignedRoom,
        assignedRoom: person.assignedRoom,
        requiredPayment: person.requiredPayment,
      }));
      
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get people status" });
    }
  });

  // Run matching algorithm
  app.post("/api/admin/run-matching", async (req, res) => {
    try {
      const people = await storage.getPeople();
      const apartments = await storage.getApartments();
      
      // Filter out already assigned people
      const unassignedPeople = people.filter(person => !person.assignedRoom);
      
      if (unassignedPeople.length === 0) {
        return res.json({ message: "No unassigned people to match", results: [] });
      }
      
      const results = await matchingEngine.runMatching(unassignedPeople, apartments);
      
      // Save matching results
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
      const matchingResults = await storage.getMatchingResults();
      
      if (matchingResults.length === 0) {
        return res.status(400).json({ message: "No matching results found. Run matching first." });
      }
      
      // Update people with assignments
      for (const result of matchingResults) {
        for (const assignedPerson of result.assignedPeople) {
          await storage.updatePerson(assignedPerson.id, {
            assignedRoom: result.apartmentName,
            requiredPayment: assignedPerson.payment,
          });
        }
      }
      
      // Update apartments with new tenant counts and roommate availability
      for (const result of matchingResults) {
        const apartment = await storage.getApartment(result.apartmentId);
        if (apartment) {
          const newTenants = result.tenants;
          const allowRoommates = newTenants < apartment.numBedrooms;
          
          await storage.updateApartment(result.apartmentId, {
            tenants: newTenants,
            allowRoommates,
          });
        }
      }
      
      // Save to CSV files
      const people = await storage.getPeople();
      const apartments = await storage.getApartments();
      await csvHandler.savePeople(people);
      await csvHandler.saveApartments(apartments);
      
      // Clear matching results
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

  // Get matching results
  app.get("/api/admin/matching-results", async (req, res) => {
    try {
      const results = await storage.getMatchingResults();
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to get matching results" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
