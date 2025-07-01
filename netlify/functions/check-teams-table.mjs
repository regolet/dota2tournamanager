// Simple endpoint to check if teams table exists
import { neon } from '@netlify/neon';

// Initialize Neon database connection
const sql = neon(process.env.DATABASE_URL);

export async function handler(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    console.log('Checking teams table...');
    
    // Try to query the teams table
    let teamsTableExists = false;
    let teamsCount = 0;
    let error = null;
    
    try {
      const result = await sql`SELECT COUNT(*) as count FROM teams`;
      teamsCount = parseInt(result[0].count);
      teamsTableExists = true;
      console.log(`Teams table exists with ${teamsCount} records`);
    } catch (e) {
      error = e.message;
      console.log('Teams table query failed:', e.message);
      
      if (e.message.includes('relation "teams" does not exist')) {
        console.log('Teams table does not exist');
      }
    }
    
    // Also check what tables exist
    let allTables = [];
    try {
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;
      allTables = tables.map(t => t.table_name);
      console.log('All tables:', allTables);
    } catch (e) {
      console.log('Could not list tables:', e.message);
    }
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      teamsTableExists,
      teamsCount,
      allTables,
      error,
      databaseUrl: process.env.DATABASE_URL ? 'Present' : 'Missing'
    };
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result, null, 2)
    };
    
  } catch (error) {
    console.error('Database check error:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Database check failed',
        details: error.message,
        timestamp: new Date().toISOString(),
        databaseUrl: process.env.DATABASE_URL ? 'Present' : 'Missing'
      }, null, 2)
    };
  }
} 