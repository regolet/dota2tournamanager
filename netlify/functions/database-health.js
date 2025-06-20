// Database health monitoring API
import { 
    performHealthCheck, 
    getDatabaseStats, 
    performDatabaseMaintenance,
    createOptimalIndexes,
    prepareBackupMetadata,
    getConnectionPoolStatus
} from './database-optimization.js';
import { validateSession } from './database.js';
import { 
    createSuccessResponse, 
    createErrorResponse, 
    getCorsPreflightResponse,
    validateHttpMethod,
    getClientIP
} from './security-utils.js';
import { checkRateLimit } from './validation-utils.js';

export const handler = async (event, context) => {
    try {
        // Handle CORS preflight
        if (event.httpMethod === 'OPTIONS') {
            return getCorsPreflightResponse();
        }

        // Validate HTTP method
        const methodValidation = validateHttpMethod(event.httpMethod, ['GET', 'POST']);
        if (!methodValidation.isValid) {
            return createErrorResponse(405, methodValidation.error);
        }

        // Rate limiting for database operations
        const clientIP = getClientIP(event.headers);
        const rateLimit = checkRateLimit(`db-health-${clientIP}`, 10, 60000); // 10 requests per minute
        
        if (!rateLimit.allowed) {
            console.warn(`Database health rate limit exceeded for IP: ${clientIP}`);
            return createErrorResponse(429, 'Too many database health requests', {
                retryAfter: rateLimit.retryAfter
            });
        }

        // Check authentication for admin-only endpoint
        const sessionId = event.headers['x-session-id'] || event.headers['X-Session-Id'];
        if (!sessionId) {
            return createErrorResponse(401, 'Authentication required');
        }

        const sessionValidation = await validateSession(sessionId);
        if (!sessionValidation.valid) {
            return createErrorResponse(401, 'Invalid or expired session');
        }

        // Only allow admin or superadmin roles
        if (!['admin', 'superadmin'].includes(sessionValidation.role)) {
            return createErrorResponse(403, 'Insufficient permissions');
        }

        const { action } = event.queryStringParameters || {};

        switch (event.httpMethod) {
            case 'GET':
                return await handleHealthCheckGet(action, sessionValidation);
            case 'POST':
                return await handleHealthCheckPost(action, event.body, sessionValidation);
            default:
                return createErrorResponse(405, 'Method not allowed');
        }

    } catch (error) {
        console.error('Database health API error:', error);
        return createErrorResponse(500, 'Internal server error', {
            message: error.message
        });
    }
};

/**
 * Handle GET requests for health monitoring
 */
async function handleHealthCheckGet(action, sessionValidation) {
    try {
        switch (action) {
            case 'status':
                const healthCheck = await performHealthCheck();
                return createSuccessResponse({
                    health: healthCheck
                }, 'Database health check completed');

            case 'stats':
                const stats = await getDatabaseStats();
                return createSuccessResponse({
                    stats: stats
                }, 'Database statistics retrieved');

            case 'connection':
                const connectionStatus = getConnectionPoolStatus();
                return createSuccessResponse({
                    connection: connectionStatus
                }, 'Connection status retrieved');

            case 'backup-metadata':
                const backupMetadata = await prepareBackupMetadata();
                return createSuccessResponse({
                    backup: backupMetadata
                }, 'Backup metadata prepared');

            default:
                // Default: comprehensive health report
                const [health, dbStats, connection] = await Promise.all([
                    performHealthCheck(),
                    getDatabaseStats(),
                    Promise.resolve(getConnectionPoolStatus())
                ]);

                return createSuccessResponse({
                    health,
                    stats: dbStats,
                    connection,
                    timestamp: new Date().toISOString()
                }, 'Comprehensive database health report');
        }

    } catch (error) {
        console.error('Health check GET error:', error);
        return createErrorResponse(500, 'Failed to retrieve health information', {
            action,
            error: error.message
        });
    }
}

/**
 * Handle POST requests for database maintenance
 */
