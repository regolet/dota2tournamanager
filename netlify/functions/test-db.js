// Test Neon DB connection
import { neon } from '@netlify/neon';

const sql = neon();

export const handler = async (event, context) => {
  try {
    console.log('Testing Neon DB connection...');
    
    // Simple test query
    const result = await sql`SELECT 1 as test`;
    console.log('Test query result:', result);
    
    // Test players table exists
    const players = await sql`SELECT COUNT(*) as count FROM players`;
    console.log('Players table count:', players);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Database connection working',
        testResult: result,
        playersCount: players
      })
    };
    
  } catch (error) {
    console.error('Database test error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
}; 