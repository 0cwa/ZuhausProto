// server/utils.ts
// A new file for utility functions

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
