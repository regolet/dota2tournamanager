// Database module for Netlify Functions using Neon DB (PostgreSQL)
import { neon } from '@netlify/neon';
import { hashPassword, verifyPassword, validatePasswordStrength } from './password-utils.js';
import { optimizedQuery, createOptimalIndexes } from './database-optimization.js';

// Initialize Neon database connection
const sql = neon(process.env.DATABASE_URL);

// Database schema initialization
async function initializeDatabase() {
  try {
    console.log('Starting database initialization...');
    
    // Create players table with registration session support
    await sql`
      CREATE TABLE IF NOT EXISTS players (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        dota2id VARCHAR(255) NOT NULL,
        peakmmr INTEGER DEFAULT 0,
        ip_address INET,
        registration_date TIMESTAMP DEFAULT NOW(),
        registration_session_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(dota2id, registration_session_id)
      )
    `;

    // Add registration_session_id column if it doesn't exist (for existing installations)
    await sql`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS registration_session_id VARCHAR(255)
    `;

    // Drop the old unique constraint on dota2id and add new composite constraint
    try {
      await sql`
        ALTER TABLE players 
        DROP CONSTRAINT IF EXISTS players_dota2id_key
      `;
    } catch (error) {
      // Constraint may not exist, ignore error
    }

    try {
      await sql`
        ALTER TABLE players 
        ADD CONSTRAINT players_dota2id_session_unique 
        UNIQUE(dota2id, registration_session_id)
      `;
    } catch (error) {
      // Constraint may already exist, ignore error
    }

    // Create masterlist table
    await sql`
      CREATE TABLE IF NOT EXISTS masterlist (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        dota2id VARCHAR(255) UNIQUE NOT NULL,
        mmr INTEGER DEFAULT 0,
        team VARCHAR(255) DEFAULT '',
        achievements TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create registration_settings table
    await sql`
      CREATE TABLE IF NOT EXISTS registration_settings (
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

    // Create admin_sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'admin',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create admin_users table
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

    // Create registration_sessions table for individual admin registration links
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

    // Insert default registration settings if table is empty
    const settingsCount = await sql`SELECT COUNT(*) as count FROM registration_settings`;
    if (settingsCount[0].count == 0) {
      await sql`
        INSERT INTO registration_settings (is_open, tournament_name, tournament_date, max_players, expiry, closed_at, auto_close) 
        VALUES (false, 'Dota 2 Tournament', CURRENT_DATE, 50, null, null, false)
      `;
    }

    // Create default admin users if table is empty
    const usersCount = await sql`SELECT COUNT(*) as count FROM admin_users`;
    if (usersCount[0].count == 0) {
      // Hash default passwords securely
      const superAdminPasswordHash = await hashPassword('SuperAdmin123!');
      const adminPasswordHash = await hashPassword('Admin123!');
      
      // Create default super admin
      await sql`
        INSERT INTO admin_users (id, username, password_hash, role, full_name, email, is_active) 
        VALUES (
          'user_superadmin_001', 
          'superadmin', 
          ${superAdminPasswordHash}, 
          'superadmin', 
          'Super Administrator', 
          'superadmin@tournament.local', 
          true
        )
      `;
      
      // Create default admin
      await sql`
        INSERT INTO admin_users (id, username, password_hash, role, full_name, email, is_active) 
        VALUES (
          'user_admin_001', 
          'admin', 
          ${adminPasswordHash}, 
          'admin', 
          'Administrator', 
          'admin@tournament.local', 
          true
        )
      `;
      
      console.log('🔐 Default admin users created with secure passwords:');
      console.log('   • superadmin / SuperAdmin123!');
      console.log('   • admin / Admin123!');
      console.log('⚠️  Please change these passwords after first login!');
    }

    // Create optimal indexes for performance
    await createOptimalIndexes();
    
    console.log('Database initialization completed successfully');

  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Tournament-scoped player operations
export async function getPlayers(registrationSessionId = null) {
  try {
    await initializeDatabase();

    let players;
    if (registrationSessionId) {
      // Get players for specific registration session
      players = await sql`
        SELECT 
          id, 
          name, 
          dota2id, 
          peakmmr, 
          ip_address as "ipAddress", 
          registration_date as "registrationDate",
          registration_session_id as "registrationSessionId"
        FROM players 
        WHERE registration_session_id = ${registrationSessionId}
        ORDER BY registration_date DESC
      `;
    } else {
      // Get all players (for super admin or legacy compatibility)
      players = await sql`
        SELECT 
          id, 
          name, 
          dota2id, 
          peakmmr, 
          ip_address as "ipAddress", 
          registration_date as "registrationDate",
          registration_session_id as "registrationSessionId"
        FROM players 
        ORDER BY registration_date DESC
      `;
    }

    return players;
  } catch (error) {
    console.error('Error getting players:', error);
    throw error;
  }
}

export async function addPlayer(player) {
  try {
    await initializeDatabase();

    if (!player.name) {
      throw new Error('Player must have a name');
    }
    
    // Generate ID if not provided
    if (!player.id) {
      player.id = `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    
    // Check if player already exists in the same registration session
    if (player.registrationSessionId) {
      const existing = await sql`
        SELECT id FROM players 
        WHERE (dota2id = ${player.dota2id} OR name = ${player.name}) 
        AND registration_session_id = ${player.registrationSessionId}
      `;
      
      if (existing.length > 0) {
        throw new Error('Player with this name or Dota2ID already exists in this tournament');
      }
    } else {
      // Legacy check for players without session (global scope)
      const existing = await sql`
        SELECT id FROM players 
        WHERE (dota2id = ${player.dota2id} OR name = ${player.name}) 
        AND registration_session_id IS NULL
      `;
      
      if (existing.length > 0) {
        throw new Error('Player with this name or Dota2ID already exists');
      }
    }
    
    await sql`
      INSERT INTO players (id, name, dota2id, peakmmr, ip_address, registration_date, registration_session_id)
      VALUES (
        ${player.id}, 
        ${player.name}, 
        ${player.dota2id}, 
        ${player.peakmmr || 0}, 
        ${player.ipAddress || '::1'}, 
        ${player.registrationDate || new Date().toISOString()},
        ${player.registrationSessionId || null}
      )
    `;

    return await getPlayers(player.registrationSessionId);
  } catch (error) {
    console.error('Error adding player:', error);
    throw error;
  }
}

export async function updatePlayer(playerId, updates) {
  try {
    await initializeDatabase();

    if (!playerId) {
      throw new Error('Player ID is required');
    }

    // Check if there's anything to update
    if (Object.keys(updates).length === 0) {
      throw new Error('No fields to update');
    }

    // Use multiple individual UPDATE statements for safety with Neon
    if (updates.name !== undefined) {
      await sql`UPDATE players SET name = ${updates.name}, updated_at = NOW() WHERE id = ${playerId}`;
    }
    
    if (updates.dota2id !== undefined) {
      await sql`UPDATE players SET dota2id = ${updates.dota2id}, updated_at = NOW() WHERE id = ${playerId}`;
    }
    
    if (updates.peakmmr !== undefined) {
      await sql`UPDATE players SET peakmmr = ${updates.peakmmr}, updated_at = NOW() WHERE id = ${playerId}`;
    }
    
    if (updates.ipAddress !== undefined) {
      await sql`UPDATE players SET ip_address = ${updates.ipAddress}, updated_at = NOW() WHERE id = ${playerId}`;
    }
    
    if (updates.registrationSessionId !== undefined) {
      await sql`UPDATE players SET registration_session_id = ${updates.registrationSessionId}, updated_at = NOW() WHERE id = ${playerId}`;
    }

    // Get the player to determine which session to return
    const updatedPlayer = await sql`SELECT registration_session_id FROM players WHERE id = ${playerId}`;
    const sessionId = updatedPlayer[0]?.registration_session_id;

    return await getPlayers(sessionId);
  } catch (error) {
    console.error('Error updating player:', error);
    throw error;
  }
}

export async function deletePlayer(playerId) {
  try {
    await initializeDatabase();

    if (!playerId) {
      throw new Error('Player ID is required');
    }

    // Get the player to determine which session to return
    const player = await sql`SELECT registration_session_id FROM players WHERE id = ${playerId}`;
    const sessionId = player[0]?.registration_session_id;

    await sql`DELETE FROM players WHERE id = ${playerId}`;

    return await getPlayers(sessionId);
  } catch (error) {
    console.error('Error deleting player:', error);
    throw error;
  }
}

// Legacy function for backward compatibility
export async function savePlayers(players) {
  try {
    await initializeDatabase();

    if (!Array.isArray(players)) {
      throw new Error('Players must be an array');
    }
    
    // Clear existing players and insert new ones (legacy behavior)
    await sql`DELETE FROM players WHERE registration_session_id IS NULL`;
    
    for (const player of players) {
      if (!player.id || !player.name) {
        throw new Error('Player must have id and name');
      }
      
      await sql`
        INSERT INTO players (id, name, dota2id, peakmmr, ip_address, registration_date, registration_session_id)
        VALUES (
          ${player.id}, 
          ${player.name}, 
          ${player.dota2id}, 
          ${player.peakmmr || 0}, 
          ${player.ipAddress || '::1'}, 
          ${player.registrationDate || new Date().toISOString()},
          ${player.registrationSessionId || null}
        )
      `;
    }

    return await getPlayers();
  } catch (error) {
    console.error('Error saving players:', error);
    throw error;
  }
}

// Helper function to get players for a specific admin's sessions
export async function getPlayersForAdmin(adminUserId, includeSessionInfo = false) {
  try {
    await initializeDatabase();

    if (includeSessionInfo) {
      const players = await sql`
        SELECT 
          p.id, 
          p.name, 
          p.dota2id, 
          p.peakmmr, 
          p.ip_address as "ipAddress", 
          p.registration_date as "registrationDate",
          p.registration_session_id as "registrationSessionId",
          rs.title as "sessionTitle",
          rs.admin_username as "sessionAdmin"
        FROM players p
        LEFT JOIN registration_sessions rs ON p.registration_session_id = rs.session_id
        WHERE rs.admin_user_id = ${adminUserId} OR p.registration_session_id IS NULL
        ORDER BY p.registration_date DESC
      `;
      return players;
    } else {
      const players = await sql`
        SELECT 
          p.id, 
          p.name, 
          p.dota2id, 
          p.peakmmr, 
          p.ip_address as "ipAddress", 
          p.registration_date as "registrationDate",
          p.registration_session_id as "registrationSessionId"
        FROM players p
        LEFT JOIN registration_sessions rs ON p.registration_session_id = rs.session_id
        WHERE rs.admin_user_id = ${adminUserId} OR p.registration_session_id IS NULL
        ORDER BY p.registration_date DESC
      `;
      return players;
    }
  } catch (error) {
    console.error('Error getting players for admin:', error);
    throw error;
  }
}

// Masterlist operations
export async function getMasterlist() {
  try {
    await initializeDatabase();

    
    const masterlist = await sql`
      SELECT id, name, dota2id, mmr, team, achievements, notes, created_at, updated_at
      FROM masterlist 
      ORDER BY mmr DESC, name ASC
    `;
    

    return masterlist;
  } catch (error) {
    console.error('Error getting masterlist:', error);
    throw error;
  }
}

export async function saveMasterlist(masterlist) {
  try {
    await initializeDatabase();

    
    if (!Array.isArray(masterlist)) {
      throw new Error('Masterlist must be an array');
    }
    
    // Clear existing masterlist and insert new ones
    await sql`DELETE FROM masterlist`;
    
    for (const player of masterlist) {
      if (!player.name) {
        throw new Error('Player must have a name');
      }
      
      await sql`
        INSERT INTO masterlist (name, dota2id, mmr, team, achievements, notes)
        VALUES (${player.name}, ${player.dota2id}, ${player.mmr || 0}, ${player.team || ''}, ${player.achievements || ''}, ${player.notes || ''})
      `;
    }
    

    return await getMasterlist();
  } catch (error) {
    console.error('Error saving masterlist:', error);
    throw error;
  }
}

export async function addMasterlistPlayer(player) {
  try {
    await initializeDatabase();

    
    if (!player.name) {
      throw new Error('Player must have a name');
    }
    
    if (!player.dota2id) {
      throw new Error('Player must have a Dota 2 ID');
    }
    
    // Check if player already exists
    const existingPlayer = await sql`
      SELECT id, name, dota2id FROM masterlist 
      WHERE dota2id = ${player.dota2id} OR LOWER(name) = LOWER(${player.name})
    `;
    
    if (existingPlayer.length > 0) {
      const existing = existingPlayer[0];
      if (existing.dota2id === player.dota2id) {
        throw new Error(`A player with Dota 2 ID "${player.dota2id}" already exists in the masterlist (${existing.name}).`);
      } else {
        throw new Error(`A player with name "${player.name}" already exists in the masterlist.`);
      }
    }
    
    const result = await sql`
      INSERT INTO masterlist (name, dota2id, mmr, team, achievements, notes)
      VALUES (${player.name}, ${player.dota2id}, ${player.mmr || 0}, ${player.team || ''}, ${player.achievements || ''}, ${player.notes || ''})
      RETURNING *
    `;
    

    return await getMasterlist();
  } catch (error) {
    console.error('Error adding masterlist player:', error);
    
    // Handle database constraint errors
    if (error.message && error.message.includes('unique constraint')) {
      if (error.message.includes('dota2id')) {
        throw new Error(`A player with Dota 2 ID "${player.dota2id}" already exists in the masterlist.`);
      } else if (error.message.includes('name')) {
        throw new Error(`A player with name "${player.name}" already exists in the masterlist.`);
      } else {
        throw new Error('A player with this information already exists in the masterlist.');
      }
    }
    
    throw error;
  }
}

export async function updateMasterlistPlayer(playerId, updates) {
  try {
    await initializeDatabase();

    
    // Get default values from current record if not provided
    const { name, dota2id, mmr, team, achievements, notes } = updates;
    
    if (!name) {
      throw new Error('Player must have a name');
    }
    
    if (!dota2id) {
      throw new Error('Player must have a Dota 2 ID');
    }
    
    // Check if another player already exists with same dota2id or name
    const existingPlayer = await sql`
      SELECT id, name, dota2id FROM masterlist 
      WHERE (dota2id = ${dota2id} OR LOWER(name) = LOWER(${name})) 
      AND id != ${parseInt(playerId)}
    `;
    
    if (existingPlayer.length > 0) {
      const existing = existingPlayer[0];
      if (existing.dota2id === dota2id) {
        throw new Error(`A different player with Dota 2 ID "${dota2id}" already exists in the masterlist (${existing.name}).`);
      } else {
        throw new Error(`A different player with name "${name}" already exists in the masterlist.`);
      }
    }
    
    // Execute update query with all fields
    const result = await sql`
      UPDATE masterlist 
      SET 
        name = ${name},
        dota2id = ${dota2id},
        mmr = ${mmr || 0},
        team = ${team || ''},
        achievements = ${achievements || ''},
        notes = ${notes || ''},
        updated_at = NOW()
      WHERE id = ${parseInt(playerId)}
    `;
    

    
    if (result.count === 0) {
      throw new Error('Player not found in masterlist');
    }
    

    return await getMasterlist();
  } catch (error) {
    console.error('Error updating masterlist player:', error);
    
    // Handle database constraint errors
    if (error.message && error.message.includes('unique constraint')) {
      if (error.message.includes('dota2id')) {
        throw new Error(`A player with Dota 2 ID "${dota2id}" already exists in the masterlist.`);
      } else if (error.message.includes('name')) {
        throw new Error(`A player with name "${name}" already exists in the masterlist.`);
      } else {
        throw new Error('A player with this information already exists in the masterlist.');
      }
    }
    
    throw error;
  }
}

export async function deleteMasterlistPlayer(playerId) {
  try {
    await initializeDatabase();

    
    const result = await sql`
      DELETE FROM masterlist WHERE id = ${parseInt(playerId)}
    `;
    
    if (result.count === 0) {
      throw new Error('Player not found in masterlist');
    }
    

    return await getMasterlist();
  } catch (error) {
    console.error('Error deleting masterlist player:', error);
    throw error;
  }
}

// Registration settings operations
export async function getRegistrationSettings() {
  try {
    await initializeDatabase();

    
    const settings = await sql`
      SELECT is_open, tournament_name, tournament_date, max_players, expiry, closed_at, auto_close, created_at, updated_at
      FROM registration_settings 
      ORDER BY id DESC 
      LIMIT 1
    `;
    
    if (settings.length === 0) {
      return {
        isOpen: false,
        tournament: {
          name: "Dota 2 Tournament",
          date: new Date().toISOString().split('T')[0],
          maxPlayers: 50
        },
        expiry: null,
        createdAt: null,
        closedAt: null,
        autoClose: false
      };
    }
    
    const setting = settings[0];
    return {
      isOpen: setting.is_open,
      tournament: {
        name: setting.tournament_name,
        date: setting.tournament_date,
        maxPlayers: setting.max_players
      },
      expiry: setting.expiry ? setting.expiry.toISOString() : null,
      createdAt: setting.created_at ? setting.created_at.toISOString() : null,
      closedAt: setting.closed_at ? setting.closed_at.toISOString() : null,
      autoClose: setting.auto_close || false
    };
  } catch (error) {
    console.error('Error getting registration settings:', error);
    throw error;
  }
}

export async function saveRegistrationSettings(settings) {
  try {
    await initializeDatabase();

    
    // Delete existing settings and insert new ones
    await sql`DELETE FROM registration_settings`;
    
    await sql`
      INSERT INTO registration_settings (is_open, tournament_name, tournament_date, max_players, expiry, closed_at, auto_close)
      VALUES (
        ${settings.isOpen}, 
        ${settings.tournament.name}, 
        ${settings.tournament.date}, 
        ${settings.tournament.maxPlayers},
        ${settings.expiry || null},
        ${settings.closedAt || null},
        ${settings.autoClose || false}
      )
    `;
    

    return await getRegistrationSettings();
  } catch (error) {
    console.error('Error saving registration settings:', error);
    throw error;
  }
}

// Registration session operations (for multi-admin registration links)
export async function createRegistrationSession(adminUserId, adminUsername, sessionData) {
  try {
    await initializeDatabase();
    
    const sessionId = `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await sql`
      INSERT INTO registration_sessions (
        session_id, admin_user_id, admin_username, title, description, 
        max_players, is_active, expires_at
      )
      VALUES (
        ${sessionId}, 
        ${adminUserId}, 
        ${adminUsername}, 
        ${sessionData.title}, 
        ${sessionData.description || ''}, 
        ${sessionData.maxPlayers || 100}, 
        true,
        ${sessionData.expiresAt || null}
      )
    `;
    
    return { success: true, sessionId };
  } catch (error) {
    console.error('Error creating registration session:', error);
    return { success: false, message: 'Error creating registration session' };
  }
}

export async function getRegistrationSessions(adminUserId = null) {
  try {
    await initializeDatabase();
    
    let sessions;
    if (adminUserId) {
      // Get sessions with actual player count from players table
      sessions = await sql`
        SELECT rs.*, 
               COALESCE(player_counts.actual_count, 0) as actual_player_count
        FROM registration_sessions rs
        LEFT JOIN (
          SELECT registration_session_id, COUNT(*) as actual_count
          FROM players 
          WHERE registration_session_id IS NOT NULL
          GROUP BY registration_session_id
        ) player_counts ON rs.session_id = player_counts.registration_session_id
        WHERE rs.admin_user_id = ${adminUserId}
        ORDER BY rs.created_at DESC
      `;
    } else {
      // Get all sessions with actual player count from players table
      sessions = await sql`
        SELECT rs.*, 
               COALESCE(player_counts.actual_count, 0) as actual_player_count
        FROM registration_sessions rs
        LEFT JOIN (
          SELECT registration_session_id, COUNT(*) as actual_count
          FROM players 
          WHERE registration_session_id IS NOT NULL
          GROUP BY registration_session_id
        ) player_counts ON rs.session_id = player_counts.registration_session_id
        ORDER BY rs.created_at DESC
      `;
    }
    
    return sessions.map(session => ({
      id: session.id,
      sessionId: session.session_id,
      adminUserId: session.admin_user_id,
      adminUsername: session.admin_username,
      title: session.title,
      description: session.description,
      maxPlayers: session.max_players,
      isActive: session.is_active,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      expiresAt: session.expires_at,
      playerCount: session.actual_player_count // Use actual count from players table
    }));
  } catch (error) {
    console.error('Error getting registration sessions:', error);
    throw error;
  }
}

export async function getRegistrationSessionBySessionId(sessionId) {
  try {
    await initializeDatabase();
    
    // Get session with actual player count from players table
    const sessions = await sql`
      SELECT rs.*, 
             COALESCE(player_counts.actual_count, 0) as actual_player_count
      FROM registration_sessions rs
      LEFT JOIN (
        SELECT registration_session_id, COUNT(*) as actual_count
        FROM players 
        WHERE registration_session_id = ${sessionId}
        GROUP BY registration_session_id
      ) player_counts ON rs.session_id = player_counts.registration_session_id
      WHERE rs.session_id = ${sessionId} AND rs.is_active = true
    `;
    
    if (sessions.length === 0) {
      return null;
    }
    
    const session = sessions[0];
    return {
      id: session.id,
      sessionId: session.session_id,
      adminUserId: session.admin_user_id,
      adminUsername: session.admin_username,
      title: session.title,
      description: session.description,
      maxPlayers: session.max_players,
      isActive: session.is_active,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      expiresAt: session.expires_at,
      playerCount: session.actual_player_count // Use actual count from players table
    };
  } catch (error) {
    console.error('Error getting registration session:', error);
    return null;
  }
}

export async function updateRegistrationSession(sessionId, updates) {
  try {
    await initializeDatabase();
    
    const updateFields = {};
    if (updates.title !== undefined) updateFields.title = updates.title;
    if (updates.description !== undefined) updateFields.description = updates.description;
    if (updates.maxPlayers !== undefined) updateFields.max_players = updates.maxPlayers;
    if (updates.isActive !== undefined) updateFields.is_active = updates.isActive;
    if (updates.expiresAt !== undefined) updateFields.expires_at = updates.expiresAt;
    
    if (Object.keys(updateFields).length === 0) {
      return { success: false, message: 'No fields to update' };
    }
    
    // Perform individual updates
    if (updateFields.title !== undefined) {
      await sql`UPDATE registration_sessions SET title = ${updateFields.title}, updated_at = NOW() WHERE session_id = ${sessionId}`;
    }
    if (updateFields.description !== undefined) {
      await sql`UPDATE registration_sessions SET description = ${updateFields.description}, updated_at = NOW() WHERE session_id = ${sessionId}`;
    }
    if (updateFields.max_players !== undefined) {
      await sql`UPDATE registration_sessions SET max_players = ${updateFields.max_players}, updated_at = NOW() WHERE session_id = ${sessionId}`;
    }
    if (updateFields.is_active !== undefined) {
      await sql`UPDATE registration_sessions SET is_active = ${updateFields.is_active}, updated_at = NOW() WHERE session_id = ${sessionId}`;
    }
    if (updateFields.expires_at !== undefined) {
      await sql`UPDATE registration_sessions SET expires_at = ${updateFields.expires_at}, updated_at = NOW() WHERE session_id = ${sessionId}`;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating registration session:', error);
    return { success: false, message: 'Error updating registration session' };
  }
}

export async function deleteRegistrationSession(sessionId) {
  try {
    await initializeDatabase();
    
    // Soft delete - deactivate instead of deleting
    await sql`
      UPDATE registration_sessions 
      SET is_active = false, updated_at = NOW() 
      WHERE session_id = ${sessionId}
    `;
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting registration session:', error);
    return { success: false, message: 'Error deleting registration session' };
  }
}

export async function incrementRegistrationPlayerCount(sessionId) {
  try {
    await initializeDatabase();
    
    await sql`
      UPDATE registration_sessions 
      SET player_count = player_count + 1, updated_at = NOW() 
      WHERE session_id = ${sessionId}
    `;
    
    return { success: true };
  } catch (error) {
    console.error('Error incrementing player count:', error);
    return { success: false, message: 'Error updating player count' };
  }
}

// Session management operations
export async function createSession(sessionId, userId, role, expiresAt) {
  try {
    await initializeDatabase();
    
    await sql`
      INSERT INTO admin_sessions (id, user_id, role, expires_at)
      VALUES (${sessionId}, ${userId}, ${role}, ${expiresAt})
      ON CONFLICT (id) DO UPDATE SET user_id = ${userId}, role = ${role}, expires_at = ${expiresAt}
    `;
    

    return true;
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}

export async function validateSession(sessionId) {
  try {
    await initializeDatabase();
    
    const sessions = await sql`
      SELECT s.id, s.user_id, s.role, u.username, u.full_name, u.is_active
      FROM admin_sessions s
      JOIN admin_users u ON s.user_id = u.id
      WHERE s.id = ${sessionId} AND s.expires_at > NOW() AND u.is_active = true
    `;
    
    if (sessions.length > 0) {
      return {
        valid: true,
        sessionId: sessions[0].id,
        userId: sessions[0].user_id,
        role: sessions[0].role,
        username: sessions[0].username,
        fullName: sessions[0].full_name
      };
    }
    
    return { valid: false };
  } catch (error) {
    console.error('Error validating session:', error);
    return { valid: false };
  }
}

export async function deleteSession(sessionId) {
  try {
    await initializeDatabase();
    
    await sql`
      DELETE FROM admin_sessions WHERE id = ${sessionId}
    `;
    

    return true;
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
}

// Clear all data (for testing)
export async function clearAllData() {
  try {

    await sql`DELETE FROM players`;
    await sql`DELETE FROM masterlist`;
    await sql`DELETE FROM registration_settings`;
    await sql`DELETE FROM admin_sessions`;

  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

// Legacy exports for compatibility (wrap the new functions)
export const playerDb = {
  async getAllPlayers() {
    return await getPlayers();
  },
  
  async addPlayer(player) {
    try {
      await addPlayer(player);
      return { success: true, player };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  async updatePlayer(playerId, updates) {
    try {
      await updatePlayer(playerId, updates);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  async deletePlayer(playerId) {
    try {
      await deletePlayer(playerId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  async deleteAllPlayers() {
    try {
      await initializeDatabase();
      await sql`DELETE FROM players`;
      return { success: true, message: 'All players deleted successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

export const masterlistDb = {
  async getAllPlayers() {
    return await getMasterlist();
  },
  
  async addPlayer(player) {
    try {
      await addMasterlistPlayer(player);
      return { success: true, player };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  async updatePlayer(playerId, updates) {
    try {
      await updateMasterlistPlayer(playerId, updates);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  async deletePlayer(playerId) {
    try {
      await deleteMasterlistPlayer(playerId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// Admin user management functions
export async function authenticateUser(username, password) {
  try {
    console.log('Authenticating user:', username);
    
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // Input validation
    if (!username || !password) {
      return {
        success: false,
        message: 'Username and password are required'
      };
    }

    // Rate limiting could be added here in the future
    
    // First get the user by username
    const users = await sql`
      SELECT id, username, password_hash, role, full_name, email, is_active
      FROM admin_users 
      WHERE username = ${username} AND is_active = true
    `;
    
    console.log('Query result:', users);
    
    if (users.length > 0) {
      const user = users[0];
      console.log('User found:', user.username, 'Role:', user.role);
      
      // Secure password verification using bcrypt
      let isPasswordValid = false;
      
      try {
        // Check if password is already hashed (starts with $2b$ for bcrypt)
        if (user.password_hash.startsWith('$2b$')) {
          // Use bcrypt verification for hashed passwords
          isPasswordValid = await verifyPassword(password, user.password_hash);
        } else {
          // Legacy plain text password support (for migration)
          console.warn('⚠️  User has legacy plain text password. Please update to secure hash.');
          isPasswordValid = (user.password_hash === password);
          
          // Auto-upgrade to hashed password if plain text matches
          if (isPasswordValid) {
            const hashedPassword = await hashPassword(password);
            await sql`
              UPDATE admin_users 
              SET password_hash = ${hashedPassword}, updated_at = NOW() 
              WHERE id = ${user.id}
            `;
            console.log('✅ Password automatically upgraded to secure hash for user:', username);
          }
        }
      } catch (error) {
        console.error('Password verification error:', error);
        return { success: false, message: 'Authentication error' };
      }
      
      if (isPasswordValid) {
        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            fullName: user.full_name,
            email: user.email
          }
        };
      } else {
        console.log('Password mismatch for user:', username);
        return { success: false, message: 'Invalid username or password' };
      }
    }
    
    console.log('No user found with username:', username);
    return { success: false, message: 'Invalid username or password' };
  } catch (error) {
    console.error('Error authenticating user:', error);
    return { success: false, message: 'Authentication error: ' + error.message };
  }
}

export async function getAdminUsers() {
  try {
    await initializeDatabase();
    
    const users = await sql`
      SELECT id, username, role, full_name, email, is_active, created_at
      FROM admin_users 
      ORDER BY created_at DESC
    `;
    
    return users.map(user => ({
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
      email: user.email,
      isActive: user.is_active,
      createdAt: user.created_at
    }));
  } catch (error) {
    console.error('Error getting admin users:', error);
    throw error;
  }
}

export async function createAdminUser(userData) {
  try {
    await initializeDatabase();
    
    // Validate password strength
    const passwordValidation = validatePasswordStrength(userData.password);
    if (!passwordValidation.isValid) {
      return { 
        success: false, 
        message: 'Password does not meet security requirements: ' + passwordValidation.messages.join(', ')
      };
    }
    
    // Hash the password securely
    const hashedPassword = await hashPassword(userData.password);
    
    const userId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    await sql`
      INSERT INTO admin_users (id, username, password_hash, role, full_name, email, is_active)
      VALUES (${userId}, ${userData.username}, ${hashedPassword}, ${userData.role}, ${userData.fullName}, ${userData.email}, ${userData.isActive !== false})
    `;
    
    return { success: true, userId };
  } catch (error) {
    console.error('Error creating admin user:', error);
    if (error.message.includes('duplicate key')) {
      return { success: false, message: 'Username already exists' };
    }
    return { success: false, message: 'Error creating user' };
  }
}

export async function updateAdminUser(userId, updates) {
  try {
    await initializeDatabase();
    
    // Check if user exists first
    const existingUser = await sql`
      SELECT id FROM admin_users WHERE id = ${userId}
    `;
    
    if (existingUser.length === 0) {
      return { success: false, message: 'User not found' };
    }
    
    // Build update query dynamically
    const updateFields = {};
    if (updates.username) updateFields.username = updates.username;
    if (updates.password) {
      // Validate password strength
      const passwordValidation = validatePasswordStrength(updates.password);
      if (!passwordValidation.isValid) {
        return { 
          success: false, 
          message: 'Password does not meet security requirements: ' + passwordValidation.messages.join(', ')
        };
      }
      // Hash the new password
      updateFields.password_hash = await hashPassword(updates.password);
    }
    if (updates.role) updateFields.role = updates.role;
    if (updates.fullName !== undefined) updateFields.full_name = updates.fullName;
    if (updates.email !== undefined) updateFields.email = updates.email;
    if (updates.isActive !== undefined) updateFields.is_active = updates.isActive;
    
    if (Object.keys(updateFields).length === 0) {
      return { success: false, message: 'No fields to update' };
    }
    
    // Perform individual updates
    if (updateFields.username) {
      await sql`UPDATE admin_users SET username = ${updateFields.username}, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (updateFields.password_hash) {
      await sql`UPDATE admin_users SET password_hash = ${updateFields.password_hash}, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (updateFields.role) {
      await sql`UPDATE admin_users SET role = ${updateFields.role}, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (updateFields.full_name !== undefined) {
      await sql`UPDATE admin_users SET full_name = ${updateFields.full_name}, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (updateFields.email !== undefined) {
      await sql`UPDATE admin_users SET email = ${updateFields.email}, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (updateFields.is_active !== undefined) {
      await sql`UPDATE admin_users SET is_active = ${updateFields.is_active}, updated_at = NOW() WHERE id = ${userId}`;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating admin user:', error);
    if (error.message.includes('duplicate key')) {
      return { success: false, message: 'Username already exists' };
    }
    return { success: false, message: 'Error updating user' };
  }
}

export async function deleteAdminUser(userId) {
  try {
    await initializeDatabase();
    
    // Don't allow deleting the last super admin
    const superAdmins = await sql`
      SELECT COUNT(*) as count FROM admin_users WHERE role = 'superadmin' AND is_active = true
    `;
    
    const userToDelete = await sql`
      SELECT role FROM admin_users WHERE id = ${userId}
    `;
    
    if (userToDelete.length > 0 && userToDelete[0].role === 'superadmin' && superAdmins[0].count <= 1) {
      return { success: false, message: 'Cannot delete the last super admin' };
    }
    
    // Deactivate user instead of deleting to maintain referential integrity
    await sql`
      UPDATE admin_users SET is_active = false, updated_at = NOW() WHERE id = ${userId}
    `;
    
    // Also invalidate all sessions for this user
    await sql`
      DELETE FROM admin_sessions WHERE user_id = ${userId}
    `;
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting admin user:', error);
    return { success: false, message: 'Error deleting user' };
  }
} 
