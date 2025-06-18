import express from 'express';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import db, { playerDb, migrateFromJson, exportToJson, authDb, masterlistDb } from './db.js';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Path to players data file (legacy, used for compatibility)
const PLAYERS_DATA_PATH = path.join(__dirname, 'players.json');

// Path to registration settings file
const REGISTRATION_SETTINGS_PATH = path.join(__dirname, 'registration-settings.json');

// Session storage file
const SESSIONS_FILE_PATH = path.join(__dirname, 'admin-sessions.json');

// Middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Session middleware for authentication
const SESSION_SECRET = 'tournament-admin-secret-' + Math.random().toString(36).substring(2, 15);

// Load sessions from file if it exists
let sessions = {};
try {
  if (fs.existsSync(SESSIONS_FILE_PATH)) {
    const sessionsData = fs.readFileSync(SESSIONS_FILE_PATH, 'utf8');
    sessions = JSON.parse(sessionsData);
  } else {
    sessions = {}; // In-memory session store
  }
} catch (error) {
  console.error('Error loading sessions from file:', error);
  sessions = {}; // Fallback to empty sessions
}

// Helper function to save sessions to file
function saveSessions() {
  try {
    fs.writeFileSync(SESSIONS_FILE_PATH, JSON.stringify(sessions, null, 2));
  } catch (error) {
    console.error('Error saving sessions to file:', error);
  }
}

// Authentication middleware for admin routes
function requireAuth(req, res, next) {
  // Check for session ID in the request
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  const isValidSession = sessionId && sessions[sessionId];
  
  // Special case: If user is trying to access admin root with valid session,
  // redirect them to the admin panel with session ID
  if (req.path === '/admin' && isValidSession) {
    return res.redirect('/admin/index.html?sessionId=' + sessionId);
  }
  
  // Skip auth for login API
  if (req.path === '/admin/api/login') {
    return next();
  }
  
  // Check if the request is for an admin route
  if (req.path.startsWith('/admin')) {
    // If no session ID, redirect to login
    if (!isValidSession) {
      // If API request, return 401
      if (req.path.startsWith('/admin/api/')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      // For HTML requests, redirect to login page
      return res.redirect('/admin/login.html');
    }
    
    // Session exists, proceed
    req.session = sessions[sessionId];
  }
  
  next();
}

// Initialize admin user if none exists
const DEFAULT_PASSWORD = 'admin123';
const initResult = authDb.createDefaultAdmin(DEFAULT_PASSWORD);
if (initResult.success) {
  // Default admin user created
} else {
  // Admin user check completed
}

// Special route for JavaScript files in admin - MUST be before requireAuth middleware
app.get('/admin/js/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'admin', 'js', filename);
  
  // Check if file exists
  if (fs.existsSync(filePath)) {
    // Set proper content type
    res.set('Content-Type', 'application/javascript');
    
    // Send the file content
    const content = fs.readFileSync(filePath, 'utf8');
    res.send(content);
  } else {
    res.status(404).send('// File not found');
  }
});

// Special route for login page - no session checking, just serve the page
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// Special route for admin index - let the client-side handle authentication
app.get('/admin/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});



// Admin login endpoint - must be defined BEFORE requireAuth middleware
app.post('/admin/api/login', (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;
    
    if (!password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required' 
      });
    }
    
    // We ignore username for now, but it's there for future expansion
    // Verify admin credentials
    const verifyResult = authDb.verifyAdmin(password);
    
    if (!verifyResult.success) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Create session
    const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessions[sessionId] = {
      user: verifyResult.user,
      createdAt: new Date().toISOString(),
      persistent: rememberMe === true
    };
    
    // Save sessions to file
    saveSessions();
    
    // Return success with session ID
    res.json({
      success: true,
      message: 'Login successful',
      sessionId: sessionId
    });
    
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login: ' + error.message
    });
  }
});

// Auto-login endpoint using persistent token - must be defined BEFORE requireAuth middleware
app.post('/admin/api/auto-login', (req, res) => {
  try {
    const { token } = req.body;
    const sessionId = req.headers['x-session-id'] || token;
    
    // Check if session exists and is persistent
    if (sessionId && sessions[sessionId] && sessions[sessionId].persistent) {
      
      // Refresh the session timestamp
      sessions[sessionId].lastAccessed = new Date().toISOString();
      saveSessions();
      
      // Return success with the same session ID
      return res.json({
        success: true,
        message: 'Auto-login successful',
        sessionId: sessionId
      });
    }
    
    // If we got here, the session is invalid or not persistent
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired session' 
    });
  } catch (error) {
    console.error('Error in auto-login:', error);
    return res.status(500).json({
      success: false,
      message: 'Error during auto-login: ' + error.message
    });
  }
});

