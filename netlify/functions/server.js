import serverlessExpress from '@codegenie/serverless-express';
import express from 'express';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import cors from 'cors';

// Import our database modules - adjust path to go up two levels
import { authDb, playerDb, masterlistDb } from '../../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: '*',
  credentials: true
}));

// Session storage (in-memory for serverless - not ideal for production)
let sessions = {};

// Helper function to save sessions (no-op in serverless environment)
function saveSessions() {
  // In serverless environment, sessions will be lost between invocations
  // Consider using external storage like Redis or database for production
}

// Initialize admin user if none exists
const DEFAULT_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
try {
  const initResult = authDb.createDefaultAdmin(DEFAULT_PASSWORD);
  console.log('Admin initialization:', initResult.message);
} catch (error) {
  console.error('Error initializing admin:', error);
}

// Admin login endpoint
app.post('/admin/api/login', (req, res) => {
  try {
    console.log('Login attempt received:', req.body);
    const { username, password, rememberMe } = req.body;
    
    if (!password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required' 
      });
    }
    
    // Verify admin credentials
    const verifyResult = authDb.verifyAdmin(password);
    console.log('Verification result:', verifyResult);
    
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
    
    console.log('Login successful, session created:', sessionId);
    
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

// Auto-login endpoint
app.post('/admin/api/auto-login', (req, res) => {
  try {
    const { token } = req.body;
    const sessionId = req.headers['x-session-id'] || token;
    
    if (sessionId && sessions[sessionId] && sessions[sessionId].persistent) {
      sessions[sessionId].lastAccessed = new Date().toISOString();
      return res.json({
        success: true,
        message: 'Auto-login successful',
        sessionId: sessionId
      });
    }
    
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

// Session check endpoint
app.get('/admin/api/check-session', (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  
  if (sessionId && sessions[sessionId]) {
    res.json({
      success: true,
      message: 'Session is valid'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Session is invalid or expired'
    });
  }
});

// Logout endpoint
app.post('/admin/api/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  
  if (sessionId && sessions[sessionId]) {
    delete sessions[sessionId];
  }
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Players API endpoints
app.get('/admin/api/players', (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  if (!sessionId || !sessions[sessionId]) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const players = playerDb.getAllPlayers();
    res.json({
      success: true,
      players: players
    });
  } catch (error) {
    console.error('Error getting players:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving players: ' + error.message
    });
  }
});

// Add player registration endpoint
app.post('/api/add-player', (req, res) => {
  try {
    const newPlayer = req.body;
    
    if (!newPlayer.name || !newPlayer.dota2id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Player name and Dota 2 ID are required' 
      });
    }
    
    const existingPlayer = playerDb.getPlayerByDota2Id(newPlayer.dota2id);
    if (existingPlayer) {
      return res.status(400).json({
        success: false,
        message: 'A player with this Dota 2 ID already exists'
      });
    }
    
    if (!newPlayer.registrationDate) {
      newPlayer.registrationDate = new Date().toISOString();
    }
    
    if (req.ip) {
      newPlayer.ipAddress = req.ip;
    }
    
    const result = playerDb.addPlayer(newPlayer);
    
    res.json({
      success: true,
      message: 'Player registered successfully!',
      player: newPlayer
    });
    
  } catch (error) {
    console.error('Error adding player:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering player: ' + error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running on Netlify Functions',
    timestamp: new Date().toISOString()
  });
});

// Serve static files for admin pages (basic file serving)
app.get('/admin/:file(*)', (req, res) => {
  const fileName = req.params.file || 'index.html';
  const filePath = path.join(__dirname, '../../admin', fileName);
  
  if (fs.existsSync(filePath)) {
    const ext = path.extname(fileName).toLowerCase();
    const contentType = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json'
    }[ext] || 'text/plain';
    
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

// Default route
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, '../../index.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.send('Tournament Management System - Netlify Functions');
  }
});

// Catch all other routes
app.get('*', (req, res) => {
  // Try to serve the file from the root directory
  const filePath = path.join(__dirname, '../..', req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Not found', path: req.path });
  }
});

// Export the serverless function
export const handler = serverlessExpress({ app }); 