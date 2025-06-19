// Database diagnostic function for troubleshooting
import { neon } from '@netlify/neon';

const sql = neon(process.env.DATABASE_URL);

export const handler = async (event, context) => {
  // Handle CORS
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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    const diagnostics = {};

    // Check if DATABASE_URL is available
    diagnostics.databaseUrl = process.env.DATABASE_URL ? 'Available' : 'Missing';

    // Test database connection
    try {
      const testQuery = await sql`SELECT 1 as test`;
      diagnostics.databaseConnection = 'Success';
    } catch (dbError) {
      diagnostics.databaseConnection = `Failed: ${dbError.message}`;
    }

    // Check if admin_users table exists
    try {
      const tableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'admin_users'
        )
      `;
      diagnostics.adminUsersTable = tableCheck[0].exists ? 'Exists' : 'Missing';
    } catch (tableError) {
      diagnostics.adminUsersTable = `Error: ${tableError.message}`;
    }

    // Check admin users in database
    try {
      const users = await sql`
        SELECT id, username, role, is_active, created_at
        FROM admin_users
        ORDER BY created_at ASC
      `;
      diagnostics.adminUsers = {
        count: users.length,
        users: users.map(user => ({
          id: user.id,
          username: user.username,
          role: user.role,
          isActive: user.is_active,
          createdAt: user.created_at
        }))
      };
    } catch (userError) {
      diagnostics.adminUsers = `Error: ${userError.message}`;
    }

    // Check if players table has the new schema
    try {
      const playersSchema = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'players'
        ORDER BY ordinal_position
      `;
      diagnostics.playersTableSchema = playersSchema;
    } catch (schemaError) {
      diagnostics.playersTableSchema = `Error: ${schemaError.message}`;
    }

    // Check registration_sessions table
    try {
      const sessionCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'registration_sessions'
        )
      `;
      diagnostics.registrationSessionsTable = sessionCheck[0].exists ? 'Exists' : 'Missing';
      
      if (sessionCheck[0].exists) {
        const sessionCount = await sql`SELECT COUNT(*) as count FROM registration_sessions`;
        diagnostics.registrationSessionsCount = sessionCount[0].count;
      }
    } catch (sessionError) {
      diagnostics.registrationSessionsTable = `Error: ${sessionError.message}`;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        diagnostics,
        timestamp: new Date().toISOString()
      }, null, 2)
    };

  } catch (error) {
    console.error('Database debug error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Database diagnostic failed',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
}; 