// Change admin password endpoint - also before requireAuth
app.post('/admin/api/change-password', (req, res) => {
  try {
    // Check session authentication
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    if (!sessionId || !sessions[sessionId]) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Both old and new passwords are required' 
      });
    }
    
    // Validate new password requirements
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'New password must be at least 6 characters long' 
      });
    }
    
    // Change password
    const changeResult = authDb.changePassword(oldPassword, newPassword);
    
    if (!changeResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: changeResult.message 
      });
    }
    
    // Return success
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password: ' + error.message
    });
  }
});

// Logout endpoint - also before requireAuth
app.post('/admin/api/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  
  if (sessionId && sessions[sessionId]) {
    delete sessions[sessionId];
    saveSessions();
  }
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Session check endpoint - also before requireAuth
app.get('/admin/api/check-session', (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  
  if (sessionId && sessions[sessionId]) {
    // Session exists
    res.json({
      success: true,
      message: 'Session is valid'
    });
  } else {
    // Session doesn't exist
    res.status(401).json({
      success: false,
      message: 'Session is invalid or expired'
    });
  }
});

// Explicit route for JavaScript files to ensure proper MIME type
// This MUST be before requireAuth middleware
app.get('*.js', (req, res, next) => {
  res.set('Content-Type', 'application/javascript');
  next();
});

// REMOVED: Global authentication middleware - we'll apply it to specific routes instead
// app.use(requireAuth);

// Serve static files from root directory
app.use(express.static(__dirname));

// Special route for admin index - serve index.html instead of relying on index.php
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Serve admin files from the admin directory
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// API routes should be defined after static file serving
app.use('/api', (req, res, next) => {
    // Allow CORS for development
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// API Routes

// Add a new player
app.post('/api/add-player', (req, res) => {
    try {
        const newPlayer = req.body;
        
        // Validate required fields
        if (!newPlayer.name || !newPlayer.dota2id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Player name and Dota 2 ID are required' 
            });
        }
        
        // Check if player with same Dota2ID already exists in main players table
        const existingPlayer = playerDb.getPlayerByDota2Id(newPlayer.dota2id);
        if (existingPlayer) {
            return res.status(400).json({
                success: false,
                message: 'A player with this Dota 2 ID already exists'
            });
        }
        
        // CHECK MASTERLIST FOR VERIFIED MMR
        const masterlistPlayer = masterlistDb.getPlayerByDota2Id(newPlayer.dota2id);
        let isFromMasterlist = false;
        let originalMmr = newPlayer.peakmmr;
        
        if (masterlistPlayer) {
            // Player exists in masterlist - use verified MMR instead of submitted MMR
            newPlayer.peakmmr = masterlistPlayer.mmr;
            isFromMasterlist = true;
        }
        
        // Set registration date and other defaults
        if (!newPlayer.registrationDate) {
            newPlayer.registrationDate = new Date().toISOString();
        }
        
        // Add IP address if provided in request
        if (req.ip) {
            newPlayer.ipAddress = req.ip;
        }
        
        // Add player to main players database
        const result = playerDb.addPlayer(newPlayer);
        
        // ADD TO MASTERLIST if not already there
        if (!masterlistPlayer && newPlayer.peakmmr) {
            try {
                const masterlistResult = masterlistDb.addPlayer(
                    newPlayer.name, 
                    newPlayer.dota2id, 
                    newPlayer.peakmmr,
                    'Auto-added from registration'
                );
                // Player added to masterlist automatically
            } catch (masterlistError) {
                // Log but don't fail registration if masterlist add fails
                console.error('Failed to add player to masterlist:', masterlistError);
            }
        }
        
        // Also update the JSON file for backward compatibility
        const allPlayers = playerDb.getAllPlayers();
        fs.writeFileSync(PLAYERS_DATA_PATH, JSON.stringify(allPlayers, null, 2));
        
        // Prepare response message
        let message = 'Player added successfully';
        if (isFromMasterlist) {
            message += ` (MMR verified from masterlist: ${newPlayer.peakmmr})`;
        }
        
        res.json({ 
            success: true, 
            player: newPlayer,
            message: message,
            verifiedFromMasterlist: isFromMasterlist,
            originalMmr: originalMmr,
            verifiedMmr: newPlayer.peakmmr
        });
    } catch (error) {
        console.error('Error adding player:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to add player',
            error: error.message
        });
    }
});

