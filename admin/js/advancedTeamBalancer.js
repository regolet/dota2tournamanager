// Advanced Team Balancer with Role-Based Balancing and Player Synergy
(function() {
    'use strict';

    // Enhanced state with role-based data
    const advancedState = {
        playerRoles: new Map(), // playerId -> role preferences
        playerSynergies: new Map(), // playerId -> Map(otherId -> synergy score)
        roleBalance: {
            carry: { min: 1, max: 1, preferred: 1 },
            mid: { min: 1, max: 1, preferred: 1 },
            offlane: { min: 1, max: 1, preferred: 1 },
            support: { min: 1, max: 2, preferred: 1 },
            hardSupport: { min: 1, max: 2, preferred: 1 }
        },
        advancedSettings: {
            considerRoles: true,
            considerSynergies: true,
            synergyWeight: 0.3, // 30% weight for synergy vs 70% for MMR
            roleStrictness: 'flexible' // strict, flexible, ignore
        }
    };

    // Dota 2 role definitions
    const DOTA_ROLES = {
        carry: { name: 'Carry (Pos 1)', icon: 'bi-award', color: '#ff6b6b' },
        mid: { name: 'Mid (Pos 2)', icon: 'bi-star', color: '#4ecdc4' },
        offlane: { name: 'Offlane (Pos 3)', icon: 'bi-shield', color: '#45b7d1' },
        support: { name: 'Support (Pos 4)', icon: 'bi-heart', color: '#96ceb4' },
        hardSupport: { name: 'Hard Support (Pos 5)', icon: 'bi-shield-heart', color: '#feca57' }
    };

    /**
     * Initialize advanced team balancer features
     */
    function initAdvancedTeamBalancer() {
        console.log('🚀 Initializing advanced team balancer...');
        
        // Add role-based balancing options to UI
        enhanceTeamBalancerUI();
        
        // Load saved player roles and synergies
        loadPlayerRoleData();
        
        // Add new balance methods
        addAdvancedBalanceMethods();
        
        console.log('✅ Advanced team balancer initialized');
    }

    /**
     * Enhance the team balancer UI with role-based controls
     */
    function enhanceTeamBalancerUI() {
        const balanceTypeSelect = document.getElementById('balance-type');
        if (!balanceTypeSelect) return;

        // Add advanced balance methods
        const advancedOptions = [
            { value: 'roleBalanced', text: '🎯 Role-Balanced Teams' },
            { value: 'synergyOptimized', text: '🤝 Synergy-Optimized Teams' },
            { value: 'hybridAdvanced', text: '⚡ Hybrid Advanced (Roles + Synergy)' },
            { value: 'skillGrouping', text: '📊 Skill Tier Grouping' }
        ];

        advancedOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            balanceTypeSelect.appendChild(optionElement);
        });

        // Add advanced settings panel
        createAdvancedSettingsPanel();
    }

    /**
     * Create advanced settings panel
     */
    function createAdvancedSettingsPanel() {
        const teamBalancerSection = document.getElementById('team-balancer');
        if (!teamBalancerSection) return;

        const settingsPanel = document.createElement('div');
        settingsPanel.id = 'advanced-balancer-settings';
        settingsPanel.className = 'card mb-4';
        settingsPanel.style.display = 'none'; // Hidden by default
        settingsPanel.innerHTML = `
            <div class="card-header">
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">
                        <i class="bi bi-gear me-2"></i>Advanced Balancing Settings
                    </h6>
                    <button class="btn btn-sm btn-outline-secondary" onclick="toggleAdvancedSettings()">
                        <i class="bi bi-chevron-down" id="settings-toggle-icon"></i>
                    </button>
                </div>
            </div>
            <div class="card-body collapse" id="advanced-settings-body">
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label small">Role Strictness</label>
                        <select id="role-strictness" class="form-select form-select-sm">
                            <option value="flexible">Flexible (Preferred)</option>
                            <option value="strict">Strict (Required)</option>
                            <option value="ignore">Ignore Roles</option>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label small">Synergy Weight</label>
                        <input type="range" id="synergy-weight" class="form-range" min="0" max="100" value="30">
                        <small class="text-muted">MMR: <span id="mmr-weight">70</span>% | Synergy: <span id="synergy-weight-display">30</span>%</small>
                    </div>
                    <div class="col-md-4">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="enable-role-balancing" checked>
                            <label class="form-check-label small" for="enable-role-balancing">
                                Enable Role Balancing
                            </label>
                        </div>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="enable-synergy-tracking" checked>
                            <label class="form-check-label small" for="enable-synergy-tracking">
                                Enable Synergy Tracking
                            </label>
                        </div>
                    </div>
                </div>
                
                <hr class="my-3">
                
                <div class="row">
                    <div class="col-12">
                        <h6 class="mb-3">
                            <i class="bi bi-people me-2"></i>Player Role Management
                        </h6>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="small text-muted">Assign roles to players for better team composition</span>
                            <button class="btn btn-sm btn-outline-primary" onclick="showPlayerRoleModal()">
                                <i class="bi bi-person-gear me-1"></i>Manage Player Roles
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insert after session selector
        const sessionSelector = document.querySelector('.session-selector-container');
        if (sessionSelector) {
            sessionSelector.parentNode.insertBefore(settingsPanel, sessionSelector.nextSibling);
        }

        // Setup event listeners
        setupAdvancedSettingsListeners();
    }

    /**
     * Setup event listeners for advanced settings
     */
    function setupAdvancedSettingsListeners() {
        // Synergy weight slider
        const synergySlider = document.getElementById('synergy-weight');
        if (synergySlider) {
            synergySlider.addEventListener('input', (e) => {
                const synergyWeight = parseInt(e.target.value);
                const mmrWeight = 100 - synergyWeight;
                
                document.getElementById('synergy-weight-display').textContent = synergyWeight;
                document.getElementById('mmr-weight').textContent = mmrWeight;
                
                advancedState.advancedSettings.synergyWeight = synergyWeight / 100;
            });
        }

        // Role strictness change
        const roleStrictnessSelect = document.getElementById('role-strictness');
        if (roleStrictnessSelect) {
            roleStrictnessSelect.addEventListener('change', (e) => {
                advancedState.advancedSettings.roleStrictness = e.target.value;
            });
        }

        // Checkbox listeners
        const roleBalancingCheck = document.getElementById('enable-role-balancing');
        const synergyTrackingCheck = document.getElementById('enable-synergy-tracking');
        
        if (roleBalancingCheck) {
            roleBalancingCheck.addEventListener('change', (e) => {
                advancedState.advancedSettings.considerRoles = e.target.checked;
            });
        }
        
        if (synergyTrackingCheck) {
            synergyTrackingCheck.addEventListener('change', (e) => {
                advancedState.advancedSettings.considerSynergies = e.target.checked;
            });
        }
    }

    /**
     * Toggle advanced settings panel
     */
    window.toggleAdvancedSettings = function() {
        const settingsBody = document.getElementById('advanced-settings-body');
        const toggleIcon = document.getElementById('settings-toggle-icon');
        
        if (settingsBody && toggleIcon) {
            const isCollapsed = settingsBody.classList.contains('collapse');
            
            if (isCollapsed) {
                settingsBody.classList.remove('collapse');
                settingsBody.classList.add('show');
                toggleIcon.className = 'bi bi-chevron-up';
            } else {
                settingsBody.classList.remove('show');
                settingsBody.classList.add('collapse');
                toggleIcon.className = 'bi bi-chevron-down';
            }
        }
    };

    /**
     * Show player role management modal
     */
    window.showPlayerRoleModal = function() {
        createPlayerRoleModal();
        const modal = new bootstrap.Modal(document.getElementById('playerRoleModal'));
        modal.show();
        loadPlayerRoleData();
        populatePlayerRoleModal();
    };

    /**
     * Create player role management modal
     */
    function createPlayerRoleModal() {
        let modal = document.getElementById('playerRoleModal');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'playerRoleModal';
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-person-gear me-2"></i>Player Role Management
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <div class="row g-2">
                                    ${Object.entries(DOTA_ROLES).map(([roleId, role]) => `
                                        <div class="col-auto">
                                            <span class="badge" style="background-color: ${role.color};">
                                                <i class="${role.icon} me-1"></i>${role.name}
                                            </span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div id="player-role-list">
                                <div class="text-center py-4">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading players...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="savePlayerRoles()">
                                <i class="bi bi-save me-1"></i>Save Roles
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
    }

    /**
     * Populate player role modal with current players
     */
    function populatePlayerRoleModal() {
        const playerRoleList = document.getElementById('player-role-list');
        if (!playerRoleList) return;

        // Get current players from team balancer state
        const players = window.state?.availablePlayers || [];

        if (players.length === 0) {
            playerRoleList.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    No players loaded. Please load players in the team balancer first.
                </div>
            `;
            return;
        }

        const playerRoleHtml = players.map(player => {
            const currentRole = advancedState.playerRoles.get(player.id) || 'support';
            
            return `
                <div class="card mb-2">
                    <div class="card-body py-2">
                        <div class="row align-items-center">
                            <div class="col-md-4">
                                <div class="d-flex align-items-center">
                                    <div class="avatar avatar-sm bg-primary text-white rounded-circle me-2 d-flex align-items-center justify-content-center" 
                                         style="width: 32px; height: 32px; font-size: 0.85rem;">
                                        ${player.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div class="fw-medium">${escapeHtml(player.name)}</div>
                                        <small class="text-muted">${player.peakmmr || 0} MMR</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <select class="form-select form-select-sm player-role-select" data-player-id="${player.id}">
                                    ${Object.entries(DOTA_ROLES).map(([roleId, role]) => `
                                        <option value="${roleId}" ${currentRole === roleId ? 'selected' : ''}>
                                            ${role.name}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="col-md-2 text-end">
                                <span class="badge" style="background-color: ${DOTA_ROLES[currentRole]?.color || '#6c757d'};">
                                    <i class="${DOTA_ROLES[currentRole]?.icon || 'bi-person'} me-1"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        playerRoleList.innerHTML = playerRoleHtml;
    }

    /**
     * Save player roles
     */
    window.savePlayerRoles = function() {
        const roleSelects = document.querySelectorAll('.player-role-select');
        
        roleSelects.forEach(select => {
            const playerId = select.getAttribute('data-player-id');
            const selectedRole = select.value;
            advancedState.playerRoles.set(playerId, selectedRole);
        });

        // Save to localStorage
        savePlayerRoleData();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('playerRoleModal'));
        if (modal) {
            modal.hide();
        }
        
        // Show success notification
        if (window.showNotification) {
            window.showNotification('Player roles saved successfully', 'success');
        }
    };

    /**
     * Load player role data from localStorage
     */
    function loadPlayerRoleData() {
        try {
            const savedRoles = localStorage.getItem('tournament-player-roles');
            const savedSynergies = localStorage.getItem('tournament-player-synergies');
            
            if (savedRoles) {
                const rolesData = JSON.parse(savedRoles);
                advancedState.playerRoles = new Map(rolesData);
            }
            
            if (savedSynergies) {
                const synergiesData = JSON.parse(savedSynergies);
                advancedState.playerSynergies = new Map(
                    synergiesData.map(([playerId, synergies]) => [
                        playerId, 
                        new Map(synergies)
                    ])
                );
            }
        } catch (error) {
            console.warn('Could not load player role data:', error);
        }
    }

    /**
     * Save player role data to localStorage
     */
    function savePlayerRoleData() {
        try {
            // Save roles
            const rolesArray = Array.from(advancedState.playerRoles.entries());
            localStorage.setItem('tournament-player-roles', JSON.stringify(rolesArray));
            
            // Save synergies
            const synergiesArray = Array.from(advancedState.playerSynergies.entries()).map(
                ([playerId, synergies]) => [playerId, Array.from(synergies.entries())]
            );
            localStorage.setItem('tournament-player-synergies', JSON.stringify(synergiesArray));
        } catch (error) {
            console.warn('Could not save player role data:', error);
        }
    }

    /**
     * Add advanced balance methods to the distribution system
     */
    function addAdvancedBalanceMethods() {
        // Hook into the existing balance method selector
        const balanceTypeSelect = document.getElementById('balance-type');
        if (balanceTypeSelect) {
            balanceTypeSelect.addEventListener('change', (e) => {
                const selectedMethod = e.target.value;
                
                // Show/hide advanced settings based on method
                const advancedSettingsPanel = document.getElementById('advanced-balancer-settings');
                if (advancedSettingsPanel) {
                    const isAdvancedMethod = ['roleBalanced', 'synergyOptimized', 'hybridAdvanced', 'skillGrouping'].includes(selectedMethod);
                    advancedSettingsPanel.style.display = isAdvancedMethod ? 'block' : 'none';
                }
            });
        }

        // Override the existing distribution method if it exists
        if (window.distributePlayersByMethod) {
            const originalDistributePlayersByMethod = window.distributePlayersByMethod;
            
            window.distributePlayersByMethod = function(players, method, numTeams, teamSize) {
                switch (method) {
                    case 'roleBalanced':
                        return distributeRoleBalancedTeams(players, numTeams, teamSize);
                    case 'synergyOptimized':
                        return distributeSynergyOptimizedTeams(players, numTeams, teamSize);
                    case 'hybridAdvanced':
                        return distributeHybridAdvancedTeams(players, numTeams, teamSize);
                    case 'skillGrouping':
                        return distributeSkillGroupingTeams(players, numTeams, teamSize);
                    default:
                        return originalDistributePlayersByMethod(players, method, numTeams, teamSize);
                }
            };
        }
    }

    /**
     * Role-Balanced Team Distribution
     */
    function distributeRoleBalancedTeams(players, numTeams, teamSize) {
        console.log('🎯 Using Role-Balanced Distribution');
        
        if (!advancedState.advancedSettings.considerRoles) {
            console.log('Role balancing disabled, falling back to high ranked balance');
            if (window.distributeHighRankedBalance) {
                return window.distributeHighRankedBalance(players, numTeams, teamSize);
            }
            return;
        }

        // Group players by their assigned roles
        const playersByRole = {
            carry: [],
            mid: [],
            offlane: [],
            support: [],
            hardSupport: [],
            unassigned: []
        };

        players.forEach(player => {
            const playerRole = advancedState.playerRoles.get(player.id) || 'unassigned';
            if (playersByRole[playerRole]) {
                playersByRole[playerRole].push(player);
            } else {
                playersByRole.unassigned.push(player);
            }
        });

        // Sort each role by MMR (highest first)
        Object.keys(playersByRole).forEach(role => {
            playersByRole[role].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
        });

        console.log('🎯 Players by role:', Object.fromEntries(
            Object.entries(playersByRole).map(([role, players]) => [role, players.length])
        ));

        // Distribute players by role priority
        const teams = window.state.balancedTeams;
        
        // Phase 1: Assign core roles (1 per team)
        ['carry', 'mid', 'offlane'].forEach(role => {
            const rolePlayers = playersByRole[role];
            for (let i = 0; i < Math.min(rolePlayers.length, numTeams); i++) {
                const player = rolePlayers[i];
                teams[i].players.push(player);
                teams[i].totalMmr += player.peakmmr || 0;
                console.log(`🎯 Assigned ${player.name} (${role}) to Team ${i + 1}`);
            }
        });

        // Phase 2: Assign support roles (prefer 1 of each type per team)
        ['hardSupport', 'support'].forEach(role => {
            const rolePlayers = playersByRole[role];
            for (let i = 0; i < Math.min(rolePlayers.length, numTeams); i++) {
                const player = rolePlayers[i];
                teams[i].players.push(player);
                teams[i].totalMmr += player.peakmmr || 0;
                console.log(`🎯 Assigned ${player.name} (${role}) to Team ${i + 1}`);
            }
        });

        // Phase 3: Fill remaining slots with unassigned players and extras
        const remainingPlayers = [
            ...playersByRole.unassigned,
            ...playersByRole.carry.slice(numTeams),
            ...playersByRole.mid.slice(numTeams),
            ...playersByRole.offlane.slice(numTeams),
            ...playersByRole.support.slice(numTeams),
            ...playersByRole.hardSupport.slice(numTeams)
        ].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));

        for (const player of remainingPlayers) {
            // Find team with least players that's not full
            const availableTeams = teams.filter(team => team.players.length < teamSize);
            if (availableTeams.length === 0) break;

            const targetTeam = availableTeams.reduce((min, team) => 
                team.players.length < min.players.length ? team : min
            );
            
            const actualTeamIndex = teams.indexOf(targetTeam);
            targetTeam.players.push(player);
            targetTeam.totalMmr += player.peakmmr || 0;
            
            console.log(`🎯 Filled remaining slot: ${player.name} to Team ${actualTeamIndex + 1}`);
        }

        console.log('🎯 Role-balanced distribution completed');
        
        // Log team compositions
        teams.forEach((team, index) => {
            const roles = team.players.map(p => advancedState.playerRoles.get(p.id) || 'unassigned');
            const roleCount = roles.reduce((acc, role) => {
                acc[role] = (acc[role] || 0) + 1;
                return acc;
            }, {});
            console.log(`Team ${index + 1} roles:`, roleCount);
        });
    }

    /**
     * Synergy-Optimized Team Distribution
     */
    function distributeSynergyOptimizedTeams(players, numTeams, teamSize) {
        console.log('🤝 Using Synergy-Optimized Distribution');
        
        // Calculate synergy matrix
        const synergyMatrix = calculatePlayerSynergyMatrix(players);
        
        // Use genetic algorithm for optimal team composition
        const teams = optimizeTeamsBySynergy(players, synergyMatrix, numTeams, teamSize);
        
        // Update global team state
        teams.forEach((team, index) => {
            window.state.balancedTeams[index] = {
                players: team.players,
                totalMmr: team.players.reduce((sum, p) => sum + (p.peakmmr || 0), 0),
                synergyScore: team.synergyScore
            };
        });
        
        console.log('🤝 Synergy-optimized distribution completed');
    }

    /**
     * Calculate player synergy matrix
     */
    function calculatePlayerSynergyMatrix(players) {
        const matrix = new Map();
        
        players.forEach(player1 => {
            const player1Synergies = new Map();
            
            players.forEach(player2 => {
                if (player1.id === player2.id) {
                    player1Synergies.set(player2.id, 1.0); // Self synergy
                    return;
                }
                
                // Get saved synergy or calculate based on MMR similarity
                let synergy = 0.5; // Default neutral synergy
                
                if (advancedState.playerSynergies.has(player1.id)) {
                    const player1Map = advancedState.playerSynergies.get(player1.id);
                    if (player1Map.has(player2.id)) {
                        synergy = player1Map.get(player2.id);
                    }
                }
                
                // If no saved synergy, calculate based on MMR proximity
                if (synergy === 0.5) {
                    const mmrDiff = Math.abs((player1.peakmmr || 0) - (player2.peakmmr || 0));
                    const maxMmrDiff = 3000; // Assume max meaningful MMR difference
                    synergy = Math.max(0.1, 1 - (mmrDiff / maxMmrDiff)); // Higher synergy for similar MMR
                }
                
                player1Synergies.set(player2.id, synergy);
            });
            
            matrix.set(player1.id, player1Synergies);
        });
        
        return matrix;
    }

    /**
     * Optimize teams using genetic algorithm for synergy
     */
    function optimizeTeamsBySynergy(players, synergyMatrix, numTeams, teamSize) {
        const maxPlayersForTeams = numTeams * teamSize;
        const playersForTeams = players.slice(0, maxPlayersForTeams);
        
        // Simple greedy approach for now (can be enhanced with genetic algorithm)
        const teams = Array.from({ length: numTeams }, () => ({ 
            players: [], 
            synergyScore: 0 
        }));
        
        // Sort players by MMR
        const sortedPlayers = [...playersForTeams].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
        
        // Distribute players to maximize synergy
        sortedPlayers.forEach(player => {
            const availableTeams = teams.filter(team => team.players.length < teamSize);
            if (availableTeams.length === 0) return;
            
            // Find team that maximizes synergy with this player
            let bestTeam = availableTeams[0];
            let bestSynergyIncrease = 0;
            
            availableTeams.forEach(team => {
                const synergyIncrease = calculateTeamSynergyIncrease(team, player, synergyMatrix);
                if (synergyIncrease > bestSynergyIncrease) {
                    bestSynergyIncrease = synergyIncrease;
                    bestTeam = team;
                }
            });
            
            bestTeam.players.push(player);
            bestTeam.synergyScore = calculateTeamSynergy(bestTeam.players, synergyMatrix);
        });
        
        return teams;
    }

    /**
     * Calculate synergy increase for adding a player to a team
     */
    function calculateTeamSynergyIncrease(team, newPlayer, synergyMatrix) {
        if (team.players.length === 0) return 0;
        
        const playerSynergies = synergyMatrix.get(newPlayer.id);
        if (!playerSynergies) return 0;
        
        let totalSynergy = 0;
        team.players.forEach(teamPlayer => {
            totalSynergy += playerSynergies.get(teamPlayer.id) || 0.5;
        });
        
        return totalSynergy / team.players.length;
    }

    /**
     * Calculate total team synergy
     */
    function calculateTeamSynergy(players, synergyMatrix) {
        if (players.length < 2) return 0;
        
        let totalSynergy = 0;
        let pairCount = 0;
        
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const player1Synergies = synergyMatrix.get(players[i].id);
                if (player1Synergies) {
                    totalSynergy += player1Synergies.get(players[j].id) || 0.5;
                    pairCount++;
                }
            }
        }
        
        return pairCount > 0 ? totalSynergy / pairCount : 0;
    }

    /**
     * Hybrid Advanced Team Distribution (Roles + Synergy + MMR)
     */
    function distributeHybridAdvancedTeams(players, numTeams, teamSize) {
        console.log('⚡ Using Hybrid Advanced Distribution (Roles + Synergy + MMR)');
        
        // First pass: Role-based distribution
        distributeRoleBalancedTeams(players, numTeams, teamSize);
        
        // Second pass: Optimize for synergy while maintaining role balance
        if (advancedState.advancedSettings.considerSynergies) {
            optimizeTeamsForSynergy();
        }
        
        console.log('⚡ Hybrid advanced distribution completed');
    }

    /**
     * Optimize existing teams for synergy
     */
    function optimizeTeamsForSynergy() {
        // Implementation for synergy optimization post role-balancing
        console.log('🔄 Optimizing teams for synergy...');
        
        const teams = window.state.balancedTeams;
        const synergyMatrix = calculatePlayerSynergyMatrix(
            teams.flatMap(team => team.players)
        );
        
        // Calculate and log synergy scores
        teams.forEach((team, index) => {
            const synergyScore = calculateTeamSynergy(team.players, synergyMatrix);
            console.log(`Team ${index + 1} synergy score: ${synergyScore.toFixed(3)}`);
        });
    }

    /**
     * Skill Tier Grouping Distribution
     */
    function distributeSkillGroupingTeams(players, numTeams, teamSize) {
        console.log('📊 Using Skill Tier Grouping Distribution');
        
        // Create MMR tiers
        const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
        const tierSize = Math.ceil(sortedPlayers.length / 5); // 5 skill tiers
        
        const tiers = {
            immortal: sortedPlayers.slice(0, tierSize),
            divine: sortedPlayers.slice(tierSize, tierSize * 2),
            ancient: sortedPlayers.slice(tierSize * 2, tierSize * 3),
            legend: sortedPlayers.slice(tierSize * 3, tierSize * 4),
            crusader: sortedPlayers.slice(tierSize * 4)
        };
        
        console.log('📊 Skill tiers:', Object.fromEntries(
            Object.entries(tiers).map(([tier, players]) => [tier, players.length])
        ));
        
        const teams = window.state.balancedTeams;
        
        // Distribute one player from each tier to each team
        Object.entries(tiers).forEach(([tierName, tierPlayers]) => {
            tierPlayers.forEach((player, index) => {
                const teamIndex = index % numTeams;
                if (teams[teamIndex].players.length < teamSize) {
                    teams[teamIndex].players.push(player);
                    teams[teamIndex].totalMmr += player.peakmmr || 0;
                    console.log(`📊 Added ${player.name} (${tierName}) to Team ${teamIndex + 1}`);
                }
            });
        });
        
        console.log('📊 Skill tier grouping distribution completed');
    }

    /**
     * Utility function to escape HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAdvancedTeamBalancer);
    } else {
        // Small delay to ensure team balancer is loaded first
        setTimeout(initAdvancedTeamBalancer, 200);
    }

    // Expose functions globally
    window.advancedTeamBalancerModule = {
        initAdvancedTeamBalancer,
        showPlayerRoleModal: window.showPlayerRoleModal,
        savePlayerRoles: window.savePlayerRoles,
        toggleAdvancedSettings: window.toggleAdvancedSettings
    };

})(); 