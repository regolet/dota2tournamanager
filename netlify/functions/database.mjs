// Database module for Netlify Functions using Neon DB (PostgreSQL)
import { neon } from '@netlify/neon';
import { hashPassword, verifyPassword, validatePasswordStrength } from './password-utils.mjs';

// Initialize Neon database connection
const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);

// Export sql instance for use in other modules
export { sql };

// Database schema initialization
export async function initializeDatabase() {
  try {
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
        discordid VARCHAR(255),
        present BOOLEAN DEFAULT false,
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

    // Add present column if it doesn't exist (for existing installations)
    await sql`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS present BOOLEAN DEFAULT false
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
        discordid VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Add discordid column to masterlist table if it doesn't exist (for backward compatibility)
    try {
      await sql`ALTER TABLE masterlist ADD COLUMN IF NOT EXISTS discordid VARCHAR(255) DEFAULT NULL`;
    } catch (error) {
      // Ignore if already exists
    }

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
        start_time TIMESTAMP,
        expires_at TIMESTAMP,
        player_count INTEGER DEFAULT 0
      )
    `;

    // Add start_time column to registration_sessions if not exists
    await sql`ALTER TABLE registration_sessions ADD COLUMN IF NOT EXISTS start_time TIMESTAMP`;

    // Create teams table for storing generated team configurations
    await sql`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        team_set_id VARCHAR(255) NOT NULL,
        admin_user_id VARCHAR(255) NOT NULL,
        admin_username VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        balance_method VARCHAR(100) NOT NULL DEFAULT 'highRanked',
        total_teams INTEGER NOT NULL DEFAULT 0,
        total_players INTEGER NOT NULL DEFAULT 0,
        average_mmr INTEGER DEFAULT 0,
        registration_session_id VARCHAR(255),
        teams_data TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create tournaments table for storing generated tournament brackets
    await sql`
      CREATE TABLE IF NOT EXISTS tournaments (
        id VARCHAR(255) PRIMARY KEY,
        admin_user_id VARCHAR(255),
        team_set_id VARCHAR(255),
        tournament_data TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create attendance_sessions table for attendance management
    await sql`
      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        admin_user_id VARCHAR(255) NOT NULL,
        admin_username VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        registration_session_id VARCHAR(255) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (registration_session_id) REFERENCES registration_sessions(session_id) ON DELETE CASCADE
      )
    `;

    // Create banned_players table for player banning system
    await sql`
      CREATE TABLE IF NOT EXISTS banned_players (
        id SERIAL PRIMARY KEY,
        dota2id VARCHAR(255) NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        reason TEXT NOT NULL,
        banned_by VARCHAR(255) NOT NULL,
        banned_by_username VARCHAR(255) NOT NULL,
        ban_type VARCHAR(50) DEFAULT 'permanent',
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Add admin_user_id column to tournaments table if it doesn't exist (for backward compatibility)
    try {
      await sql`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS admin_user_id VARCHAR(255)`;
    } catch (error) {
      // Ignore if already exists
    }

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
    }

    // Create optimal indexes for performance
    await createBasicIndexes();
    
    // Create discord_webhooks table
    await sql`
      CREATE TABLE IF NOT EXISTS discord_webhooks (
        admin_user_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        url TEXT NOT NULL,
        template TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (admin_user_id, type)
      )
    `;
    // Add template column if it doesn't exist
    try {
      await sql`ALTER TABLE discord_webhooks ADD COLUMN IF NOT EXISTS template TEXT`;
    } catch (error) {
      // Ignore if already exists
    }
    
    // Create banned_players table for player banning system
    await sql`
      CREATE TABLE IF NOT EXISTS banned_players (
        id SERIAL PRIMARY KEY,
        dota2id VARCHAR(255) NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        reason TEXT NOT NULL,
        banned_by VARCHAR(255) NOT NULL,
        banned_by_username VARCHAR(255) NOT NULL,
        ban_type VARCHAR(50) NOT NULL DEFAULT 'permanent',
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(dota2id)
      )
    `;
    
    // Create indexes for banned_players table
    await sql`CREATE INDEX IF NOT EXISTS idx_banned_players_dota2id ON banned_players(dota2id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_banned_players_active ON banned_players(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_banned_players_expires ON banned_players(expires_at)`;
    
  } catch (error) {
    throw error;
  }
}

// Create basic database indexes for performance
async function createBasicIndexes() {
  try {
    // Players table indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_players_session ON players(registration_session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_players_dota2id ON players(dota2id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_players_mmr ON players(peakmmr DESC)`;
    
    // Registration sessions indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_reg_sessions_session_id ON registration_sessions(session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reg_sessions_admin ON registration_sessions(admin_user_id)`;
    
    // Admin sessions indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at)`;
    
    // Teams table indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_teams_admin_user ON teams(admin_user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teams_set_id ON teams(team_set_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teams_session ON teams(registration_session_id)`;
    
    // Tournaments table indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_tournaments_team_set ON tournaments(team_set_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tournaments_active ON tournaments(is_active)`;
    
  } catch (error) {
    // Don't throw error as indexes might already exist
  }
}

// Tournament-scoped player operations
export async function getPlayers(registrationSessionId = null, presentOnly = false, limit = 1000) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

    let players;
    if (registrationSessionId) {
      // Get players for specific registration session
      if (presentOnly) {
        players = await sql`
          SELECT 
            id, 
            name, 
            dota2id, 
            peakmmr, 
            ip_address as "ipAddress", 
            registration_date as "registrationDate",
            registration_session_id as "registrationSessionId",
            discordid,
            present
          FROM players 
          WHERE registration_session_id = ${registrationSessionId} AND present = true
          ORDER BY registration_date DESC
          LIMIT ${limit}
        `;
      } else {
        players = await sql`
          SELECT 
            id, 
            name, 
            dota2id, 
            peakmmr, 
            ip_address as "ipAddress", 
            registration_date as "registrationDate",
            registration_session_id as "registrationSessionId",
            discordid,
            present
          FROM players 
          WHERE registration_session_id = ${registrationSessionId}
          ORDER BY registration_date DESC
          LIMIT ${limit}
        `;
      }
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
          registration_session_id as "registrationSessionId",
          discordid,
          present
        FROM players 
        ORDER BY registration_date DESC
        LIMIT ${limit}
      `;
    }

    return players;
  } catch (error) {
    throw error;
  }
}

export async function addPlayer(player) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

    if (!player.name) {
      throw new Error('Player must have a name');
    }
    
    // Check if player is banned
    if (player.dota2id) {
      const isBanned = await isPlayerBanned(player.dota2id, player.adminUserId);
      if (isBanned) {
        throw new Error('This player is banned and cannot register for tournaments');
      }
    }
    
    // Generate ID if not provided
    if (!player.id) {
      player.id = `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    
    // Check if player already exists in the same registration session
    if (player.registrationSessionId) {
      // Check for name duplicates first
      const nameExisting = await sql`
        SELECT id, name FROM players 
        WHERE name = ${player.name} 
        AND registration_session_id = ${player.registrationSessionId}
      `;
      
      if (nameExisting.length > 0) {
        throw new Error(`A player with the name "${player.name}" is already registered in this tournament`);
      }
      
      // Check for Dota 2 ID duplicates
      const dota2idExisting = await sql`
        SELECT id, dota2id FROM players 
        WHERE dota2id = ${player.dota2id} 
        AND registration_session_id = ${player.registrationSessionId}
      `;
      
      if (dota2idExisting.length > 0) {
        throw new Error(`A player with the Dota 2 ID "${player.dota2id}" is already registered in this tournament`);
      }
      
    } else {
      // Legacy check for players without session (global scope)
      // Check for name duplicates first
      const nameExisting = await sql`
        SELECT id, name FROM players 
        WHERE name = ${player.name} 
        AND registration_session_id IS NULL
      `;
      
      if (nameExisting.length > 0) {
        throw new Error(`A player with the name "${player.name}" is already registered`);
      }
      
      // Check for Dota 2 ID duplicates
      const dota2idExisting = await sql`
        SELECT id, dota2id FROM players 
        WHERE dota2id = ${player.dota2id} 
        AND registration_session_id IS NULL
      `;
      
      if (dota2idExisting.length > 0) {
        throw new Error(`A player with the Dota 2 ID "${player.dota2id}" is already registered`);
      }
    }
    
    // Check if player with same discordId is already registered in this session
    if (player.discordId) {
      const discordExisting = await sql`
        SELECT id FROM players 
        WHERE discordid = ${player.discordId} 
        AND registration_session_id = ${player.registrationSessionId || null}
      `;
      if (discordExisting.length > 0) {
        throw new Error(`A player with the Discord account "${player.discordId}" is already registered in this tournament`);
      }
    }
    
    await sql`
      INSERT INTO players (id, name, dota2id, peakmmr, ip_address, registration_date, registration_session_id, discordid)
      VALUES (
        ${player.id}, 
        ${player.name}, 
        ${player.dota2id}, 
        ${player.peakmmr || 0}, 
        ${player.ipAddress || '::1'}, 
        ${player.registrationDate || new Date().toISOString()},
        ${player.registrationSessionId || null},
        ${player.discordid || null}
      )
    `;

    return await getPlayers(player.registrationSessionId);
  } catch (error) {
    throw error;
  }
}

export async function updatePlayer(playerId, updates) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

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
    
    if (updates.present !== undefined) {
      await sql`UPDATE players SET present = ${updates.present}, updated_at = NOW() WHERE id = ${playerId}`;
    }

    // Get the player to determine which session to return
    const updatedPlayer = await sql`SELECT registration_session_id FROM players WHERE id = ${playerId}`;
    const sessionId = updatedPlayer[0]?.registration_session_id;

    return await getPlayers(sessionId);
  } catch (error) {
    throw error;
  }
}