// Get players for team balancer
app.get('/api/get-players', (req, res) => {
    try {
        // Get players from database
        const players = playerDb.getAllPlayers();
        
        res.json({ 
            success: true, 
            players: players,
            count: players.length
        });
    } catch (error) {
        console.error('Error getting players:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get players data',
            error: error.message
        });
    }
});

// API Routes

// Get registration status
app.get('/api/registration/status', (req, res) => {
    try {
        let registrationSettings = { isOpen: false };
        
        if (fs.existsSync(REGISTRATION_SETTINGS_PATH)) {
            const fileContent = fs.readFileSync(REGISTRATION_SETTINGS_PATH, 'utf8');
            
            try {
                registrationSettings = JSON.parse(fileContent);
                
                // Check if registration has expired but only override isOpen if it's currently true
                if (registrationSettings.expiry && registrationSettings.isOpen) {
                    const expiry = new Date(registrationSettings.expiry);
                    const now = new Date();
                    // Only update isOpen if it's currently true and expiry has passed
                    if (expiry <= now) {
                        registrationSettings.isOpen = false;
                    }
                } else if (!registrationSettings.expiry && !('isOpen' in registrationSettings)) {
                    registrationSettings.isOpen = false;
                }
                // If registration was manually closed (isOpen is explicitly false), respect that setting
            } catch (parseError) {
                console.error('Failed to parse registration settings file:', parseError);
                registrationSettings = { isOpen: false };
            }
        } else {
            // Create default settings file if it doesn't exist
            fs.writeFileSync(REGISTRATION_SETTINGS_PATH, JSON.stringify(registrationSettings, null, 2));
        }
        
        // Create response object with explicit structure
        const response = {
            registration: registrationSettings
        };
        
        // Return registration data in a consistent format
        return res.json(response);
    } catch (error) {
        console.error('Error getting registration status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get registration status',
            registration: { isOpen: false }
        });
    }
});

// Update registration settings (admin only)
app.post('/api/registration', (req, res) => {
    try {
        const data = req.body;
        
        if (!data) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid registration settings',
                registration: { isOpen: false }
            });
        }
        
        // Extract settings from request body
        const settings = data.settings || data;
        
        // Create a complete registration settings object
        const registrationSettings = {
            isOpen: true,
            expiry: settings.expiry,
            createdAt: new Date().toISOString(),
            playerLimit: settings.playerLimit || 40,
            enablePlayerLimit: settings.enablePlayerLimit !== undefined ? settings.enablePlayerLimit : true
        };
        
        // Write to registration-settings.json
        fs.writeFileSync(REGISTRATION_SETTINGS_PATH, JSON.stringify(registrationSettings, null, 2));
        
        // Create response object with explicit structure
        const response = {
            success: true, 
            message: 'Registration settings updated successfully',
            registration: registrationSettings
        };
        
        // Send the response
        return res.json(response);
    } catch (error) {
        console.error('Error updating registration settings:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update registration settings',
            registration: { isOpen: false } 
        });
    }
});

// Close registration (admin only)
app.post('/api/registration/close', (req, res) => {
    try {
        // Extract settings if provided
        let existingSettings = {};
        if (fs.existsSync(REGISTRATION_SETTINGS_PATH)) {
            try {
                const settingsContent = fs.readFileSync(REGISTRATION_SETTINGS_PATH, 'utf8');
                existingSettings = JSON.parse(settingsContent);
            } catch (err) {
                console.error('Error reading existing settings:', err);
            }
        }
        
        // Get settings from request if available
        const inputSettings = req.body.settings || {};
        
        // Create updated registration settings
        const registrationSettings = {
            ...existingSettings, // Keep other properties from existing settings
            isOpen: false,
            closedAt: new Date().toISOString(),
            // Preserve some important fields if they exist
            playerLimit: inputSettings.playerLimit || existingSettings.playerLimit,
            enablePlayerLimit: inputSettings.enablePlayerLimit !== undefined ? 
                               inputSettings.enablePlayerLimit : 
                               existingSettings.enablePlayerLimit
        };
        
        // Write to registration-settings.json
        fs.writeFileSync(REGISTRATION_SETTINGS_PATH, JSON.stringify(registrationSettings, null, 2));
        
        // Create response object with explicit structure
        const response = {
            success: true, 
            message: 'Registration closed successfully',
            registration: registrationSettings
        };
        
        // Send the response
        return res.json(response);
    } catch (error) {
        console.error('Error closing registration:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to close registration',
            registration: { isOpen: false } 
        });
    }
});

