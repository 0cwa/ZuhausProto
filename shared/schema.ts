import { z } from "zod";

// Apartment data schema
export const apartmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  sqMeters: z.number(),
  numWindows: z.number(),
  windowDirections: z.array(z.string()),
  totalWindowSize: z.number(),
  numBedrooms: z.number(),
  numBathrooms: z.number(), // Can be float e.g. 1.5
  hasDishwasher: z.boolean(),
  hasWasher: z.boolean(),
  hasDryer: z.boolean(),
  tenants: z.number(),
  allowRoommates: z.boolean(),
});

// Person preferences schema
export const personPreferencesSchema = z.object({
  sqMeters: z.tuple([z.number(), z.number()]), // [min, max]
  sqMetersWorth: z.number().optional(),
  numWindows: z.tuple([z.number(), z.number()]), // [min, max]
  numWindowsWorth: z.number().optional(),
  windowDirections: z.array(z.string()),
  windowDirectionsWorth: z.number().optional(),
  totalWindowSize: z.tuple([z.number(), z.number()]), // [min, max]
  totalWindowSizeWorth: z.number().optional(),
  numBedrooms: z.tuple([z.number(), z.number()]), // [min, max]
  numBedroomsWorth: z.number().optional(),
  numBathrooms: z.tuple([z.number(), z.number()]), // [min, max]
  numBathroomsWorth: z.number().optional(),
  hasDishwasher: z.boolean(),
  dishwasherWorth: z.number().optional(),
  hasWasher: z.boolean(),
  washerWorth: z.number().optional(),
  hasDryer: z.boolean(),
  dryerWorth: z.number().optional(),
  bidAmount: z.number(),
  maxRoommates: z.number().min(0).max(4).optional(), // maxRoommates can be 0 if no roommates allowed
  cleanliness: z.number().min(0).max(100).optional(),
  quietness: z.number().min(0).max(100).optional(),
  guests: z.number().min(0).max(100).optional(),
  personalSpace: z.number().min(0).max(100).optional(),
  sleepTime: z.tuple([z.number(), z.number()]).optional(), // [min, max] linear minutes, can exceed 1439
  wakeTime: z.tuple([z.number(), z.number()]).optional(), // [min, max] linear minutes
});

// Person data schema (for people.csv - now directly includes preferences)
export const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  preferences: personPreferencesSchema, // Directly include preferences
  allowRoommates: z.boolean(),
  assignedRoom: z.string().optional(),
  requiredPayment: z.number().optional(),
});

// Person data schema (for peoplec.csv - cleartext preferences, now same as Person)
export const personCleartextSchema = z.object({
  id: z.string(),
  name: z.string(),
  allowRoommates: z.boolean(),
  assignedRoom: z.string().optional(),
  requiredPayment: z.number().optional(),
  preferences: personPreferencesSchema, // Directly include preferences
});

// Form submission schema
export const formSubmissionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  allowRoommates: z.boolean(),
  encryptedData: z.string(), // This will now be a base64 encoded JSON string of preferences
});

// Admin authentication schema
export const adminAuthSchema = z.object({
  password: z.string(),
});

// Matching result schema
export const matchingResultSchema = z.object({
  apartmentId: z.string(),
  apartmentName: z.string(),
  assignedPeople: z.array(z.object({
    id: z.string(),
    name: z.string(),
    payment: z.number(),
  })),
  totalPayment: z.number(),
  tenants: z.number(),
  capacity: z.number(),
});

export type Apartment = z.infer<typeof apartmentSchema>;
export type PersonPreferences = z.infer<typeof personPreferencesSchema>;
export type Person = z.infer<typeof personSchema>; // Updated to include preferences directly
export type PersonCleartext = z.infer<typeof personCleartextSchema>; // Now identical to Person
export type FormSubmission = z.infer<typeof formSubmissionSchema>;
export type AdminAuth = z.infer<typeof adminAuthSchema>;
export type MatchingResult = z.infer<typeof matchingResultSchema>;
