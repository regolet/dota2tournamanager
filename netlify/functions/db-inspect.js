// Database inspection endpoint to check table structure
import { sql } from './database.js';

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
    console.log('Inspecting database structure...');
    
    // Get all tables in the database
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('Found tables:', tables.map(t => t.table_name));
    
    // Get detailed info for each table
    const tableDetails = {};
    
    for (const table of tables) {
      const tableName = table.table_name;
      
      // Get column information
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = ${tableName}
        ORDER BY ordinal_position
      `;
      
      // Get row count
      let rowCount = 0;
      try {
        const countResult = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`;
        rowCount = parseInt(countResult[0].count);
      } catch (e) {
        console.log(`Could not get row count for ${tableName}:`, e.message);
      }
      
      tableDetails[tableName] = {
        columns: columns.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          default: col.column_default
        })),
        rowCount
      };
    }
    
    // Check if teams table specifically exists
    const teamsTableExists = tables.some(t => t.table_name === 'teams');
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      tablesFound: tables.length,
      teamsTableExists,
      tables: tables.map(t => t.table_name),
      tableDetails
    };
    
    console.log('Database inspection complete:', JSON.stringify(result, null, 2));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result, null, 2)
    };
    
  } catch (error) {
    console.error('Database inspection error:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Database inspection failed',
        details: error.message,
        timestamp: new Date().toISOString()
      }, null, 2)
    };
  }
} 