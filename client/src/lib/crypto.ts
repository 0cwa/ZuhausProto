// Client-side encryption utilities using Web Crypto API

const EC_ALGORITHM = {
  name: "ECDH",
  namedCurve: "P-256", // Corresponds to prime256v1 in Node.js
};

const AES_ALGORITHM = {
  name: "AES-GCM",
  length: 256, // 256-bit key
};

const IV_LENGTH = 12; // 96-bit IV for AES-GCM

export async function encryptData(data: string, serverPublicKeyPEM: string): Promise<string> {
  try {
    // 1. Import the server's EC public key
    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    const pemContents = serverPublicKeyPEM.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    const serverPublicKey = await crypto.subtle.importKey(
      "spki",
      binaryDer.buffer,
      EC_ALGORITHM,
      false,
      [] // Public key is for key derivation, not direct encryption
    );

    // 2. Generate an ephemeral EC key pair on the client
    const ephemeralKeyPair = await crypto.subtle.generateKey(
      EC_ALGORITHM,
      true, // extractable
      ["deriveBits"]
    );

    // 3. Derive a shared secret using client's ephemeral private key and server's public key
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: EC_ALGORITHM.name,
        public: serverPublicKey,
      },
      ephemeralKeyPair.privateKey,
      256 // 256 bits for AES-256 key
    );

    // 4. Derive AES key from shared secret (using a simple hash for consistency with server)
    // In a real application, use HKDF for key derivation.
    const aesKey = await crypto.subtle.importKey(
      "raw",
      sharedSecret,
      AES_ALGORITHM,
      false,
      ["encrypt"]
    );

    // 5. Encrypt the data with the AES key
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

    // 6. Export the client's ephemeral public key
    const exportedEphemeralPublicKey = await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey);

    // 7. Combine IV, encrypted data, and ephemeral public key into a single object
    const fullEncryptedData = {
      iv: Array.from(iv), // Convert Uint8Array to array for JSON serialization
      encryptedData: Array.from(new Uint8Array(encryptedDataBuffer)),
      ephemeralPublicKey: Array.from(new Uint8Array(exportedEphemeralPublicKey)),
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
