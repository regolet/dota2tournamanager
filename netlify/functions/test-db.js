// Test database connection
import { neon } from '@netlify/neon';

export const handler = async (event, context) => {
  try {
    // Test basic connection
    const sql = neon(process.env.DATABASE_URL);
    
    console.log('Testing database connection...');
    
    // Test simple query
    const result = await sql`SELECT NOW() as current_time`;
    console.log('Database connection successful:', result);
    
    // Check if admin_users table exists
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'admin_users'
    `;
    console.log('Admin users table check:', tableCheck);
    
    // Try to create admin_users table if it doesn't exist
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
    console.log('Admin users table created/verified');
    
    // Check if any users exist
    const userCount = await sql`SELECT COUNT(*) as count FROM admin_users`;
    console.log('Current user count:', userCount);
    
    // If no users, create default ones
    if (userCount[0].count == 0) {
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
      console.log('Default users created');
    }
    
    // List all users
    const users = await sql`SELECT username, role, is_active FROM admin_users`;
    console.log('All users:', users);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Database test successful',
        data: {
          connection: 'OK',
          currentTime: result[0].current_time,
          userCount: userCount[0].count,
          users: users
        }
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