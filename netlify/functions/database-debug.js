// Database diagnostic function for troubleshooting
import { neon } from '@netlify/neon';
import bcrypt from 'bcrypt';

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
    console.log('Database debug starting...');

    // First, let's check if the admin_users table exists
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log('Available tables:', tables.map(t => t.table_name));

    // Check if admin_users table exists
    const adminUsersTableExists = tables.some(t => t.table_name === 'admin_users');
    
    if (!adminUsersTableExists) {
      // Create the table and default users
      console.log('admin_users table does not exist, creating...');
      
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

      // Create default admin users
      const superAdminPasswordHash = await bcrypt.hash('SuperAdmin123!', 12);
      const adminPasswordHash = await bcrypt.hash('Admin123!', 12);
      
      await sql`
        INSERT INTO admin_users (id, username, password_hash, role, full_name, email, is_active) 
        VALUES 
        (
          'user_superadmin_001', 
          'superadmin', 
          ${superAdminPasswordHash}, 
          'superadmin', 
          'Super Administrator', 
          'superadmin@tournament.local', 
          true
        ),
        (
          'user_admin_001', 
          'admin', 
          ${adminPasswordHash}, 
          'admin', 
          'Administrator', 
          'admin@tournament.local', 
          true
        )
      `;
      
      console.log('Default admin users created');
    }

    // Get all admin users (without password hashes for security)
    const users = await sql`
      SELECT id, username, role, full_name, email, is_active, created_at
      FROM admin_users 
      ORDER BY created_at ASC
    `;

    console.log(`Found ${users.length} admin users`);

    // Test password verification for admin user
    const adminUser = await sql`
      SELECT username, password_hash 
      FROM admin_users 
      WHERE username = 'admin'
    `;

    let passwordTestResult = null;
    if (adminUser.length > 0) {
      const testPassword = 'Admin123!';
      passwordTestResult = {
        passwordExists: !!adminUser[0].password_hash,
        passwordHashLength: adminUser[0].password_hash ? adminUser[0].password_hash.length : 0,
        testResult: await bcrypt.compare(testPassword, adminUser[0].password_hash)
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        debug: {
          tablesFound: tables.map(t => t.table_name),
          adminUsersTableExists,
          usersCount: users.length,
          users: users,
          passwordTest: passwordTestResult,
          timestamp: new Date().toISOString()
        }
      })
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
        error: 'Database debug failed',
        details: error.message,
        stack: error.stack
      })
    };
  }
}; 