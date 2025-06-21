// Database module for Netlify Functions using Neon DB (PostgreSQL)
import { neon } from '@netlify/neon';
import { hashPassword, verifyPassword, validatePasswordStrength } from './password-utils.js';

// Initialize Neon database connection
const sql = neon(process.env.DATABASE_URL);

// Database schema initialization
async function initializeDatabase() {
  try {
    // ... (rest of the initializeDatabase function)
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// ... (other database functions)

// Teams management operations
export async function saveTeamConfiguration(adminUserId, adminUsername, teamData) {
  try {
    console.log(`[DB] Saving team config for admin: ${adminUserId} (${adminUsername})`);
    
    await initializeDatabase();
    
    const teamSetId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await sql`
      INSERT INTO teams (
        team_set_id, admin_user_id, admin_username, title, description, 
        balance_method, total_teams, total_players, average_mmr, 
        registration_session_id, teams_data
      ) VALUES (
        ${teamSetId}, ${adminUserId}, ${adminUsername}, ${teamData.title}, 
        ${teamData.description || ''}, ${teamData.balanceMethod}, 
        ${teamData.totalTeams}, ${teamData.totalPlayers}, ${teamData.averageMmr},
        ${teamData.registrationSessionId || null}, ${JSON.stringify(teamData.teams)}
      )
    `;
    
    console.log(`[DB] Team config saved successfully with ID: ${teamSetId}`);
    return { success: true, teamSetId };
  } catch (error) {
    console.error('[DB] Error saving team configuration:', error);
    
    if (error.message && (error.message.includes('relation "teams" does not exist') || 
                         error.message.includes('table') || 
                         error.message.includes('does not exist'))) {
      console.log('[DB] Teams table does not exist - reinitializing');
      try {
        await initializeDatabase();
        console.log('[DB] Reinitialized - retrying save');
        
        const teamSetId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await sql`
          INSERT INTO teams (
            team_set_id, admin_user_id, admin_username, title, description, 
            balance_method, total_teams, total_players, average_mmr, 
            registration_session_id, teams_data
          ) VALUES (
            ${teamSetId}, ${adminUserId}, ${adminUsername}, ${teamData.title}, 
            ${teamData.description || ''}, ${teamData.balanceMethod}, 
            ${teamData.totalTeams}, ${teamData.totalPlayers}, ${teamData.averageMmr},
            ${teamData.registrationSessionId || null}, ${JSON.stringify(teamData.teams)}
          )
        `;
        
        console.log(`[DB] Team config saved successfully on retry with ID: ${teamSetId}`);
        return { success: true, teamSetId };
      } catch (retryError) {
        console.error('[DB] Error on retry:', retryError);
        return { success: false, message: 'Database initialization failed' };
      }
    }
    
    return { success: false, message: `Error saving team configuration: ${error.message}` };
  }
}

export async function getTeamConfigurations(adminUserId = null) {
  try {
    await initializeDatabase();
    
    console.log(`[DB] Getting all team configs (bypassing admin ID for debugging)`);
    
    let teams = await sql`
      SELECT * FROM teams 
      WHERE is_active = true
      ORDER BY created_at DESC
    `;
    
    console.log(`[DB] Found ${teams.length} total team configurations`);
    
    return teams.map(team => ({
      id: team.id,
      teamSetId: team.team_set_id,
      adminUserId: team.admin_user_id,
      adminUsername: team.admin_username,
      title: team.title,
      description: team.description,
      balanceMethod: team.balance_method,
      totalTeams: team.total_teams,
      totalPlayers: team.total_players,
      averageMmr: team.average_mmr,
      registrationSessionId: team.registration_session_id,
      teams: JSON.parse(team.teams_data),
      createdAt: team.created_at,
      updatedAt: team.updated_at
    }));
  } catch (error) {
    console.error('[DB] Error getting team configurations:', error);
    return [];
  }
}

// ... (rest of the database functions) 