// Get players from players.json
app.get('/get-players', (req, res) => {
    try {
        const playersPath = path.join(__dirname, 'players.json');
        
        // Check if the file exists
        if (!fs.existsSync(playersPath)) {
            return res.json([]);
        }
        
        // Read and return the players
        const data = fs.readFileSync(playersPath, 'utf8');
        const players = data ? JSON.parse(data) : [];
        
        res.json(players);
        
    } catch (error) {
        console.error('Error getting players:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get players',
            error: error.message
        });
    }
});

// Update a player's information
app.put('/update-player/:index', (req, res) => {
    try {
        const playerIndex = parseInt(req.params.index);
        const updatedPlayer = req.body;
        const playersPath = path.join(__dirname, 'players.json');
        
        // Validate input
        if (isNaN(playerIndex) || !updatedPlayer) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid request. Player index and updated data required.'
            });
        }
        
        if (!updatedPlayer.name || !updatedPlayer.dota2id || !updatedPlayer.peakmmr) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid player data. Name, Dota2 ID, and Peak MMR are required.' 
            });
        }

        // Read the players file
        if (!fs.existsSync(playersPath)) {
            return res.status(404).json({ 
                success: false, 
                message: 'Players data not found.'
            });
        }
        
        const data = fs.readFileSync(playersPath, 'utf8');
        const players = data ? JSON.parse(data) : [];
        
        // Check if the player index exists
        if (playerIndex < 0 || playerIndex >= players.length) {
            return res.status(404).json({ 
                success: false, 
                message: 'Player not found.'
            });
        }
        
        // Update player but preserve ipAddress and registrationDate
        players[playerIndex] = {
            name: updatedPlayer.name,
            dota2id: updatedPlayer.dota2id,
            peakmmr: parseInt(updatedPlayer.peakmmr),
            ipAddress: players[playerIndex].ipAddress,
            registrationDate: players[playerIndex].registrationDate
        };
        
        // Save back to players.json
        fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
        
        res.json({ 
            success: true, 
            message: 'Player updated successfully',
            player: players[playerIndex]
        });
        
    } catch (error) {
        console.error('Error updating player:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update player',
            error: error.message
        });
    }
});

// Delete a player
app.delete('/delete-player/:index', (req, res) => {
    try {
        const playerIndex = parseInt(req.params.index);
        const playersPath = path.join(__dirname, 'players.json');
        
        // Validate input
        if (isNaN(playerIndex)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid request. Player index required.'
            });
        }

        // Read the players file
        if (!fs.existsSync(playersPath)) {
            return res.status(404).json({ 
                success: false, 
                message: 'Players data not found.'
            });
        }
        
        const data = fs.readFileSync(playersPath, 'utf8');
        const players = data ? JSON.parse(data) : [];
        
        // Check if the player index exists
        if (playerIndex < 0 || playerIndex >= players.length) {
            return res.status(404).json({ 
                success: false, 
                message: 'Player not found.'
            });
        }
        
        // Remove the player
        const removedPlayer = players.splice(playerIndex, 1)[0];
        
        // Save back to players.json
        fs.writeFileSync(playersPath, JSON.stringify(players, null, 2));
        
        res.json({ 
            success: true, 
            message: 'Player deleted successfully',
            player: removedPlayer
        });
        
    } catch (error) {
        console.error('Error deleting player:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete player',
            error: error.message
        });
    }
});

