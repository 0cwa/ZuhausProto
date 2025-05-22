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
  numBathrooms: z.number(),
  hasDishwasher: z.boolean(),
  hasWasher: z.boolean(),
  hasDryer: z.boolean(),
  tenants: z.number(),
  allowRoommates: z.boolean(),
});

// Person preferences schema
export const personPreferencesSchema = z.object({
  sqMeters: z.number(),
  sqMetersWorth: z.number().optional(),
  numWindows: z.number(),
  numWindowsWorth: z.number().optional(),
  windowDirections: z.array(z.string()),
  windowDirectionsWorth: z.number().optional(),
  totalWindowSize: z.number(),
  totalWindowSizeWorth: z.number().optional(),
  numBedrooms: z.number(),
  numBedroomsWorth: z.number().optional(),
  numBathrooms: z.number(),
  numBathroomsWorth: z.number().optional(),
  hasDishwasher: z.boolean(),
  dishwasherWorth: z.number().optional(),
  hasWasher: z.boolean(),
  washerWorth: z.number().optional(),
  hasDryer: z.boolean(),
  dryerWorth: z.number().optional(),
  bidAmount: z.number(),
  maxRoommates: z.number().optional(),
  cleanliness: z.number().optional(),
  quietness: z.number().optional(),
  guests: z.number().optional(),
  personalSpace: z.number().optional(),
  sleepTime: z.number().optional(),
  wakeTime: z.number().optional(),
});

// Person data schema
export const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  encryptedData: z.string(),
  allowRoommates: z.boolean(),
  assignedRoom: z.string().optional(),
  requiredPayment: z.number().optional(),
});

// Form submission schema
export const formSubmissionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  allowRoommates: z.boolean(),
  encryptedData: z.string(),
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
export type Person = z.infer<typeof personSchema>;
export type FormSubmission = z.infer<typeof formSubmissionSchema>;
export type AdminAuth = z.infer<typeof adminAuthSchema>;
export type MatchingResult = z.infer<typeof matchingResultSchema>;
