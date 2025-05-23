import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { serverKeyPair } from "./crypto"; // Now a dummy
import { csvHandler } from "./csv-handler";
import { matchingEngine } from "./matching";
import { formSubmissionSchema, adminAuthSchema, PersonCleartext } from "@shared/schema";
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Get the current directory name in an ES module compatible way
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_SCRIPT_PATH = path.resolve(__dirname, '../data/apartment_matcher.py');

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize EC key pair (now a dummy, no actual key generation/loading)
  await serverKeyPair.init();

  // Initialize data from CSV files
  try {
    const apartments = await csvHandler.loadApartments();
    const peopleFromPeopleCSV = await csvHandler.loadPeople(); // Load from people.csv
    
    storage.setApartments(apartments);
    // Set people in storage from people.csv data
    // The 'encryptedData' field will contain the base64 encoded JSON string of preferences
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
      
      // Create new person in storage
      const person = await storage.createPerson({
        name: data.name,
        encryptedData: data.encryptedData, // This is base64(JSON.stringify(preferences))
        allowRoommates: data.allowRoommates,
      });
      
      // Update people.csv from storage
      const allPeopleFromStorage = await storage.getPeople();
      await csvHandler.savePeople(allPeopleFromStorage);

      // DEBUGGING: Save cleartext preferences to peoplec.csv
      const preferencesJsonString = Buffer.from(data.encryptedData, 'base64').toString('utf8');
      const newPersonCleartext: PersonCleartext = {
        id: person.id,
        name: person.name,
        allowRoommates: person.allowRoommates,
        assignedRoom: person.assignedRoom,
        requiredPayment: person.requiredPayment,
        preferences: JSON.parse(preferencesJsonString),
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

  // New endpoint to run the Python matching script
  app.post("/api/admin/run-python-matching", async (req, res) => {
    console.log(`Attempting to run Python script: ${PYTHON_SCRIPT_PATH}`);
    exec(`python3 ${PYTHON_SCRIPT_PATH}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return res.status(500).json({ message: "Failed to run Python matching script", error: stderr });
      }
      if (stderr) {
        console.warn(`Python script stderr: ${stderr}`);
      }
      console.log(`Python script stdout: ${stdout}`);
      res.json({ message: "Python matching script executed successfully", output: stdout });
    });
  });

  // Run matching algorithm (this endpoint is now deprecated/replaced by run-python-matching)
  // app.post("/api/admin/run-matching", async (req, res) => {
  //   try {
  //     // Get people from storage (sourced from people.csv)
  //     // The 'encryptedData' field contains the base64 encoded JSON string of preferences.
  //     // The dummy matchingEngine.decryptPersonData expects this.
  //     const peopleForMatching = await storage.getPeople();

  //     const apartments = await storage.getApartments();
      
  //     // Filter out already assigned people
  //     const unassignedPeople = peopleForMatching.filter(person => !person.assignedRoom);
      
  //     if (unassignedPeople.length === 0) {
  //       return res.json({ message: "No unassigned people to match", results: [] });
  //     }
      
  //     const results = await matchingEngine.runMatching(unassignedPeople, apartments);
      
  //     // Save matching results to storage (in-memory)
  //     await storage.saveMatchingResults(results);
      
  //     res.json({
  //       message: "Matching completed successfully",
  //       results,
  //       assignedCount: results.reduce((sum, r) => sum + r.assignedPeople.length, 0),
  //     });
  //   } catch (error) {
  //     console.error('Error running matching:', error);
  //     res.status(500).json({ message: "Failed to run matching algorithm" });
  //   }
  // });

  // Assign rooms (finalize assignments)
  app.post("/api/admin/assign-rooms", async (req, res) => {
    try {
      // Load results from bidding_assignments.csv generated by Python script
      const biddingAssignmentsContent = await fs.promises.readFile(path.join(__dirname, '../data/bidding_assignments.csv'), 'utf8');
      const parsedAssignments = await csvHandler.parseCSV(biddingAssignmentsContent);

      if (parsedAssignments.length < 2) { // Check for headers + at least one data row
        return res.status(400).json({ message: "No matching results found in bidding_assignments.csv. Run matching first." });
      }

      const headers = parsedAssignments[0];
      const dataRows = parsedAssignments.slice(1);

      const matchingResults: MatchingResult[] = [];
      const apartmentMap = new Map<string, MatchingResult>();

      dataRows.forEach(row => {
        const apartmentName = row[headers.indexOf('ApartmentName')];
        const personId = row[headers.indexOf('PersonID')];
        const personName = row[headers.indexOf('PersonName')];
        const expectedPayment = parseFloat(row[headers.indexOf('ExpectedPayment')]);
        const groupWinningBid = parseFloat(row[headers.indexOf('GroupWinningBid')]);
        const groupMembersInWinningBid = row[headers.indexOf('GroupMembersInWinningBid')];

        let result = apartmentMap.get(apartmentName);
        if (!result) {
          // Find apartment ID from storage based on name
          const apt = storage.getApartments().find(a => a.name === apartmentName);
          if (!apt) {
            console.warn(`Apartment ${apartmentName} not found in storage during assignment.`);
            return; // Skip this row if apartment not found
          }
          result = {
            apartmentId: apt.id,
            apartmentName: apartmentName,
            assignedPeople: [],
            totalPayment: groupWinningBid, // This will be overwritten by the last person's groupWinningBid, but should be consistent
            tenants: 0, // Will be calculated
            capacity: apt.numBedrooms,
          };
          apartmentMap.set(apartmentName, result);
          matchingResults.push(result);
        }

        result.assignedPeople.push({
          id: personId,
          name: personName,
          payment: expectedPayment,
        });
        result.tenants++; // Increment tenant count for this apartment
      });
      
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
      
      // Clear matching results from storage (optional, as they are now from CSV)
      await storage.clearMatchingResults(); // Clear in-memory results

      res.json({
        message: "Rooms assigned successfully",
        assignedCount: matchingResults.reduce((sum, r) => sum + r.assignedPeople.length, 0),
      });
    } catch (error) {
      console.error('Error assigning rooms:', error);
      res.status(500).json({ message: "Failed to assign rooms" });
    }
  });

  // Get matching results (now reads from bidding_assignments.csv)
  app.get("/api/admin/matching-results", async (req, res) => {
    try {
      const biddingAssignmentsContent = await fs.promises.readFile(path.join(__dirname, '../data/bidding_assignments.csv'), 'utf8');
      const parsedAssignments = await csvHandler.parseCSV(biddingAssignmentsContent);

      if (parsedAssignments.length < 2) {
        return res.json([]); // No results yet
      }

      const headers = parsedAssignments[0];
      const dataRows = parsedAssignments.slice(1);

      const resultsMap = new Map<string, MatchingResult>();

      dataRows.forEach(row => {
        const apartmentName = row[headers.indexOf('ApartmentName')];
        const personId = row[headers.indexOf('PersonID')];
        const personName = row[headers.indexOf('PersonName')];
        const expectedPayment = parseFloat(row[headers.indexOf('ExpectedPayment')]);
        const groupWinningBid = parseFloat(row[headers.indexOf('GroupWinningBid')]);
        const secondHighestBidForApt = parseFloat(row[headers.indexOf('SecondHighestBidForApt')]);
        const groupMembersInWinningBid = row[headers.indexOf('GroupMembersInWinningBid')];

        let result = resultsMap.get(apartmentName);
        if (!result) {
          // Find apartment ID from storage based on name
          const apt = storage.getApartments().find(a => a.name === apartmentName);
          if (!apt) {
            console.warn(`Apartment ${apartmentName} not found in storage for matching results display.`);
            return; // Skip this row if apartment not found
          }
          result = {
            apartmentId: apt.id,
            apartmentName: apartmentName,
            assignedPeople: [],
            totalPayment: groupWinningBid,
            tenants: 0, // Will be calculated
            capacity: apt.numBedrooms,
          };
          resultsMap.set(apartmentName, result);
        }

        result.assignedPeople.push({
          id: personId,
          name: personName,
          payment: expectedPayment,
        });
        result.tenants++; // Increment tenant count for this apartment
        result.totalPayment = groupWinningBid; // Ensure total payment is the group winning bid
      });

      res.json(Array.from(resultsMap.values()));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn("bidding_assignments.csv not found. Returning empty matching results.");
        return res.json([]);
      }
      console.error("Error in /api/admin/matching-results:", error);
      res.status(500).json({ message: "Failed to get matching results" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