// Handle save-player requests
app.post('/save-player', (req, res) => {
    try {
        const newPlayer = req.body;
        
        // Validate required fields
        if (!newPlayer.name || !newPlayer.dota2id || !newPlayer.peakmmr) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required: Name, Dota 2 ID, and MMR' 
            });
        }
        
        // Validate Dota 2 ID format (should be a number)
        if (!/^\d+$/.test(newPlayer.dota2id)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Dota 2 ID should be a numeric Friend ID' 
            });
        }
        
        // Get client IP address
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        // Read existing players
        let players = [];
        if (fs.existsSync(PLAYERS_DATA_PATH)) {
            const data = fs.readFileSync(PLAYERS_DATA_PATH, 'utf8');
            players = data ? JSON.parse(data) : [];
            if (!Array.isArray(players)) {
                players = [];
            }
        }
        
        // Check if registration is open
        let registrationSettings = { isOpen: false };
        if (fs.existsSync(REGISTRATION_SETTINGS_PATH)) {
            try {
                const settingsData = fs.readFileSync(REGISTRATION_SETTINGS_PATH, 'utf8');
                registrationSettings = JSON.parse(settingsData);
                
                // Check if registration has expired
                if (registrationSettings.expiry) {
                    const expiry = new Date(registrationSettings.expiry);
                    const now = new Date();
                    registrationSettings.isOpen = expiry > now;
                }
                
                // Check if player limit is reached
                if (registrationSettings.isOpen && 
                    registrationSettings.enablePlayerLimit && 
                    registrationSettings.playerLimit && 
                    players.length >= registrationSettings.playerLimit) {
                    
                    // Auto-close registration
                    registrationSettings.isOpen = false;
                    registrationSettings.closedAt = new Date().toISOString();
                    registrationSettings.closedReason = 'Player limit reached';
                    
                    // Save updated settings
                    fs.writeFileSync(REGISTRATION_SETTINGS_PATH, JSON.stringify(registrationSettings, null, 2));
                    
                    return res.status(400).json({
                        success: false,
                        message: 'Registration is closed: Player limit reached'
                    });
                }
            } catch (error) {
                console.error('Error parsing registration settings:', error);
            }
        }
        
        // Check if registration is open
        if (!registrationSettings.isOpen) {
            return res.status(400).json({
                success: false,
                message: 'Registration is currently closed'
            });
        }
        
        // Check for duplicate Dota 2 ID
        const duplicateDota2Id = players.find(player => player.dota2id === newPlayer.dota2id);
        if (duplicateDota2Id) {
            return res.status(400).json({
                success: false,
                message: 'A player with this Dota 2 ID is already registered'
            });
        }
        
        // Check for duplicate IP address (optional security feature)
        const duplicateIp = players.find(player => player.ipAddress === clientIp);
        if (duplicateIp && clientIp !== '::1' && clientIp !== '127.0.0.1') {
            return res.status(400).json({
                success: false,
                message: 'A player has already registered from this IP address'
            });
        }
        
        // Add unique ID, IP address, and registration date
        newPlayer.id = 'player-' + Date.now();
        newPlayer.ipAddress = clientIp;
        newPlayer.registrationDate = new Date().toISOString();
        
        // Add the new player to the array
        players.push(newPlayer);
        
        // Save the updated players array back to file
        fs.writeFileSync(PLAYERS_DATA_PATH, JSON.stringify(players, null, 2));
        
        // Return success response
        res.json({ 
            success: true, 
            message: 'Player registered successfully'
        });
    } catch (error) {
        console.error('Error saving player:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to register player: ' + error.message
        });
    }
});

