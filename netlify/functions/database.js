// Database module for Netlify Functions using Neon DB (PostgreSQL)
import { neon } from '@netlify/neon';

// Initialize Neon database connection
const sql = neon();

// Database schema initialization
async function initializeDatabase() {
  try {

    
    // Create players table
    await sql`
      CREATE TABLE IF NOT EXISTS players (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        dota2id VARCHAR(255) UNIQUE NOT NULL,
        peakmmr INTEGER DEFAULT 0,
        ip_address INET,
        registration_date TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

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
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // No default masterlist data - start with empty masterlist for true realtime database

    // Insert default registration settings if table is empty
    const settingsCount = await sql`SELECT COUNT(*) as count FROM registration_settings`;
    if (settingsCount[0].count == 0) {
      
      await sql`
        INSERT INTO registration_settings (is_open, tournament_name, tournament_date, max_players, expiry, closed_at, auto_close) 
        VALUES (false, 'Dota 2 Tournament', CURRENT_DATE, 50, null, null, false)
      `;
    }

    // No default player data - start with empty players table for true realtime database


  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Players operations
export async function getPlayers() {
  try {
    await initializeDatabase();

    
    const players = await sql`
      SELECT id, name, dota2id, peakmmr, ip_address, registration_date 
      FROM players 
      ORDER BY registration_date DESC
    `;
    

    return players;
  } catch (error) {
    console.error('Error getting players:', error);
    throw error;
  }
}

export async function savePlayers(players) {
  try {
    await initializeDatabase();

    
    if (!Array.isArray(players)) {
      throw new Error('Players must be an array');
    }
    
    // Clear existing players and insert new ones
    await sql`DELETE FROM players`;
    
    for (const player of players) {
      if (!player.id || !player.name) {
        throw new Error('Player must have id and name');
      }
      
      await sql`
        INSERT INTO players (id, name, dota2id, peakmmr, ip_address, registration_date)
        VALUES (${player.id}, ${player.name}, ${player.dota2id}, ${player.peakmmr || 0}, ${player.ipAddress || '::1'}, ${player.registrationDate || new Date().toISOString()})
      `;
    }
    

    return await getPlayers();
  } catch (error) {
    console.error('Error saving players:', error);
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
    
    // Check if player already exists by Dota2ID or name
    const existing = await sql`
      SELECT id FROM players WHERE dota2id = ${player.dota2id} OR name = ${player.name}
    `;
    
    if (existing.length > 0) {
      throw new Error('Player with this name or Dota2ID already exists');
    }
    
    await sql`
      INSERT INTO players (id, name, dota2id, peakmmr, ip_address, registration_date)
      VALUES (${player.id}, ${player.name}, ${player.dota2id}, ${player.peakmmr || 0}, ${player.ipAddress || '::1'}, ${player.registrationDate || new Date().toISOString()})
    `;
    

    return await getPlayers();
  } catch (error) {
    console.error('Error adding player:', error);
    throw error;
  }
}

export async function updatePlayer(playerId, updates) {
  try {
    await initializeDatabase();

    
    // Simple approach: update all fields at once
    const name = updates.name || '';
    const dota2id = updates.dota2id || '';
    const peakmmr = updates.peakmmr || 0;
    
    if (!name && !dota2id && peakmmr === 0) {
      throw new Error('No valid fields to update');
    }
    
    // Execute update query with all fields
    const result = await sql`
      UPDATE players 
      SET 
        name = ${name},
        dota2id = ${dota2id},
        peakmmr = ${peakmmr},
        updated_at = NOW()
      WHERE id = ${playerId}
    `;
    

    
    if (result.count === 0) {
      throw new Error('Player not found');
    }
    

    return await getPlayers();
  } catch (error) {
    console.error('Error updating player:', error);
    throw error;
  }
}

export async function deletePlayer(playerId) {
  try {
    await initializeDatabase();

    
    const result = await sql`
      DELETE FROM players WHERE id = ${playerId}
    `;
    
    if (result.count === 0) {
      throw new Error('Player not found');
    }
    

    return await getPlayers();
  } catch (error) {
    console.error('Error deleting player:', error);
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
    
    const result = await sql`
      INSERT INTO masterlist (name, dota2id, mmr, team, achievements, notes)
      VALUES (${player.name}, ${player.dota2id}, ${player.mmr || 0}, ${player.team || ''}, ${player.achievements || ''}, ${player.notes || ''})
      RETURNING *
    `;
    

    return await getMasterlist();
  } catch (error) {
    console.error('Error adding masterlist player:', error);
    throw error;
  }
}

export async function updateMasterlistPlayer(playerId, updates) {
  try {
    await initializeDatabase();

    
    // Get default values from current record if not provided
    const { name, dota2id, mmr, team, achievements, notes } = updates;
    
    // Execute update query with all fields
    const result = await sql`
      UPDATE masterlist 
      SET 
        name = ${name || ''},
        dota2id = ${dota2id || ''},
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

// Session management operations
export async function createSession(sessionId, expiresAt) {
  try {
    await initializeDatabase();
    
    await sql`
      INSERT INTO admin_sessions (id, expires_at)
      VALUES (${sessionId}, ${expiresAt})
      ON CONFLICT (id) DO UPDATE SET expires_at = ${expiresAt}
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
      SELECT id FROM admin_sessions 
      WHERE id = ${sessionId} AND expires_at > NOW()
    `;
    
    return sessions.length > 0;
  } catch (error) {
    console.error('Error validating session:', error);
    return false;
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