export async function deletePlayer(playerId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

    if (!playerId) {
      throw new Error('Player ID is required');
    }

    // Get the player to determine which session to return
    const player = await sql`SELECT registration_session_id FROM players WHERE id = ${playerId}`;
    const sessionId = player[0]?.registration_session_id;

    await sql`DELETE FROM players WHERE id = ${playerId}`;

    return await getPlayers(sessionId);
  } catch (error) {
    throw error;
  }
}

// Legacy function for backward compatibility
export async function savePlayers(players) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

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
    throw error;
  }
}

// Helper function to get players for a specific admin's sessions
export async function getPlayersForAdmin(adminUserId, includeSessionInfo = false, limit = 1000) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

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
        INNER JOIN registration_sessions rs ON p.registration_session_id = rs.session_id
        WHERE rs.admin_user_id = ${adminUserId}
        ORDER BY p.registration_date DESC
        LIMIT ${limit}
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
        INNER JOIN registration_sessions rs ON p.registration_session_id = rs.session_id
        WHERE rs.admin_user_id = ${adminUserId}
        ORDER BY p.registration_date DESC
        LIMIT ${limit}
      `;
      return players;
    }
  } catch (error) {
    throw error;
  }
}

// Masterlist operations
export async function getMasterlist() {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

    
    const masterlist = await sql`
      SELECT id, name, dota2id, mmr, team, achievements, notes, created_at, updated_at
      FROM masterlist 
      ORDER BY mmr DESC, name ASC
    `;
    

    return masterlist;
  } catch (error) {
    throw error;
  }
}

export async function saveMasterlist(masterlist) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

    
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
    throw error;
  }
}

export async function addMasterlistPlayer(player) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

    // Enhanced validation - consistent with bulk import
    const trimmedName = player.name ? player.name.trim() : '';
    if (!trimmedName || trimmedName.length < 2) {
      throw new Error('Player must have a valid name (at least 2 characters)');
    }
    
    if (trimmedName.length > 50) {
      throw new Error('Player name too long (max 50 characters)');
    }
    
    const trimmedDota2Id = player.dota2id ? player.dota2id.trim() : '';
    if (!trimmedDota2Id || !/^\d{6,20}$/.test(trimmedDota2Id)) {
      throw new Error('Player must have a valid Dota 2 ID (6-20 digits)');
    }
    
    // MMR validation
    if (typeof player.mmr !== 'number' || isNaN(player.mmr) || player.mmr < 0 || player.mmr > 20000) {
      throw new Error('Player must have a valid MMR (0-20000)');
    }
    
    // Notes validation
    if (player.notes && player.notes.length > 500) {
      throw new Error('Player notes too long (max 500 characters)');
    }
    
    // Check if player already exists
    const existingPlayer = await sql`
      SELECT id, name, dota2id, discordid FROM masterlist 
      WHERE dota2id = ${trimmedDota2Id} OR LOWER(name) = LOWER(${trimmedName})
    `;
    
    if (existingPlayer.length > 0) {
      const existing = existingPlayer[0];
      
      // If player exists and has Discord ID, update it
      if (player.discordid && existing.dota2id === trimmedDota2Id) {
        const updateResult = await sql`
          UPDATE masterlist 
          SET 
            discordid = ${player.discordid},
            updated_at = NOW()
          WHERE id = ${existing.id}
        `;
        
        return await getMasterlist();
      }
      
      // If player exists but no Discord ID update needed, throw error
      if (existing.dota2id === trimmedDota2Id) {
        throw new Error(`A player with Dota 2 ID "${trimmedDota2Id}" already exists in the masterlist (${existing.name}).`);
      } else {
        throw new Error(`A player with name "${trimmedName}" already exists in the masterlist.`);
      }
    }
    
    // Add new player to masterlist
    const result = await sql`
      INSERT INTO masterlist (name, dota2id, mmr, team, achievements, notes, discordid)
      VALUES (${trimmedName}, ${trimmedDota2Id}, ${player.mmr || 0}, ${player.team || ''}, ${player.achievements || ''}, ${player.notes || ''}, ${player.discordid || null})
      RETURNING *
    `;
    
    return await getMasterlist();
  } catch (error) {
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
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

    // Get default values from current record if not provided
    const { name, dota2id, mmr, team, achievements, notes, discordid } = updates;
    
    // Enhanced validation - consistent with bulk import
    const trimmedName = name ? name.trim() : '';
    if (!trimmedName || trimmedName.length < 2) {
      throw new Error('Player must have a valid name (at least 2 characters)');
    }
    
    if (trimmedName.length > 50) {
      throw new Error('Player name too long (max 50 characters)');
    }
    
    const trimmedDota2Id = dota2id ? dota2id.trim() : '';
    if (!trimmedDota2Id || !/^\d{6,20}$/.test(trimmedDota2Id)) {
      throw new Error('Player must have a valid Dota 2 ID (6-20 digits)');
    }
    
    // MMR validation
    if (typeof mmr !== 'number' || isNaN(mmr) || mmr < 0 || mmr > 20000) {
      throw new Error('Player must have a valid MMR (0-20000)');
    }
    
    // Notes validation
    if (notes && notes.length > 500) {
      throw new Error('Player notes too long (max 500 characters)');
    }
    
    // Check if another player already exists with same dota2id or name
    const existingPlayer = await sql`
      SELECT id, name, dota2id FROM masterlist 
      WHERE (dota2id = ${trimmedDota2Id} OR LOWER(name) = LOWER(${trimmedName})) 
      AND id != ${parseInt(playerId)}
    `;
    
    if (existingPlayer.length > 0) {
      const existing = existingPlayer[0];
      if (existing.dota2id === trimmedDota2Id) {
        throw new Error(`A different player with Dota 2 ID "${trimmedDota2Id}" already exists in the masterlist (${existing.name}).`);
      } else {
        throw new Error(`A different player with name "${trimmedName}" already exists in the masterlist.`);
      }
    }
    
    // Execute update query with all fields including discordid
    const result = await sql`
      UPDATE masterlist 
      SET 
        name = ${trimmedName},
        dota2id = ${trimmedDota2Id},
        mmr = ${mmr || 0},
        team = ${team || ''},
        achievements = ${achievements || ''},
        notes = ${notes || ''},
        discordid = ${discordid || null},
        updated_at = NOW()
      WHERE id = ${parseInt(playerId)}
    `;
    
    if (result.count === 0) {
      throw new Error('Player not found in masterlist');
    }
    
    return await getMasterlist();
  } catch (error) {
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
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

    
    const result = await sql`
      DELETE FROM masterlist WHERE id = ${parseInt(playerId)}
    `;
    
    if (result.count === 0) {
      throw new Error('Player not found in masterlist');
    }
    

    return await getMasterlist();
  } catch (error) {
    throw error;
  }
}

// Registration settings operations
export async function getRegistrationSettings() {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

    
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
    throw error;
  }
}

export async function saveRegistrationSettings(settings) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();

    
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
    throw error;
  }
}

// Registration session operations (for multi-admin registration links)
export async function createRegistrationSession(adminUserId, adminUsername, sessionData) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    const sessionId = `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await sql`
      INSERT INTO registration_sessions (
        session_id, admin_user_id, admin_username, title, description, 
        max_players, is_active, start_time, expires_at
      )
      VALUES (
        ${sessionId}, 
        ${adminUserId}, 
        ${adminUsername}, 
        ${sessionData.title}, 
        ${sessionData.description || ''}, 
        ${sessionData.maxPlayers || 100}, 
        true,
        ${sessionData.startTime || null},
        ${sessionData.expiresAt || null}
      )
    `;
    
    return { success: true, sessionId };
  } catch (error) {
    return { success: false, message: 'Error creating registration session' };
  }
}