// Helper function to handle player save requests
function handleSavePlayers(req, res) {
    try {
        const data = req.body;
        let message = '';
        let playerUpdateResult;
        
        // Check for action type
        const action = data.action || 'add';
        
        switch (action) {
            case 'removeAll':
                // Delete all players
                try {
                    playerDb.deleteAllPlayers();
                    message = 'All players removed successfully';
                } catch (err) {
                    console.error('Error removing all players:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Failed to remove all players: ' + err.message 
                    });
                }
                break;
                
            case 'delete':
                // Delete a player by ID
                if (!data.playerId) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Player ID is required for delete action' 
                    });
                }
                
                const playerId = data.playerId;
                let playerDeleted = false;
                
                // Try to delete by ID
                if (playerId) {
                    try {
                        const result = playerDb.deletePlayer(playerId);
                        if (result && result.changes > 0) {
                            playerDeleted = true;
                        }
                    } catch (err) {
                        console.error('Error deleting player by ID:', err);
                    }
                }
                
                if (!playerDeleted) {
                    return res.status(404).json({ 
                        success: false, 
                        message: 'Player not found' 
                    });
                }
                
                message = 'Player deleted successfully';
                break;
                
            case 'edit':
                // Edit an existing player by ID or by finding a matching player
                if (!data.player) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Player data is required for edit action' 
                    });
                }
                
                const updatedPlayer = data.player;
                let playerUpdated = false;
                
                // Try to update by ID
                if (updatedPlayer.id) {
                    try {
                        const player = playerDb.getPlayerById(updatedPlayer.id);
                        if (player) {
                            playerUpdateResult = playerDb.updatePlayer(updatedPlayer);
                            if (playerUpdateResult && playerUpdateResult.changes > 0) {
                                playerUpdated = true;
                            }
                        }
                    } catch (err) {
                        console.error('Error updating player by ID:', err);
                    }
                }
                
                // If not updated by ID, try to update by dota2id
                if (!playerUpdated && updatedPlayer.dota2id) {
                    try {
                        const player = playerDb.getPlayerByDota2Id(updatedPlayer.dota2id);
                        if (player) {
                            // Preserve original ID
                            updatedPlayer.id = player.id;
                            playerUpdateResult = playerDb.updatePlayer(updatedPlayer);
                            if (playerUpdateResult && playerUpdateResult.changes > 0) {
                                playerUpdated = true;
                            }
                        }
                    } catch (err) {
                        console.error('Error updating player by Dota2ID:', err);
                    }
                }
                
                if (!playerUpdated) {
                    return res.status(404).json({ 
                        success: false, 
                        message: `Player not found` 
                    });
                }
                
                message = 'Player updated successfully';
                break;
                
            case 'add':
            default:
                // Add a new player
                if (action === 'add' && !data.player) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Player data is required for add action' 
                    });
                }
                
                if (data.player) {
                    const newPlayer = data.player;
                    
                    try {
                        playerUpdateResult = playerDb.addPlayer(newPlayer);
                        message = 'Player added successfully';
                    } catch (err) {
                        console.error('Error adding player:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: 'Failed to add player: ' + err.message 
                        });
                    }
                } else {
                    // If replacing the entire list, simply delete all and add new ones
                    try {
                        playerDb.deleteAllPlayers();
                        
                        if (Array.isArray(data)) {
                            const transaction = db.transaction((players) => {
                                for (const player of players) {
                                    playerDb.addPlayer(player);
                                }
                            });
                            
                            transaction(data);
                        }
                        message = 'Player list replaced successfully';
                    } catch (err) {
                        console.error('Error replacing players:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: 'Failed to replace player list: ' + err.message 
                        });
                    }
                }
                break;
        }
        
        // Return success response
        res.json({
            success: true,
            message: message || 'Player data saved successfully'
        });
        
    } catch (error) {
        console.error('Error in save-players endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Error: ' + error.message
        });
    }
}

// Add a save-players endpoint to replace save-players.php
app.post('/save-players', (req, res) => {
    handleSavePlayers(req, res);
});

// Add duplicate endpoint for admin path
app.post('/admin/save-players', (req, res) => {
    handleSavePlayers(req, res);
});

// Admin Routes

// Serve admin section main page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Serve all admin static files
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Handle save-registration-settings.php requests
app.post('/save-registration-settings.php', (req, res) => {
    try {
        const data = req.body;
        
        // Check if this is a delete/reset action
        const action = data.action || 'update';
        let registrationSettings = data;
        
        if (action === 'delete') {
            // Create a default/empty registration settings
            registrationSettings = {
                isOpen: false,
                closedAt: new Date().toISOString()
            };
        } else {
            // Ensure player limit is set
            registrationSettings.playerLimit = registrationSettings.playerLimit || 40;
            registrationSettings.enablePlayerLimit = registrationSettings.enablePlayerLimit !== undefined 
                ? registrationSettings.enablePlayerLimit : true;
        }
        
        // Save to the settings file
        fs.writeFileSync(REGISTRATION_SETTINGS_PATH, JSON.stringify(registrationSettings, null, 2));
        
        // Return success response with appropriate message
        const message = (action === 'delete') ? 'Registration settings reset successfully' : 'Registration settings saved successfully';
        
        res.json({
            success: true, 
            message: message,
            registration: registrationSettings
        });
        
    } catch (error) {
        console.error('Error in save-registration-settings.php:', error);
        res.status(500).json({
            success: false,
            message: 'Error: ' + error.message
        });
    }
});

