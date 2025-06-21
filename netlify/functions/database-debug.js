// Database debug function to check teams table
import { neon } from '@netlify/neon';

const sql = neon(process.env.DATABASE_URL);

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('Database debug function called');
    
    // Check if teams table exists
    let tableExists = false;
    try {
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'teams'
      `;
      tableExists = tables.length > 0;
      console.log('Teams table exists:', tableExists);
    } catch (error) {
      console.log('Error checking table existence:', error.message);
    }

    let teamsData = [];
    let error = null;

    if (tableExists) {
      try {
        // Get all teams data
        teamsData = await sql`SELECT * FROM teams ORDER BY created_at DESC`;
        console.log('Found', teamsData.length, 'team configurations');
      } catch (dbError) {
        console.error('Error fetching teams:', dbError);
        error = dbError.message;
      }
    }

    // Also check all tables in the database
    let allTables = [];
    try {
      allTables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
    } catch (tablesError) {
      console.error('Error getting table list:', tablesError);
    }

    const debugInfo = {
      timestamp: new Date().toISOString(),
      teamsTableExists: tableExists,
      teamsCount: teamsData.length,
      allTables: allTables.map(t => t.table_name),
      teamsData: teamsData.map(team => ({
        id: team.id,
        team_set_id: team.team_set_id,
        admin_user_id: team.admin_user_id,
        admin_username: team.admin_username,
        title: team.title,
        total_teams: team.total_teams,
        total_players: team.total_players,
        is_active: team.is_active,
        created_at: team.created_at
      })),
      error
    };

    console.log('Debug info:', JSON.stringify(debugInfo, null, 2));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(debugInfo)
    };

  } catch (error) {
    console.error('Database debug error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Database debug failed',
        details: error.message,
        stack: error.stack
      })
    };
  }
} 