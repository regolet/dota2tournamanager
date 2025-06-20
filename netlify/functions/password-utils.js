// Password utilities for secure authentication
import bcrypt from 'bcrypt';

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
export async function hashPassword(password) {
    try {
        const saltRounds = 12; // Higher rounds = more secure but slower
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        return hashedPassword;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw new Error('Failed to hash password');
    }
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password from database
 * @returns {Promise<boolean>} - True if password matches
 */
export async function verifyPassword(password, hash) {
    try {
        const isValid = await bcrypt.compare(password, hash);
        return isValid;
    } catch (error) {
        console.error('Error verifying password:', error);
        throw new Error('Failed to verify password');
    }
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - Validation result with isValid and messages
 */
export function validatePasswordStrength(password) {
    const result = {
        isValid: true,
        messages: []
    };

    if (!password || password.length < 8) {
        result.isValid = false;
        result.messages.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
        result.isValid = false;
        result.messages.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        result.isValid = false;
        result.messages.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
        result.isValid = false;
        result.messages.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        result.isValid = false;
        result.messages.push('Password must contain at least one special character');
    }

    if (password.length > 128) {
        result.isValid = false;
        result.messages.push('Password must be less than 128 characters');
    }

    return result;
}

/**
 * Generate a random secure password
 * @param {number} length - Length of password (default: 16)
 * @returns {string} - Generated password
 */
export function generateSecurePassword(length = 16) {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
} 