// Handle save-players.php requests
app.post('/save-players.php', (req, res) => {
    try {
        const data = req.body;
        const playersPath = path.join(__dirname, 'players.json');
        
        // Check for action type
        const action = data.action || 'add';
        let message = '';
        let playerUpdateResult;
        
        switch (action) {
            case 'delete':
                // Delete a player by ID or by finding a matching player
                if (!data.playerId && !data.player) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Player ID or player object is required for delete action' 
                    });
                }
                
                let playerDeleted = false;
                
                if (data.player) {
                    // If a player object is provided, try to find and delete by ID first
                    const playerToDelete = data.player;
                    
                    // First try to delete by ID
                    if (playerToDelete.id) {
                        try {
                            const result = playerDb.deletePlayer(playerToDelete.id);
                            if (result && result.changes > 0) {
                                playerDeleted = true;
                            }
                        } catch (err) {
                            console.error('Error deleting player by ID:', err);
                        }
                    }
                    
                    // If not deleted by ID, try to find by dota2id and delete
                    if (!playerDeleted && (playerToDelete.dota2id || playerToDelete.dotaId)) {
                        const dota2id = playerToDelete.dota2id || playerToDelete.dotaId;
                        
                        try {
                            const playerToRemove = playerDb.getPlayerByDota2Id(dota2id);
                            if (playerToRemove) {
                                const result = playerDb.deletePlayer(playerToRemove.id);
                                if (result && result.changes > 0) {
                                    playerDeleted = true;
                                }
                            }
                        } catch (err) {
                            console.error('Error deleting player by Dota2ID:', err);
                        }
                    }
                } else if (data.playerId) {
                    // If only an ID is provided
                    const playerId = data.playerId;
                    
                    try {
                        const result = playerDb.deletePlayer(playerId);
                        if (result && result.changes > 0) {
                            playerDeleted = true;
                        }
                    } catch (err) {
                        console.error('Error deleting player by ID:', err);
                    }
                }
                
                if (!playerDeleted) {
                    return res.status(404).json({ 
                        success: false, 
                        message: 'Player not found' 
                    });
                }
                
                message = 'Player deleted successfully';
                break;
                
            case 'edit':
                // Edit an existing player by ID or by finding a matching player
                if (!data.player) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Player data is required for edit action' 
                    });
                }
                
                const updatedPlayer = data.player;
                let playerUpdated = false;
                
                // Try to update by ID
                if (updatedPlayer.id) {
                    try {
                        const player = playerDb.getPlayerById(updatedPlayer.id);
                        if (player) {
                            playerUpdateResult = playerDb.updatePlayer(updatedPlayer);
                            if (playerUpdateResult && playerUpdateResult.changes > 0) {
                                playerUpdated = true;
                            }
                        }
                    } catch (err) {
                        console.error('Error updating player by ID:', err);
                    }
                }
                
                // If not updated by ID, try to update by dota2id
                if (!playerUpdated && updatedPlayer.dota2id) {
                    try {
                        const player = playerDb.getPlayerByDota2Id(updatedPlayer.dota2id);
                        if (player) {
                            // Preserve original ID
                            updatedPlayer.id = player.id;
                            playerUpdateResult = playerDb.updatePlayer(updatedPlayer);
                            if (playerUpdateResult && playerUpdateResult.changes > 0) {
                                playerUpdated = true;
                            }
                        }
                    } catch (err) {
                        console.error('Error updating player by Dota2ID:', err);
                    }
                }
                
                if (!playerUpdated) {
                    return res.status(404).json({ 
                        success: false, 
                        message: `Player not found` 
                    });
                }
                
                message = 'Player updated successfully';
                break;
                
            case 'add':
            default:
                // Add a new player
                if (action === 'add' && !data.player) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Player data is required for add action' 
                    });
                }
                
                if (data.player) {
                    const newPlayer = data.player;
                    
                    try {
                        playerUpdateResult = playerDb.addPlayer(newPlayer);
                        message = 'Player added successfully';
                    } catch (err) {
                        console.error('Error adding player:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: 'Failed to add player: ' + err.message 
                        });
                    }
                } else {
                    // If replacing the entire list, simply delete all and add new ones
                    try {
                        playerDb.deleteAllPlayers();
                        
                        if (Array.isArray(data)) {
                            const transaction = db.transaction((players) => {
                                for (const player of players) {
                                    playerDb.addPlayer(player);
                                }
                            });
                            
                            transaction(data);
                        }
                        message = 'Player list replaced successfully';
                    } catch (err) {
                        console.error('Error replacing players:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: 'Failed to replace player list: ' + err.message 
                        });
                    }
                }
                break;
        }
        
        // Return success response
        res.json({
            success: true,
            message: message || 'Player data saved successfully'
        });
        
    } catch (error) {
        console.error('Error in save-players.php:', error);
        res.status(500).json({
            success: false,
            message: 'Error: ' + error.message
        });
    }
});

// API endpoints for player operations
app.get('/api/players', (req, res) => {
    try {
        const players = playerDb.getAllPlayers();
        res.json(players);
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching players: ' + error.message
        });
    }
});

app.get('/api/players/count', (req, res) => {
    try {
        const players = playerDb.getAllPlayers();
        res.json({ count: players.length });
    } catch (error) {
        console.error('Error counting players:', error);
        res.status(500).json({
            success: false,
            message: 'Error counting players: ' + error.message
        });
    }
});