async function handleHealthCheckPost(action, requestBody, sessionValidation) {
    try {
        // Only superadmin can perform maintenance operations
        if (sessionValidation.role !== 'superadmin') {
            return createErrorResponse(403, 'Superadmin privileges required for maintenance operations');
        }

        let body = {};
        if (requestBody) {
            try {
                body = JSON.parse(requestBody);
            } catch (parseError) {
                return createErrorResponse(400, 'Invalid JSON in request body');
            }
        }

        switch (action) {
            case 'maintenance':
                console.log(`🔧 Database maintenance initiated by user: ${sessionValidation.userId}`);
                await performDatabaseMaintenance();
                
                // Get updated stats after maintenance
                const postMaintenanceStats = await getDatabaseStats();
                
                return createSuccessResponse({
                    message: 'Database maintenance completed successfully',
                    stats: postMaintenanceStats
                }, 'Database maintenance completed');

            case 'optimize-indexes':
                console.log(`🔧 Index optimization initiated by user: ${sessionValidation.userId}`);
                await createOptimalIndexes();
                
                return createSuccessResponse({
                    message: 'Database indexes optimized successfully'
                }, 'Index optimization completed');

            case 'analyze':
                console.log(`📊 Database analysis initiated by user: ${sessionValidation.userId}`);
                const analysisResults = await getDatabaseStats();
                
                return createSuccessResponse({
                    analysis: analysisResults,
                    recommendations: generateOptimizationRecommendations(analysisResults)
                }, 'Database analysis completed');

            default:
                return createErrorResponse(400, 'Invalid maintenance action', {
                    validActions: ['maintenance', 'optimize-indexes', 'analyze']
                });
        }

    } catch (error) {
        console.error('Health check POST error:', error);
        return createErrorResponse(500, 'Maintenance operation failed', {
            action,
            error: error.message
        });
    }
}

/**
 * Generate optimization recommendations based on database stats
 */
function generateOptimizationRecommendations(stats) {
    const recommendations = [];

    try {
        // Check for large tables without proper indexing
        if (stats.tableSizes) {
            for (const table of stats.tableSizes) {
                if (table.size_bytes > 10000000) { // 10MB+
                    recommendations.push({
                        type: 'performance',
                        priority: 'medium',
                        message: `Large table detected: ${table.tablename} (${table.size}). Consider archiving old data or optimizing queries.`
                    });
                }
            }
        }

        // Check index usage
        if (stats.indexStats) {
            const unusedIndexes = stats.indexStats.filter(idx => idx.index_scans === 0);
            if (unusedIndexes.length > 0) {
                recommendations.push({
                    type: 'optimization',
                    priority: 'low',
                    message: `${unusedIndexes.length} unused indexes detected. Consider removing them to improve write performance.`
                });
            }
        }

        // Check error rate
        if (stats.monitorStats && stats.monitorStats.errorRate > 1) {
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                message: `High error rate detected: ${stats.monitorStats.errorRate.toFixed(2)}%. Review application logs for database errors.`
            });
        }

        // Check connection usage
        if (stats.connectionInfo) {
            const activeConnections = stats.connectionInfo.active_connections;
            if (activeConnections > 80) { // Arbitrary threshold
                recommendations.push({
                    type: 'scalability',
                    priority: 'medium',
                    message: `High connection count: ${activeConnections}. Consider implementing connection pooling.`
                });
            }
        }

        // Default recommendation if everything looks good
        if (recommendations.length === 0) {
            recommendations.push({
                type: 'maintenance',
                priority: 'low',
                message: 'Database appears to be running optimally. Continue regular maintenance schedules.'
            });
        }

    } catch (error) {
        console.error('Error generating recommendations:', error);
        recommendations.push({
            type: 'error',
            priority: 'low',
            message: 'Unable to generate recommendations due to analysis error.'
        });
    }

    return recommendations;
}

/**
 * Validate maintenance request parameters
 */
function validateMaintenanceRequest(action, body) {
    const validActions = ['maintenance', 'optimize-indexes', 'analyze'];
    
    if (!validActions.includes(action)) {
        return {
            isValid: false,
            error: `Invalid action. Valid actions: ${validActions.join(', ')}`
        };
    }

    // Add specific validation for each action if needed
    switch (action) {
        case 'maintenance':
            // Could add parameters like 'tables' to specify which tables to maintain
            break;
        case 'optimize-indexes':
            // Could add parameters like 'recreate' to force index recreation
            break;
        case 'analyze':
            // Could add parameters like 'deep' for more thorough analysis
            break;
    }

    return { isValid: true };
} 