export async function getRegistrationSessions(adminUserId = null) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
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
      playerCount: session.actual_player_count, // Use actual count from players table
      startTime: session.start_time
    }));
  } catch (error) {
    throw error;
  }
}

export async function getRegistrationSessionBySessionId(sessionId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
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
      WHERE rs.session_id = ${sessionId}
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
      playerCount: session.actual_player_count, // Use actual count from players table
      startTime: session.start_time
    };
  } catch (error) {
    return null;
  }
}

export async function updateRegistrationSession(sessionId, updates) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    const updateFields = {};
    if (updates.title !== undefined) updateFields.title = updates.title;
    if (updates.description !== undefined) updateFields.description = updates.description;
    if (updates.maxPlayers !== undefined) updateFields.max_players = updates.maxPlayers;
    if (updates.isActive !== undefined) updateFields.is_active = updates.isActive;
    if (updates.expiresAt !== undefined) updateFields.expires_at = updates.expiresAt;
    if (updates.startTime !== undefined) updateFields.start_time = updates.startTime;

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
    if (updateFields.start_time !== undefined) {
      await sql`UPDATE registration_sessions SET start_time = ${updateFields.start_time}, updated_at = NOW() WHERE session_id = ${sessionId}`;
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, message: 'Error updating registration session' };
  }
}

