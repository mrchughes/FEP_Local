// backend/utils/encryption.js
const crypto = require('crypto');

// Environment variables or use default for development (should be set properly in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a-secure-32-byte-key-for-development'; // 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypts text using AES-256-CBC with a random initialization vector
 * @param {string} text - The text to encrypt
 * @returns {string} - The encrypted text as a base64 string with IV prepended
 */
function encrypt(text) {
    if (!text) return null;

    try {
        // Create a random initialization vector
        const iv = crypto.randomBytes(IV_LENGTH);

        // Create cipher using the encryption key and initialization vector
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);

        // Encrypt the text
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        // Prepend the IV to the encrypted text (we'll need it for decryption)
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error.message);
        return null;
    }
}

/**
 * Decrypts text that was encrypted with the encrypt function
 * @param {string} encryptedText - The encrypted text with IV prepended
 * @returns {string} - The decrypted text
 */
function decrypt(encryptedText) {
    if (!encryptedText) return null;

    try {
        // Split the encrypted text to get the IV and the actual encrypted content
        const textParts = encryptedText.split(':');
        if (textParts.length !== 2) {
            throw new Error('Invalid encrypted text format');
        }

        const iv = Buffer.from(textParts[0], 'hex');
        const encryptedData = textParts[1];

        // Create decipher using the encryption key and initialization vector
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);

        // Decrypt the text
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error.message);
        return null;
    }
}

module.exports = {
    encrypt,
    decrypt
};
