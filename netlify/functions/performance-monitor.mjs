// Performance monitoring and metrics collection
import { dbMonitor } from './database-optimization.mjs';

class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.requestCounts = new Map();
        this.responseTimes = new Map();
        this.errorCounts = new Map();
        this.startTime = Date.now();
        this.cleanupInterval = null;
        
        // Start cleanup process
        this.startCleanup();
    }

    /**
     * Start a performance measurement
     */
    startMeasurement(requestId, endpoint, method = 'unknown') {
        const measurement = {
            id: requestId,
            endpoint,
            method,
            startTime: Date.now(),
            startMemory: this.getMemoryUsage()
        };
        
        this.metrics.set(requestId, measurement);
        
        // Track request count
        const key = `${method}:${endpoint}`;
        this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);
        
        return measurement;
    }

    /**
     * End a performance measurement
     */
    endMeasurement(requestId, statusCode = 200, additionalData = {}) {
        const measurement = this.metrics.get(requestId);
        if (!measurement) {
            console.warn('Performance measurement not found for request:', requestId);
            return null;
        }

        const endTime = Date.now();
        const duration = endTime - measurement.startTime;
        const endMemory = this.getMemoryUsage();
        const memoryDelta = endMemory - measurement.startMemory;

        const completedMeasurement = {
            ...measurement,
            endTime,
            duration,
            endMemory,
            memoryDelta,
            statusCode,
            ...additionalData
        };

        // Store response time
        const key = `${measurement.method}:${measurement.endpoint}`;
        if (!this.responseTimes.has(key)) {
            this.responseTimes.set(key, []);
        }
        this.responseTimes.get(key).push(duration);

        // Track errors
        if (statusCode >= 400) {
            this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
        }

        // Log slow requests (>2 seconds)
        if (duration > 2000) {
            console.warn(`🐌 Slow request detected: ${key} took ${duration}ms`);
        }

        // Clean up measurement
        this.metrics.delete(requestId);

        return completedMeasurement;
    }

    /**
     * Get current memory usage
     */
    getMemoryUsage() {
        try {
            if (typeof process !== 'undefined' && process.memoryUsage) {
                const usage = process.memoryUsage();
                return {
                    rss: usage.rss,
                    heapUsed: usage.heapUsed,
                    heapTotal: usage.heapTotal,
                    external: usage.external
                };
            }
        } catch (error) {
            // Memory usage not available in this environment
        }
        return { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 };
    }

    /**
     * Get comprehensive performance statistics
     */
    getStatistics() {
        const now = Date.now();
        const uptime = now - this.startTime;
        
        const stats = {
            uptime,
            timestamp: new Date().toISOString(),
            requests: {
                total: Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0),
                byEndpoint: Object.fromEntries(this.requestCounts),
                errors: Object.fromEntries(this.errorCounts),
                errorRate: this.calculateErrorRate()
            },
            responseTimes: this.calculateResponseTimeStats(),
            memory: this.getMemoryUsage(),
            activeRequests: this.metrics.size,
            database: dbMonitor ? dbMonitor.getStats() : null
        };

        return stats;
    }

    /**
     * Calculate error rate
     */
    calculateErrorRate() {
        const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);
        const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
        
        return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    }

    /**
     * Calculate response time statistics
     */
    calculateResponseTimeStats() {
        const stats = {};
        
        for (const [endpoint, times] of this.responseTimes.entries()) {
            if (times.length === 0) continue;
            
            const sorted = [...times].sort((a, b) => a - b);
            const sum = sorted.reduce((a, b) => a + b, 0);
            
            stats[endpoint] = {
                count: sorted.length,
                min: sorted[0],
                max: sorted[sorted.length - 1],
                average: Math.round(sum / sorted.length),
                median: sorted[Math.floor(sorted.length / 2)],
                p95: sorted[Math.floor(sorted.length * 0.95)],
                p99: sorted[Math.floor(sorted.length * 0.99)]
            };
        }
        
        return stats;
    }

    /**
     * Get health metrics for monitoring
     */
    getHealthMetrics() {
        const stats = this.getStatistics();
        const errorRate = stats.requests.errorRate;
        const avgResponseTime = this.getOverallAverageResponseTime();
        
        return {
            status: this.determineHealthStatus(errorRate, avgResponseTime),
            errorRate,
            avgResponseTime,
            activeRequests: stats.activeRequests,
            uptime: stats.uptime,
            memoryUsage: stats.memory.heapUsed || 0
        };
    }

    /**
     * Determine overall health status
     */
    determineHealthStatus(errorRate, avgResponseTime) {
        if (errorRate > 10 || avgResponseTime > 5000) {
            return 'unhealthy';
        } else if (errorRate > 5 || avgResponseTime > 2000) {
            return 'degraded';
        } else {
            return 'healthy';
        }
    }

    /**
     * Get overall average response time
     */
    getOverallAverageResponseTime() {
        const allTimes = [];
        for (const times of this.responseTimes.values()) {
            allTimes.push(...times);
        }
        
        if (allTimes.length === 0) return 0;
        
        const sum = allTimes.reduce((a, b) => a + b, 0);
        return Math.round(sum / allTimes.length);
    }

    /**
     * Start cleanup process to prevent memory leaks
     */
    startCleanup() {
        // Clean up old data every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 5 * 60 * 1000);
    }

    /**
     * Perform cleanup of old metrics
     */
    performCleanup() {
        console.log('🧹 Performing performance metrics cleanup...');
        
        // Keep only last 1000 response times per endpoint
        for (const [endpoint, times] of this.responseTimes.entries()) {
            if (times.length > 1000) {
                this.responseTimes.set(endpoint, times.slice(-1000));
            }
        }
        
        // Clean up stale measurements (older than 5 minutes)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        for (const [id, measurement] of this.metrics.entries()) {
            if (measurement.startTime < fiveMinutesAgo) {
                console.warn(`⚠️ Cleaning up stale measurement: ${id}`);
                this.metrics.delete(id);
            }
        }
        
        console.log(`🧹 Cleanup completed. Active metrics: ${this.metrics.size}`);
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics.clear();
        this.requestCounts.clear();
        this.responseTimes.clear();
        this.errorCounts.clear();
        this.startTime = Date.now();
        
        console.log('📊 Performance metrics reset');
    }

    /**
     * Stop monitoring and cleanup
     */
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        this.reset();
        console.log('🛑 Performance monitoring stopped');
    }
}

