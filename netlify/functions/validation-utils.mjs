// Input validation utilities for security and data integrity

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized string
 */
export function sanitizeHtml(input) {
    if (typeof input !== 'string') return '';
    // Simple HTML tag removal
    return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Validate and sanitize string input
 * @param {string} input - Input to validate
 * @param {object} options - Validation options
 * @returns {object} - Validation result
 */
export function validateString(input, options = {}) {
    const {
        required = false,
        minLength = 0,
        maxLength = 1000,
        pattern = null,
        allowedChars = null,
        fieldName = 'Field'
    } = options;

    const result = { isValid: true, value: '', errors: [] };

    // Check if required
    if (required && (!input || input.trim().length === 0)) {
        result.isValid = false;
        result.errors.push(`${fieldName} is required`);
        return result;
    }

    // If not required and empty, return early
    if (!input || input.trim().length === 0) {
        result.value = '';
        return result;
    }

    // Convert to string and trim
    const sanitized = sanitizeHtml(String(input).trim());
    result.value = sanitized;

    // Length validation
    if (sanitized.length < minLength) {
        result.isValid = false;
        result.errors.push(`${fieldName} must be at least ${minLength} characters long`);
    }

    if (sanitized.length > maxLength) {
        result.isValid = false;
        result.errors.push(`${fieldName} must be no more than ${maxLength} characters long`);
    }

    // Pattern validation
    if (pattern && !pattern.test(sanitized)) {
        result.isValid = false;
        result.errors.push(`${fieldName} format is invalid`);
    }

    // Allowed characters validation
    if (allowedChars && !allowedChars.test(sanitized)) {
        result.isValid = false;
        result.errors.push(`${fieldName} contains invalid characters`);
    }

    return result;
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @param {boolean} required - Whether email is required
 * @returns {object} - Validation result
 */
export function validateEmail(email, required = false) {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    return validateString(email, {
        required,
        maxLength: 254,
        pattern: emailPattern,
        fieldName: 'Email'
    });
}

/**
 * Validate username
 * @param {string} username - Username to validate
 * @param {boolean} required - Whether username is required
 * @returns {object} - Validation result
 */
export function validateUsername(username, required = true) {
    const usernamePattern = /^[a-zA-Z0-9_-]+$/;
    
    return validateString(username, {
        required,
        minLength: 3,
        maxLength: 30,
        pattern: usernamePattern,
        fieldName: 'Username'
    });
}

/**
 * Validate player name
 * @param {string} name - Player name to validate
 * @param {boolean} required - Whether name is required
 * @returns {object} - Validation result
 */
export function validatePlayerName(name, required = true) {
    // Allow letters, numbers, spaces, basic punctuation for player names
    const namePattern = /^[a-zA-Z0-9\s\-_.()[\]]+$/;
    
    return validateString(name, {
        required,
        minLength: 1,
        maxLength: 50,
        pattern: namePattern,
        fieldName: 'Player name'
    });
}

/**
 * Validate Dota 2 ID
 * @param {string} dota2id - Dota 2 ID to validate
 * @param {boolean} required - Whether ID is required
 * @returns {object} - Validation result
 */
export function validateDota2Id(dota2id, required = false) {
    // Dota 2 IDs can be various formats (Steam ID, custom names, etc.)
    const dota2Pattern = /^[a-zA-Z0-9\-_.[\]]+$/;
    
    return validateString(dota2id, {
        required,
        minLength: 1,
        maxLength: 50,
        pattern: dota2Pattern,
        fieldName: 'Dota 2 ID'
    });
}

/**
 * Validate MMR value
 * @param {string|number} mmr - MMR to validate
 * @param {boolean} required - Whether MMR is required
 * @returns {object} - Validation result
 */
export function validateMmr(mmr, required = false) {
    const result = { isValid: true, value: 0, errors: [] };

    // Check if required
    if (required && (mmr === null || mmr === undefined || mmr === '')) {
        result.isValid = false;
        result.errors.push('MMR is required');
        return result;
    }

    // If not required and empty, return 0
    if (mmr === null || mmr === undefined || mmr === '') {
        result.value = 0;
        return result;
    }

    // Convert to number
    const numericMmr = parseInt(mmr, 10);

    // Check if valid number
    if (isNaN(numericMmr)) {
        result.isValid = false;
        result.errors.push('MMR must be a valid number');
        return result;
    }

    // Range validation (typical Dota 2 MMR range)
    if (numericMmr < 0) {
        result.isValid = false;
        result.errors.push('MMR cannot be negative');
    }

    if (numericMmr > 15000) {
        result.isValid = false;
        result.errors.push('MMR cannot exceed 15,000');
    }

    result.value = numericMmr;
    return result;
}

/**
 * Validate session title
 * @param {string} title - Session title to validate
 * @param {boolean} required - Whether title is required
 * @returns {object} - Validation result
 */
export function validateSessionTitle(title, required = true) {
    // Allow letters, numbers, spaces, and common punctuation for titles
    const titlePattern = /^[a-zA-Z0-9\s\-_.()[\]#&!]+$/;
    
    return validateString(title, {
        required,
        minLength: 3,
        maxLength: 100,
        pattern: titlePattern,
        fieldName: 'Session title'
    });
}

/**
 * Validate IP address (basic format check)
 * @param {string} ip - IP address to validate
 * @param {boolean} required - Whether IP is required
 * @returns {object} - Validation result
 */
export function validateIpAddress(ip, required = false) {
    // Basic IPv4 pattern (can be extended for IPv6)
    const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    return validateString(ip, {
        required,
        pattern: ipPattern,
        fieldName: 'IP address'
    });
}

/**
 * Validate session ID format
 * @param {string} sessionId - Session ID to validate
 * @param {boolean} required - Whether session ID is required
 * @returns {object} - Validation result
 */
export function validateSessionId(sessionId, required = false) {
    // Session ID should be alphanumeric with underscores/hyphens
    const sessionPattern = /^[a-zA-Z0-9_-]+$/;
    
    return validateString(sessionId, {
        required,
        minLength: 10,
        maxLength: 100,
        pattern: sessionPattern,
        fieldName: 'Session ID'
    });
}

/**
 * Validate role
 * @param {string} role - Role to validate
 * @param {boolean} required - Whether role is required
 * @returns {object} - Validation result
 */
export function validateRole(role, required = true) {
    const validRoles = ['admin', 'superadmin', 'moderator'];
    const result = { isValid: true, value: '', errors: [] };

    if (required && (!role || role.trim().length === 0)) {
        result.isValid = false;
        result.errors.push('Role is required');
        return result;
    }

    if (role && !validRoles.includes(role.trim().toLowerCase())) {
        result.isValid = false;
        result.errors.push(`Role must be one of: ${validRoles.join(', ')}`);
        return result;
    }

    result.value = role ? role.trim().toLowerCase() : '';
    return result;
}

/**
 * Validate boolean value
 * @param {any} value - Value to validate as boolean
 * @param {any} defaultValue - Default value if validation fails
 * @returns {boolean} - Validated boolean value
 */
export function validateBoolean(value, defaultValue = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    return defaultValue;
}

/**
 * Validate complete player object
 * @param {object} player - Player object to validate
 * @param {boolean} isUpdate - Whether this is an update (allows partial data)
 * @returns {object} - Validation result with sanitized player data
 */
export function validatePlayer(player, isUpdate = false) {
    const result = { isValid: true, player: {}, errors: [] };

    if (!player || typeof player !== 'object') {
        result.isValid = false;
        result.errors.push('Invalid player data');
        return result;
    }

    // Validate name
    const nameValidation = validatePlayerName(player.name, !isUpdate);
    if (!nameValidation.isValid) {
        result.isValid = false;
        result.errors.push(...nameValidation.errors);
    } else {
        result.player.name = nameValidation.value;
    }

    // Validate Dota 2 ID
    const dota2IdValidation = validateDota2Id(player.dota2id, false);
    if (!dota2IdValidation.isValid) {
        result.isValid = false;
        result.errors.push(...dota2IdValidation.errors);
    } else {
        result.player.dota2id = dota2IdValidation.value;
    }

    // Validate MMR
    const mmrValidation = validateMmr(player.peakmmr || player.mmr, false);
    if (!mmrValidation.isValid) {
        result.isValid = false;
        result.errors.push(...mmrValidation.errors);
    } else {
        result.player.peakmmr = mmrValidation.value;
    }

    // Validate IP (if provided)
    if (player.ip) {
        const ipValidation = validateIpAddress(player.ip, false);
        if (!ipValidation.isValid) {
            result.isValid = false;
            result.errors.push(...ipValidation.errors);
        } else {
            result.player.ip = ipValidation.value;
        }
    }

    return result;
}

/**
 * Sanitize request body for logging (remove sensitive data)
 * @param {object} data - Data to sanitize
 * @returns {object} - Sanitized data safe for logging
 */
export function sanitizeForLogging(data) {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const sensitiveFields = ['password', 'currentPassword', 'newPassword', 'confirmPassword', 'password_hash', 'token', 'sessionId'];

    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });

    return sanitized;
}

/**
 * Rate limiting helper (simple in-memory implementation)
 * In production, use Redis or similar
 */
const rateLimitStore = new Map();

export function checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimitStore.has(identifier)) {
        rateLimitStore.set(identifier, []);
    }
    
    const requests = rateLimitStore.get(identifier);
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(time => time > windowStart);
    
    if (recentRequests.length >= maxRequests) {
        return {
            allowed: false,
            retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
        };
    }
    
    // Add current request
    recentRequests.push(now);
    rateLimitStore.set(identifier, recentRequests);
    
    return {
        allowed: true,
        remaining: maxRequests - recentRequests.length
    };
}

