// server/utils.ts
// A new file for utility functions

import { PersonPreferences } from "@shared/schema";

export function euclideanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have the same dimension for Euclidean distance calculation.");
  }
  let sumOfSquares = 0;
  for (let i = 0; i < vec1.length; i++) {
    sumOfSquares += (vec1[i] - vec2[i]) ** 2;
  }
  return Math.sqrt(sumOfSquares);
}

export function generateRandomPreferences(): PersonPreferences {
  const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const getRandomFloat = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(1));
  const getRandomBool = () => Math.random() > 0.5;
  const getRandomElement = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

  const windowDirectionsOptions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const randomWindowDirections = Array.from({ length: getRandomInt(1, 4) }, () => getRandomElement(windowDirectionsOptions));

  const sleepTimeStart = getRandomInt(19 * 60, 23 * 60); // 7 PM to 11 PM
  const sleepTimeEnd = getRandomInt(sleepTimeStart + 30, (24 + 5) * 60); // 30 mins after start, up to 5 AM next day

  const wakeTimeStart = getRandomInt(4 * 60, 8 * 60); // 4 AM to 8 AM
  const wakeTimeEnd = getRandomInt(wakeTimeStart + 30, 13 * 60); // 30 mins after start, up to 1 PM

  return {
    sqMeters: [getRandomInt(50, 100), getRandomInt(101, 200)],
    sqMetersWorth: getRandomInt(0, 100),
    numWindows: [getRandomInt(1, 5), getRandomInt(6, 12)],
    numWindowsWorth: getRandomInt(0, 50),
    windowDirections: Array.from(new Set(randomWindowDirections)), // Ensure unique directions
    windowDirectionsWorth: getRandomInt(0, 70),
    totalWindowSize: [getRandomFloat(5, 10), getRandomFloat(11, 20)],
    totalWindowSizeWorth: getRandomInt(0, 60),
    numBedrooms: [getRandomInt(1, 2), getRandomInt(3, 5)],
    numBedroomsWorth: getRandomInt(0, 120),
    numBathrooms: [getRandomFloat(1, 1.5), getRandomFloat(2, 3)],
    numBathroomsWorth: getRandomInt(0, 80),
    hasDishwasher: getRandomBool(),
    dishwasherWorth: getRandomInt(0, 40),
    hasWasher: getRandomBool(),
    washerWorth: getRandomInt(0, 50),
    hasDryer: getRandomBool(),
    dryerWorth: getRandomInt(0, 50),
    bidAmount: getRandomInt(800, 2500),
    maxRoommates: getRandomInt(0, 3), // 0 means no roommates
    cleanliness: getRandomInt(0, 100),
    quietness: getRandomInt(0, 100),
    guests: getRandomInt(0, 100),
    personalSpace: getRandomInt(0, 100),
    sleepTime: [sleepTimeStart, sleepTimeEnd],
    wakeTime: [wakeTimeStart, wakeTimeEnd],
  };
}
