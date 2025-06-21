// Database diagnostic function for troubleshooting
import { neon } from '@netlify/neon';
import bcrypt from 'bcrypt';
import { initializeDatabase } from './database.js';

const sql = neon(process.env.DATABASE_URL);

export async function handler(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    console.log('Database debug endpoint called');
    
    // Force database initialization
    await initializeDatabase();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Database initialized successfully',
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Database debug error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Database initialization failed',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
} 