export async function deleteRegistrationSession(sessionId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    // Hard delete for superadmin
    await sql`
      DELETE FROM registration_sessions 
      WHERE session_id = ${sessionId}
    `;
    
    return { success: true };
  } catch (error) {
    return { success: false, message: 'Error deleting registration session' };
  }
}

export async function incrementRegistrationPlayerCount(sessionId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    await sql`
      UPDATE registration_sessions 
      SET player_count = player_count + 1, updated_at = NOW() 
      WHERE session_id = ${sessionId}
    `;
    
    return { success: true };
  } catch (error) {
    return { success: false, message: 'Error updating player count' };
  }
}

// Session management operations
export async function createSession(sessionId, userId, role, expiresAt) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    await sql`
      INSERT INTO admin_sessions (id, user_id, role, expires_at)
      VALUES (${sessionId}, ${userId}, ${role}, ${expiresAt})
      ON CONFLICT (id) DO UPDATE SET user_id = ${userId}, role = ${role}, expires_at = ${expiresAt}
    `;
    

    return true;
  } catch (error) {
    throw error;
  }
}

export async function validateSession(sessionId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    // Use NOW() without timezone comparison to avoid timezone issues
    const sessions = await sql`
      SELECT s.id, s.user_id, s.role, s.expires_at, u.username, u.full_name, u.is_active
      FROM admin_sessions s
      JOIN admin_users u ON s.user_id = u.id
      WHERE s.id = ${sessionId} AND u.is_active = true
    `;
    
    if (sessions.length > 0) {
      const session = sessions[0];
      const now = new Date();
      const expiresAt = new Date(session.expires_at);
      
      // Validate date parsing
      if (isNaN(expiresAt.getTime())) {
        // Clean up invalid session
        await sql`DELETE FROM admin_sessions WHERE id = ${sessionId}`;
        return { valid: false, reason: 'invalid_date' };
      }
      
      // Check if session is expired
      if (expiresAt > now) {
        return {
          valid: true,
          sessionId: session.id,
          userId: session.user_id,
          role: session.role,
          username: session.username,
          fullName: session.full_name
        };
      } else {
        // Clean up expired session
        await sql`DELETE FROM admin_sessions WHERE id = ${sessionId}`;
        return { valid: false, reason: 'expired' };
      }
    }
    
    return { valid: false, reason: 'not_found' };
  } catch (error) {
    return { valid: false, reason: 'error', error: error.message };
  }
}

