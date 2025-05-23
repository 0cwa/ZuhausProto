import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const RSA_ALGORITHM_DETAILS = {
  name: 'rsa-oaep',
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' } as const,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' } as const,
  oaepHash: 'sha256',
};

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for AES-GCM

const KEYS_DIR = path.resolve(process.cwd(), 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, '.private_key.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, '.public_key.pem'); // Optional, but good practice

export class RSAKeyPair {
  private privateKey: crypto.KeyObject;
  public publicKey: crypto.KeyObject;

  constructor() {
    // Initialize with dummy keys, actual keys will be loaded/generated async
    this.privateKey = crypto.createPrivateKey('-----BEGIN RSA PRIVATE KEY-----\nMC4CAQAwBQYDK2VuBCIEIEY+2020202020202020202020202020202020202020\n-----END RSA PRIVATE KEY-----');
    this.publicKey = crypto.createPublicKey('-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VuAyEAJ+2020202020202020202020202020202020202020\n-----END PUBLIC KEY-----');
  }

  async init(): Promise<void> {
    await fs.mkdir(KEYS_DIR, { recursive: true });

    try {
      // Try to load existing keys
      const privateKeyPem = await fs.readFile(PRIVATE_KEY_PATH, 'utf8');
      const publicKeyPem = await fs.readFile(PUBLIC_KEY_PATH, 'utf8');
      
      this.privateKey = crypto.createPrivateKey(privateKeyPem);
      this.publicKey = crypto.createPublicKey(publicKeyPem);
      console.log('RSA key pair loaded from files.');
    } catch (error) {
      // If files don't exist or are unreadable, generate new keys
      console.warn('RSA key pair files not found or unreadable. Generating new keys...');
      const keyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: RSA_ALGORITHM_DETAILS.modulusLength,
        publicKeyEncoding: RSA_ALGORITHM_DETAILS.publicKeyEncoding,
        privateKeyEncoding: RSA_ALGORITHM_DETAILS.privateKeyEncoding,
      });

      this.privateKey = keyPair.privateKey;
      this.publicKey = keyPair.publicKey;

      // Save new keys to files
      await fs.writeFile(PRIVATE_KEY_PATH, this.privateKey.export(RSA_ALGORITHM_DETAILS.privateKeyEncoding), 'utf8');
      await fs.writeFile(PUBLIC_KEY_PATH, this.publicKey.export(RSA_ALGORITHM_DETAILS.publicKeyEncoding), 'utf8');
      console.log('New RSA key pair generated and saved to files.');
    }
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
          oaepHash: RSA_ALGORITHM_DETAILS.oaepHash,
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
export const serverKeyPair = new RSAKeyPair();
// Initialize the key pair asynchronously when the server starts
// This will be called in server/routes.ts
