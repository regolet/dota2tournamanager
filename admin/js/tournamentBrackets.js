// Tournament Bracket System with Single/Double Elimination and Swiss Rounds
(function() {
    'use strict';

    // Tournament bracket state
    const bracketState = {
        currentTournament: null,
        matches: new Map(),
        tournamentFormat: 'single_elimination',
        availableTeams: []
    };

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
     * Initialize tournament bracket page
     */
    async function initTournamentBracketPage() {
        console.log('🏆 Initializing tournament bracket page...');
        
        setupTournamentFormats();
        setupEventListeners();
        
        // Wait for session to be ready before making API calls
        console.log('⏳ Waiting for session validation to complete...');
        if (window.sessionManager && window.sessionManager.init) {
            await window.sessionManager.init();
        }
        
        // Load available teams (now that session is ready)
        await loadAvailableTeams();
        updateTournamentStats();
        
        // Load available tournaments
        await loadAvailableTournaments();

        console.log('✅ Tournament bracket page initialized');
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
     * Setup event listeners for the tournament bracket page
     */
    function setupEventListeners() {
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
        const nextRoundBtn = document.getElementById('next-round-btn');
        if (nextRoundBtn) {
            nextRoundBtn.addEventListener('click', nextRound);
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
        const savedTournamentSelector = document.getElementById('saved-tournament-selector');
        if (savedTournamentSelector) {
            savedTournamentSelector.addEventListener('click', loadSelectedTournament);
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
                bracketState.availableTeams = [];
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

        // Clear existing options
        selector.innerHTML = '<option value="">Select saved team configuration...</option>';

        if (teamConfigs.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No saved team configurations found - Use Team Balancer to save teams first';
            option.disabled = true;
            selector.appendChild(option);
            return;
        }

        // Add team configurations
        teamConfigs.forEach(config => {
            const option = document.createElement('option');
            option.value = config.teamSetId;
            option.textContent = `${config.title} (${config.totalTeams} teams, ${config.totalPlayers} players)`;
            
            // Store the full configuration object on the option element for easy access
            option.dataset.teamConfig = JSON.stringify(config);
            
            selector.appendChild(option);
        });

        // Trigger change event if there's only one config, to auto-load it
        if (teamConfigs.length === 1) {
            selector.selectedIndex = 1;
            selector.dispatchEvent(new Event('change'));
        }

        updateTournamentStats();
    }

    /**
     * Load the teams from the selected configuration into the bracket state
     */
    async function loadSelectedTeamConfiguration() {
        const teamConfigSelector = document.getElementById('tournament-selector');
        if (!teamConfigSelector) return;

        const selectedOption = teamConfigSelector.options[teamConfigSelector.selectedIndex];
        
        if (!selectedOption || !selectedOption.dataset.teamConfig) {
            bracketState.availableTeams = [];
            updateTournamentStats();
            return;
        }

        const teamConfig = JSON.parse(selectedOption.dataset.teamConfig);

        // Defensive coding: Check if 'teams' is a string and parse it if needed
        let teamsData = teamConfig.teams;
        if (typeof teamsData === 'string') {
            try {
                teamsData = JSON.parse(teamsData);
            } catch (e) {
                console.error('Failed to re-parse nested teams data:', e);
                teamsData = [];
            }
        }
        
        if (teamConfig && Array.isArray(teamsData)) {
            bracketState.availableTeams = teamsData.map(team => ({
                id: team.teamNumber,
                name: team.name || `Team ${team.teamNumber}`,
                players: team.players || [],
                isEliminated: false
            }));
            
            console.log(`Team config "${teamConfig.title}" selected with ${bracketState.availableTeams.length} teams.`);
        } else {
            bracketState.availableTeams = [];
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
            const count = bracketState.availableTeams.length;
            teamCountElement.textContent = `${count} team${count !== 1 ? 's' : ''}`;
        }
    }

    /**
     * Update tournament statistics
     */
    function updateTournamentStats() {
        const teams = bracketState.availableTeams;
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
        if (bracketState.currentTournament) {
            const currentRoundDisplay = document.getElementById('tournament-current-round');
            if (currentRoundDisplay) {
                currentRoundDisplay.textContent = bracketState.currentTournament.currentRound + 1;
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
     * Load registration sessions
     */
    async function loadRegistrationSessions() {
        console.log('📋 Loading registration sessions...');
        // Implementation would load from registration sessions API
        // For now, just update the selector
        const sessionSelector = document.getElementById('tournament-bracket-session-selector');
        if (sessionSelector) {
            sessionSelector.innerHTML = '<option value="">No tournaments available</option>';
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
        const teams = bracketState.availableTeams;
        const tournamentName = document.getElementById('tournament-name')?.value || 'Dota 2 Tournament';
        const selectedFormat = document.getElementById('tournament-format')?.value || 'single_elimination';
        const description = document.getElementById('tournament-description')?.value || '';
        
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
        
        bracketState.currentTournament = {
            id: `tournament_${Date.now()}`,
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
        const tournament = bracketState.currentTournament;
        if (!tournament) return;
        
        // Hide empty state
        const emptyState = document.getElementById('tournament-empty-state');
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
        const visualization = document.getElementById('tournament-bracket-visualization');
        if (visualization) {
            visualization.style.display = 'block';
            renderTournamentBracket(visualization);
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

        if (visualization) {
            visualization.style.display = 'none';
        }

        const winnerCard = document.getElementById('tournament-winner-card');
        if (winnerCard) {
            winnerCard.innerHTML = '';
        }
        
        const tournamentHeader = document.getElementById('tournament-header');
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

            if (team1WinnerBtn) {
                team1WinnerBtn.addEventListener('click', () => setMatchWinner(matchId, 1));
            }
            if (team2WinnerBtn) {
                team2WinnerBtn.addEventListener('click', () => setMatchWinner(matchId, 2));
            }
        });
    }

    /**
     * Set the winner for a specific match
     */
    function setMatchWinner(matchId, winnerNumber) {
        const tournament = bracketState.currentTournament;
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
        const tournament = bracketState.currentTournament;
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
        } else {
            // This was the final match
            console.log('🏆 Tournament finished! Winner:', completedMatch.winner.name);
            displayTournamentWinner(completedMatch.winner);
        }
    }

    /**
     * Render tournament bracket in the visualization area
     */
    function renderTournamentBracket(container) {
        const tournament = bracketState.currentTournament;
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
        const tournament = bracketState.currentTournament;
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
        const tournament = bracketState.currentTournament;
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
        const tournament = bracketState.currentTournament;
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
        const tournament = bracketState.currentTournament;
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
        const tournament = bracketState.currentTournament;
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
        const tournament = bracketState.currentTournament;
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
        bracketState.currentTournament = null;
        bracketState.matches.clear();
        
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
        
        const tournamentHeader = document.getElementById('tournament-header');
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

    /**
     * Save the current tournament state to the database
     */
    async function saveTournamentToDb() {
        const tournament = bracketState.currentTournament;
        if (!tournament) return;

        const sessionId = window.sessionManager?.getSessionId();
        if (!sessionId) {
            console.warn('Cannot save tournament without a session.');
            return;
        }

        try {
            const response = await fetch('/.netlify/functions/tournaments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': sessionId
                },
                body: JSON.stringify(tournament)
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
        console.log('📋 Loading saved tournaments...');
        const selector = document.getElementById('saved-tournament-selector');
        if (!selector) return;

        try {
            const sessionId = window.sessionManager?.getSessionId();
            if (!sessionId) return;

            const response = await fetch('/.netlify/functions/tournaments', {
                headers: { 'x-session-id': sessionId }
            });

            if (!response.ok) {
                throw new Error('Failed to load tournaments');
            }

            const tournaments = await response.json();
            
            selector.innerHTML = '<option value="">Select a saved tournament to load...</option>';
            if (tournaments.length === 0) {
                const option = document.createElement('option');
                option.textContent = 'No saved tournaments found';
                option.disabled = true;
                selector.appendChild(option);
                return;
            }

            tournaments.forEach(tourn => {
                const option = document.createElement('option');
                option.value = tourn.id;
                const date = new Date(tourn.created_at).toLocaleDateString();
                option.textContent = `${tourn.name} (Saved on ${date})`;
                selector.appendChild(option);
            });

        } catch (error) {
            console.error('Error loading tournaments:', error);
            selector.innerHTML = '<option value="">Error loading tournaments</option>';
        }
    }

    /**
     * Load a selected tournament from the database
     */
    async function loadSelectedTournament() {
        const selector = document.getElementById('saved-tournament-selector');
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

            const tournamentData = await response.json();
            bracketState.currentTournament = tournamentData;

            displayTournamentBracket();
            showTournamentControls();
            updateTournamentStats();

            if (window.showNotification) {
                window.showNotification(`Tournament "${tournamentData.name}" loaded successfully!`, 'success');
            }
        } catch (error) {
            console.error('Error loading tournament:', error);
            if (window.showNotification) {
                window.showNotification('Error loading tournament.', 'danger');
            }
        }
    }

    // Tournament bracket initialization is now handled by navigation.js
    // Only initialize when the tournament bracket tab is actually loaded
    // This prevents unnecessary API calls when on other tabs

    // Expose functions globally
    window.initTournamentBracketPage = initTournamentBracketPage;

    window.tournamentBracketsModule = {
        initTournamentBracketPage,
        createTournamentBracket: window.createTournamentBracket,
        reportMatchResult: window.reportMatchResult,
        exportBracket: window.exportBracket,
        resetTournament: window.resetTournament,
        loadAvailableTeams,
        importTeamsFromBalancer
    };

})();
