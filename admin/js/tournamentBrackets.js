(function() {
    'use strict';

    // Simple global state like Masterlist (safe for reloading)
    window.tournamentBracketsData = window.tournamentBracketsData || {
        currentTournament: null,
        matches: new Map(),
        tournamentFormat: 'single_elimination',
        availableTeams: []
    };
    
    window.isTournamentBracketsLoading = window.isTournamentBracketsLoading || false;
    window.lastLoadedTournamentBracketsCount = window.lastLoadedTournamentBracketsCount || null;

    // Tournament formats
    const TOURNAMENT_FORMATS = {
        single_elimination: {
            name: 'Single Elimination',
            description: 'Teams are eliminated after one loss',
            minTeams: 4,
            maxRounds: (teams) => Math.ceil(Math.log2(teams))
        },
        swiss_rounds: {
            name: 'Swiss Rounds',
            description: 'Teams play a fixed number of rounds',
            minTeams: 6,
            maxRounds: (teams) => Math.min(Math.ceil(Math.log2(teams)) + 2, 8)
        },
        round_robin: {
            name: 'Round Robin',
            description: 'Each team plays every other team once',
            minTeams: 3,
            maxRounds: (teams) => teams - 1
        }
    };

    /**
     * Initialize tournament bracket page - Simplified like Masterlist
     */
    window.initTournamentBrackets = async function() {
        try {
            console.log('🚀 Tournament Brackets: Starting initialization...');
            
            // Set up event listeners
            setupTournamentBracketsEventListeners();
            
            // Load initial data
            await loadTournamentBracketsData();
            
            console.log('✅ Tournament Brackets: Initialization complete');
            return true;
        } catch (error) {
            console.error('❌ Tournament Brackets: Error in initTournamentBrackets:', error);
            window.showNotification('Error initializing tournament brackets', 'error');
            return false;
        }
    }

    /**
     * Load tournament brackets data - Simplified like Masterlist
     */
    async function loadTournamentBracketsData() {
        if (window.isTournamentBracketsLoading) return;
        window.isTournamentBracketsLoading = true;
        
        try {
            console.log('🔄 Tournament Brackets: Loading data...');
            
            // Setup tournament formats
            setupTournamentFormats();
            
            // Load available teams
            await loadAvailableTeams();
            
            // Load available tournaments
            await loadAvailableTournaments();
            
            // Update stats
            updateTournamentStats();
            
            console.log('✅ Tournament Brackets: Data loaded successfully');
        } catch (error) {
            console.error('❌ Tournament Brackets: Error loading data:', error);
            window.showNotification('Error loading tournament brackets data', 'error');
        } finally {
            window.isTournamentBracketsLoading = false;
        }
    }

    /**
     * Cleanup function for tournament brackets when switching tabs - Simplified
     */
    window.cleanupTournamentBrackets = function() {
        console.log('🏆 Tournament Brackets: Starting cleanup...');
        
        // Simple cleanup - just reset loading flag
        window.isTournamentBracketsLoading = false;
        
        console.log('🏆 Tournament Brackets: Cleanup completed');
    }

    /**
     * Set up event listeners - Simplified like Masterlist
     */
    function setupTournamentBracketsEventListeners() {
        // Format selection change
        const formatSelect = document.getElementById('tournament-format');
        if (formatSelect) {
            formatSelect.addEventListener('change', updateTournamentStats);
        }

        // Create tournament button
        const createBtn = document.getElementById('create-tournament');
        if (createBtn) {
            createBtn.addEventListener('click', createTournamentBracket);
        }

        // Import teams button
        const importBtn = document.getElementById('import-teams-btn');
        if (importBtn) {
            importBtn.addEventListener('click', importTeamsFromBalancer);
        }

        // Team configuration selector
        const teamSelector = document.getElementById('tournament-selector');
        if (teamSelector) {
            teamSelector.addEventListener('change', loadSelectedTeamConfiguration);
        }

        // Tournament controls
        const reshuffleBtn = document.getElementById('reshuffle-btn');
        if (reshuffleBtn) {
            reshuffleBtn.addEventListener('click', reshuffleParticipants);
        }

        const exportBtn = document.getElementById('export-bracket-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportBracket);
        }

        const resetBtn = document.getElementById('reset-tournament-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetTournament);
        }

        // Refresh buttons
        const refreshBtn = document.getElementById('refresh-bracket-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadAvailableTeams);
        }

        const refreshBtn2 = document.getElementById('refresh-bracket-btn-2');
        if (refreshBtn2) {
            refreshBtn2.addEventListener('click', loadAvailableTeams);
        }

        const refreshSessionsBtn = document.getElementById('refresh-bracket-sessions');
        if (refreshSessionsBtn) {
            refreshSessionsBtn.addEventListener('click', loadRegistrationSessions);
        }

        // Session selector
        const sessionSelector = document.getElementById('tournament-bracket-session-selector');
        if (sessionSelector) {
            sessionSelector.addEventListener('change', handleSessionChange);
        }

        // Saved tournament selector
        const savedTournamentSelector = document.getElementById('load-tournament-select');
        if (savedTournamentSelector) {
            savedTournamentSelector.addEventListener('change', loadSelectedTournament);
        }
    }

    /**
     * Setup tournament format dropdown
     */
    function setupTournamentFormats() {
        const formatSelect = document.getElementById('tournament-format');
        if (formatSelect) {
            formatSelect.innerHTML = '';
            Object.entries(TOURNAMENT_FORMATS).forEach(([formatId, format]) => {
                const option = document.createElement('option');
                option.value = formatId;
                option.textContent = `${format.name} - ${format.description}`;
                formatSelect.appendChild(option);
            });
        }
    }

    /**
     * Load available teams from various sources
     */
    async function loadAvailableTeams() {
        console.log('📋 Loading saved team configurations...');
        
        try {
            const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            console.log('🔐 Session ID for teams API:', sessionId ? `${sessionId.substring(0, 20)}...` : 'None');
            
            if (!sessionId) {
                console.log('⚠️ No session found');
                window.tournamentBracketsData.availableTeams = [];
                updateTeamCount();
                updateTeamConfigurationSelector([]);
                return;
            }

            const response = await fetch('/.netlify/functions/teams', {
                headers: {
                    'x-session-id': sessionId
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Teams API error:', response.status, response.statusText, errorText);
                updateTeamConfigurationSelector([]);
                return;
            }

            const teamConfigs = await response.json();
            
            if (Array.isArray(teamConfigs) && teamConfigs.length > 0) {
                console.log(`✅ Loaded ${teamConfigs.length} saved team configurations.`);
                updateTeamConfigurationSelector(teamConfigs);
                if (window.showNotification) {
                    window.showNotification(`Loaded ${teamConfigs.length} teams`, 'success');
                }
            } else {
                console.log('⚠️ No saved team configurations found in the response.');
                updateTeamConfigurationSelector([]);
            }
        } catch (error) {
            console.error('Error loading available teams:', error);
            updateTeamConfigurationSelector([]);
        }
    }

    /**
     * Update the team configuration selector dropdown
     */
    function updateTeamConfigurationSelector(teamConfigs) {
        const selector = document.getElementById('tournament-selector');
        if (!selector) return;

        const previouslySelected = selector.value;
        selector.innerHTML = '<option value="">Select saved team configuration...</option>';

        if (Array.isArray(teamConfigs)) {
            teamConfigs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            teamConfigs.forEach(config => {
                const option = document.createElement('option');
                option.value = config.teamSetId;
                option.dataset.teamConfig = JSON.stringify(config.teams);
                option.textContent = `${config.title} (${config.totalTeams} teams, ${config.totalPlayers} players)`;
                selector.appendChild(option);
            });
        }

        // Always select the first config if none is selected
        if (!selector.value && teamConfigs && teamConfigs.length > 0) {
            selector.value = teamConfigs[0].teamSetId;
            selector.dispatchEvent(new Event('change'));
            console.log(`✅ Auto-selected team config: ${teamConfigs[0].teamSetId}`);
        }

        updateTeamCount();

        // Disable delete button if no selection
        const deleteBtn = document.querySelector('.delete-team-config-btn');
        if (deleteBtn) {
            deleteBtn.disabled = !selector.value;
        }
        // Add delete button for superadmin
        const user = window.sessionManager?.getUser();
        const userRole = user ? user.role : 'admin';
        if (userRole === 'superadmin') {
            addDeleteButtonToTeamConfigSelector();
        }
    }

    /**
     * Load the teams from the selected configuration into the bracket state
     */
    async function loadSelectedTeamConfiguration() {
        const teamConfigSelector = document.getElementById('tournament-selector');
        if (!teamConfigSelector) return;

        const selectedOption = teamConfigSelector.options[teamConfigSelector.selectedIndex];
        
        if (!selectedOption || !selectedOption.dataset.teamConfig) {
            window.tournamentBracketsData.availableTeams = [];
            updateTournamentStats();
            return;
        }

        try {
            const teamsData = JSON.parse(selectedOption.dataset.teamConfig);
            
            if (Array.isArray(teamsData)) {
                window.tournamentBracketsData.availableTeams = teamsData.map(team => ({
                    id: team.teamNumber || `team_${Math.random()}`,
                    name: team.name || `Team ${team.teamNumber}`,
                    players: team.players || [],
                    isEliminated: false,
                    averageMmr: team.averageMmr || 0
                }));
                
                console.log(`Team config selected with ${window.tournamentBracketsData.availableTeams.length} teams.`);
            } else {
                window.tournamentBracketsData.availableTeams = [];
            }
        } catch (e) {
            console.error('Failed to parse team config data:', e);
            window.tournamentBracketsData.availableTeams = [];
        }

        updateTournamentStats();
    }

    /**
     * Import teams from Team Balancer (deprecated - replaced with saved teams)
     */
    function importTeamsFromBalancer() {
        if (window.showNotification) {
            window.showNotification('Please use Team Balancer to save teams, then select them from the dropdown above.', 'info');
        }
    }

    /**
     * Update team count display
     */
    function updateTeamCount() {
        const teamCountElement = document.getElementById('bracket-team-count');
        if (teamCountElement) {
            const count = window.tournamentBracketsData.availableTeams.length;
            teamCountElement.textContent = `${count} team${count !== 1 ? 's' : ''}`;
        }
    }

    /**
     * Update tournament statistics
     */
    function updateTournamentStats() {
        const teams = window.tournamentBracketsData.availableTeams;
        const teamCount = teams.length;
        
        const formatSelect = document.getElementById('tournament-format');
        const selectedFormat = formatSelect?.value || 'single_elimination';
        const format = TOURNAMENT_FORMATS[selectedFormat];
        
        // Update team count
        const teamCountDisplay = document.getElementById('tournament-team-count');
        if (teamCountDisplay) {
            teamCountDisplay.textContent = teamCount;
        }
        
        if (teamCount >= format.minTeams) {
            const estimatedRounds = format.maxRounds(teamCount);
            const estimatedRoundsDisplay = document.getElementById('tournament-estimated-rounds');
            if (estimatedRoundsDisplay) {
                estimatedRoundsDisplay.textContent = estimatedRounds;
            }
            
            const estimatedDuration = Math.ceil((estimatedRounds * 45) / 60);
            const estimatedDurationDisplay = document.getElementById('tournament-estimated-duration');
            if (estimatedDurationDisplay) {
                estimatedDurationDisplay.textContent = `${estimatedDuration}h`;
            }
            
            const createButton = document.getElementById('create-tournament');
            if (createButton) {
                createButton.disabled = false;
                createButton.innerHTML = '<i class="bi bi-plus-circle me-1"></i>Create Tournament';
            }
        } else {
            const createButton = document.getElementById('create-tournament');
            if (createButton) {
                createButton.disabled = true;
                createButton.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>Need ${format.minTeams}+ Teams`;
            }
        }

        // Update current round if tournament exists
        if (window.tournamentBracketsData.currentTournament) {
            const currentRoundDisplay = document.getElementById('tournament-current-round');
            if (currentRoundDisplay) {
                currentRoundDisplay.textContent = window.tournamentBracketsData.currentTournament.currentRound + 1;
            }
        }
    }

    /**
     * Handle session selector change
     */
    function handleSessionChange() {
        const sessionSelector = document.getElementById('tournament-bracket-session-selector');
        const selectedSessionId = sessionSelector?.value;
        
        if (selectedSessionId) {
            loadPlayersFromSession(selectedSessionId);
        }
    }

    /**
     * Load registration sessions for tournament bracket
     */
    async function loadRegistrationSessions() {
        try {
            console.log('📋 Loading registration sessions for tournament bracket...');
            
            const data = await fetchWithAuth('/.netlify/functions/registration-sessions');
            
            if (data.success && data.sessions) {
                console.log(`📋 Loaded ${data.sessions.length} registration sessions for tournament bracket`);
                // Store sessions for potential use
                window.tournamentBracketSessions = data.sessions;
            } else {
                console.error('Failed to load registration sessions for tournament bracket:', data);
            }
        } catch (error) {
            console.error('Error loading registration sessions for tournament bracket:', error);
        }
    }

    /**
     * Load players from a specific session
     */
    async function loadPlayersFromSession(sessionId) {
        console.log('👥 Loading players from session:', sessionId);
        // Implementation would load players from specific session
        // This would integrate with the existing player loading system
    }

    /**
     * Create tournament bracket
     */
    window.createTournamentBracket = function() {
        const teams = window.tournamentBracketsData.availableTeams;
        const tournamentName = document.getElementById('tournament-name')?.value || 'Dota 2 Tournament';
        const selectedFormat = document.getElementById('tournament-format')?.value || 'single_elimination';
        const description = document.getElementById('tournament-description')?.value || '';
        const teamSelector = document.getElementById('tournament-selector');
        const teamSetId = teamSelector ? teamSelector.value : null;
        
        if (teams.length === 0) {
            if (window.showNotification) {
                window.showNotification('Please select a team configuration from the dropdown above', 'warning');
            }
            return;
        }
        
        const format = TOURNAMENT_FORMATS[selectedFormat];
        if (teams.length < format.minTeams) {
            if (window.showNotification) {
                window.showNotification(`Need at least ${format.minTeams} teams for ${format.name}`, 'warning');
            }
            return;
        }
        
        console.log(`🏆 Creating ${format.name} tournament with ${teams.length} teams`);
        
        window.tournamentBracketsData.currentTournament = {
            id: `tournament_${Date.now()}`,
            team_set_id: teamSetId,
            name: tournamentName,
            description: description,
            format: selectedFormat,
            teams: teams.map((team, index) => {
                const totalMmr = team.players.reduce((sum, player) => sum + (player.peakmmr || 0), 0);
                const averageMmr = team.players.length > 0 ? Math.round(totalMmr / team.players.length) : 0;
                return {
                    id: team.id || `team_${index + 1}`,
                    name: team.name || `Team ${index + 1}`,
                    players: team.players,
                    totalMmr: totalMmr,
                    averageMmr: averageMmr,
                    wins: 0,
                    losses: 0,
                    eliminated: false
                };
            }),
            rounds: [],
            currentRound: 0,
            status: 'created',
            createdAt: new Date().toISOString()
        };
        
        // Save to database
        saveTournamentToDb();

        switch (selectedFormat) {
            case 'single_elimination':
                generateSingleEliminationBracket();
                break;
            case 'swiss_rounds':
                generateSwissRoundsBracket();
                break;
            case 'round_robin':
                generateRoundRobinBracket();
                break;
        }
        
        displayTournamentBracket();
        showTournamentControls();
        updateTournamentStats();
        
        if (window.showNotification) {
            window.showNotification(`${format.name} tournament created successfully!`, 'success');
        }
    };

    /**
     * Show tournament controls
     */
    function showTournamentControls() {
        const controlsCard = document.getElementById('tournament-controls');
        if (controlsCard) {
            controlsCard.style.display = 'block';
        }
    }

    /**
     * Hide tournament controls
     */
    function hideTournamentControls() {
        const controlsCard = document.getElementById('tournament-controls');
        if (controlsCard) {
            controlsCard.style.display = 'none';
        }
    }

    /**
     * Display tournament bracket
     */
    function displayTournamentBracket() {
        const container = document.getElementById('tournament-bracket-visualization');
        const emptyState = document.getElementById('tournament-empty-state');
        const tournament = window.tournamentBracketsData.currentTournament;
        if (!tournament) return;
        
        // Hide empty state
        if (emptyState) {
            emptyState.classList.add('d-none');
        }
        
        // Show tournament header
        const tournamentHeader = document.getElementById('tournament-header');
        if (tournamentHeader) {
            tournamentHeader.style.display = 'block';
            
            const titleElement = document.getElementById('tournament-title');
            if (titleElement) {
                titleElement.textContent = tournament.name;
            }
            
            const infoElement = document.getElementById('tournament-info');
            if (infoElement) {
                infoElement.textContent = `${TOURNAMENT_FORMATS[tournament.format].name} • ${tournament.teams.length} Teams`;
            }
            
            const statusElement = document.getElementById('tournament-status');
            if (statusElement) {
                statusElement.textContent = `Round ${tournament.currentRound + 1}`;
            }
        }
        
        // Show tournament visualization
        if (container) {
            container.style.display = 'block';
            renderTournamentBracket(container);
            addMatchClickListeners();
        }
        
        // Show standings for round robin and swiss
        if (tournament.format === 'swiss_rounds' || tournament.format === 'round_robin') {
            const standings = document.getElementById('tournament-standings');
            if (standings) {
                standings.style.display = 'block';
                renderStandings();
            }
        }

        // Display winner if one exists
        if (tournament.status === 'completed' && tournament.winner) {
            displayTournamentWinner(tournament.winner);
        } else {
            const winnerCard = document.getElementById('tournament-winner-card');
            if (winnerCard) {
                winnerCard.innerHTML = '';
                winnerCard.style.display = 'none';
            }
        }
        
        updateReshuffleButtonState();
        showTournamentControls();
        updateTournamentStats();
    }

    /**
     * Add click listeners for match winner selection
     */
    function addMatchClickListeners() {
        const matches = document.querySelectorAll('.match-card');
        matches.forEach(matchElement => {
            const matchId = matchElement.dataset.matchId;
            const team1WinnerBtn = matchElement.querySelector('.set-winner-btn-1');
            const team2WinnerBtn = matchElement.querySelector('.set-winner-btn-2');
            const undoBtn = matchElement.querySelector('.undo-winner-btn');

            if (team1WinnerBtn) {
                team1WinnerBtn.addEventListener('click', () => setMatchWinner(matchId, 1));
            }
            if (team2WinnerBtn) {
                team2WinnerBtn.addEventListener('click', () => setMatchWinner(matchId, 2));
            }
            if (undoBtn) {
                undoBtn.addEventListener('click', () => undoMatchWinner(matchId));
            }
        });
    }

    /**
     * Set the winner for a specific match
     */
    function setMatchWinner(matchId, winnerNumber) {
        const tournament = window.tournamentBracketsData.currentTournament;
        if (!tournament) return;

        let matchToUpdate = null;
        for (const round of tournament.rounds) {
            const match = round.matches.find(m => m.id === matchId);
            if (match) {
                matchToUpdate = match;
                break;
            }
        }

        if (matchToUpdate) {
            const winner = winnerNumber === 1 ? matchToUpdate.team1 : matchToUpdate.team2;
            if (winner) {
                matchToUpdate.winner = winner;
                matchToUpdate.status = 'completed';
                console.log(`Match ${matchId} winner set to Team ${winnerNumber}: ${winner.name}`);

                // Basic progression for single elimination for now
                if (tournament.format === 'single_elimination') {
                    advanceSingleElimination(matchToUpdate);
                }
                
                // Save updated tournament state
                saveTournamentToDb();

                displayTournamentBracket(); // Re-render the bracket
            }
        }
    }

    /**
     * Advance the winner in a single elimination bracket
     */
    function advanceSingleElimination(completedMatch) {
        const tournament = window.tournamentBracketsData.currentTournament;
        const currentRoundIndex = completedMatch.round - 1;
        const nextRoundIndex = currentRoundIndex + 1;

        if (nextRoundIndex < tournament.rounds.length) {
            const matchIndexInRound = tournament.rounds[currentRoundIndex].matches.findIndex(m => m.id === completedMatch.id);
            const nextMatchIndex = Math.floor(matchIndexInRound / 2);
            const nextMatch = tournament.rounds[nextRoundIndex].matches[nextMatchIndex];

            if (nextMatch) {
                if (matchIndexInRound % 2 === 0) {
                    nextMatch.team1 = completedMatch.winner;
                } else {
                    nextMatch.team2 = completedMatch.winner;
                }

                if(nextMatch.team1 && nextMatch.team2) {
                    nextMatch.status = 'pending';
                }
            }
            // PATCH: Advance round status if all matches in current round are completed
            const currentRound = tournament.rounds[currentRoundIndex];
            const nextRound = tournament.rounds[nextRoundIndex];
            if (currentRound.matches.every(m => m.status === 'completed')) {
                currentRound.status = 'completed';
                nextRound.status = 'ready';
            }
        } else {
            // This was the final match
            tournament.status = 'completed';
            tournament.winner = completedMatch.winner;
            console.log('🏆 Tournament finished! Winner:', completedMatch.winner.name);
            displayTournamentWinner(completedMatch.winner);
        }
    }

    /**
     * Undo a match result
     */
    function undoMatchWinner(matchId) {
        const tournament = window.tournamentBracketsData.currentTournament;
        if (!tournament) return;

        let matchToUpdate = null;
        for (const round of tournament.rounds) {
            const match = round.matches.find(m => m.id === matchId);
            if (match) {
                matchToUpdate = match;
                break;
            }
        }

        if (matchToUpdate && matchToUpdate.status === 'completed') {
            console.log(`Undoing winner for match ${matchId}`);
            
            if (tournament.format === 'single_elimination') {
                retractSingleElimination(matchToUpdate);
            }

            const team1Name = matchToUpdate.team1.name;
            const team2Name = matchToUpdate.team2.name;

            matchToUpdate.winner = null;
            matchToUpdate.status = 'pending';

            saveTournamentToDb();
            displayTournamentBracket();
            if (window.showNotification) {
                window.showNotification(`Result for ${team1Name} vs ${team2Name} reset.`, 'info');
            }
        }
    }

    /**
     * Retract the winner in a single elimination bracket
     */
    function retractSingleElimination(completedMatch) {
        const tournament = window.tournamentBracketsData.currentTournament;
        const currentRoundIndex = completedMatch.round - 1;
        const nextRoundIndex = currentRoundIndex + 1;

        if (nextRoundIndex >= tournament.rounds.length) {
            if (tournament.status === 'completed') {
                tournament.status = 'created';
                tournament.winner = null;
            }
        } else {
            const matchIndexInRound = tournament.rounds[currentRoundIndex].matches.findIndex(m => m.id === completedMatch.id);
            const nextMatchIndex = Math.floor(matchIndexInRound / 2);
            const nextMatch = tournament.rounds[nextRoundIndex].matches[nextMatchIndex];

            if (nextMatch) {
                if (nextMatch.team1 && nextMatch.team1.id === completedMatch.winner.id) {
                    nextMatch.team1 = null;
                } else if (nextMatch.team2 && nextMatch.team2.id === completedMatch.winner.id) {
                    nextMatch.team2 = null;
                }
                nextMatch.status = 'waiting';
            }
        }
    }

    /**
     * Render tournament bracket in the visualization area
     */
    function renderTournamentBracket(container) {
        const tournament = window.tournamentBracketsData.currentTournament;
        if (!tournament) return;
        
        let bracketHtml = '';
        
        if (tournament.format === 'swiss_rounds' || tournament.format === 'round_robin') {
            const currentRound = tournament.rounds[tournament.currentRound];
            if (currentRound) {
                bracketHtml = `
                    <div class="current-round">
                        <h6>${currentRound.name}</h6>
                        <div class="row g-2">
                            ${currentRound.matches.map(match => `
                                <div class="col-md-6">
                                    ${renderMatch(match)}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        } else {
            bracketHtml = '<div class="bracket-rounds d-flex gap-4 overflow-auto">';
            
            tournament.rounds.forEach((round) => {
                bracketHtml += `
                    <div class="bracket-round d-flex flex-column justify-content-around" style="min-width: 250px;">
                        <div>
                            <h6 class="text-center mb-3">${round.name}</h6>
                            <div class="matches">
                                ${round.matches.map(match => renderMatch(match)).join('')}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            bracketHtml += '</div>';
        }
        
        container.innerHTML = bracketHtml;
    }

    /**
     * Next round function
     */
    function nextRound() {
        const tournament = window.tournamentBracketsData.currentTournament;
        if (!tournament) return;
        
        // Implementation for advancing to next round
        if (window.showNotification) {
            window.showNotification('Next round functionality coming soon!', 'info');
        }
    }

    /**
     * Render standings table
     */
    function renderStandings() {
        const tournament = window.tournamentBracketsData.currentTournament;
        if (!tournament) return;
        
        const sortedTeams = [...tournament.teams].sort((a, b) => {
            const aScore = a.wins - a.losses;
            const bScore = b.wins - b.losses;
            return bScore - aScore || b.averageMmr - a.averageMmr;
        });
        
        const standingsBody = document.getElementById('standings-table-body');
        if (standingsBody) {
            standingsBody.innerHTML = sortedTeams.map((team, index) => `
                <tr class="${team.eliminated ? 'text-muted' : ''}">
                    <td>${index + 1}</td>
                    <td>${escapeHtml(team.name)}</td>
                    <td>${team.wins}-${team.losses}</td>
                    <td>${team.averageMmr}</td>
                    <td>
                        <span class="badge ${team.eliminated ? 'bg-danger' : 'bg-success'}">
                            ${team.eliminated ? 'Eliminated' : 'Active'}
                        </span>
                    </td>
                </tr>
            `).join('');
        }
    }

    function generateSingleEliminationBracket() {
        const tournament = window.tournamentBracketsData.currentTournament;
        const teams = [...tournament.teams];
        
        shuffleArray(teams);
        
        const numRounds = Math.ceil(Math.log2(teams.length));
        tournament.rounds = [];
        
        const firstRoundMatches = [];
        for (let i = 0; i < teams.length; i += 2) {
            if (i + 1 < teams.length) {
                firstRoundMatches.push({
                    id: `match_r1_${Math.floor(i/2) + 1}`,
                    round: 1,
                    team1: teams[i],
                    team2: teams[i + 1],
                    winner: null,
                    status: 'pending'
                });
            } else {
                firstRoundMatches.push({
                    id: `match_r1_${Math.floor(i/2) + 1}`,
                    round: 1,
                    team1: teams[i],
                    team2: null,
                    winner: teams[i],
                    status: 'bye'
                });
            }
        }
        
        tournament.rounds.push({
            round: 1,
            name: 'First Round',
            matches: firstRoundMatches,
            status: 'ready'
        });
        
        for (let round = 2; round <= numRounds; round++) {
            const roundMatches = [];
            const numMatches = Math.ceil(Math.pow(2, numRounds - round));
            
            for (let i = 0; i < numMatches; i++) {
                roundMatches.push({
                    id: `match_r${round}_${i + 1}`,
                    round: round,
                    team1: null,
                    team2: null,
                    winner: null,
                    status: 'waiting'
                });
            }
            
            tournament.rounds.push({
                round: round,
                name: round === numRounds ? 'Final' : 
                      round === numRounds - 1 ? 'Semi-Final' : 
                      `Round ${round}`,
                matches: roundMatches,
                status: 'waiting'
            });
        }
        
        console.log(`🏆 Generated single elimination bracket with ${numRounds} rounds`);
    }

    function generateSwissRoundsBracket() {
        const tournament = window.tournamentBracketsData.currentTournament;
        const teams = [...tournament.teams];
        const numRounds = Math.min(Math.ceil(Math.log2(teams.length)) + 2, 8);
        
        tournament.rounds = [];
        
        shuffleArray(teams);
        const firstRoundMatches = [];
        
        for (let i = 0; i < teams.length; i += 2) {
            if (i + 1 < teams.length) {
                firstRoundMatches.push({
                    id: `match_r1_${Math.floor(i/2) + 1}`,
                    round: 1,
                    team1: teams[i],
                    team2: teams[i + 1],
                    winner: null,
                    status: 'pending'
                });
            }
        }
        
        tournament.rounds.push({
            round: 1,
            name: 'Round 1',
            matches: firstRoundMatches,
            status: 'ready'
        });
        
        for (let round = 2; round <= numRounds; round++) {
            tournament.rounds.push({
                round: round,
                name: `Round ${round}`,
                matches: [],
                status: 'waiting'
            });
        }
        
        console.log(`🏆 Generated Swiss rounds bracket with ${numRounds} rounds`);
    }

    function generateRoundRobinBracket() {
        const tournament = window.tournamentBracketsData.currentTournament;
        const teams = [...tournament.teams];
        const numRounds = teams.length - 1;
        
        tournament.rounds = [];
        
        for (let round = 1; round <= numRounds; round++) {
            const roundMatches = [];
            
            for (let i = 0; i < Math.floor(teams.length / 2); i++) {
                const team1Index = i;
                const team2Index = teams.length - 1 - i;
                
                if (team1Index !== team2Index) {
                    roundMatches.push({
                        id: `match_r${round}_${i + 1}`,
                        round: round,
                        team1: teams[team1Index],
                        team2: teams[team2Index],
                        winner: null,
                        status: round === 1 ? 'pending' : 'waiting'
                    });
                }
            }
            
            tournament.rounds.push({
                round: round,
                name: `Round ${round}`,
                matches: roundMatches,
                status: round === 1 ? 'ready' : 'waiting'
            });
            
            if (round < numRounds) {
                const lastTeam = teams.pop();
                teams.splice(1, 0, lastTeam);
            }
        }
        
        console.log(`🏆 Generated round robin bracket with ${numRounds} rounds`);
    }

    function renderMatch(match) {
        const team1 = match.team1 || { name: 'TBD', totalMmr: 0 };
        const team2 = match.team2 || { name: 'TBD', totalMmr: 0 };

        const isPending = match.status === 'pending';
        const isCompleted = match.status === 'completed';
        const isBye = match.status === 'bye';

        let team1Classes = 'd-flex justify-content-between align-items-center p-2';
        let team2Classes = 'd-flex justify-content-between align-items-center p-2';

        if(isCompleted) {
            if(match.winner.id === team1.id) team1Classes += ' bg-success-light';
            if(match.winner.id === team2.id) team2Classes += ' bg-success-light';
        }

        return `
            <div class="match-card card card-body mb-5" data-match-id="${match.id}">
                <div class="${team1Classes}">
                    <span>${escapeHtml(team1.name)} <small class="text-muted">(${(team1.averageMmr || 0)} MMR)</small></span>
                    ${isPending ? `<button class="btn btn-sm btn-primary set-winner-btn-1" title="Set ${escapeHtml(team1.name)} as winner"><i class="bi bi-check-circle"></i></button>` : ''}
                    ${(isCompleted && match.winner.id === team1.id) ? '<i class="bi bi-trophy-fill text-warning"></i>' : ''}
                </div>
                <div class="${team2Classes}">
                    <span>${escapeHtml(team2.name)} <small class="text-muted">(${(team2.averageMmr || 0)} MMR)</small></span>
                    ${isPending ? `<button class="btn btn-sm btn-primary set-winner-btn-2" title="Set ${escapeHtml(team2.name)} as winner"><i class="bi bi-check-circle"></i></button>` : ''}
                    ${(isCompleted && match.winner.id === team2.id) ? '<i class="bi bi-trophy-fill text-warning"></i>' : ''}
                </div>
                ${isBye ? '<div class="text-center small text-muted mt-1">(Bye)</div>' : ''}
                ${isCompleted ? `<div class="text-center mt-2"><button class="btn btn-sm btn-outline-warning undo-winner-btn" data-match-id="${match.id}"><i class="bi bi-arrow-counterclockwise"></i> Undo Winner</button></div>` : ''}
            </div>
        `;
    }

    window.reportMatchResult = function(matchId) {
        console.log(`🏆 Reporting result for match: ${matchId}`);
        
        if (window.showNotification) {
            window.showNotification('Match result reporting coming soon!', 'info');
        }
    };

    window.exportBracket = function() {
        const tournament = window.tournamentBracketsData.currentTournament;
        if (!tournament) return;
        
        const exportData = {
            tournament: tournament,
            exportDate: new Date().toISOString(),
            format: 'tournament_bracket_v1'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tournament-bracket-${tournament.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        if (window.showNotification) {
            window.showNotification('Tournament bracket exported successfully', 'success');
        }
    };

    window.resetTournament = function() {
        window.tournamentBracketsData.currentTournament = null;
        window.tournamentBracketsData.matches.clear();
        
        // Show empty state
        const emptyState = document.getElementById('tournament-empty-state');
        if (emptyState) {
            emptyState.classList.remove('d-none');
        }
        
        const visualization = document.getElementById('tournament-bracket-visualization');
        if (visualization) {
            visualization.style.display = 'none';
        }

        const winnerCard = document.getElementById('tournament-winner-card');
        if (winnerCard) {
            winnerCard.innerHTML = '';
        }
        
        let tournamentHeader = document.getElementById('tournament-header');
        if (tournamentHeader) {
            tournamentHeader.style.display = 'none';
        }
        
        const standings = document.getElementById('tournament-standings');
        if (standings) {
            standings.style.display = 'none';
        }
        
        hideTournamentControls();
        updateTournamentStats();
        
        if (window.showNotification) {
            window.showNotification('Tournament has been reset', 'info');
        }
    };

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function processLoadedTournamentData(tournament) {
        if (!tournament || !tournament.teams) return tournament;

        const teamMap = new Map();
        tournament.teams.forEach(team => {
            const teamData = { ...team };
            if (teamData.players && teamData.players.length > 0) {
                const totalMmr = teamData.players.reduce((sum, player) => sum + (player.peakmmr || 0), 0);
                teamData.averageMmr = Math.round(totalMmr / teamData.players.length);
            } else {
                teamData.averageMmr = 0;
            }
            teamMap.set(teamData.id, teamData);
        });

        if (tournament.rounds && Array.isArray(tournament.rounds)) {
            tournament.rounds.forEach(round => {
                if (round.matches && Array.isArray(round.matches)) {
                    round.matches.forEach(match => {
                        const updateTeam = (team) => {
                            if (team && teamMap.has(team.id)) {
                                return { ...team, ...teamMap.get(team.id) };
                            }
                            return team;
                        };
                        match.team1 = updateTeam(match.team1);
                        match.team2 = updateTeam(match.team2);
                        match.winner = updateTeam(match.winner);
                    });
                }
            });
        }
        
        tournament.teams = Array.from(teamMap.values());

        if (tournament.rounds && tournament.rounds.length > 0) {
            const finalRound = tournament.rounds[tournament.rounds.length - 1];
            if (finalRound && finalRound.matches && finalRound.matches.length === 1) {
                const finalMatch = finalRound.matches[0];
                if (finalMatch.status === 'completed' && finalMatch.winner) {
                    tournament.status = 'completed';
                    tournament.winner = finalMatch.winner;
                }
            }
        }
        
        return tournament;
    }

    /**
     * Save the current tournament state to the database
     */
    async function saveTournamentToDb() {
        const tournament = window.tournamentBracketsData.currentTournament;
        if (!tournament) return;

        const sessionId = window.sessionManager?.getSessionId();
        if (!sessionId) {
            console.warn('Cannot save tournament without a session.');
            return;
        }

        try {
            const payload = {
                id: tournament.id,
                team_set_id: tournament.team_set_id,
                tournament_data: tournament
            };
            const response = await fetch('/.netlify/functions/tournaments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': sessionId
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save tournament');
            }

            console.log('✅ Tournament state saved successfully.');
        } catch (error) {
            console.error('Error saving tournament state:', error);
            if (window.showNotification) {
                window.showNotification(`Error saving tournament: ${error.message}`, 'danger');
            }
        }
    }

    /**
     * Display the tournament winner card
     * @param {object} winningTeam - The team object of the winner
     */
    function displayTournamentWinner(winningTeam) {
        const winnerCard = document.getElementById('tournament-winner-card');
        if (!winnerCard) return;

        winnerCard.style.display = 'block';

        const playersHtml = winningTeam.players.map(player => `
            <li class="list-group-item bg-light">
                ${escapeHtml(player.name)}
                <span class="badge bg-secondary float-end">${player.peakmmr || 0} MMR</span>
            </li>
        `).join('');

        winnerCard.innerHTML = `
            <div class="card border-warning border-2 shadow-lg">
                <div class="card-header bg-warning text-dark text-center">
                    <h4 class="mb-0"><i class="bi bi-trophy-fill me-2"></i>Tournament Winner!</h4>
                </div>
                <div class="card-body">
                    <h3 class="card-title text-center text-warning mb-3">${escapeHtml(winningTeam.name)}</h3>
                    <h6 class="text-muted text-center mb-3">Winning Roster</h6>
                    <ul class="list-group list-group-flush">
                        ${playersHtml}
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * Load available tournaments from the database
     */
    async function loadAvailableTournaments() {
        console.log('🔄 Loading available tournaments...');
        try {
            const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            if (!sessionId) {
                console.log('⚠️ No session ID for loading tournaments.');
                updateSavedTournamentSelector([]);
                return;
            }

            const response = await fetch('/.netlify/functions/tournaments', {
                headers: { 'x-session-id': sessionId }
            });

            if (!response.ok) {
                console.error('Failed to load tournaments:', response.status);
                updateSavedTournamentSelector([]);
                return;
            }

            const tournaments = await response.json();
            console.log(`✅ Loaded ${tournaments.length} tournaments.`);
            updateSavedTournamentSelector(tournaments);

        } catch (error) {
            console.error('Error loading available tournaments:', error);
            updateSavedTournamentSelector([]);
        }
    }

    /**
     * Update saved tournament selector
     */
    function updateSavedTournamentSelector(tournaments) {
        const selector = document.getElementById('load-tournament-select');
        const user = window.sessionManager?.getUser();
        const userRole = user ? user.role : 'admin';

        if (!selector) return;

        selector.innerHTML = '<option value="">Select a saved tournament to load...</option>';
        
        if (!tournaments || tournaments.length === 0) {
            return;
        }

        tournaments.forEach(tournament => {
            const option = document.createElement('option');
            option.value = tournament.id;
            option.textContent = `${tournament.name} (Created: ${new Date(tournament.created_at).toLocaleDateString()})`;
            
            // Add a data attribute for the delete button if user is superadmin
            if (userRole === 'superadmin') {
                option.dataset.tournamentId = tournament.id;
            }

            selector.appendChild(option);
        });

        // Add delete buttons for superadmin
        if (userRole === 'superadmin') {
            addDeleteButtonToTournamentSelector();
        }
    }

    /**
     * Add delete button for team configurations for superadmin
     */
    function addDeleteButtonToTeamConfigSelector() {
        const selector = document.getElementById('tournament-selector');
        if (!selector) return;

        // Prevent adding multiple buttons
        if (selector.parentElement.querySelector('.delete-team-config-btn')) {
            return;
        }

        let container = selector.parentElement.querySelector('.team-config-selector-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'team-config-selector-container input-group';
            selector.parentElement.insertBefore(container, selector);
            container.appendChild(selector);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-outline-danger delete-team-config-btn';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.title = 'Delete selected team configuration';
        container.appendChild(deleteBtn);

        deleteBtn.addEventListener('click', async () => {
            const selectedOption = selector.options[selector.selectedIndex];
            const teamSetId = selector.value;
            console.log('Attempting to delete team config:', teamSetId, selectedOption);

            if (!teamSetId) {
                showNotification('Please select a team configuration to delete.', 'warning');
                return;
            }
            if (confirm(`Are you sure you want to permanently delete the team config "${selectedOption.textContent}"?`)) {
                await deleteSelectedTeamConfig(teamSetId, deleteBtn);
            }
        });
    }

    /**
     * Delete the selected team configuration
     */
    async function deleteSelectedTeamConfig(teamSetId, button) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

        try {
            const sessionId = window.sessionManager?.getSessionId();
            const response = await fetch(`/.netlify/functions/teams?teamSetId=${teamSetId}`, {
                method: 'DELETE',
                headers: { 'x-session-id': sessionId }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showNotification('Team configuration deleted.', 'success');
                await loadAvailableTeams(); // Refresh the list
            } else {
                throw new Error(result.error || 'Failed to delete team configuration');
            }
        } catch (error) {
            console.error('Error deleting team configuration:', error);
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-trash"></i>';
        }
    }

    /**
     * Add delete buttons next to tournament options for superadmin
     */
    function addDeleteButtonToTournamentSelector() {
        const selector = document.getElementById('load-tournament-select');
        if (!selector) return;

        // Prevent adding multiple buttons
        if (selector.parentElement.querySelector('.delete-tournament-btn')) {
            return;
        }

        // Create a container for the selector and buttons
        let container = selector.parentElement.querySelector('.tournament-selector-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'tournament-selector-container input-group';
            selector.parentElement.insertBefore(container, selector);
            container.appendChild(selector);
        }

        // Add a delete button if one doesn't exist
        let deleteBtn = container.querySelector('.delete-tournament-btn');
        if (!deleteBtn) {
            deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-outline-danger delete-tournament-btn';
            deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
            deleteBtn.title = 'Delete selected tournament';
            container.appendChild(deleteBtn);

            deleteBtn.addEventListener('click', async () => {
                const selectedOption = selector.options[selector.selectedIndex];
                const tournamentId = selectedOption?.dataset.tournamentId;

                if (!tournamentId || selector.value === '') {
                    showNotification('Please select a tournament to delete.', 'warning');
                    return;
                }

                if (confirm(`Are you sure you want to permanently delete the tournament "${selectedOption.textContent}"? This action cannot be undone.`)) {
                    await deleteSelectedTournament(tournamentId, deleteBtn);
                }
            });
        }
    }

    /**
     * Delete the selected tournament
     */
    async function deleteSelectedTournament(tournamentId, button) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

        try {
            const sessionId = window.sessionManager?.getSessionId() || localStorage.getItem('adminSessionId');
            const response = await fetch(`/.netlify/functions/tournaments?id=${tournamentId}`, {
                method: 'DELETE',
                headers: { 'x-session-id': sessionId }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showNotification('Tournament deleted successfully.', 'success');
                // Reload the list of tournaments
                await loadAvailableTournaments();
                // Optionally, reset the bracket view
                resetTournament();
            } else {
                throw new Error(result.message || 'Failed to delete tournament');
            }
        } catch (error) {
            console.error('Error deleting tournament:', error);
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-trash"></i>';
        }
    }

    /**
     * Load the selected tournament data from the server
     */
    async function loadSelectedTournament() {
        const selector = document.getElementById('load-tournament-select');
        if (!selector.value) return;

        const tournamentId = selector.value;
        console.log(`Loading tournament ${tournamentId}...`);

        try {
            const sessionId = window.sessionManager?.getSessionId();
            const response = await fetch(`/.netlify/functions/tournaments?id=${tournamentId}`, {
                headers: { 'x-session-id': sessionId }
            });

            if (!response.ok) {
                throw new Error('Tournament not found');
            }

            const tournament = await response.json();
            console.log('[Bracket DEBUG] Fetched raw tournament data from server:', tournament);
 
            if (tournament && tournament.tournament_data) {
                // The data might be a string, let's parse it
                let dataToProcess;
                if (typeof tournament.tournament_data === 'string') {
                    try {
                        dataToProcess = JSON.parse(tournament.tournament_data);
                    } catch (e) {
                        console.error('[Bracket DEBUG] Failed to parse tournament_data string.', e);
                        showNotification('Failed to parse tournament data.', 'error');
                        return;
                    }
                } else {
                    dataToProcess = tournament.tournament_data;
                }

                 const processedData = processLoadedTournamentData(dataToProcess);
                 console.log('[Bracket DEBUG] STEP 3: Data processed. Updating state and UI.');

                 window.tournamentBracketsData.currentTournament = processedData;
                 
                 displayTournamentBracket();
                 showTournamentControls();

                document.getElementById('tournament-name').value = processedData.name || '';
                document.getElementById('tournament-description').value = processedData.description || '';
                document.getElementById('tournament-format').value = processedData.format || 'single_elimination';

                showNotification('Tournament loaded!', 'success');

             } else {
                 console.error('[Bracket DEBUG] Tournament data from server is null or undefined.');
                 showNotification('Could not load the selected tournament.', 'error');
             }

        } catch (error) {
            console.error('Error loading tournament:', error);
            showNotification(`Error: ${error.message}`, 'error');
        }
    }

    // Tournament bracket initialization is now handled by navigation.js
    // Only initialize when the tournament bracket tab is actually loaded
    // This prevents unnecessary API calls when on other tabs

    // Expose functions globally
    window.initTournamentBrackets = initTournamentBrackets;

    window.tournamentBracketsModule = {
        initTournamentBrackets,
        createTournamentBracket: window.createTournamentBracket,
        reportMatchResult: window.reportMatchResult,
        exportBracket: window.exportBracket,
        resetTournament: window.resetTournament,
        loadAvailableTeams,
        importTeamsFromBalancer
    };

    /**
     * Reshuffle participants for the current tournament
     */
    function reshuffleParticipants() {
        const tournament = window.tournamentBracketsData.currentTournament;
        if (!tournament) return;

        const hasWinner = tournament.rounds.some(round => 
            round.matches.some(match => match.winner)
        );

        if (hasWinner) {
            if (window.showNotification) {
                window.showNotification('Cannot reshuffle when matches have recorded winners.', 'warning');
            }
            return;
        }

        console.log('🔀 Reshuffling participants...');

        switch (tournament.format) {
            case 'single_elimination':
                generateSingleEliminationBracket();
                break;
            case 'swiss_rounds':
                generateSwissRoundsBracket();
                break;
            case 'round_robin':
                generateRoundRobinBracket();
                break;
        }

        displayTournamentBracket();
        saveTournamentToDb();

        if (window.showNotification) {
            window.showNotification('Participants have been reshuffled.', 'success');
        }
    }

    function updateReshuffleButtonState() {
        const reshuffleBtn = document.getElementById('reshuffle-btn');
        if (!reshuffleBtn || !window.tournamentBracketsData.currentTournament) {
            if (reshuffleBtn) reshuffleBtn.disabled = true;
            return;
        }

        const hasWinner = window.tournamentBracketsData.currentTournament.rounds.some(round =>
            round.matches.some(match => match.winner)
        );

        reshuffleBtn.disabled = hasWinner;
    }

    window.refreshTournamentBracketData = async function() {
        await loadAvailableTeams();
        await loadAvailableTournaments();
    };

})();
