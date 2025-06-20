// Database optimization and performance utilities
import { neon, neonConfig } from '@netlify/neon';

// Configure Neon for optimal performance
neonConfig.fetchConnectionCache = true;
neonConfig.pipelineConnect = false;
neonConfig.useSecureWebSocket = true;

// Initialize optimized database connection
const sql = neon(process.env.DATABASE_URL);

/**
 * Database performance monitoring
 */
class DatabaseMonitor {
    constructor() {
        this.queryTimes = new Map();
        this.slowQueryThreshold = 1000; // 1 second
        this.errorCount = 0;
        this.totalQueries = 0;
    }

    startQuery(queryId) {
        this.queryTimes.set(queryId, Date.now());
        this.totalQueries++;
    }

    endQuery(queryId, queryText = '') {
        const startTime = this.queryTimes.get(queryId);
        if (startTime) {
            const duration = Date.now() - startTime;
            this.queryTimes.delete(queryId);
            
            if (duration > this.slowQueryThreshold) {
                console.warn(`🐌 Slow query detected (${duration}ms):`, queryText.substring(0, 100));
            }
            
            return duration;
        }
        return 0;
    }

    recordError() {
        this.errorCount++;
    }

    getStats() {
        return {
            totalQueries: this.totalQueries,
            errorCount: this.errorCount,
            errorRate: this.totalQueries > 0 ? (this.errorCount / this.totalQueries) * 100 : 0,
            activeQueries: this.queryTimes.size
        };
    }
}

const dbMonitor = new DatabaseMonitor();

/**
 * Optimized database query wrapper with monitoring
 */
export async function optimizedQuery(queryTemplate, ...params) {
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queryText = queryTemplate.strings.join('?');
    
    try {
        dbMonitor.startQuery(queryId);
        const result = await sql(queryTemplate, ...params);
        const duration = dbMonitor.endQuery(queryId, queryText);
        
        console.log(`✅ Query completed in ${duration}ms:`, queryText.substring(0, 50));
        return result;
    } catch (error) {
        dbMonitor.recordError();
        dbMonitor.endQuery(queryId, queryText);
        console.error('❌ Database query failed:', error.message, 'Query:', queryText.substring(0, 100));
        throw error;
    }
}

/**
 * Create database indexes for optimal performance
 */
