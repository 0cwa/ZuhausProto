import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const EC_ALGORITHM_DETAILS = {
  name: 'prime256v1', // A common and secure elliptic curve
  publicKeyEncoding: { type: 'spki', format: 'pem' } as const,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' } as const,
};

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag for AES-GCM

const KEYS_DIR = path.resolve(process.cwd(), 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, '.private_key.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, '.public_key.pem'); // Optional, but good practice

export class ECKeyPair {
  private privateKey: crypto.KeyObject;
  public publicKey: crypto.KeyObject;

  constructor() {
    // Initialize with valid, but generic, dummy EC keys.
    // These are minimal valid PEM formats for P-256 (prime256v1) EC keys.
    // They will be immediately overwritten by init() if files don't exist.
    this.privateKey = crypto.createPrivateKey({
      key: '-----BEGIN PRIVATE KEY-----\n' +
           'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgKz2020202020202020202020202020202020202020\n' +
           'oihmQyBggqhkjOPAgEBAQRqGmswawIBAQQgKz2020202020202020202020202020202020202020\n' +
           '-----END PRIVATE KEY-----',
      format: 'pem',
      type: 'pkcs8'
    });
    this.publicKey = crypto.createPublicKey({
      key: '-----BEGIN PUBLIC KEY-----\n' +
           'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEKz2020202020202020202020202020202020202020\n' +
           '-----END PUBLIC KEY-----',
      format: 'pem',
      type: 'spki'
    });
  }

  async init(): Promise<void> {
    await fs.mkdir(KEYS_DIR, { recursive: true });

    try {
      // Try to load existing keys
      const privateKeyPem = await fs.readFile(PRIVATE_KEY_PATH, 'utf8');
      const publicKeyPem = await fs.readFile(PUBLIC_KEY_PATH, 'utf8');
      
      this.privateKey = crypto.createPrivateKey(privateKeyPem);
      this.publicKey = crypto.createPublicKey(publicKeyPem);
      console.log('EC key pair loaded from files.');
    } catch (error) {
      // If files don't exist or are unreadable, generate new keys
      console.warn('EC key pair files not found or unreadable. Generating new keys...');
      const keyPair = crypto.generateKeyPairSync('ec', {
        namedCurve: EC_ALGORITHM_DETAILS.name,
        publicKeyEncoding: EC_ALGORITHM_DETAILS.publicKeyEncoding,
        privateKeyEncoding: EC_ALGORITHM_DETAILS.privateKeyEncoding,
      });

      this.privateKey = keyPair.privateKey;
      this.publicKey = keyPair.publicKey;

      // Save new keys to files
      await fs.writeFile(PRIVATE_KEY_PATH, this.privateKey.export(EC_ALGORITHM_DETAILS.privateKeyEncoding), 'utf8');
      await fs.writeFile(PUBLIC_KEY_PATH, this.publicKey.export(EC_ALGORITHM_DETAILS.publicKeyEncoding), 'utf8');
      console.log('New EC key pair generated and saved to files.');
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

  async decrypt(encryptedPayload: string): Promise<string> {
    try {
      // Decode the base64 string to get the JSON string
      const decodedPayload = Buffer.from(encryptedPayload, 'base64').toString('utf8');
      const { iv, encryptedData, ephemeralPublicKey } = JSON.parse(decodedPayload);

      // Convert arrays back to Buffers/Uint8Arrays
      const ivBuffer = Buffer.from(iv);
      const encryptedDataBuffer = Buffer.from(encryptedData);
      const ephemeralPublicKeyBuffer = Buffer.from(ephemeralPublicKey);

      // 1. Create ECDH instance with server's private key
      const ecdh = crypto.createECDH(EC_ALGORITHM_DETAILS.name);
      // Set the server's private key for key derivation
      // Node.js crypto.createECDH().setPrivateKey expects a DER-encoded key for 'sec1' type
      // The privateKey.export() method with 'pkcs8' format gives a PEM, which needs to be converted to DER.
      // However, for ECDH, it's often simpler to use the raw private key bytes or a specific DER format.
      // Let's re-export the private key in 'sec1' DER format for setPrivateKey.
      ecdh.setPrivateKey(this.privateKey.export({ format: 'der', type: 'sec1' }));

      // 2. Derive shared secret using client's ephemeral public key
      const sharedSecret = ecdh.computeSecret(ephemeralPublicKeyBuffer);

      // 3. Derive AES key from shared secret (e.g., using HKDF or a simple hash)
      // For simplicity, we'll use a direct hash of the shared secret.
      // In a real application, use HKDF for key derivation.
      const aesKey = crypto.createHash('sha256').update(sharedSecret).digest();

      // 4. Decrypt the actual data using the derived AES key and IV
      const decipher = crypto.createDecipheriv(AES_ALGORITHM, aesKey, ivBuffer);
      
      const ciphertext = encryptedDataBuffer.slice(0, encryptedDataBuffer.length - AUTH_TAG_LENGTH);
      const authTag = encryptedDataBuffer.slice(encryptedDataBuffer.length - AUTH_TAG_LENGTH);
      
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
export const serverKeyPair = new ECKeyPair();
// Initialize the key pair asynchronously when the server starts
// This will be called in server/routes.ts
