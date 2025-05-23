// Client-side encryption utilities using Web Crypto API

const RSA_ALGORITHM = {
  name: "RSA-OAEP",
  hash: "SHA-256",
};

const AES_ALGORITHM = {
  name: "AES-GCM",
  length: 256, // 256-bit key
};

const IV_LENGTH = 12; // 96-bit IV for AES-GCM

export async function encryptData(data: string, publicKeyPEM: string): Promise<string> {
  try {
    // 1. Import the RSA public key
    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    const pemContents = publicKeyPEM.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    const publicKey = await crypto.subtle.importKey(
      "spki",
      binaryDer.buffer,
      RSA_ALGORITHM,
      false,
      ["encrypt"]
    );

    // 2. Generate a symmetric AES key
    const aesKey = await crypto.subtle.generateKey(
      AES_ALGORITHM,
      true, // extractable
      ["encrypt", "decrypt"]
    );

    // 3. Encrypt the data with the AES key
    const encodedData = new TextEncoder().encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH)); // Generate a random IV
    
    const encryptedDataBuffer = await crypto.subtle.encrypt(
      {
        name: AES_ALGORITHM.name,
        iv: iv,
      },
      aesKey,
      encodedData
    );

    // 4. Export the AES key and encrypt it with the RSA public key
    const exportedAesKey = await crypto.subtle.exportKey("raw", aesKey);
    const encryptedAesKeyBuffer = await crypto.subtle.encrypt(
      RSA_ALGORITHM,
      publicKey,
      exportedAesKey
    );

    // 5. Combine IV, encrypted data, and encrypted AES key into a single string
    const fullEncryptedData = {
      iv: Array.from(iv), // Convert Uint8Array to array for JSON serialization
      encryptedData: Array.from(new Uint8Array(encryptedDataBuffer)),
      encryptedAesKey: Array.from(new Uint8Array(encryptedAesKeyBuffer)),
    };
    
    // Stringify and base64 encode the combined object
    return btoa(JSON.stringify(fullEncryptedData));

  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

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
