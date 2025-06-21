// Database reset function to initialize default users
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
        error: 'Method not allowed'
      })
    };
  }

  try {
    const actions = [];

    // Create admin_users table if it doesn't exist (matching existing schema)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS admin_users (
          id VARCHAR(255) PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'admin',
          full_name VARCHAR(255),
          email VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      actions.push('admin_users table ensured');
    } catch (tableError) {
      actions.push(`Failed to create admin_users table: ${tableError.message}`);
    }

    // Create registration_sessions table if it doesn't exist (matching existing schema)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS registration_sessions (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(255) UNIQUE NOT NULL,
          admin_user_id VARCHAR(255) NOT NULL,
          admin_username VARCHAR(255) NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          max_players INTEGER DEFAULT 100,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP,
          player_count INTEGER DEFAULT 0
        )
      `;
      actions.push('registration_sessions table ensured');
    } catch (sessionTableError) {
      actions.push(`Failed to create registration_sessions table: ${sessionTableError.message}`);
    }

    // Update players table to add registration_session_id if not exists
    try {
      await sql`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS registration_session_id VARCHAR(255)
      `;
      actions.push('players table updated with registration_session_id');
    } catch (alterError) {
      actions.push(`Failed to update players table: ${alterError.message}`);
    }

    // Remove existing default users
    try {
      await sql`
        DELETE FROM admin_users 
        WHERE username IN ('admin', 'superadmin')
      `;
      actions.push('Removed existing default users');
    } catch (deleteError) {
      actions.push(`Failed to remove existing users: ${deleteError.message}`);
    }

    // Create default admin user with matching schema
    try {
      await sql`
        INSERT INTO admin_users (id, username, password_hash, role, full_name, email, is_active)
        VALUES (
          'user_admin_001', 
          'admin', 
          'admin123', 
          'admin', 
          'Administrator', 
          'admin@tournament.local', 
          true
        )
      `;
      actions.push('Created default admin user (username: admin, password: admin123)');
    } catch (adminError) {
      actions.push(`Failed to create admin user: ${adminError.message}`);
    }

    // Create default super admin user with matching schema
    try {
      await sql`
        INSERT INTO admin_users (id, username, password_hash, role, full_name, email, is_active)
        VALUES (
          'user_superadmin_001', 
          'superadmin', 
          'superadmin123', 
          'superadmin', 
          'Super Administrator', 
          'superadmin@tournament.local', 
          true
        )
      `;
      actions.push('Created default superadmin user (username: superadmin, password: superadmin123)');
    } catch (superAdminError) {
      actions.push(`Failed to create superadmin user: ${superAdminError.message}`);
    }

    // Database reset completed successfully

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Database reset completed',
        actions,

        credentials: {
          admin: { username: 'admin', password: 'admin123' },
          superadmin: { username: 'superadmin', password: 'superadmin123' }
        },
        timestamp: new Date().toISOString()
      }, null, 2)
    };

  } catch (error) {
    console.error('Database reset error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Database reset failed',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
}; 