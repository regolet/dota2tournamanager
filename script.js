// Updated for Neon DB API endpoints - v2.0.1
document.addEventListener('DOMContentLoaded', function() {
    const playerForm = document.getElementById('playerForm');
    const messageDiv = document.getElementById('message');
    
    // Registration status elements
    const countdownSection = document.getElementById('countdown-section');
    const registrationClosedDiv = document.getElementById('registration-closed');
    const registrationNotOpenDiv = document.getElementById('registration-not-open');
    
    // Countdown timer elements
    const daysElement = document.getElementById('days');
    const hoursElement = document.getElementById('hours');
    const minutesElement = document.getElementById('minutes');
    const secondsElement = document.getElementById('seconds');
    
    // Player count elements
    const currentPlayerCountElement = document.getElementById('current-player-count');
    const maxPlayerCountElement = document.getElementById('max-player-count');
    
    // Check registration status
    checkRegistrationStatus();
    
    // Check player count
    checkPlayerCount();
    
    // Function to check if player already exists
    async function checkDuplicatePlayer(name, dota2id) {
        try {
            const response = await fetch('/.netlify/functions/get-players');
            if (!response.ok) {
                throw new Error('Failed to fetch player data');
            }
            
            const players = await response.json();
            if (!Array.isArray(players)) return null;
            
            // Check for duplicate name or Dota 2 ID
            const duplicateName = players.find(player => 
                player.name && player.name.toLowerCase() === name.toLowerCase());
                
            const duplicateDota2Id = players.find(player => 
                player.dota2id && player.dota2id === dota2id);
            
            if (duplicateName) {
                return { type: 'name', player: duplicateName };
            }
            
            if (duplicateDota2Id) {
                return { type: 'dota2id', player: duplicateDota2Id };
            }
            
            return null;
        } catch (error) {
            // Silently handle duplicate check errors
            throw error;
        }
    }
    
    playerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form values
        const name = document.getElementById('name').value.trim();
        const dota2id = document.getElementById('dota2id').value.trim();
        const peakmmr = parseInt(document.getElementById('peakmmr').value);
        
        // Validate input
        if (!name || !dota2id || isNaN(peakmmr)) {
            showMessage('Please fill in all fields correctly.', 'error');
            return;
        }
        
        // Validate Dota 2 ID format (should be a number)
        if (!/^\d+$/.test(dota2id)) {
            showMessage('Dota 2 ID should be a numeric Friend ID.', 'error');
            return;
        }
        
        try {
            // Check for duplicate before proceeding
            const duplicate = await checkDuplicatePlayer(name, dota2id);
            if (duplicate) {
                if (duplicate.type === 'name') {
                    showMessage(`Registration failed: Player name "${name}" is already registered.`, 'error');
                } else {
                    showMessage(`Registration failed: Dota 2 ID "${dota2id}" is already registered.`, 'error');
                }
                return;
            }
            
            // Create player object
            const player = {
                name: name,
                dota2id: dota2id,
                peakmmr: peakmmr,
                registrationDate: new Date().toISOString(),
                id: `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`
            };
            
            // Save player to server using API endpoint
            const response = await fetch('/.netlify/functions/add-player', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(player)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                // Extract error message from server response if available
                const errorMessage = result && result.message ? result.message : 'Failed to save player';
                
                // Handle specific error types
                if (result && result.errorType === 'DUPLICATE_PLAYER') {
                    throw new Error(errorMessage);
                }
                
                throw new Error(errorMessage);
            }
            
            // Reset form and show success message with masterlist info
            playerForm.reset();
            
            // Show enhanced success message
            let successMessage = 'Player registered successfully!';
            if (result.verifiedFromMasterlist) {
                successMessage += ` Your MMR was verified from the masterlist (${result.verifiedMmr} MMR).`;
            } else {
                successMessage += ` Your MMR (${result.player.peakmmr}) has been added to the masterlist.`;
            }
            
            showMessage(successMessage, 'success');
            
            // Update player count after successful registration
            checkPlayerCount();
            
        } catch (error) {
            // Show user-friendly error message without console logging
            showMessage('Registration failed: ' + error.message, 'error');
        }
    });
    
    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = type;
        messageDiv.classList.remove('hidden');
        
        // Hide message after 5 seconds
        setTimeout(() => {
            messageDiv.classList.add('hidden');
        }, 5000);
    }
    
    // Function to check current player count
    async function checkPlayerCount() {
        try {
            const response = await fetch('/.netlify/functions/get-players');
            if (!response.ok) {
                throw new Error('Failed to fetch player count');
            }
            
            const data = await response.json();
            const count = data.count || 0;
            
            // Update player count display
            if (currentPlayerCountElement) {
                currentPlayerCountElement.textContent = count;
            }
            
            return count;
        } catch (error) {
            // Silently handle player count errors
            return 0;
        }
    }
    
    // Check registration status from server
    function checkRegistrationStatus() {
        // Load registration status from Neon DB API
        fetch('/.netlify/functions/registration')
            .then(response => response.json())
            .then(data => {
                // Use the data directly or extract the registration object if needed
                const registration = data.registration || data.settings || data;
                updateRegistrationUI(registration);
            })
            .catch(error => {
                // If error, default to registration not open
                showRegistrationNotOpen();
            });
            
        // Check every minute for updates
        setTimeout(checkRegistrationStatus, 60000);
    }
    
    // Update UI based on registration status
    function updateRegistrationUI(data) {
        // Hide all registration status containers
        countdownSection.classList.add('hidden');
        registrationClosedDiv.classList.add('hidden');
        registrationNotOpenDiv.classList.add('hidden');
        
        // Get start time and expiry time
        const now = Date.now();
        const startTime = data.startTime ? new Date(data.startTime).getTime() : null;
        const expiryTime = data.expiry ? new Date(data.expiry).getTime() : null;
        
        // Helper to clear any previous countdown intervals
        if (window._registrationCountdownInterval) {
            clearInterval(window._registrationCountdownInterval);
        }
        
        if (startTime && now < startTime) {
            // Registration not open yet
            showRegistrationNotOpen();
            showCountdown(startTime, 'opens');
            startCountdown(startTime, 'opens', () => {
                updateRegistrationUI({ ...data, isOpen: true });
            });
            playerForm.classList.add('hidden');
            if (registrationNotOpenDiv) {
                registrationNotOpenDiv.innerHTML = '<div class="alert alert-info"><b>Registration opens soon!</b><br>Registration will open in:</div>';
            }
            return;
        }
        
        if (expiryTime && now < expiryTime) {
            // Registration is open
            showCountdown(expiryTime, 'closes');
            startCountdown(expiryTime, 'closes', () => {
                updateRegistrationUI({ ...data, isOpen: false });
            });
            playerForm.classList.remove('hidden');
            // Check if we need to monitor player limit
            if (data.enablePlayerLimit && data.playerLimit) {
                const playerLimitInterval = setInterval(async () => {
                    const count = await checkPlayerCount();
                    if (count >= data.playerLimit) {
                        clearInterval(playerLimitInterval);
                        showRegistrationClosed();
                        showMessage('Registration has closed: Player limit reached.', 'warning');
                    }
                }, 30000); // Check every 30 seconds
            }
            return;
        }
        
        // Registration closed
        showRegistrationClosed();
        playerForm.classList.add('hidden');
    }
    
    // Start countdown timer (now supports both open and close countdowns)
    function startCountdown(targetTime, mode, onComplete) {
        // Validate targetTime
        if (!targetTime || isNaN(new Date(targetTime).getTime())) {
            console.error('Invalid target time for countdown:', targetTime);
            return;
        }
        if (window._registrationCountdownInterval) {
            clearInterval(window._registrationCountdownInterval);
        }
        window._registrationCountdownInterval = setInterval(() => {
            try {
                const now = new Date().getTime();
                const target = new Date(targetTime).getTime();
                const timeRemaining = target - now;
                
                if (timeRemaining <= 0) {
                    clearInterval(window._registrationCountdownInterval);
                    if (typeof onComplete === 'function') onComplete();
                    return;
                }
                
                // Calculate days, hours, minutes, seconds
                const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
                
                // Update the countdown timer
                daysElement.textContent = formatTime(days);
                hoursElement.textContent = formatTime(hours);
                minutesElement.textContent = formatTime(minutes);
                secondsElement.textContent = formatTime(seconds);
                
                // Update the countdown label
                const countdownLabel = document.getElementById('countdown-label');
                if (countdownLabel) {
                    countdownLabel.textContent = mode === 'opens' ? 'Registration opens in:' : 'Registration closes in:';
                }
                // Optionally, update the soon message
                const soonMsg = document.getElementById('countdown-soon-msg');
                if (soonMsg) {
                    soonMsg.textContent = (mode === 'opens') ? '' : 'Hurry! Registration closes soon!';
                }
            } catch (error) {
                console.error('Error updating countdown:', error);
                clearInterval(window._registrationCountdownInterval);
            }
        }, 1000);
    }
    
    // Helper to format time components with leading zeros
    function formatTime(time) {
        return time < 10 ? `0${time}` : time;
    }
    
    // Show registration not open message
    function showRegistrationNotOpen() {
        registrationNotOpenDiv.classList.remove('hidden');
        playerForm.classList.add('hidden');
    }
    
    // Show registration closed message
    function showRegistrationClosed() {
        registrationClosedDiv.classList.remove('hidden');
        playerForm.classList.add('hidden');
    }
    
    // Show countdown timer (now supports both open and close modes)
    function showCountdown(targetTime, mode) {
        countdownSection.classList.remove('hidden');
        playerForm.classList.remove('hidden');
        // Update the countdown label immediately
        const countdownLabel = document.getElementById('countdown-label');
        if (countdownLabel) {
            countdownLabel.textContent = mode === 'opens' ? 'Registration opens in:' : 'Registration closes in:';
        }
        // Optionally, update the soon message
        const soonMsg = document.getElementById('countdown-soon-msg');
        if (soonMsg) {
            soonMsg.textContent = (mode === 'opens') ? '' : 'Hurry! Registration closes soon!';
        }
    }
});