export async function deleteSession(sessionId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    await sql`
      DELETE FROM admin_sessions WHERE id = ${sessionId}
    `;
    

    return true;
  } catch (error) {
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
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
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
    
    if (users.length > 0) {
      const user = users[0];
      
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
    return { success: false, message: 'Authentication error: ' + error.message };
  }
}

export async function getAdminUsers() {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
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
    throw error;
  }
}

export async function createAdminUser(userData) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
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
    if (error.message.includes('duplicate key')) {
      return { success: false, message: 'Username already exists' };
    }
    return { success: false, message: 'Error creating user' };
  }
}

export async function updateAdminUser(userId, updates) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
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
    if (error.message.includes('duplicate key')) {
      return { success: false, message: 'Username already exists' };
    }
    return { success: false, message: 'Error updating user' };
  }
}

export async function deleteAdminUser(userId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
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
    return { success: false, message: 'Error deleting user' };
  }
}

// Teams management operations
export async function saveTeamConfiguration(adminUserId, adminUsername, teamData) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
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
    
    return { success: true, teamSetId };
  } catch (error) {
    // If it's a table not found error, try to reinitialize the database
    if (error.message && (error.message.includes('relation "teams" does not exist') || 
                         error.message.includes('table') || 
                         error.message.includes('does not exist'))) {
      try {
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
        
        return { success: true, teamSetId };
      } catch (retryError) {
        return { success: false, message: 'Database initialization failed' };
      }
    }
    
    return { success: false, message: `Error saving team configuration: ${error.message}` };
  }
}

