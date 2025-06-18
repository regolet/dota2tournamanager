// Updated for Neon DB API endpoints - v2.0.1
document.addEventListener('DOMContentLoaded', function() {
    const playerForm = document.getElementById('playerForm');
    const messageDiv = document.getElementById('message');
    
    // Registration status elements
    const countdownContainer = document.getElementById('countdown-container');
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
            const response = await fetch('./api/players');
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
            console.error('Error checking for duplicate player:', error);
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
            const response = await fetch('/api/add-player', {
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
            console.error('Error saving player:', error);
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
            const response = await fetch('/api/players');
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
            console.error('Error checking player count:', error);
            return 0;
        }
    }
    
    // Check registration status from server
    function checkRegistrationStatus() {
        // Load registration status from Neon DB API
        fetch('/api/registration')
            .then(response => response.json())
            .then(data => {
                // Use the data directly or extract the registration object if needed
                const registration = data.settings || data;
                updateRegistrationUI(registration);
            })
            .catch(error => {
                console.error('Error fetching registration status from API:', error);
                // If error, default to registration not open
                showRegistrationNotOpen();
            });
            
        // Check every minute for updates
        setTimeout(checkRegistrationStatus, 60000);
    }
    
    // Update UI based on registration status
    function updateRegistrationUI(data) {
        // Hide all registration status containers
        countdownContainer.classList.add('hidden');
        registrationClosedDiv.classList.add('hidden');
        registrationNotOpenDiv.classList.add('hidden');
        
        // Enable/disable the form
        playerForm.disabled = !data.isOpen;
        
        // Update player limit if available
        if (data.playerLimit && maxPlayerCountElement) {
            maxPlayerCountElement.textContent = data.playerLimit;
        }
        
        // First check if registration is explicitly marked as closed
        if (!data.isOpen) {
            // Registration is closed (either manually by admin or due to expiry)
            showRegistrationClosed();
            
            // Disable the form
            const submitButton = document.getElementById('submit-btn');
            if (submitButton) {
                submitButton.disabled = true;
            }
            
            // Add clear visual indication that form is disabled
            playerForm.classList.add('disabled-form');
        } else {
            // Registration is open with countdown
            const expiryTime = new Date(data.expiry).getTime();
            showCountdown(expiryTime);
            startCountdown(expiryTime);
            
            // Check if we need to monitor player limit
            if (data.enablePlayerLimit && data.playerLimit) {
                // Set up interval to check player count for limit
                const playerLimitInterval = setInterval(async () => {
                    const count = await checkPlayerCount();
                    if (count >= data.playerLimit) {
                        clearInterval(playerLimitInterval);
                        showRegistrationClosed();
                        showMessage('Registration has closed: Player limit reached.', 'warning');
                    }
                }, 30000); // Check every 30 seconds
            }
        }
    }
    
    // Start countdown timer
    function startCountdown(expiryTime) {
        // Update countdown every second
        const countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const timeRemaining = expiryTime - now;
            
            if (timeRemaining <= 0) {
                // Time expired
                clearInterval(countdownInterval);
                showRegistrationClosed();
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
    
    // Show countdown timer
    function showCountdown(expiryTime) {
        countdownContainer.classList.remove('hidden');
        playerForm.classList.remove('hidden');
    }
});