/**
 * Convert PH time to UTC with validation
 * @param {string} phTime - Time string in YYYY-MM-DDTHH:mm format
 * @returns {string} UTC ISO string
 */
export function convertPHTimeToUTC(phTime) {
    if (!phTime) {
        throw new Error('Time is required');
    }
    
    try {
        // Simple conversion: assume PH time is UTC+8
        const date = new Date(phTime);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid time format');
        }
        
        // Convert to UTC by subtracting 8 hours
        const utcDate = new Date(date.getTime() - (8 * 60 * 60 * 1000));
        return utcDate.toISOString();
    } catch (error) {
        throw new Error(`Invalid time format: ${error.message}. Please use YYYY-MM-DDTHH:mm format.`);
    }
}

/**
 * Validate that a date is in the future
 * @param {string} dateString - ISO date string
 * @returns {boolean} true if valid future date
 */
export function validateFutureDate(dateString) {
    if (!dateString) {
        throw new Error('Date is required');
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
    }
    
    const now = new Date();
    if (date <= now) {
        throw new Error('Date must be in the future');
    }
    
    return true;
}

/**
 * Validate that end time is after start time
 * @param {string} startTime - ISO date string
 * @param {string} endTime - ISO date string
 * @returns {boolean} true if valid
 */
export function validateTimeRange(startTime, endTime) {
    if (!startTime || !endTime) {
        throw new Error('Both start and end times are required');
    }
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid time format');
    }
    
    if (end <= start) {
        throw new Error('End time must be after start time');
    }
    
    return true;
}

/**
 * Format date for display with timezone
 * @param {string} dateString - ISO date string
 * @param {string} timezone - Timezone (default: 'Asia/Manila')
 * @returns {string} Formatted date string
 */
export function formatDateForDisplay(dateString, timezone = 'Asia/Manila') {
    if (!dateString) {
        return 'N/A';
    }
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        
        // Simple formatting without timezone conversion
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid date';
    }
}

/**
 * Get current time in specified timezone
 * @param {string} timezone - Timezone (default: 'Asia/Manila')
 * @returns {string} ISO string in specified timezone
 */
export function getCurrentTimeInTimezone(timezone = 'Asia/Manila') {
    try {
        return new Date().toISOString();
    } catch (error) {
        console.error('Error getting current time in timezone:', error);
        return new Date().toISOString();
    }
}

/**
 * Validate session expiry date
 * @param {string} expiryDate - ISO date string
 * @returns {boolean} true if valid
 */
export function validateSessionExpiry(expiryDate) {
    if (!expiryDate) {
        throw new Error('Expiry date is required');
    }
    
    const date = new Date(expiryDate);
    if (isNaN(date.getTime())) {
        throw new Error('Invalid expiry date format');
    }
    
    return true;
} 