export async function createOptimalIndexes() {
    try {
        console.log('🔧 Creating database indexes for optimal performance...');
        
        // Players table indexes
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_registration_session_id ON players(registration_session_id)`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_dota2id ON players(dota2id)`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_name_search ON players USING gin(to_tsvector('english', name))`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_mmr_desc ON players(peakmmr DESC NULLS LAST)`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_registration_date ON players(registration_date DESC)`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_ip_address ON players(ip_address)`;
        
        // Masterlist table indexes
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_masterlist_dota2id ON masterlist(dota2id)`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_masterlist_name_search ON masterlist USING gin(to_tsvector('english', name))`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_masterlist_mmr_desc ON masterlist(mmr DESC NULLS LAST)`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_masterlist_team ON masterlist(team)`;
        
        // Registration sessions indexes
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registration_sessions_session_id ON registration_sessions(session_id)`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registration_sessions_admin_user_id ON registration_sessions(admin_user_id)`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registration_sessions_active ON registration_sessions(is_active) WHERE is_active = true`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registration_sessions_created_at ON registration_sessions(created_at DESC)`;
        
        // Admin sessions indexes
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id)`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at)`;
        
        // Admin users indexes
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_users_username ON admin_users(username)`;
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_users_active ON admin_users(is_active) WHERE is_active = true`;
        
        // Registration settings indexes
        await sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registration_settings_is_open ON registration_settings(is_open) WHERE is_open = true`;
        
        console.log('✅ Database indexes created successfully');
        
    } catch (error) {
        console.error('❌ Error creating indexes:', error);
        // Don't throw error as indexes might already exist
    }
}

/**
 * Database maintenance and optimization
 */
export async function performDatabaseMaintenance() {
    try {
        console.log('🧹 Starting database maintenance...');
        
        // Clean up expired sessions
        const expiredSessions = await sql`
            DELETE FROM admin_sessions 
            WHERE expires_at < NOW()
        `;
        console.log(`🗑️ Cleaned up ${expiredSessions.length} expired sessions`);
        
        // Update player counts in registration sessions
        await sql`
            UPDATE registration_sessions 
            SET player_count = (
                SELECT COUNT(*) 
                FROM players 
                WHERE players.registration_session_id = registration_sessions.session_id
            )
        `;
        console.log('📊 Updated registration session player counts');
        
        // Analyze table statistics for query optimizer
        await sql`ANALYZE players`;
        await sql`ANALYZE masterlist`;
        await sql`ANALYZE registration_sessions`;
        await sql`ANALYZE admin_sessions`;
        await sql`ANALYZE admin_users`;
        
        console.log('📈 Updated table statistics for query optimizer');
        
        // Log database size and performance metrics
        const dbStats = await getDatabaseStats();
        console.log('📊 Database stats:', dbStats);
        
        console.log('✅ Database maintenance completed');
        
    } catch (error) {
        console.error('❌ Error during database maintenance:', error);
        throw error;
    }
}

/**
 * Get comprehensive database statistics
 */
export async function getDatabaseStats() {
    try {
        // Table sizes
        const tableSizes = await sql`
            SELECT 
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        `;
        
        // Index usage statistics
        const indexStats = await sql`
            SELECT 
                schemaname,
                tablename,
                indexname,
                idx_scan as index_scans,
                idx_tup_read as tuples_read,
                idx_tup_fetch as tuples_fetched
            FROM pg_stat_user_indexes 
            ORDER BY idx_scan DESC
            LIMIT 10
        `;
        
        // Database connection info
        const connectionInfo = await sql`
            SELECT 
                count(*) as active_connections,
                count(*) FILTER (WHERE state = 'active') as active_queries,
                count(*) FILTER (WHERE state = 'idle') as idle_connections
            FROM pg_stat_activity 
            WHERE datname = current_database()
        `;
        
        // Record counts
        const recordCounts = await sql`
            SELECT 
                'players' as table_name, COUNT(*) as record_count FROM players
            UNION ALL
            SELECT 'masterlist', COUNT(*) FROM masterlist
            UNION ALL
            SELECT 'registration_sessions', COUNT(*) FROM registration_sessions
            UNION ALL
            SELECT 'admin_users', COUNT(*) FROM admin_users
            UNION ALL
            SELECT 'admin_sessions', COUNT(*) FROM admin_sessions
        `;
        
        return {
            tableSizes,
            indexStats,
            connectionInfo: connectionInfo[0],
            recordCounts,
            monitorStats: dbMonitor.getStats()
        };
        
    } catch (error) {
        console.error('Error getting database stats:', error);
        return { error: error.message };
    }
}

/**
 * Database health check
 */
export async function performHealthCheck() {
    try {
        const healthCheck = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            checks: []
        };
        
        // Test basic connectivity
        try {
            await sql`SELECT 1 as test`;
            healthCheck.checks.push({ name: 'connectivity', status: 'pass', message: 'Database connection successful' });
        } catch (error) {
            healthCheck.checks.push({ name: 'connectivity', status: 'fail', message: error.message });
            healthCheck.status = 'unhealthy';
        }
        
        // Check critical tables exist
        const criticalTables = ['players', 'masterlist', 'admin_users', 'registration_sessions'];
        for (const table of criticalTables) {
            try {
                await sql`SELECT 1 FROM ${sql(table)} LIMIT 1`;
                healthCheck.checks.push({ name: `table_${table}`, status: 'pass', message: `Table ${table} accessible` });
            } catch (error) {
                healthCheck.checks.push({ name: `table_${table}`, status: 'fail', message: error.message });
                healthCheck.status = 'degraded';
            }
        }
        
        // Check for expired sessions
        const expiredSessionsCount = await sql`
            SELECT COUNT(*) as count 
            FROM admin_sessions 
            WHERE expires_at < NOW()
        `;
        
        if (expiredSessionsCount[0].count > 100) {
            healthCheck.checks.push({ 
                name: 'expired_sessions', 
                status: 'warn', 
                message: `${expiredSessionsCount[0].count} expired sessions need cleanup` 
            });
        } else {
            healthCheck.checks.push({ 
                name: 'expired_sessions', 
                status: 'pass', 
                message: `${expiredSessionsCount[0].count} expired sessions (normal)` 
            });
        }
        
        // Check database performance
        const monitorStats = dbMonitor.getStats();
        if (monitorStats.errorRate > 5) { // More than 5% error rate
            healthCheck.checks.push({ 
                name: 'error_rate', 
                status: 'warn', 
                message: `High error rate: ${monitorStats.errorRate.toFixed(2)}%` 
            });
            healthCheck.status = 'degraded';
        } else {
            healthCheck.checks.push({ 
                name: 'error_rate', 
                status: 'pass', 
                message: `Error rate: ${monitorStats.errorRate.toFixed(2)}%` 
            });
        }
        
        return healthCheck;
        
    } catch (error) {
        return {
            timestamp: new Date().toISOString(),
            status: 'unhealthy',
            error: error.message,
            checks: [{ name: 'health_check', status: 'fail', message: error.message }]
        };
    }
}

/**
 * Backup preparation (metadata and structure)
 */
export async function prepareBackupMetadata() {
    try {
        console.log('📦 Preparing backup metadata...');
        
        const metadata = {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            database: 'tournament_manager',
            tables: {}
        };
        
        // Get table schemas and row counts
        const tables = await sql`
            SELECT 
                table_name,
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        `;
        
        // Group by table
        for (const column of tables) {
            if (!metadata.tables[column.table_name]) {
                metadata.tables[column.table_name] = {
                    columns: [],
                    rowCount: 0
                };
            }
            metadata.tables[column.table_name].columns.push({
                name: column.column_name,
                type: column.data_type,
                nullable: column.is_nullable === 'YES',
                default: column.column_default
            });
        }
        
        // Get row counts
        for (const tableName of Object.keys(metadata.tables)) {
            try {
                const result = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`;
                metadata.tables[tableName].rowCount = parseInt(result[0].count);
            } catch (error) {
                metadata.tables[tableName].rowCount = -1; // Error getting count
            }
        }
        
        console.log('✅ Backup metadata prepared');
        return metadata;
        
    } catch (error) {
        console.error('❌ Error preparing backup metadata:', error);
        throw error;
    }
}

/**
 * Connection pool status (for monitoring)
 */
export function getConnectionPoolStatus() {
    return {
        type: 'neon_serverless',
        cacheEnabled: neonConfig.fetchConnectionCache,
        pipelineConnect: neonConfig.pipelineConnect,
        useSecureWebSocket: neonConfig.useSecureWebSocket,
        monitorStats: dbMonitor.getStats()
    };
}

// Export the optimized SQL instance and monitor
export { sql as optimizedSql, dbMonitor }; 