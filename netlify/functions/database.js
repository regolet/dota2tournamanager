// Database module for Netlify Functions using Neon DB (PostgreSQL)
import { neon } from '@netlify/neon';

// Initialize Neon database connection
const sql = neon(process.env.DATABASE_URL);

// Database schema initialization
async function initializeDatabase() {
  try {
    console.log('Starting database initialization...');
    
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

    // Create default admin users if table is empty
    const usersCount = await sql`SELECT COUNT(*) as count FROM admin_users`;
    if (usersCount[0].count == 0) {
      // Create default super admin
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
      
      // Create default admin
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
    }

    console.log('Database initialization completed successfully');

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
      SELECT 
        id, 
        name, 
        dota2id, 
        peakmmr, 
        ip_address as "ipAddress", 
        registration_date as "registrationDate"
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
      
      // Simple password comparison (for development/testing)
      if (user.password_hash === password) {
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
    
    const userId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    await sql`
      INSERT INTO admin_users (id, username, password_hash, role, full_name, email, is_active)
      VALUES (${userId}, ${userData.username}, ${userData.password}, ${userData.role}, ${userData.fullName}, ${userData.email}, ${userData.isActive !== false})
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
    
    const setClause = [];
    const values = [];
    
    if (updates.username) {
      setClause.push('username = $' + (values.length + 1));
      values.push(updates.username);
    }
    if (updates.password) {
      setClause.push('password_hash = $' + (values.length + 1));
      values.push(updates.password);
    }
    if (updates.role) {
      setClause.push('role = $' + (values.length + 1));
      values.push(updates.role);
    }
    if (updates.fullName !== undefined) {
      setClause.push('full_name = $' + (values.length + 1));
      values.push(updates.fullName);
    }
    if (updates.email !== undefined) {
      setClause.push('email = $' + (values.length + 1));
      values.push(updates.email);
    }
    if (updates.isActive !== undefined) {
      setClause.push('is_active = $' + (values.length + 1));
      values.push(updates.isActive);
    }
    
    if (setClause.length === 0) {
      return { success: false, message: 'No fields to update' };
    }
    
    setClause.push('updated_at = NOW()');
    values.push(userId);
    
    await sql`UPDATE admin_users SET ${sql.raw(setClause.join(', '))} WHERE id = $${values.length}`.apply(null, values);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating admin user:', error);
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
