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
    // Test database connection
    const testQuery = await sql`SELECT 1 as test`;

    // Get admin users
    const users = await sql`
      SELECT id, username, role, is_active, created_at
      FROM admin_users
      ORDER BY created_at ASC
    `;

    // Get players table schema
    const playersSchema = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'players'
      ORDER BY ordinal_position
    `;

    // Get registration sessions count
    const sessionCount = await sql`SELECT COUNT(*) as count FROM registration_sessions`;

    // Get registration sessions details
    const registrationSessionsResult = await sql`
      SELECT * FROM registration_sessions ORDER BY created_at DESC
    `;
    
    // Get players details  
    const playersResult = await sql`
      SELECT * FROM players ORDER BY created_at DESC
    `;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        diagnostics: {
          databaseUrl: process.env.DATABASE_URL ? 'Available' : 'Missing',
          databaseConnection: 'Success',
          adminUsersTable: 'Exists',
          adminUsers: {
            count: users.length,
            users: users.map(user => ({
              id: user.id,
              username: user.username,
              role: user.role,
              isActive: user.is_active,
              createdAt: user.created_at
            }))
          },
          playersTableSchema: playersSchema,
          registrationSessionsTable: 'Exists',
          registrationSessionsCount: sessionCount[0].count,
          registrationSessions: registrationSessionsResult.map(session => ({
            id: session.id,
            sessionId: session.session_id,
            adminUsername: session.admin_username,
            title: session.title,
            maxPlayers: session.max_players,
            playerCount: session.player_count,
            isActive: session.is_active,
            createdAt: session.created_at
          })),
          playersCount: playersResult.length,
          players: playersResult.map(player => ({
            id: player.id,
            name: player.name,
            dota2id: player.dota2id,
            peakmmr: player.peakmmr,
            registrationSessionId: player.registration_session_id,
            createdAt: player.created_at
          }))
        },
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