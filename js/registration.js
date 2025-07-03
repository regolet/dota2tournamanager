// Registration logic moved from register/index.html
// This file contains all functions and event listeners for registration, countdown, and form handling

// Extract session ID from URL
function getSessionIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionFromParams = urlParams.get('session');
    return sessionFromParams;
}

let currentSession = null;
let sessionId = null;

// Initialize page
// (Wrapped in DOMContentLoaded to ensure elements exist)
document.addEventListener('DOMContentLoaded', async function() {
    sessionId = getSessionIdFromUrl();
    if (!sessionId) {
        showError('Session ID required', 'No registration session specified in URL');
        return;
    }
    await loadRegistrationSession();
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
});

document.addEventListener('visibilitychange', function() {
    if (document.hidden && countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
});

async function loadRegistrationSession() {
    try {
        const apiUrl = `/.netlify/functions/get-registration-session?sessionId=${sessionId}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (!data.success || !data.session) {
            showError('Registration session not found', data.message || 'Registration session not found or expired');
            return;
        }
        currentSession = data.session;
        displayRegistrationSession();
    } catch (error) {
        console.error('Error loading registration session:', error);
        showError('Failed to load registration session', 'There was an error loading the registration session. Please try again later.');
    }
}

function displayRegistrationSession() {
    document.getElementById('loading-section').classList.add('hidden');
    document.getElementById('registration-section').classList.remove('hidden');
    document.getElementById('session-title').textContent = currentSession.title;
    document.getElementById('session-description').textContent = currentSession.description || 'Join this Dota 2 tournament!';
    document.getElementById('admin-username').textContent = currentSession.adminUsername;
    document.getElementById('current-players').textContent = currentSession.playerCount;
    document.getElementById('max-players').textContent = currentSession.maxPlayers;
    updateRegistrationStatus();
    document.title = `Register for ${currentSession.title}`;
}

function updateRegistrationStatus() {
    const statusInfo = document.getElementById('status-info');
    const statusTitle = document.getElementById('status-title');
    const statusMessage = document.getElementById('status-message');
    const playerForm = document.getElementById('playerForm');
    const countdownSection = document.getElementById('countdown-section');
    const now = new Date();
    const startTime = currentSession.startTime ? new Date(currentSession.startTime) : null;
    const expiresAt = currentSession.expiresAt ? new Date(currentSession.expiresAt) : null;
    // Debug log for registration timing
    console.log('[DEBUG] now:', now.toString(), 'startTime:', startTime ? startTime.toString() : null, 'expiresAt:', expiresAt ? expiresAt.toString() : null, 'raw:', {now, startTime, expiresAt, currentSession});
    if (!currentSession.isActive) {
        statusInfo.style.backgroundColor = '#f8d7da';
        statusInfo.style.color = '#721c24';
        statusTitle.textContent = 'Registration Closed';
        statusMessage.textContent = 'This registration session has been deactivated';
        playerForm.classList.add('hidden');
        countdownSection.style.display = 'none';
    } else if (expiresAt && now > expiresAt) {
        statusInfo.style.backgroundColor = '#fff3cd';
        statusInfo.style.color = '#856404';
        statusTitle.textContent = 'Registration Expired';
        statusMessage.textContent = 'The registration deadline has passed';
        playerForm.classList.add('hidden');
        countdownSection.style.display = 'none';
    } else if (startTime && now < startTime) {
        statusInfo.style.backgroundColor = '#cce5ff';
        statusInfo.style.color = '#004085';
        statusTitle.textContent = 'Registration Not Yet Open';
        statusMessage.textContent = 'Registration will open soon for this tournament.';
        playerForm.classList.add('hidden');
        countdownSection.style.display = 'block';
        startRegistrationCountdown(startTime.getTime(), true); // true = countdown to start
    } else if (currentSession.playerCount >= currentSession.maxPlayers) {
        statusInfo.style.backgroundColor = '#f8d7da';
        statusInfo.style.color = '#721c24';
        statusTitle.textContent = 'Registration Full';
        statusMessage.textContent = `Tournament is full (${currentSession.maxPlayers} players maximum)`;
        playerForm.classList.add('hidden');
        countdownSection.style.display = 'none';
    } else {
        statusInfo.style.backgroundColor = '#d4edda';
        statusInfo.style.color = '#155724';
        statusTitle.textContent = 'Registration Open';
        statusMessage.textContent = 'You can register for this tournament';
        playerForm.classList.remove('hidden');
        if (expiresAt) {
            const expiryTime = expiresAt.getTime();
            const timeRemaining = expiryTime - now.getTime();
            if (timeRemaining > 0) {
                countdownSection.style.display = 'block';
                startRegistrationCountdown(expiryTime, false); // false = countdown to expiry
            } else {
                countdownSection.style.display = 'none';
            }
        } else {
            countdownSection.style.display = 'none';
        }
    }
}

let countdownInterval = null;

function startRegistrationCountdown(targetTime, isStartCountdown) {
    if (!targetTime || isNaN(new Date(targetTime).getTime())) {
        console.error('Invalid target time for countdown:', targetTime);
        return;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    const countdownSection = document.getElementById('countdown-section');
    const daysElement = document.getElementById('days');
    const hoursElement = document.getElementById('hours');
    const minutesElement = document.getElementById('minutes');
    const secondsElement = document.getElementById('seconds');
    const messageElement = document.getElementById('countdown-soon-msg');
    const titleElement = countdownSection.querySelector('.countdown-title');
    function updateCountdown() {
        try {
            const now = new Date().getTime();
            const target = new Date(targetTime).getTime();
            const timeRemaining = target - now;
            if (timeRemaining <= 0) {
                clearInterval(countdownInterval);
                countdownSection.style.display = 'none';
                loadRegistrationSession();
                return;
            }
            const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
            daysElement.textContent = String(days).padStart(2, '0');
            hoursElement.textContent = String(hours).padStart(2, '0');
            minutesElement.textContent = String(minutes).padStart(2, '0');
            secondsElement.textContent = String(seconds).padStart(2, '0');
            countdownSection.className = 'countdown-section';
            if (isStartCountdown) {
                titleElement.textContent = '⏳ Registration starts in:';
                if (timeRemaining <= 60 * 60 * 1000) {
                    countdownSection.classList.add('critical');
                    messageElement.textContent = '🎉 Registration opens very soon!';
                } else if (timeRemaining <= 24 * 60 * 60 * 1000) {
                    countdownSection.classList.add('urgent');
                    messageElement.textContent = '⏰ Registration opens within 24 hours!';
                } else {
                    messageElement.textContent = '📅 Registration will open soon.';
                }
            } else {
                titleElement.textContent = '⏰ Registration closes in:';
                if (timeRemaining <= 24 * 60 * 60 * 1000) {
                    countdownSection.classList.add('critical');
                    messageElement.textContent = '🚨 Hurry! Registration closes soon!';
                } else if (timeRemaining <= 3 * 24 * 60 * 60 * 1000) {
                    countdownSection.classList.add('urgent');
                    messageElement.textContent = '⚡ Don\'t wait too long to register!';
                } else {
                    messageElement.textContent = '📅 Plenty of time to register';
                }
            }
        } catch (error) {
            console.error('Error updating countdown:', error);
            clearInterval(countdownInterval);
            countdownSection.style.display = 'none';
        }
    }
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

async function checkDuplicatePlayer(name, dota2id, sessionId) {
    try {
        const response = await fetch(`/.netlify/functions/api-players?sessionId=${sessionId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch player data');
        }
        const data = await response.json();
        const players = data.players || [];
        const duplicateName = players.find(player => player.name && player.name.toLowerCase() === name.toLowerCase());
        const duplicateDota2Id = players.find(player => player.dota2id && player.dota2id === dota2id);
        if (duplicateName) {
            return { type: 'name', player: duplicateName };
        }
        if (duplicateDota2Id) {
            return { type: 'dota2id', player: duplicateDota2Id };
        }
        return null;
    } catch (error) {
        console.error('Error checking duplicates:', error);
        throw error;
    }
}

async function getMasterlistPlayer(name, dota2id) {
    try {
        const response = await fetch('/.netlify/functions/masterlist');
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        const masterlist = data.masterlist || [];
        const masterlistPlayer = masterlist.find(player => (player.dota2id && player.dota2id === dota2id) || (player.name && player.name.toLowerCase() === name.toLowerCase()));
        return masterlistPlayer;
    } catch (error) {
        console.error('Error fetching masterlist:', error);
        return null;
    }
}

document.getElementById('playerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn.textContent;
    const messageDiv = document.getElementById('message');
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering...';
        const name = document.getElementById('name').value.trim();
        const dota2id = document.getElementById('dota2id').value.trim();
        const peakmmrInput = document.getElementById('peakmmr').value.trim();
        const peakmmr = parseInt(peakmmrInput) || 0;
        if (!name || !dota2id || !peakmmrInput) {
            throw new Error('Please fill in all required fields.');
        }
        if (name.length < 2 || name.length > 50) {
            throw new Error('Player name must be between 2 and 50 characters.');
        }
        if (!/^\d+$/.test(dota2id)) {
            throw new Error('Dota 2 ID should be a numeric Friend ID.');
        }
        if (peakmmr < 0 || peakmmr > 15000) {
            throw new Error('Peak MMR must be between 0 and 15000.');
        }
        const duplicate = await checkDuplicatePlayer(name, dota2id, sessionId);
        if (duplicate) {
            if (duplicate.type === 'name') {
                throw new Error(`Player name "${name}" is already registered in this tournament.`);
            } else {
                throw new Error(`Dota 2 ID "${dota2id}" is already registered in this tournament.`);
            }
        }
        let masterlistPlayer = null;
        let verifiedMMR = peakmmr;
        let verifiedFromMasterlist = false;
        try {
            masterlistPlayer = await getMasterlistPlayer(name, dota2id);
            if (masterlistPlayer) {
                verifiedFromMasterlist = true;
                verifiedMMR = masterlistPlayer.mmr;
            }
        } catch (error) {}
        const formData = {
            name: name,
            dota2id: dota2id,
            peakmmr: verifiedMMR,
            registrationSessionId: sessionId
        };
        const response = await fetch('/.netlify/functions/add-player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        const data = await response.json();
        if (data.success) {
            let successMessage = 'Registration successful! ';
            if (data.verifiedFromMasterlist || verifiedFromMasterlist) {
                successMessage += `Your MMR was verified from the masterlist (${verifiedMMR} MMR). `;
            } else if (peakmmr > 0) {
                successMessage += `Your MMR (${peakmmr}) has been recorded. `;
            }
            successMessage += 'Tournament details will be shared closer to the event.';
            document.getElementById('success-message').textContent = successMessage;
            document.getElementById('registration-section').classList.add('hidden');
            document.getElementById('success-section').classList.remove('hidden');
            currentSession.playerCount = (currentSession.playerCount || 0) + 1;
            document.getElementById('current-players').textContent = currentSession.playerCount;
        } else {
            throw new Error(data.message || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        messageDiv.textContent = error.message || 'Registration failed. Please try again.';
        messageDiv.className = 'error';
        messageDiv.classList.remove('hidden');
        setTimeout(() => {
            messageDiv.classList.add('hidden');
        }, 8000);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

function showError(title, message) {
    document.getElementById('loading-section').classList.add('hidden');
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-section').classList.remove('hidden');
} 