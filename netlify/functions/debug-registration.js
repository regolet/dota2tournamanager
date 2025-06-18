// Debug function to test registration database operations
import { neon } from '@netlify/neon';

const sql = neon(process.env.DATABASE_URL);

export const handler = async (event, context) => {
  try {
    console.log('Debug registration API called');
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
        }
      };
    }
    
    const results = {};
    
    // Test 1: Basic database connection
    try {
      const testQuery = await sql`SELECT 1 as test`;
      results.databaseConnection = { success: true, result: testQuery };
    } catch (error) {
      results.databaseConnection = { success: false, error: error.message };
    }
    
    // Test 2: Check if registration_settings table exists
    try {
      const tableCheck = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'registration_settings'
        ORDER BY ordinal_position
      `;
      results.tableSchema = { success: true, columns: tableCheck };
    } catch (error) {
      results.tableSchema = { success: false, error: error.message };
    }
    
    // Test 3: Try to select from registration_settings
    try {
      const settingsQuery = await sql`
        SELECT * FROM registration_settings ORDER BY id DESC LIMIT 1
      `;
      results.settingsQuery = { success: true, data: settingsQuery };
    } catch (error) {
      results.settingsQuery = { success: false, error: error.message };
    }
    
    // Test 4: Try inserting test data
    try {
      // First clear any existing data
      await sql`DELETE FROM registration_settings`;
      
      // Insert test data
      const insertResult = await sql`
        INSERT INTO registration_settings (is_open, tournament_name, tournament_date, max_players, expiry, closed_at, auto_close)
        VALUES (false, 'Test Tournament', CURRENT_DATE, 50, null, null, false)
        RETURNING *
      `;
      
      results.insertTest = { success: true, data: insertResult };
    } catch (error) {
      results.insertTest = { success: false, error: error.message };
    }
    
    // Test 5: Test the actual getRegistrationSettings function
    try {
      const { getRegistrationSettings } = await import('./database.js');
      const registrationSettings = await getRegistrationSettings();
      results.getRegistrationSettings = { success: true, data: registrationSettings };
    } catch (error) {
      results.getRegistrationSettings = { success: false, error: error.message };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Registration debug completed',
        results: results,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Debug registration error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Debug registration error: ' + error.message,
        error: error.toString(),
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    };
  }
}; 