// Create global performance monitor instance
const performanceMonitor = new PerformanceMonitor();

/**
 * Middleware function for automatic performance tracking
 */
export function withPerformanceTracking(handler, endpoint) {
    return async (event, context) => {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const method = event.httpMethod || 'UNKNOWN';
        
        // Start measurement
        performanceMonitor.startMeasurement(requestId, endpoint, method);
        
        try {
            const result = await handler(event, context);
            
            // End measurement with success
            performanceMonitor.endMeasurement(requestId, result.statusCode || 200, {
                success: true,
                responseSize: result.body ? result.body.length : 0
            });
            
            return result;
            
        } catch (error) {
            // End measurement with error
            performanceMonitor.endMeasurement(requestId, 500, {
                success: false,
                error: error.message
            });
            
            throw error;
        }
    };
}

/**
 * Get current performance statistics
 */
export function getPerformanceStats() {
    return performanceMonitor.getStatistics();
}

/**
 * Get health metrics
 */
export function getHealthMetrics() {
    return performanceMonitor.getHealthMetrics();
}

/**
 * Reset performance metrics
 */
export function resetPerformanceMetrics() {
    performanceMonitor.reset();
}

/**
 * Manual measurement functions
 */
export function startMeasurement(requestId, endpoint, method) {
    return performanceMonitor.startMeasurement(requestId, endpoint, method);
}

export function endMeasurement(requestId, statusCode, additionalData) {
    return performanceMonitor.endMeasurement(requestId, statusCode, additionalData);
}

// Export the monitor instance for advanced usage
export { performanceMonitor };

// Cleanup on process exit (for Node.js environments)
if (typeof process !== 'undefined') {
    process.on('exit', () => {
        performanceMonitor.stop();
    });
    
    process.on('SIGINT', () => {
        performanceMonitor.stop();
        process.exit(0);
    });
} 