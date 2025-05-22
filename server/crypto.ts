import crypto from 'crypto';

export class ECKeyPair {
  private privateKey: crypto.KeyObject;
  public publicKey: crypto.KeyObject;

  constructor() {
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
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

  decrypt(encryptedData: string): string {
    try {
      // For EC keys, we typically use ECIES or a hybrid approach
      // This is a simplified implementation - in production, use a proper ECIES library
      const buffer = Buffer.from(encryptedData, 'base64');
      
      // Use RSA-OAEP for decryption to match client-side encryption
      const decrypted = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        buffer
      );
      
      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error('Failed to decrypt data');
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
