import crypto from 'crypto';
import { env } from '../config/env';

// For development, fallback to a derived key if not provided. In production, require a strong 32-byte key.
const getEncryptionKey = (): Buffer => {
  if (env.encryptionKey) {
    if (env.encryptionKey.length === 64) {
      return Buffer.from(env.encryptionKey, 'hex');
    }
    if (env.encryptionKey.length === 32) {
      return Buffer.from(env.encryptionKey, 'utf-8');
    }
  }
  // Fallback for dev: derive a 32-byte key from JWT_ACCESS_SECRET or generic string
  return crypto.scryptSync(env.jwtAccessSecret || 'dev-secret-key-fallback-never-use-in-prod', 'salt', 32);
};

const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = 'aes-256-gcm';

export function encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  const jsonStr = JSON.stringify(config);
  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    authTag,
    encryptedData: encrypted,
  };
}

export function decryptConfig(encryptedRecord: Record<string, unknown>): Record<string, unknown> {
  const ivStr = encryptedRecord.iv as string;
  const authTagStr = encryptedRecord.authTag as string;
  const encryptedData = encryptedRecord.encryptedData as string;

  if (!ivStr || !authTagStr || !encryptedData) {
    throw new Error('Invalid encrypted config payload');
  }

  const iv = Buffer.from(ivStr, 'hex');
  const authTag = Buffer.from(authTagStr, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted) as Record<string, unknown>;
}