export async function getTeamConfigurations(adminUserId = null) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    let teams;
    if (adminUserId) {
      teams = await sql`
        SELECT DISTINCT ON (team_set_id) * FROM teams 
        WHERE admin_user_id = ${adminUserId} AND is_active = true
        ORDER BY team_set_id, created_at DESC
      `;
    } else {
      teams = await sql`
        SELECT DISTINCT ON (team_set_id) * FROM teams 
        WHERE is_active = true
        ORDER BY team_set_id, created_at DESC
      `;
    }
    
    const mappedTeams = teams.map(team => {
      let parsedTeams = [];
      if (team.teams_data) {
        if (typeof team.teams_data === 'string') {
          try {
            parsedTeams = JSON.parse(team.teams_data);
          } catch (e) {
            // Ignore if parsing fails
          }
        } else if (typeof team.teams_data === 'object') {
          parsedTeams = team.teams_data;
        }
      }

      return {
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
        teams: parsedTeams,
        createdAt: team.created_at,
        updatedAt: team.updated_at
      };
    });

    // Sort by creation date, newest first
    mappedTeams.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return mappedTeams;
  } catch (error) {
    return []; // Return empty on error to prevent frontend crash
  }
}

export async function getTeamConfigurationById(teamSetId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    const teams = await sql`
      SELECT * FROM teams 
      WHERE team_set_id = ${teamSetId} AND is_active = true
    `;
    
    if (teams.length === 0) {
      return null;
    }
    
    const team = teams[0];
    
    let parsedTeams = [];
    if (team.teams_data) {
      if (typeof team.teams_data === 'string') {
        try {
          parsedTeams = JSON.parse(team.teams_data);
        } catch (e) {
          // Ignore if parsing fails
        }
      } else if (typeof team.teams_data === 'object') {
        parsedTeams = team.teams_data;
      }
    }

    return {
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
      teams: parsedTeams,
      createdAt: team.created_at,
      updatedAt: team.updated_at
    };
  } catch (error) {
    return null;
  }
}

export async function updateTeamConfiguration(teamSetId, updates) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    const updateFields = {};
    if (updates.title !== undefined) updateFields.title = updates.title;
    if (updates.description !== undefined) updateFields.description = updates.description;
    if (updates.isActive !== undefined) updateFields.is_active = updates.isActive;
    if (updates.teams !== undefined) updateFields.teams_data = JSON.stringify(updates.teams);
    
    if (Object.keys(updateFields).length === 0) {
      return { success: false, message: 'No fields to update' };
    }
    
    // Perform individual updates
    if (updateFields.title !== undefined) {
      await sql`UPDATE teams SET title = ${updateFields.title}, updated_at = NOW() WHERE team_set_id = ${teamSetId}`;
    }
    if (updateFields.description !== undefined) {
      await sql`UPDATE teams SET description = ${updateFields.description}, updated_at = NOW() WHERE team_set_id = ${teamSetId}`;
    }
    if (updateFields.is_active !== undefined) {
      await sql`UPDATE teams SET is_active = ${updateFields.is_active}, updated_at = NOW() WHERE team_set_id = ${teamSetId}`;
    }
    if (updateFields.teams_data !== undefined) {
      await sql`UPDATE teams SET teams_data = ${updateFields.teams_data}, updated_at = NOW() WHERE team_set_id = ${teamSetId}`;
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, message: 'Error updating team configuration' };
  }
}

export async function deleteTeamConfiguration(teamSetId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    // Hard delete for superadmin
    await sql`
      DELETE FROM teams 
      WHERE team_set_id = ${teamSetId}
    `;
    
    return { success: true };
  } catch (error) {
    return { success: false, message: 'Error deleting team configuration' };
  }
}

