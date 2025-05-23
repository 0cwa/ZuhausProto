// Client-side encryption utilities (now simplified for debugging with cleartext)

const EC_ALGORITHM = {
  name: "ECDH",
  namedCurve: "P-256", // Still specified for consistency, but not used for actual encryption
};

const AES_ALGORITHM = {
  name: "AES-GCM",
  length: 256, // Still specified for consistency
};

const IV_LENGTH = 12; // Still specified for consistency

// This function now only base64 encodes the data, simulating "encryption" for debugging.
export async function encryptData(data: string, serverPublicKeyPEM: string): Promise<string> {
  try {
    console.warn('DEBUG MODE: encryptData is only base64 encoding. No actual encryption is happening.');
    // In debugging mode, we just base64 encode the JSON string of preferences.
    return btoa(data);
  } catch (error) {
    console.error('DEBUG ENCRYPTION ERROR (expected base64 encoding):', error);
    throw new Error('Failed to encode data for debugging.');
  }
}

// This function is no longer used for identicon generation based on server public key.
// It remains here if other parts of the client might use a generic hash.
export function generateHash(input: string): string {
  // Simple hash function for client-side use
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}
