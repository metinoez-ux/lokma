import crypto from 'crypto';

/**
 * AES-256-GCM encryption/decryption for API keys.
 * Uses ENCRYPTION_SECRET env variable (64-char hex = 32 bytes).
 * Format: iv:encrypted:authTag (hex encoded)
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

function getKey(): Buffer {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret || secret.length !== 64) {
        throw new Error('ENCRYPTION_SECRET must be a 64-character hex string (32 bytes)');
    }
    return Buffer.from(secret, 'hex');
}

/**
 * Encrypt a plaintext API key → "iv:ciphertext:authTag" (hex)
 */
export function encryptApiKey(plaintext: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

/**
 * Decrypt "iv:ciphertext:authTag" (hex) → plaintext API key
 */
export function decryptApiKey(ciphertext: string): string {
    const key = getKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const authTag = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Mask an API key for display: "AIza****_sm"
 */
export function maskApiKey(key: string): string {
    if (key.length <= 8) return '****';
    return `${key.substring(0, 4)}${'*'.repeat(Math.min(key.length - 8, 20))}${key.substring(key.length - 4)}`;
}
