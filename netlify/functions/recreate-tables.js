// Function to recreate registration_settings table with correct schema
import { neon } from '@netlify/neon';

const sql = neon(process.env.DATABASE_URL);

export const handler = async (event, context) => {
  try {
    console.log('Recreate tables API called');
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
      };
    }
    
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Method not allowed. Use POST.'
        })
      };
    }
    
    const results = {};
    
    // Step 1: Drop existing table
    try {
      await sql`DROP TABLE IF EXISTS registration_settings`;
      results.dropTable = { success: true, message: 'Dropped existing table' };
    } catch (error) {
      results.dropTable = { success: false, error: error.message };
    }
    
    // Step 2: Recreate table with correct schema
    try {
      await sql`
        CREATE TABLE registration_settings (
          id SERIAL PRIMARY KEY,
          is_open BOOLEAN DEFAULT true,
          tournament_name VARCHAR(255) DEFAULT 'Dota 2 Tournament',
          tournament_date DATE DEFAULT CURRENT_DATE,
          max_players INTEGER DEFAULT 50,
          expiry TIMESTAMP,
          closed_at TIMESTAMP,
          auto_close BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      results.createTable = { success: true, message: 'Created table with new schema' };
    } catch (error) {
      results.createTable = { success: false, error: error.message };
    }
    
    // Step 3: Insert default registration settings
    try {
      await sql`
        INSERT INTO registration_settings (is_open, tournament_name, tournament_date, max_players, expiry, closed_at, auto_close) 
        VALUES (false, 'Dota 2 Tournament', CURRENT_DATE, 50, null, null, false)
      `;
      results.insertDefault = { success: true, message: 'Inserted default settings' };
    } catch (error) {
      results.insertDefault = { success: false, error: error.message };
    }
    
    // Step 4: Verify the table
    try {
      const verification = await sql`
        SELECT * FROM registration_settings ORDER BY id DESC LIMIT 1
      `;
      results.verification = { success: true, data: verification };
    } catch (error) {
      results.verification = { success: false, error: error.message };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Table recreation completed',
        results: results,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Recreate tables error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Error recreating tables: ' + error.message,
        error: error.toString(),
        timestamp: new Date().toISOString()
      })
    };
  }
}; 