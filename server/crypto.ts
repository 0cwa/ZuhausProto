// This file is now a dummy for debugging purposes,
// providing a placeholder for serverKeyPair without actual encryption.

export class ECKeyPair {
  // No actual keys are generated or stored in this debugging version.

  constructor() {
    console.warn('DEBUG MODE: ECKeyPair is a dummy. No actual encryption/decryption is happening.');
  }

  async init(): Promise<void> {
    // No initialization needed for dummy keys.
    console.log('Dummy EC key pair initialized.');
  }

  // Public key methods are no longer relevant for client-side encryption in this mode.
  getPublicKeyDER(): Buffer {
    return Buffer.from(''); // Dummy return
  }

  getPublicKeyPEM(): string {
    return '-----BEGIN PUBLIC KEY-----\nDEBUG_PUBLIC_KEY\n-----END PUBLIC KEY-----'; // Dummy return
  }

  // Decrypt method now just parses the input as cleartext JSON.
  async decrypt(payload: string): Promise<string> {
    try {
      // In this debugging mode, the payload is expected to be base64-encoded JSON string of preferences.
      const decodedPayload = Buffer.from(payload, 'base64').toString('utf8');
      // The client's encryptData will just base64 encode the JSON preferences.
      // So, we just need to decode and return the JSON string.
      return decodedPayload;
    } catch (error) {
      console.error('DEBUG DECRYPTION ERROR (expected cleartext):', error);
      throw new Error('Failed to parse cleartext data for debugging.');
    }
  }

  // Identicon hash is no longer based on a real public key.
  getPublicKeyHash(): string {
    return 'debughash'; // Dummy hash
  }
}

// Global instance
export const serverKeyPair = new ECKeyPair();
