// Security utilities for HTTP headers and protection
import crypto from 'crypto';

/**
 * Generate a cryptographically secure nonce for CSP
 * @returns {string} - Random nonce string
 */
export function generateNonce() {
    return crypto.randomBytes(16).toString('base64');
}

/**
 * Get comprehensive security headers for API responses
 * @param {object} options - Security options
 * @returns {object} - Security headers object
 */
export function getSecurityHeaders(options = {}) {
    const {
        allowOrigin = '*', // In production, should be specific domains
        contentType = 'application/json',
        allowCredentials = false,
        allowMethods = 'GET, POST, PUT, DELETE, OPTIONS',
        allowHeaders = 'Content-Type, Authorization, X-Session-Id, X-Requested-With',
        maxAge = 86400 // 24 hours for preflight cache
    } = options;

    const headers = {
        // CORS headers
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': allowMethods,
        'Access-Control-Allow-Headers': allowHeaders,
        'Access-Control-Max-Age': maxAge.toString(),
        
        // Security headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
        
        // Content headers
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    };

    // Add credentials header if needed
    if (allowCredentials) {
        headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // For API endpoints, add additional security
    if (contentType === 'application/json') {
        headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
        headers['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none';";
    }

    return headers;
}

/**
 * Get CORS preflight response
 * @param {object} options - CORS options
 * @returns {object} - HTTP response object for CORS preflight
 */
export function getCorsPreflightResponse(options = {}) {
    return {
        statusCode: 200,
        headers: getSecurityHeaders(options),
        body: ''
    };
}

/**
 * Standardized error response with security headers
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {object} additionalData - Additional error data
 * @param {object} headerOptions - Header options
 * @returns {object} - HTTP response object
 */
export function createErrorResponse(statusCode, message, additionalData = {}, headerOptions = {}) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const errorBody = {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        ...additionalData
    };

    // Only include sensitive debugging info in development
    if (!isDevelopment) {
        delete errorBody.stack;
        delete errorBody.details;
    }

    return {
        statusCode,
        headers: getSecurityHeaders(headerOptions),
        body: JSON.stringify(errorBody)
    };
}

/**
 * Standardized success response with security headers
 * @param {object} data - Response data
 * @param {string} message - Success message
 * @param {object} headerOptions - Header options
 * @returns {object} - HTTP response object
 */
export function createSuccessResponse(data = {}, message = 'Success', headerOptions = {}) {
    const responseBody = {
        success: true,
        message,
        timestamp: new Date().toISOString(),
        ...data
    };

    return {
        statusCode: 200,
        headers: getSecurityHeaders(headerOptions),
        body: JSON.stringify(responseBody)
    };
}

/**
 * Validate and sanitize HTTP method
 * @param {string} method - HTTP method
 * @param {string[]} allowedMethods - Array of allowed methods
 * @returns {object} - Validation result
 */
export function validateHttpMethod(method, allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
    if (!method || typeof method !== 'string') {
        return {
            isValid: false,
            error: 'Missing or invalid HTTP method'
        };
    }

    const upperMethod = method.toUpperCase();
    if (!allowedMethods.includes(upperMethod)) {
        return {
            isValid: false,
            error: `Method ${upperMethod} not allowed. Allowed methods: ${allowedMethods.join(', ')}`
        };
    }

    return {
        isValid: true,
        method: upperMethod
    };
}

/**
 * Extract and validate client IP address
 * @param {object} headers - Request headers
 * @returns {string} - Client IP address
 */
export function getClientIP(headers) {
    // Priority order for IP detection
    const ipHeaders = [
        'x-forwarded-for',
        'cf-connecting-ip',      // Cloudflare
        'x-real-ip',            // nginx
        'x-client-ip',          // Apache
        'forwarded',            // RFC 7239
        'x-cluster-client-ip'   // AWS ELB
    ];

    for (const header of ipHeaders) {
        const value = headers[header] || headers[header.toLowerCase()];
        if (value) {
            // Handle comma-separated IPs (take the first one)
            const ip = value.split(',')[0].trim();
            if (isValidIP(ip)) {
                return ip;
            }
        }
    }

    return 'unknown';
}

/**
 * Basic IP address validation
 * @param {string} ip - IP address to validate
 * @returns {boolean} - Whether IP is valid
 */
function isValidIP(ip) {
    // Basic IPv4 validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // Basic IPv6 validation (simplified)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === '::1' || ip === 'localhost';
}

/**
 * Create audit log entry
 * @param {string} action - Action performed
 * @param {string} userId - User ID (if authenticated)
 * @param {string} ip - Client IP
 * @param {object} metadata - Additional metadata
 * @returns {object} - Audit log entry
 */
export function createAuditLog(action, userId = null, ip = 'unknown', metadata = {}) {
    return {
        timestamp: new Date().toISOString(),
        action,
        userId,
        ip,
        metadata,
        logId: crypto.randomUUID()
    };
}

/**
 * Detect potential security threats in request
 * @param {object} event - Lambda event object
 * @returns {object} - Threat analysis result
 */
export function detectThreats(event) {
    const threats = [];
    const { headers, body, queryStringParameters } = event;
    
    // Check for common injection patterns
    const injectionPatterns = [
        /<script[^>]*>/i,
        /javascript:/i,
        /vbscript:/i,
        /on\w+\s*=/i,
        /union\s+select/i,
        /drop\s+table/i,
        /insert\s+into/i,
        /delete\s+from/i,
        /update\s+\w+\s+set/i,
        /'.*or.*'/i,
        /".*or.*"/i
    ];
    
    // Check body for threats
    if (body) {
        for (const pattern of injectionPatterns) {
            if (pattern.test(body)) {
                threats.push({
                    type: 'injection_attempt',
                    location: 'body',
                    pattern: pattern.toString()
                });
            }
        }
    }
    
    // Check query parameters for threats
    if (queryStringParameters) {
        for (const [key, value] of Object.entries(queryStringParameters)) {
            for (const pattern of injectionPatterns) {
                if (pattern.test(value)) {
                    threats.push({
                        type: 'injection_attempt',
                        location: `query.${key}`,
                        pattern: pattern.toString()
                    });
                }
            }
        }
    }
    
    // Check for suspicious headers
    const suspiciousHeaders = ['x-forwarded-host', 'host'];
    for (const header of suspiciousHeaders) {
        const value = headers[header];
        if (value && !/^[a-zA-Z0-9.-]+$/.test(value)) {
            threats.push({
                type: 'suspicious_header',
                location: `headers.${header}`,
                value: value
            });
        }
    }
    
    return {
        hasThreat: threats.length > 0,
        threats,
        riskLevel: threats.length === 0 ? 'low' : threats.length < 3 ? 'medium' : 'high'
    };
}

/**
 * Rate limiting response helper
 * @param {number} retryAfter - Seconds to retry after
 * @param {object} headerOptions - Header options
 * @returns {object} - Rate limit response
 */
export function createRateLimitResponse(retryAfter, headerOptions = {}) {
    return {
        statusCode: 429,
        headers: {
            ...getSecurityHeaders(headerOptions),
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': '10', // Could be dynamic
            'X-RateLimit-Remaining': '0'
        },
        body: JSON.stringify({
            success: false,
            error: 'Rate limit exceeded',
            retryAfter,
            timestamp: new Date().toISOString()
        })
    };
} 