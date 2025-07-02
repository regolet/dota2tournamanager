// Attendance Management Module - IIFE Pattern
(function() {
    'use strict';
    
    // Module state
    const state = {
        attendanceSessions: [],
        players: [],
        registrationSessions: [],
        currentUser: null,
        initialized: false
    };

    // Utility to wait for an element to exist in the DOM
    async function waitForElement(id, maxAttempts = 10, interval = 100) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const check = () => {
                const el = document.getElementById(id);
                if (el) return resolve(el);
                attempts++;
                if (attempts >= maxAttempts) return reject(new Error('Element not found: ' + id));
                setTimeout(check, interval);
            };
            check();
        });
    }

    let attendanceInitAttempts = 0;
    const MAX_ATTENDANCE_INIT_ATTEMPTS = 10;

    // Attendance session management functions
    async function deleteAttendanceSession(sessionId, sessionName) {
        if (!confirm(`Are you sure you want to delete the attendance session "${sessionName}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/admin/api/attendance-sessions?sessionId=${sessionId}`, {
                method: 'DELETE',
                headers: { 'x-session-id': localStorage.getItem('adminSessionId') }
            });
            
            const data = await response.json();
            if (data.success) {
                window.utils.showNotification(`Attendance session "${sessionName}" deleted successfully`, 'success');
                await loadAttendanceSessions();
            } else {
                throw new Error(data.message || 'Failed to delete attendance session');
            }
        } catch (error) {
            console.error('Error deleting attendance session:', error);
            window.utils.showNotification(`Error deleting attendance session: ${error.message}`, 'error');
        }
    }

    async function closeAttendanceSession(sessionId, sessionName) {
        if (!confirm(`Are you sure you want to close the attendance session "${sessionName}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/admin/api/attendance-sessions?sessionId=${sessionId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-session-id': localStorage.getItem('adminSessionId') 
                },
                body: JSON.stringify({ isActive: false })
            });
            
            const data = await response.json();
            if (data.success) {
                window.utils.showNotification(`Attendance session "${sessionName}" closed successfully`, 'success');
                await loadAttendanceSessions();
            } else {
                throw new Error(data.message || 'Failed to close attendance session');
            }
        } catch (error) {
            console.error('Error closing attendance session:', error);
            window.utils.showNotification(`Error closing attendance session: ${error.message}`, 'error');
        }
    }

    async function reopenAttendanceSession(sessionId, sessionName) {
        try {
            const response = await fetch(`/admin/api/attendance-sessions?sessionId=${sessionId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-session-id': localStorage.getItem('adminSessionId') 
                },
                body: JSON.stringify({ isActive: true })
            });
            
            const data = await response.json();
            if (data.success) {
                window.utils.showNotification(`Attendance session "${sessionName}" reopened successfully`, 'success');
                await loadAttendanceSessions();
            } else {
                throw new Error(data.message || 'Failed to reopen attendance session');
            }
        } catch (error) {
            console.error('Error reopening attendance session:', error);
            window.utils.showNotification(`Error reopening attendance session: ${error.message}`, 'error');
        }
    }

    function editAttendanceSession(sessionId) {
        // For now, show a simple alert. This could be expanded to show an edit modal
        window.utils.showNotification('Edit functionality coming soon!', 'info');
    }

    function viewAttendanceStats(sessionId) {
        // For now, show a simple alert. This could be expanded to show detailed statistics
        window.utils.showNotification('Statistics view coming soon!', 'info');
    }

    // Initialize attendance module
    async function initAttendance() {
        try {
            console.log('🚀 Attendance: Starting initAttendance...');
            if (state.initialized) {
                console.log('🚀 Attendance: Already initialized, skipping...');
                return;
            }
            console.log('🚀 Attendance: Setting up event listeners...');
            setupEventListeners();
            
            try {
                await waitForElement('attendance-sessions-table-body', 20, 100);
            } catch (e) {
                attendanceInitAttempts++;
                if (attendanceInitAttempts < MAX_ATTENDANCE_INIT_ATTEMPTS) {
                    console.warn('Attendance: Table body not found, retrying initAttendance...');
                    setTimeout(initAttendance, 200);
                    return;
                } else {
                    console.error('Attendance: Table body not found after multiple attempts. Giving up.');
                    return;
                }
            }
            
            console.log('🚀 Attendance: Loading attendance data...');
            await loadAttendanceData();
            state.initialized = true;
            console.log('✅ Attendance: Initialization complete');
        } catch (error) {
            console.error('❌ Attendance: Error in initAttendance:', error);
        }
    }

    function setupEventListeners() {
        // Create attendance session button
        const createBtn = document.getElementById('create-attendance-session');
        if (createBtn) {
            createBtn.addEventListener('click', showCreateAttendanceSessionModal);
        }
        
        // Refresh button
        const refreshBtn = document.getElementById('refresh-attendance');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadAttendanceData);
        }
        
        // Attendance session form
        const sessionForm = document.getElementById('attendance-session-form');
        if (sessionForm) {
            sessionForm.addEventListener('submit', handleAttendanceSessionSave);
        }
        
        // Copy attendance URL button
        const copyBtn = document.getElementById('copy-attendance-url-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', copyAttendanceUrl);
        }
        
        // Send Discord attendance button
        const discordBtn = document.getElementById('send-discord-attendance');
        if (discordBtn) {
            discordBtn.addEventListener('click', sendDiscordAttendanceMessage);
        }
        
        // Mark all present/absent buttons
        const markAllPresentBtn = document.getElementById('mark-all-present');
        if (markAllPresentBtn) {
            markAllPresentBtn.addEventListener('click', () => markAllPlayersAttendance(true));
        }
        
        const markAllAbsentBtn = document.getElementById('mark-all-absent');
        if (markAllAbsentBtn) {
            markAllAbsentBtn.addEventListener('click', () => markAllPlayersAttendance(false));
        }
        
        // Export attendance button
        const exportBtn = document.getElementById('export-attendance');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportAttendanceData);
        }
        
        // Select all players checkbox
        const selectAllCheckbox = document.getElementById('select-all-players');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', toggleSelectAllPlayers);
        }
        
        // Event delegation for dynamically created buttons
        const sessionsTableBody = document.getElementById('attendance-sessions-table-body');
        if (sessionsTableBody) {
            sessionsTableBody.addEventListener('click', function(e) {
                const button = e.target.closest('button');
                if (!button) return;
                const sessionId = button.dataset.sessionId;
                const sessionName = button.dataset.sessionName;
                if (!sessionId) {
                    console.warn('No sessionId found for attendance session action button:', button);
                    window.utils.showNotification('Error: Session ID not found for this action.', 'error');
                    return;
                }
                if (button.classList.contains('copy-attendance-link')) {
                    copyAttendanceSessionLink(sessionId);
                } else if (button.classList.contains('open-attendance-link')) {
                    openAttendanceSessionLink(sessionId);
                } else if (button.classList.contains('edit-attendance-session')) {
                    editAttendanceSession(sessionId);
                } else if (button.classList.contains('close-attendance-session')) {
                    closeAttendanceSession(sessionId, sessionName);
                } else if (button.classList.contains('reopen-attendance-session')) {
                    reopenAttendanceSession(sessionId, sessionName);
                } else if (button.classList.contains('delete-attendance-session')) {
                    deleteAttendanceSession(sessionId, sessionName);
                } else if (button.classList.contains('view-attendance-stats')) {
                    viewAttendanceStats(sessionId);
                }
            });
        }
        
        // Event delegation for player attendance table
        const playerTableBody = document.getElementById('player-attendance-table-body');
        if (playerTableBody) {
            playerTableBody.addEventListener('click', function(e) {
                const target = e.target.closest('button');
                if (!target) return;
                
                const playerId = target.dataset.playerId;
                const playerName = target.dataset.playerName;
                
                if (target.classList.contains('mark-present')) {
                    markPlayerAttendance(playerId, true);
                } else if (target.classList.contains('mark-absent')) {
                    markPlayerAttendance(playerId, false);
                } else if (target.classList.contains('view-player-details')) {
                    viewPlayerDetails(playerId);
                }
            });
        }
    }

    async function loadAttendanceData() {
        try {
            console.log('🔄 Attendance: Loading attendance data...');
            
            // Load registration sessions for dropdown
            await loadRegistrationSessions();
            
            // Load attendance sessions
            await loadAttendanceSessions();
            
            // Load players with attendance status
            await loadPlayersWithAttendance();
            
            // Update dashboard statistics
            updateAttendanceStatistics();
            
            console.log('✅ Attendance: Data loaded successfully');
        } catch (error) {
            console.error('❌ Attendance: Error loading data:', error);
            window.utils.showNotification('Error loading attendance data', 'error');
        }
    }

    async function loadRegistrationSessions() {
        try {
            const data = await window.utils.loadRegistrationSessionsWithRetry(3, 1000);
            if (data.success && data.sessions) {
                state.registrationSessions = data.sessions;
                updateRegistrationSessionDropdown();
            }
        } catch (error) {
            console.error('Error loading registration sessions:', error);
        }
    }

    function updateRegistrationSessionDropdown() {
        const dropdown = document.getElementById('attendance-registration-session');
        if (!dropdown) return;
        
        dropdown.innerHTML = '<option value="">Select Registration Session</option>';
        state.registrationSessions.forEach(session => {
            if (session.isActive) {
                const option = document.createElement('option');
                option.value = session.sessionId;
                option.textContent = `${session.title} (${session.playerCount}/${session.maxPlayers})`;
                dropdown.appendChild(option);
            }
        });
    }

    async function loadAttendanceSessions() {
        try {
            const tableBody = document.getElementById('attendance-sessions-table-body');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4">
                            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                            Loading attendance sessions...
                        </td>
                    </tr>
                `;
            }
            
            // Load attendance sessions from API
            try {
                const response = await fetch('/admin/api/attendance-sessions', {
                    headers: { 'x-session-id': localStorage.getItem('adminSessionId') }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                if (data.success && data.sessions) {
                    state.attendanceSessions = data.sessions;
                    displayAttendanceSessions();
                } else {
                    throw new Error(data.message || 'Failed to load attendance sessions');
                }
            } catch (apiError) {
                console.warn('Attendance API not available, using empty state:', apiError.message);
                // Use empty state instead of throwing error
                state.attendanceSessions = [];
                displayAttendanceSessions();
            }
        } catch (error) {
            console.error('Error loading attendance sessions:', error);
            const tableBody = document.getElementById('attendance-sessions-table-body');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4 text-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Failed to load attendance sessions
                            <br><small>Please try refreshing or check your connection</small>
                            <br><small class="text-muted">Error: ${error.message}</small>
                        </td>
                    </tr>
                `;
            }
        }
    }

    async function loadPlayersWithAttendance() {
        try {
            const tableBody = document.getElementById('player-attendance-table-body');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-4">
                            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                            Loading player attendance...
                        </td>
                    </tr>
                `;
            }
            
            // Load players from the existing API
            const data = await window.utils.loadPlayersWithRetry(3, 1000);
            if (data.success && data.players) {
                state.players = data.players;
                displayPlayersWithAttendance();
            }
        } catch (error) {
            console.error('Error loading players with attendance:', error);
            const tableBody = document.getElementById('player-attendance-table-body');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-4 text-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Failed to load player attendance
                        </td>
                    </tr>
                `;
            }
        }
    }

    function displayAttendanceSessions() {
        const tableBody = document.getElementById('attendance-sessions-table-body');
        if (!tableBody) return;
        
        if (state.attendanceSessions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-muted">
                        <i class="bi bi-calendar-x me-2"></i>
                        No attendance sessions created yet.
                        <br><small>Click "Create Attendance Session" to get started.</small>
                    </td>
                </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = '';
        
        state.attendanceSessions.forEach(session => {
            const row = document.createElement('tr');
            
            // Status determination
            let statusBadge = '';
            let statusClass = '';
            
            if (!session.isActive) {
                statusBadge = 'Inactive';
                statusClass = 'bg-secondary';
            } else if (session.endTime && new Date() > new Date(session.endTime)) {
                statusBadge = 'Expired';
                statusClass = 'bg-warning';
            } else if (new Date() < new Date(session.startTime)) {
                statusBadge = 'Upcoming';
                statusClass = 'bg-info';
            } else {
                statusBadge = 'Active';
                statusClass = 'bg-success';
            }
            
            // Find registration session
            const regSession = state.registrationSessions.find(s => s.sessionId === session.registrationSessionId);
            const regSessionTitle = regSession ? regSession.title : 'Unknown';
            
            row.innerHTML = `
                <td>
                    <div class="fw-bold">${escapeHtml(session.name)}</div>
                    <small class="text-muted">ID: ${session.sessionId}</small>
                </td>
                <td>${escapeHtml(regSessionTitle)}</td>
                <td><span class="badge ${statusClass}">${statusBadge}</span></td>
                <td>${session.presentCount}/${session.totalCount}</td>
                <td><small>${formatDate(session.createdAt)}</small></td>
                <td><small>${session.endTime ? formatDate(session.endTime) : 'Never'}</small></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary copy-attendance-link" data-session-id="${session.sessionId}" title="Copy Link">
                            <i class="bi bi-clipboard"></i>
                        </button>
                        <button class="btn btn-outline-secondary open-attendance-link" data-session-id="${session.sessionId}" title="Open Link">
                            <i class="bi bi-box-arrow-up-right"></i>
                        </button>
                        <button class="btn btn-outline-info view-attendance-stats" data-session-id="${session.sessionId}" title="View Stats">
                            <i class="bi bi-graph-up"></i>
                        </button>
                        ${session.isActive ? 
                            `<button class="btn btn-outline-warning close-attendance-session" data-session-id="${session.sessionId}" data-session-name="${escapeHtml(session.name)}" title="Close Session">
                                <i class="bi bi-stop-circle"></i>
                            </button>` : 
                            `<button class="btn btn-outline-success reopen-attendance-session" data-session-id="${session.sessionId}" data-session-name="${escapeHtml(session.name)}" title="Reopen Session">
                                <i class="bi bi-play-circle"></i>
                            </button>`
                        }
                        <button class="btn btn-outline-danger delete-attendance-session" data-session-id="${session.sessionId}" data-session-name="${escapeHtml(session.name)}" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    function displayPlayersWithAttendance() {
        const tableBody = document.getElementById('player-attendance-table-body');
        if (!tableBody) return;
        
        if (state.players.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-muted">
                        <i class="bi bi-people me-2"></i>
                        No players found.
                        <br><small>Players will appear here once they register for tournaments.</small>
                    </td>
                </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = '';
        
        // Always sort players by MMR (high to low)
        state.players.sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
        
        state.players.forEach(player => {
            const row = document.createElement('tr');
            
            // Find registration session
            const regSession = state.registrationSessions.find(s => s.sessionId === player.registration_session_id);
            const regSessionTitle = regSession ? regSession.title : 'Unknown';
            
            // Attendance status
            const isPresent = player.present === true;
            const statusBadge = isPresent ? 
                '<span class="badge bg-success">Present</span>' : 
                '<span class="badge bg-danger">Absent</span>';
            
            row.innerHTML = `
                <td>
                    <input type="checkbox" class="form-check-input player-checkbox" data-player-id="${player.id}">
                </td>
                <td>${escapeHtml(player.name)}</td>
                <td>${escapeHtml(player.dota2id)}</td>
                <td>${player.peakmmr || 0}</td>
                <td>${escapeHtml(regSessionTitle)}</td>
                <td>${statusBadge}</td>
                <td><small>${formatDate(player.updated_at || player.registration_date)}</small></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        ${isPresent ? 
                            `<button class="btn btn-outline-danger mark-absent" data-player-id="${player.id}" data-player-name="${escapeHtml(player.name)}" title="Mark Absent">
                                <i class="bi bi-x-circle"></i>
                            </button>` : 
                            `<button class="btn btn-outline-success mark-present" data-player-id="${player.id}" data-player-name="${escapeHtml(player.name)}" title="Mark Present">
                                <i class="bi bi-check-circle"></i>
                            </button>`
                        }
                        <button class="btn btn-outline-info view-player-details" data-player-id="${player.id}" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    function updateAttendanceStatistics() {
        const totalPlayers = state.players.length;
        const presentPlayers = state.players.filter(p => p.present === true).length;
        const absentPlayers = totalPlayers - presentPlayers;
        const attendanceRate = totalPlayers > 0 ? Math.round((presentPlayers / totalPlayers) * 100) : 0;
        
        // Update dashboard cards
        const activeSessionsCount = document.getElementById('active-sessions-count');
        const presentTodayCount = document.getElementById('present-today-count');
        const absentTodayCount = document.getElementById('absent-today-count');
        const attendanceRateElement = document.getElementById('attendance-rate');
        
        if (activeSessionsCount) activeSessionsCount.textContent = state.attendanceSessions.filter(s => s.isActive).length;
        if (presentTodayCount) presentTodayCount.textContent = presentPlayers;
        if (absentTodayCount) absentTodayCount.textContent = absentPlayers;
        if (attendanceRateElement) attendanceRateElement.textContent = `${attendanceRate}%`;
    }

    function showCreateAttendanceSessionModal() {
        // Reset form
        document.getElementById('attendance-session-form').reset();
        
        // Set default times
        const now = new Date();
        const startTime = new Date(now.getTime() + 30 * 60000); // 30 minutes from now
        const endTime = new Date(now.getTime() + 2 * 60 * 60000); // 2 hours from now
        
        document.getElementById('attendance-start-time').value = startTime.toISOString().slice(0, 16);
        document.getElementById('attendance-end-time').value = endTime.toISOString().slice(0, 16);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('createAttendanceSessionModal'));
        modal.show();
    }

    async function handleAttendanceSessionSave(e) {
        e.preventDefault();
        
        const sessionData = {
            name: document.getElementById('attendance-session-name').value,
            registrationSessionId: document.getElementById('attendance-registration-session').value,
            startTime: document.getElementById('attendance-start-time').value,
            endTime: document.getElementById('attendance-end-time').value,
            description: document.getElementById('attendance-description').value
        };
        
        const saveButton = e.target.querySelector('button[type="submit"]');
        const originalText = saveButton.textContent;
        
        try {
            saveButton.disabled = true;
            saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';
            
            // Create attendance session via API
            try {
                const response = await fetch('/admin/api/attendance-sessions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-session-id': localStorage.getItem('adminSessionId')
                    },
                    body: JSON.stringify(sessionData)
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                if (data.success && data.session) {
                    const newSession = data.session;
                    state.attendanceSessions.push(newSession);
                    
                    // Close modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('createAttendanceSessionModal'));
                    if (modal) {
                        modal.hide();
                    }
                    
                    // Show attendance link modal
                    showAttendanceLinkModal(newSession);
                    
                    // Reload data
                    await loadAttendanceData();
                    
                    window.utils.showNotification('Attendance session created successfully', 'success');
                } else {
                    throw new Error(data.message || 'Failed to create attendance session');
                }
            } catch (apiError) {
                console.warn('Attendance API not available, using mock session:', apiError.message);
                
                // Create mock session for demo purposes
                const mockSession = {
                    sessionId: 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    ...sessionData,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    presentCount: 0,
                    totalCount: 0
                };
                
                state.attendanceSessions.push(mockSession);
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('createAttendanceSessionModal'));
                if (modal) {
                    modal.hide();
                }
                
                // Show attendance link modal
                showAttendanceLinkModal(mockSession);
                
                // Reload data
                await loadAttendanceData();
                
                window.utils.showNotification('Attendance session created (demo mode)', 'success');
            }
        } catch (error) {
            console.error('Error creating attendance session:', error);
            window.utils.showNotification('Error creating attendance session', 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = originalText;
        }
    }

    function showAttendanceLinkModal(session) {
        const attendanceUrl = `${window.location.origin}/attendance/?session=${session.sessionId}`;
        document.getElementById('attendance-url').value = attendanceUrl;
        const modal = new bootstrap.Modal(document.getElementById('attendanceLinkModal'));
        modal.show();
    }

    function copyAttendanceUrl() {
        const urlInput = document.getElementById('attendance-url');
        copyToClipboard(urlInput.value);
        
        const copyBtn = document.getElementById('copy-attendance-url-btn');
        const originalHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="bi bi-check me-1"></i>Copied!';
        copyBtn.classList.add('btn-success');
        copyBtn.classList.remove('btn-outline-secondary');
        
        setTimeout(() => {
            copyBtn.innerHTML = originalHtml;
            copyBtn.classList.remove('btn-success');
            copyBtn.classList.add('btn-outline-secondary');
        }, 2000);
    }

    async function sendDiscordAttendanceMessage() {
        try {
            const attendanceUrl = document.getElementById('attendance-url').value;
            const sessionName = document.getElementById('attendance-session-name').value;
            
            // Fetch webhooks from backend
            const res = await fetch('/.netlify/functions/discord-webhooks', {
                headers: { 'x-session-id': localStorage.getItem('adminSessionId') }
            });
            
            if (!res.ok) {
                window.utils.showNotification('Failed to fetch Discord webhooks', 'error');
                return;
            }
            
            const data = await res.json();
            if (!data.success || !Array.isArray(data.webhooks)) {
                window.utils.showNotification('No Discord webhooks found', 'warning');
                return;
            }
            
            // Find attendance webhook
            const webhookObj = data.webhooks.find(w => w.type === 'attendance');
            const webhookUrl = webhookObj ? webhookObj.url : '';
            
            if (!webhookUrl) {
                window.utils.showNotification('No Discord webhook URL set for attendance', 'warning');
                return;
            }
            
            const message = `📋 **Attendance Session: ${sessionName}**\n\n🎯 **Attendance Link:**\n${attendanceUrl}\n\n⏰ **Please mark your attendance using the link above.**\n\n✅ Present players will be eligible for tournament participation.`;
            
            // Send to Discord webhook
            const sendRes = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: message,
                    username: 'Tournament Attendance',
                    avatar_url: 'https://cdn.discordapp.com/emojis/1234567890.png'
                })
            });
            
            if (sendRes.ok) {
                window.utils.showNotification('Attendance link sent to Discord!', 'success');
            } else {
                const errorText = await sendRes.text();
                window.utils.showNotification('Failed to send to Discord: ' + errorText, 'error');
            }
        } catch (error) {
            window.utils.showNotification('Error sending to Discord: ' + error.message, 'error');
        }
    }

    async function markPlayerAttendance(playerId, isPresent) {
        try {
            // Call the backend API to update attendance (use /api/update-player)
            const response = await fetch('/api/update-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId, updates: { present: isPresent } })
            });
            const data = await response.json();
            if (data.success) {
                // Reload the player list from the server
                await loadPlayersWithAttendance();
                updateAttendanceStatistics();
                window.utils.showNotification(
                    `${data.player?.name || 'Player'} marked as ${isPresent ? 'present' : 'absent'} (database updated)`,
                    'success'
                );
            } else {
                throw new Error(data.message || 'Update failed');
            }
        } catch (error) {
            // Fallback: update local state only
            const player = state.players.find(p => p.id === playerId);
            if (player) {
                player.present = isPresent;
                player.updated_at = new Date().toISOString();
                displayPlayersWithAttendance();
                updateAttendanceStatistics();
                window.utils.showNotification(
                    `${player.name} marked as ${isPresent ? 'present' : 'absent'} (local only, API error)`,
                    'warning'
                );
            }
            console.error('Error marking player attendance:', error);
        }
    }

    async function markAllPlayersAttendance(isPresent) {
        if (!confirm(`Are you sure you want to mark ALL players as ${isPresent ? 'present' : 'absent'}?`)) {
            return;
        }
        try {
            // Call bulk attendance update API
            const playerIds = state.players.map(p => p.id);
            const response = await fetch('/api/update-attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bulk: true, playerIds, present: isPresent })
            });
            const data = await response.json();
            if (data.success) {
                // Reload players from server to reflect changes
                await loadPlayersWithAttendance();
                updateAttendanceStatistics();
                window.utils.showNotification(
                    `All players marked as ${isPresent ? 'present' : 'absent'} (database updated)`,
                    'success'
                );
            } else {
                throw new Error(data.message || 'Bulk update failed');
            }
        } catch (error) {
            // Fallback: update local state only
            state.players.forEach(player => {
                player.present = isPresent;
                player.updated_at = new Date().toISOString();
            });
            displayPlayersWithAttendance();
            updateAttendanceStatistics();
            window.utils.showNotification(
                `All players marked as ${isPresent ? 'present' : 'absent'} (local only, API error)`,
                'warning'
            );
            console.error('Error marking all players attendance:', error);
        }
    }

    function toggleSelectAllPlayers() {
        const selectAllCheckbox = document.getElementById('select-all-players');
        const playerCheckboxes = document.querySelectorAll('.player-checkbox');
        
        playerCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
    }

    function exportAttendanceData() {
        try {
            const data = state.players.map(player => ({
                Name: player.name,
                'Dota 2 ID': player.dota2id,
                MMR: player.peakmmr || 0,
                Status: player.present ? 'Present' : 'Absent',
                'Registration Date': formatDate(player.registration_date),
                'Last Updated': formatDate(player.updated_at || player.registration_date)
            }));
            
            const csv = convertToCSV(data);
            downloadCSV(csv, `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
            
            window.utils.showNotification('Attendance report exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting attendance data:', error);
            window.utils.showNotification('Error exporting attendance data', 'error');
        }
    }

    function convertToCSV(data) {
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        
        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                return `"${String(value).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        });
        
        return csvRows.join('\n');
    }

    function downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Utility functions
    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        
        const date = new Date(dateString);
        const now = new Date();
        
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        if (date.getFullYear() === now.getFullYear()) {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
        
        return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Function to reset attendance module (for cleanup)
    function resetAttendanceModule() {
        // Reset all state variables
        state.initialized = false;
        state.attendanceSessions = [];
        state.players = [];
        state.registrationSessions = [];
        state.currentUser = null;
        // Also reset any retry counters or timers if present
        attendanceInitAttempts = 0;
        // Remove any event listeners if needed (optional, for future-proofing)
        // Optionally clear any DOM content if needed
        const tableBody = document.getElementById('attendance-sessions-table-body');
        if (tableBody) tableBody.innerHTML = '';
        const playerTableBody = document.getElementById('player-attendance-table-body');
        if (playerTableBody) playerTableBody.innerHTML = '';
    }

    // Expose functions globally
    window.initAttendance = initAttendance;
    window.resetAttendanceModule = resetAttendanceModule;
    window.loadAttendance = loadAttendance;
    
    // Add missing attendance link functions
    function openAttendanceSessionLink(sessionId) {
        const attendanceUrl = `${window.location.origin}/attendance/?session=${sessionId}`;
        window.open(attendanceUrl, '_blank');
    }

    function copyAttendanceSessionLink(sessionId) {
        const attendanceUrl = `${window.location.origin}/attendance/?session=${sessionId}`;
        copyToClipboard(attendanceUrl);
        window.utils.showNotification('Attendance link copied to clipboard!', 'success');
    }

    // Load attendance sessions into the dropdown
    async function populateAttendanceSessionDropdown() {
        try {
            const dropdown = document.getElementById('attendance-session-select');
            if (!dropdown) return;
            // Fetch attendance sessions from API
            const response = await fetch('/admin/api/attendance-sessions', {
                headers: { 'x-session-id': localStorage.getItem('adminSessionId') }
            });
            const data = await response.json();
            if (data.success && Array.isArray(data.sessions)) {
                state.attendanceSessions = data.sessions;
                dropdown.innerHTML = '<option value="">-- Select Session --</option>';
                data.sessions.forEach(session => {
                    dropdown.innerHTML += `<option value="${session.sessionId}">${session.name}</option>`;
                });
                
                // Auto-select the latest session (most recent by creation date)
                if (data.sessions.length > 0) {
                    const latestSession = data.sessions.sort((a, b) => 
                        new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)
                    )[0];
                    dropdown.value = latestSession.sessionId;
                    // Load players for the latest session
                    await loadPlayersForAttendanceSession(latestSession.sessionId);
                }
            }
        } catch (error) {
            console.error('Error loading attendance sessions for dropdown:', error);
        }
    }

    // Fetch and display players for a selected attendance session
    async function loadPlayersForAttendanceSession(attendanceSessionId) {
        if (!attendanceSessionId) {
            // If no session selected, load all players as before
            await loadPlayersWithAttendance();
            return;
        }
        try {
            const response = await fetch(`/.netlify/functions/attendance-session-players?attendanceSessionId=${attendanceSessionId}`);
            const data = await response.json();
            if (data.success && Array.isArray(data.players)) {
                state.players = data.players;
                displayPlayersWithAttendance();
            } else {
                state.players = [];
                displayPlayersWithAttendance();
            }
        } catch (error) {
            console.error('Error loading players for attendance session:', error);
            state.players = [];
            displayPlayersWithAttendance();
        }
    }

    // Add event listener to the dropdown
    document.addEventListener('DOMContentLoaded', function() {
        populateAttendanceSessionDropdown();
        const dropdown = document.getElementById('attendance-session-select');
        if (dropdown) {
            dropdown.addEventListener('change', function() {
                const sessionId = dropdown.value;
                loadPlayersForAttendanceSession(sessionId);
            });
        }
    });
})(); 