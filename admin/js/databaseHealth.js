// Database Health Monitoring Dashboard
(function() {
    'use strict';

    let healthCheckInterval;
    let lastHealthCheck = null;

    /**
     * Initialize database health monitoring
     */
    function initDatabaseHealth() {
        console.log('🔧 Initializing database health monitoring...');
        
        // Set up periodic health checks (every 5 minutes)
        startPeriodicHealthChecks();
        
        // Initial health check
        performHealthCheck();
        
        console.log('✅ Database health monitoring initialized');
    }

    /**
     * Start periodic health checks
     */
    function startPeriodicHealthChecks() {
        // Clear any existing interval
        if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
        }
        
        // Check every 5 minutes
        healthCheckInterval = setInterval(() => {
            performHealthCheck(true); // Silent check
        }, 5 * 60 * 1000);
    }

    /**
     * Perform database health check
     */
    async function performHealthCheck(silent = false) {
        try {
            if (!silent) {
                showDatabaseStatus('checking', 'Checking database health...');
            }

            const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            if (!sessionId) {
                throw new Error('No session ID available');
            }

            const response = await fetch('/admin/api/database-health', {
                headers: {
                    'X-Session-Id': sessionId
                }
            });

            const data = await response.json();

            if (data.success) {
                lastHealthCheck = data;
                updateDatabaseHealthDisplay(data);
                
                if (!silent) {
                    showDatabaseStatus('healthy', 'Database health check completed');
                }
            } else {
                throw new Error(data.error || 'Health check failed');
            }

        } catch (error) {
            console.error('Health check failed:', error);
            showDatabaseStatus('error', `Health check failed: ${error.message}`);
            
            if (!silent) {
                showNotification('Database health check failed', 'error');
            }
        }
    }

    /**
     * Update database health display
     */
    function updateDatabaseHealthDisplay(healthData) {
        // Update navigation indicator
        updateHealthIndicator(healthData.health.status);
        
        // Update health dashboard if visible
        const healthDashboard = document.getElementById('database-health-dashboard');
        if (healthDashboard && healthDashboard.style.display !== 'none') {
            renderHealthDashboard(healthData);
        }
    }

    /**
     * Update health indicator in navigation
     */
    function updateHealthIndicator(status) {
        let indicatorElement = document.getElementById('db-health-indicator');
        
        if (!indicatorElement) {
            // Create health indicator in navigation
            const navbarNav = document.querySelector('.navbar-nav');
            if (navbarNav) {
                const healthIndicator = document.createElement('li');
                healthIndicator.className = 'nav-item';
                healthIndicator.innerHTML = `
                    <a class="nav-link" href="#" id="db-health-indicator" onclick="showDatabaseHealthModal()">
                        <i class="bi bi-database me-1" id="db-health-icon"></i>
                        <span id="db-health-text">DB</span>
                    </a>
                `;
                navbarNav.appendChild(healthIndicator);
                indicatorElement = document.getElementById('db-health-indicator');
            }
        }

        if (indicatorElement) {
            const icon = document.getElementById('db-health-icon');
            const text = document.getElementById('db-health-text');
            
            // Remove existing status classes
            indicatorElement.classList.remove('text-success', 'text-warning', 'text-danger');
            
            switch (status) {
                case 'healthy':
                    indicatorElement.classList.add('text-success');
                    if (icon) icon.className = 'bi bi-database-check me-1';
                    if (text) text.textContent = 'DB ✓';
                    indicatorElement.title = 'Database is healthy';
                    break;
                case 'degraded':
                    indicatorElement.classList.add('text-warning');
                    if (icon) icon.className = 'bi bi-database-exclamation me-1';
                    if (text) text.textContent = 'DB ⚠';
                    indicatorElement.title = 'Database has performance issues';
                    break;
                case 'unhealthy':
                    indicatorElement.classList.add('text-danger');
                    if (icon) icon.className = 'bi bi-database-x me-1';
                    if (text) text.textContent = 'DB ✗';
                    indicatorElement.title = 'Database has critical issues';
                    break;
                default:
                    if (icon) icon.className = 'bi bi-database me-1';
                    if (text) text.textContent = 'DB ?';
                    indicatorElement.title = 'Database status unknown';
            }
        }
    }

    /**
     * Show database health modal
     */
    window.showDatabaseHealthModal = function() {
        createDatabaseHealthModal();
        const modal = new bootstrap.Modal(document.getElementById('databaseHealthModal'));
        modal.show();
        
        // Refresh health data when modal opens
        performHealthCheck();
    };

    /**
     * Create database health modal
     */
    function createDatabaseHealthModal() {
        let modal = document.getElementById('databaseHealthModal');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'databaseHealthModal';
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-database me-2"></i>Database Health Monitor
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-0">
                            <div id="database-health-dashboard">
                                <div class="text-center py-4">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-2">Loading database health information...</p>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="performHealthCheck()">
                                <i class="bi bi-arrow-clockwise me-1"></i>Refresh
                            </button>
                            <button type="button" class="btn btn-warning" onclick="performDatabaseMaintenance()" 
                                    id="maintenance-btn" style="display: none;">
                                <i class="bi bi-tools me-1"></i>Run Maintenance
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
    }

    /**
     * Render health dashboard content
     */
    function renderHealthDashboard(healthData) {
        const dashboard = document.getElementById('database-health-dashboard');
        if (!dashboard) return;

        const { health, stats, connection } = healthData;

        dashboard.innerHTML = `
            <div class="row g-0">
                <!-- Health Status -->
                <div class="col-12 border-bottom">
                    <div class="p-3">
                        <div class="d-flex align-items-center justify-content-between">
                            <div>
                                <h6 class="mb-1">Overall Health Status</h6>
                                <div class="d-flex align-items-center">
                                    <span class="badge ${getStatusBadgeClass(health.status)} me-2">${health.status.toUpperCase()}</span>
                                    <small class="text-muted">${new Date(health.timestamp).toLocaleString()}</small>
                                </div>
                            </div>
                            <div class="text-end">
                                <i class="bi ${getStatusIcon(health.status)} fs-2 ${getStatusTextClass(health.status)}"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Health Checks -->
                <div class="col-md-6 border-end border-bottom">
                    <div class="p-3">
                        <h6 class="mb-3">
                            <i class="bi bi-list-check me-2"></i>Health Checks
                        </h6>
                        <div class="list-group list-group-flush">
                            ${health.checks.map(check => `
                                <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0 py-2">
                                    <div>
                                        <span class="fw-medium">${formatCheckName(check.name)}</span>
                                        <br><small class="text-muted">${check.message}</small>
                                    </div>
                                    <span class="badge ${getCheckBadgeClass(check.status)}">
                                        ${check.status.toUpperCase()}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Connection Status -->
                <div class="col-md-6 border-bottom">
                    <div class="p-3">
                        <h6 class="mb-3">
                            <i class="bi bi-hdd-network me-2"></i>Connection Status
                        </h6>
                        <div class="row g-2">
                            <div class="col-12">
                                <div class="d-flex justify-content-between">
                                    <span>Connection Type:</span>
                                    <span class="fw-medium">${connection.type || 'Unknown'}</span>
                                </div>
                            </div>
                            <div class="col-12">
                                <div class="d-flex justify-content-between">
                                    <span>Cache Enabled:</span>
                                    <span class="badge ${connection.cacheEnabled ? 'bg-success' : 'bg-secondary'}">
                                        ${connection.cacheEnabled ? 'Yes' : 'No'}
                                    </span>
                                </div>
                            </div>
                            <div class="col-12">
                                <div class="d-flex justify-content-between">
                                    <span>Secure WebSocket:</span>
                                    <span class="badge ${connection.useSecureWebSocket ? 'bg-success' : 'bg-secondary'}">
                                        ${connection.useSecureWebSocket ? 'Yes' : 'No'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Performance Stats -->
                <div class="col-md-6 border-end">
                    <div class="p-3">
                        <h6 class="mb-3">
                            <i class="bi bi-speedometer2 me-2"></i>Performance Metrics
                        </h6>
                        ${stats.monitorStats ? `
                            <div class="row g-2">
                                <div class="col-6">
                                    <div class="text-center">
                                        <div class="fs-4 fw-bold text-primary">${stats.monitorStats.totalQueries}</div>
                                        <small class="text-muted">Total Queries</small>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="text-center">
                                        <div class="fs-4 fw-bold ${stats.monitorStats.errorRate > 5 ? 'text-danger' : 'text-success'}">
                                            ${stats.monitorStats.errorRate.toFixed(1)}%
                                        </div>
                                        <small class="text-muted">Error Rate</small>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="text-center">
                                        <div class="fs-4 fw-bold text-info">${stats.monitorStats.activeQueries}</div>
                                        <small class="text-muted">Active Queries</small>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="text-center">
                                        <div class="fs-4 fw-bold text-warning">${stats.monitorStats.errorCount}</div>
                                        <small class="text-muted">Total Errors</small>
                                    </div>
                                </div>
                            </div>
                        ` : '<p class="text-muted">Performance metrics not available</p>'}
                    </div>
                </div>

                <!-- Database Statistics -->
                <div class="col-md-6">
                    <div class="p-3">
                        <h6 class="mb-3">
                            <i class="bi bi-table me-2"></i>Database Statistics
                        </h6>
                        ${stats.recordCounts ? `
                            <div class="row g-2">
                                ${stats.recordCounts.map(record => `
                                    <div class="col-6">
                                        <div class="d-flex justify-content-between">
                                            <span class="text-capitalize">${record.table_name}:</span>
                                            <span class="fw-medium">${record.record_count.toLocaleString()}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p class="text-muted">Record counts not available</p>'}
                    </div>
                </div>
            </div>
        `;

        // Show maintenance button for superadmin
        const maintenanceBtn = document.getElementById('maintenance-btn');
        if (maintenanceBtn && window.sessionManager?.getRole() === 'superadmin') {
            maintenanceBtn.style.display = 'inline-block';
        }
    }

    /**
     * Perform database maintenance
     */
    window.performDatabaseMaintenance = async function() {
        if (!confirm('Are you sure you want to run database maintenance? This may take a few moments.')) {
            return;
        }

        try {
            showDatabaseStatus('maintenance', 'Running database maintenance...');

            const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            const response = await fetch('/admin/api/database-health?action=maintenance', {
                method: 'POST',
                headers: {
                    'X-Session-Id': sessionId,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                showNotification('Database maintenance completed successfully', 'success');
                showDatabaseStatus('healthy', 'Maintenance completed');
                
                // Refresh health data
                setTimeout(() => performHealthCheck(), 2000);
            } else {
                throw new Error(data.error || 'Maintenance failed');
            }

        } catch (error) {
            console.error('Database maintenance failed:', error);
            showNotification(`Database maintenance failed: ${error.message}`, 'error');
            showDatabaseStatus('error', 'Maintenance failed');
        }
    };

    /**
     * Show database status in notification area
     */
    function showDatabaseStatus(status, message) {
        // Use existing notification system if available
        if (window.showNotification) {
            const type = status === 'healthy' ? 'success' : 
                        status === 'maintenance' || status === 'checking' ? 'info' : 'warning';
            window.showNotification(message, type);
        }
    }

    /**
     * Helper functions for UI rendering
     */
    function getStatusBadgeClass(status) {
        switch (status) {
            case 'healthy': return 'bg-success';
            case 'degraded': return 'bg-warning';
            case 'unhealthy': return 'bg-danger';
            default: return 'bg-secondary';
        }
    }

    function getStatusTextClass(status) {
        switch (status) {
            case 'healthy': return 'text-success';
            case 'degraded': return 'text-warning';
            case 'unhealthy': return 'text-danger';
            default: return 'text-secondary';
        }
    }

    function getStatusIcon(status) {
        switch (status) {
            case 'healthy': return 'bi-check-circle-fill';
            case 'degraded': return 'bi-exclamation-triangle-fill';
            case 'unhealthy': return 'bi-x-circle-fill';
            default: return 'bi-question-circle-fill';
        }
    }

    function getCheckBadgeClass(status) {
        switch (status) {
            case 'pass': return 'bg-success';
            case 'warn': return 'bg-warning';
            case 'fail': return 'bg-danger';
            default: return 'bg-secondary';
        }
    }

    function formatCheckName(name) {
        return name.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDatabaseHealth);
    } else {
        initDatabaseHealth();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
        }
    });

    // Expose functions globally
    window.databaseHealthModule = {
        performHealthCheck,
        showDatabaseHealthModal: window.showDatabaseHealthModal,
        performDatabaseMaintenance: window.performDatabaseMaintenance
    };

})(); 