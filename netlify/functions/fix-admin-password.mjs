// Fix admin user password with proper bcrypt hash
import { sql } from './database.mjs';
import bcrypt from 'bcrypt';

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

  try {
    console.log('Fixing admin password...');
    
    // Hash the correct passwords
    const adminPassword = 'Admin123!';
    const superadminPassword = 'SuperAdmin123!';
    
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    const superadminPasswordHash = await bcrypt.hash(superadminPassword, 12);
    
    console.log('Generated hashes:');
    console.log('Admin hash length:', adminPasswordHash.length);
    console.log('Superadmin hash length:', superadminPasswordHash.length);
    
    // Update admin user
    const adminUpdate = await sql`
      UPDATE admin_users 
      SET password_hash = ${adminPasswordHash}, updated_at = NOW()
      WHERE username = 'admin'
    `;
    
    // Update superadmin user
    const superadminUpdate = await sql`
      UPDATE admin_users 
      SET password_hash = ${superadminPasswordHash}, updated_at = NOW()
      WHERE username = 'superadmin'
    `;
    
    console.log('Password updates completed');
    
    // Test the updated passwords
    const testAdmin = await sql`
      SELECT username, password_hash FROM admin_users WHERE username = 'admin'
    `;
    
    const testSuperadmin = await sql`
      SELECT username, password_hash FROM admin_users WHERE username = 'superadmin'
    `;
    
    // Verify the passwords work
    const adminVerify = await bcrypt.compare(adminPassword, testAdmin[0].password_hash);
    const superadminVerify = await bcrypt.compare(superadminPassword, testSuperadmin[0].password_hash);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Admin passwords fixed successfully',
        verification: {
          admin: {
            hashLength: testAdmin[0].password_hash.length,
            passwordVerifies: adminVerify
          },
          superadmin: {
            hashLength: testSuperadmin[0].password_hash.length,
            passwordVerifies: superadminVerify
          }
        }
      })
    };

  } catch (error) {
    console.error('Password fix error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Password fix failed',
        details: error.message
      })
    };
  }
}; 