// Add duplicate API endpoints for admin paths
app.get('/admin/api/players', (req, res) => {
    try {
        const players = playerDb.getAllPlayers();
        res.json(players);
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching players: ' + error.message
        });
    }
});

app.get('/admin/api/players/count', (req, res) => {
    try {
        const players = playerDb.getAllPlayers();
        res.json({ count: players.length });
    } catch (error) {
        console.error('Error counting players:', error);
        res.status(500).json({
            success: false,
            message: 'Error counting players: ' + error.message
        });
    }
});

// Masterlist API endpoints
// Get all masterlist players
app.get('/api/masterlist', (req, res) => {
    try {
        const players = masterlistDb.getAllPlayers();
        const stats = masterlistDb.getStats();
        
        res.json({
            success: true,
            players: players,
            stats: stats
        });
    } catch (error) {
        console.error('Error getting masterlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get masterlist',
            error: error.message
        });
    }
});

// Search masterlist players
app.get('/api/masterlist/search', (req, res) => {
    try {
        const searchTerm = req.query.q || '';
        const players = masterlistDb.searchPlayers(searchTerm);
        
        res.json({
            success: true,
            players: players
        });
    } catch (error) {
        console.error('Error searching masterlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search masterlist',
            error: error.message
        });
    }
});

// Add player to masterlist
app.post('/api/masterlist', (req, res) => {
    try {
        const { name, dota2id, mmr, notes } = req.body;
        
        if (!name || !dota2id || !mmr) {
            return res.status(400).json({
                success: false,
                message: 'Name, Dota2 ID, and MMR are required'
            });
        }
        
        const result = masterlistDb.addPlayer(name, dota2id, mmr, notes || '');
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error adding to masterlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add player to masterlist',
            error: error.message
        });
    }
});

// Update masterlist player
app.put('/api/masterlist/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, dota2id, mmr, notes } = req.body;
        
        if (!name || !dota2id || !mmr) {
            return res.status(400).json({
                success: false,
                message: 'Name, Dota2 ID, and MMR are required'
            });
        }
        
        const result = masterlistDb.updatePlayer(id, name, dota2id, mmr, notes || '');
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error updating masterlist player:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update masterlist player',
            error: error.message
        });
    }
});

// Delete masterlist player
app.delete('/api/masterlist/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = masterlistDb.deletePlayer(id);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        console.error('Error deleting masterlist player:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete masterlist player',
            error: error.message
        });
    }
});

// Catch-all route for 404 errors
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// Add an endpoint for exporting the database to JSON
app.get('/export-players', (req, res) => {
    try {
        const players = playerDb.getAllPlayers();
        
        // Create a formatted JSON string
        const jsonContent = JSON.stringify(players, null, 2);
        
        // Set response headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="dota-tournament-players-${new Date().toISOString().slice(0, 10)}.json"`);
        
        // Send the response
        res.send(jsonContent);
    } catch (error) {
        console.error('Error exporting players:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting players: ' + error.message
        });
    }
});

// Migrate existing players to masterlist
async function migratePlayersToMasterlist() {
    try {
        console.log('Checking for players to migrate to masterlist...');
        
        const allPlayers = playerDb.getAllPlayers();
        const masterlistPlayers = masterlistDb.getAllPlayers();
        
        // Create a set of existing masterlist dota2ids for quick lookup
        const masterlistDota2Ids = new Set(masterlistPlayers.map(p => p.dota2id));
        
        let migratedCount = 0;
        
        for (const player of allPlayers) {
            // Skip if already in masterlist
            if (masterlistDota2Ids.has(player.dota2id)) {
                continue;
            }
            
            // Skip if missing required data
            if (!player.name || !player.dota2id || !player.peakmmr) {
                continue;
            }
            
            try {
                const result = masterlistDb.addPlayer(
                    player.name,
                    player.dota2id,
                    player.peakmmr,
                    'Migrated from existing players'
                );
                
                if (result.success) {
                    migratedCount++;
                    console.log(`Migrated ${player.name} (${player.dota2id}) to masterlist`);
                }
            } catch (error) {
                console.error(`Failed to migrate ${player.name}:`, error.message);
            }
        }
        
        if (migratedCount > 0) {
            console.log(`Migration complete: ${migratedCount} players added to masterlist`);
        } else {
            console.log('No players needed migration to masterlist');
        }
    } catch (error) {
        console.error('Error during masterlist migration:', error);
    }
}

// Run migration on startup
migratePlayersToMasterlist();

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
