import crypto from 'crypto';

const RSA_ALGORITHM_DETAILS = { // Renamed for clarity
  name: 'rsa-oaep',
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' } as const,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' } as const,
  oaepHash: 'sha256',
};

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for AES-GCM

export class RSAKeyPair { // Renamed class from ECKeyPair to RSAKeyPair
  private privateKey: crypto.KeyObject;
  public publicKey: crypto.KeyObject;

  constructor() {
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: RSA_ALGORITHM_DETAILS.modulusLength,
      publicKeyEncoding: RSA_ALGORITHM_DETAILS.publicKeyEncoding,
      privateKeyEncoding: RSA_ALGORITHM_DETAILS.privateKeyEncoding,
    });

    this.privateKey = keyPair.privateKey;
    this.publicKey = keyPair.publicKey;
  }

  getPublicKeyDER(): Buffer {
    const pem = this.publicKey.export({ type: 'spki', format: 'pem' }) as string;
    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    const pemContents = pem.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
    return Buffer.from(pemContents, 'base64');
  }

  getPublicKeyPEM(): string {
    return this.publicKey.export({ type: 'spki', format: 'pem' }) as string;
  }

  decrypt(encryptedPayload: string): string {
    try {
      // Decode the base64 string to get the JSON string
      const decodedPayload = Buffer.from(encryptedPayload, 'base64').toString('utf8');
      const { iv, encryptedData, encryptedAesKey } = JSON.parse(decodedPayload);

      // Convert arrays back to Buffers/Uint8Arrays
      const ivBuffer = Buffer.from(iv);
      const encryptedDataBuffer = Buffer.from(encryptedData);
      const encryptedAesKeyBuffer = Buffer.from(encryptedAesKey);

      // 1. Decrypt the AES key using RSA private key
      const decryptedAesKey = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: RSA_ALGORITHM_DETAILS.oaepHash, // Use renamed constant
        },
        encryptedAesKeyBuffer
      );

      // 2. Decrypt the actual data using the decrypted AES key and IV
      const decipher = crypto.createDecipheriv(AES_ALGORITHM, decryptedAesKey, ivBuffer);
      
      // The auth tag is appended to the end of the encrypted data in AES-GCM
      // It's typically 16 bytes (128 bits)
      const authTagLength = 16; 
      const ciphertext = encryptedDataBuffer.slice(0, encryptedDataBuffer.length - authTagLength);
      const authTag = encryptedDataBuffer.slice(encryptedDataBuffer.length - authTagLength);
      
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Server decryption error:', error);
      throw new Error('Failed to decrypt data on server');
    }
  }

  // Generate a hash for identicon
  getPublicKeyHash(): string {
    const publicKeyDER = this.getPublicKeyDER();
    return crypto.createHash('sha256').update(publicKeyDER).digest('hex');
  }
}

// Global instance
export const serverKeyPair = new RSAKeyPair(); // Use renamed class