// Tournament Bracket operations
export async function saveTournament(tournamentData) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    const { id, team_set_id, tournament_data, admin_user_id } = tournamentData;

    // Validate input
    if (!id || !tournament_data) {
      return { success: false, message: 'Tournament ID and data are required.' };
    }

    // Ensure tournament_data is properly stringified if it's an object
    let tournamentDataString;
    if (typeof tournament_data === 'object') {
      tournamentDataString = JSON.stringify(tournament_data);
    } else if (typeof tournament_data === 'string') {
      tournamentDataString = tournament_data;
    } else {
      return { success: false, message: 'Tournament data must be an object or string.' };
    }


    const result = await sql`
      INSERT INTO tournaments (id, admin_user_id, team_set_id, tournament_data, created_at, updated_at)
      VALUES (${id}, ${admin_user_id}, ${team_set_id}, ${tournamentDataString}, NOW(), NOW())
      ON CONFLICT (id) 
      DO UPDATE SET
        tournament_data = EXCLUDED.tournament_data,
        team_set_id = EXCLUDED.team_set_id,
        updated_at = NOW()
    `;

    return { success: true, id };
  } catch (error) {
    // Check if it's a table not found error
    if (error.message && (error.message.includes('relation "tournaments" does not exist') || 
                         error.message.includes('table') || 
                         error.message.includes('does not exist'))) {
      try {
        await initializeDatabase();
        
        const { id, team_set_id, tournament_data, admin_user_id } = tournamentData;
        let tournamentDataString = typeof tournament_data === 'object' ? JSON.stringify(tournament_data) : tournament_data;
        
        const result = await sql`
          INSERT INTO tournaments (id, admin_user_id, team_set_id, tournament_data, created_at, updated_at)
          VALUES (${id}, ${admin_user_id}, ${team_set_id}, ${tournamentDataString}, NOW(), NOW())
          ON CONFLICT (id) 
          DO UPDATE SET
            tournament_data = EXCLUDED.tournament_data,
            team_set_id = EXCLUDED.team_set_id,
            updated_at = NOW()
        `;
        
        return { success: true, id };
      } catch (retryError) {
        return { success: false, message: 'Database initialization failed: ' + retryError.message };
      }
    }
    
    return { success: false, message: 'Error saving tournament: ' + error.message };
  }
}

export async function deleteTournament(tournamentId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    await sql`
      DELETE FROM tournaments 
      WHERE id = ${tournamentId}
    `;
    return { success: true };
  } catch (error) {
    return { success: false, message: 'Error deleting tournament' };
  }
}

export async function getTournament(tournamentId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    const result = await sql`
      SELECT 
        t.id, 
        t.team_set_id, 
        t.tournament_data, 
        t.is_active, 
        t.created_at, 
        t.updated_at,
        ts.title AS team_set_title
      FROM tournaments t
      LEFT JOIN teams ts ON t.team_set_id = ts.team_set_id
      WHERE t.id = ${tournamentId}
    `;
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    // Return null instead of throwing to prevent 500 errors
    return null;
  }
}

export async function getTournaments(adminUserId = null) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    let result;
    if (adminUserId) {
      result = await sql`
        SELECT *
        FROM tournaments t
        WHERE t.admin_user_id = ${adminUserId}
        ORDER BY t.created_at DESC
      `;
    } else {
      result = await sql`
        SELECT *
        FROM tournaments t
        ORDER BY t.created_at DESC
      `;
    }
    return result;
  } catch (error) {
    // If table doesn't exist, return empty array gracefully
    if (error.message && (error.message.includes('relation "tournaments" does not exist') || 
                         error.message.includes('table') || 
                         error.message.includes('does not exist'))) {
      return [];
    }
    return [];
  }
}

// Discord Webhooks CRUD
export async function getDiscordWebhooks(adminUserId) {
  return await sql`SELECT type, url, template FROM discord_webhooks WHERE admin_user_id = ${adminUserId}`;
}

export async function setDiscordWebhook(adminUserId, type, url, template = null) {
  await sql`
    INSERT INTO discord_webhooks (admin_user_id, type, url, template, created_at, updated_at)
    VALUES (${adminUserId}, ${type}, ${url}, ${template}, NOW(), NOW())
    ON CONFLICT (admin_user_id, type)
    DO UPDATE SET url = EXCLUDED.url, template = EXCLUDED.template, updated_at = NOW()
  `;

  return true;
}

export async function deleteDiscordWebhook(adminUserId, type) {
  await sql`DELETE FROM discord_webhooks WHERE admin_user_id = ${adminUserId} AND type = ${type}`;
  return true;
}

export async function deleteAllPlayersForSession(sessionId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    await sql`DELETE FROM players WHERE registration_session_id = ${sessionId}`;
    return { success: true, message: 'All players deleted for session', sessionId };
  } catch (error) {
    throw error;
  }
}

