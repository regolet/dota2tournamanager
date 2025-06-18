import serverlessExpress from '@codegenie/serverless-express';
import express from 'express';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Add basic error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: '*',
  credentials: true
}));

// Session storage (in-memory for serverless)
let sessions = {};

// Simple database simulation (in-memory)
let adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
let players = [];

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
    
    // Simple password verification
    if (password !== adminPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Create session
    const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessions[sessionId] = {
      user: { username: 'admin', role: 'admin' },
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
  try {
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
  } catch (error) {
    console.error('Error in check-session:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking session: ' + error.message
    });
  }
});

// Logout endpoint
app.post('/admin/api/logout', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    
    if (sessionId && sessions[sessionId]) {
      delete sessions[sessionId];
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Error in logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout: ' + error.message
    });
  }
});

// Players API endpoints
app.get('/admin/api/players', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    if (!sessionId || !sessions[sessionId]) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

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
    
    // Check for existing player
    const existingPlayer = players.find(p => p.dota2id === newPlayer.dota2id);
    if (existingPlayer) {
      return res.status(400).json({
        success: false,
        message: 'A player with this Dota 2 ID already exists'
      });
    }
    
    // Add player to in-memory storage
    const player = {
      id: `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: newPlayer.name,
      dota2id: newPlayer.dota2id,
      peakmmr: newPlayer.peakmmr || 0,
      registrationDate: new Date().toISOString(),
      ipAddress: req.ip || 'unknown'
    };
    
    players.push(player);
    
    res.json({
      success: true,
      message: 'Player registered successfully!',
      player: player
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

// Basic file serving with error handling
app.get('/admin/:file(*)', (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).send('Error serving file');
  }
});

// Default route
app.get('/', (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../index.html');
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.send('Tournament Management System - Netlify Functions');
    }
  } catch (error) {
    console.error('Error serving index:', error);
    res.send('Tournament Management System - Netlify Functions (Error serving static file)');
  }
});

// Catch all other routes
app.get('*', (req, res) => {
  try {
    const filePath = path.join(__dirname, '../..', req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Not found', path: req.path });
    }
  } catch (error) {
    console.error('Error in catch-all route:', error);
    res.status(404).json({ error: 'Not found', path: req.path });
  }
});

// Export the serverless function with error handling
export const handler = async (event, context) => {
  try {
    console.log('Function invoked:', event.httpMethod, event.path);
    const serverlessHandler = serverlessExpress({ app });
    return await serverlessHandler(event, context);
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
}; 