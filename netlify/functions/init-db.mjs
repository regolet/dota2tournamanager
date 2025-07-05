// Simple database initialization endpoint
import { initializeDatabase } from './database.mjs';

export async function handler(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    console.log('Force initializing database...');
    
    // This will create all tables including the teams table
    await initializeDatabase();
    
    console.log('Database initialization completed successfully');
    
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
    console.error('Database initialization error:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Database initialization failed',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
} 