// Helper function to get a single player by ID
export async function getPlayerById(playerId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
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
      WHERE p.id = ${playerId}
    `;
    
    return players.length > 0 ? players[0] : null;
  } catch (error) {
    throw error;
  }
}

// Banning System Functions
export async function banPlayer(banData) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    
    const { dota2id, playerName, reason, bannedBy, bannedByUsername, banType = 'permanent', expiresAt = null } = banData;
    
    if (!dota2id || !playerName || !reason || !bannedBy || !bannedByUsername) {
      throw new Error('Missing required fields for banning player');
    }
    
    // Check if player is already banned
    const existingBan = await sql`
      SELECT id, is_active FROM banned_players 
      WHERE dota2id = ${dota2id}
    `;
    
    if (existingBan.length > 0) {
      if (existingBan[0].is_active) {
        throw new Error('Player is already banned');
      } else {
        // Reactivate existing ban
        await sql`
          UPDATE banned_players 
          SET reason = ${reason}, banned_by = ${bannedBy}, banned_by_username = ${bannedByUsername},
              ban_type = ${banType}, expires_at = ${expiresAt}, is_active = true, updated_at = NOW()
          WHERE dota2id = ${dota2id}
        `;
        return { success: true, message: 'Player ban reactivated' };
      }
    }
    
    // Create new ban
    await sql`
      INSERT INTO banned_players (dota2id, player_name, reason, banned_by, banned_by_username, ban_type, expires_at)
      VALUES (${dota2id}, ${playerName}, ${reason}, ${bannedBy}, ${bannedByUsername}, ${banType}, ${expiresAt})
    `;
    
    return { success: true, message: 'Player banned successfully' };
  } catch (error) {
    throw error;
  }
}

export async function unbanPlayer(dota2id, adminUserId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    if (!dota2id || !adminUserId) {
      throw new Error('Dota2 ID and adminUserId are required');
    }
    const result = await sql`
      UPDATE banned_players 
      SET is_active = false, updated_at = NOW()
      WHERE dota2id = ${dota2id} AND banned_by = ${adminUserId} AND is_active = true
    `;
    if (result.count === 0) {
      throw new Error('Player is not currently banned');
    }
    return { success: true, message: 'Player unbanned successfully' };
  } catch (error) {
    throw error;
  }
}

export async function getBannedPlayers(adminUserId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    // Return all currently banned players, not just those banned by the current admin
    const bannedPlayers = await sql`
      SELECT 
        id, dota2id, player_name, reason, banned_by, banned_by_username,
        ban_type, expires_at, is_active, created_at, updated_at
      FROM banned_players 
      WHERE is_active = true
      ORDER BY created_at DESC
    `;
    return bannedPlayers;
  } catch (error) {
    throw error;
  }
}

export async function isPlayerBanned(dota2id, adminUserId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    if (!dota2id || !adminUserId) return false;
    const ban = await sql`
      SELECT id, ban_type, expires_at 
      FROM banned_players 
      WHERE dota2id = ${dota2id} AND banned_by = ${adminUserId} AND is_active = true
    `;
    if (ban.length === 0) {
      return false;
    }
    const banRecord = ban[0];
    // Check if temporary ban has expired
    if (banRecord.ban_type === 'temporary' && banRecord.expires_at) {
      const now = new Date();
      const expiresAt = new Date(banRecord.expires_at);
      if (now > expiresAt) {
        // Ban has expired, deactivate it
        await sql`
          UPDATE banned_players 
          SET is_active = false, updated_at = NOW()
          WHERE id = ${banRecord.id}
        `;
        return false;
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}

export async function getBanHistory(dota2id = null, adminUserId) {
  try {
    // Comment out all calls to await initializeDatabase() except in the initializeDatabase function itself
    // (This disables redundant schema checks on every function call)
    // await initializeDatabase();
    if (!adminUserId) throw new Error('adminUserId required');
    let query;
    if (dota2id) {
      query = sql`
        SELECT 
          id, dota2id, player_name, reason, banned_by, banned_by_username,
          ban_type, expires_at, is_active, created_at, updated_at
        FROM banned_players 
        WHERE dota2id = ${dota2id} AND banned_by = ${adminUserId}
        ORDER BY created_at DESC
      `;
    } else {
      query = sql`
        SELECT 
          id, dota2id, player_name, reason, banned_by, banned_by_username,
          ban_type, expires_at, is_active, created_at, updated_at
        FROM banned_players 
        WHERE banned_by = ${adminUserId}
        ORDER BY created_at DESC
      `;
    }
    return await query;
  } catch (error) {
    throw error;
  }
}