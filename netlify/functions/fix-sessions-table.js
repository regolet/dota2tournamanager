// Fix admin_sessions table structure
import { neon } from '@netlify/neon';

export const handler = async (event, context) => {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    console.log('Checking admin_sessions table structure...');
    
    // Check current table structure
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'admin_sessions' AND table_schema = 'public'
    `;
    
    console.log('Current columns:', columns);
    
    // Drop and recreate the table with correct structure
    await sql`DROP TABLE IF EXISTS admin_sessions CASCADE`;
    console.log('Dropped existing admin_sessions table');
    
    // Create the table with correct structure
    await sql`
      CREATE TABLE admin_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'admin',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('Created new admin_sessions table');
    
    // Verify the new structure
    const newColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'admin_sessions' AND table_schema = 'public'
    `;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'admin_sessions table fixed successfully',
        oldColumns: columns,
        newColumns: newColumns
      })
    };
    
  } catch (error) {
    console.error('Error fixing admin_sessions table:', error);
    
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