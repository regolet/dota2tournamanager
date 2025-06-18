import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const DB_PATH = path.join(__dirname, 'tournament.db');

// Initialize database
function initializeDb() {
  const db = new Database(DB_PATH);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create players table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dota2id TEXT NOT NULL,
      peakmmr INTEGER,
      ipAddress TEXT,
      registrationDate TEXT,
      UNIQUE(dota2id)
    )
  `);
  
  // Create users table for authentication
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    )
  `);
  
  // Create masterlist table for verified players
  db.exec(`
    CREATE TABLE IF NOT EXISTS masterlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dota2id TEXT NOT NULL UNIQUE,
      mmr INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    )
  `);
  
  return db;
}

// Get database connection
const db = initializeDb();

// User authentication operations
export const authDb = {
  // Check if any admin user exists
  hasAdminUser() {
    const result = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
    return result.count > 0;
  },
  
  // Create a default admin user if none exists
  createDefaultAdmin(password) {
    if (this.hasAdminUser()) {
      return { success: false, message: 'Admin user already exists' };
    }
    
    try {
      const stmt = db.prepare(`
        INSERT INTO users (username, password, role, created_at)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(
        'admin',
        password,
        'admin',
        new Date().toISOString()
      );
      
      return { success: true, message: 'Default admin user created' };
    } catch (error) {
      console.error('Error creating default admin:', error);
      return { success: false, message: error.message };
    }
  },
  
  // Verify admin credentials
  verifyAdmin(password) {
    try {
      const user = db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').get('admin');
      if (!user) {
        return { success: false, message: 'Admin user not found' };
      }
      
      // Compare passwords
      if (user.password === password) {
        return { success: true, user: { username: user.username, role: user.role } };
      } else {
        return { success: false, message: 'Invalid password' };
      }
    } catch (error) {
      console.error('Error verifying admin:', error);
      return { success: false, message: error.message };
    }
  },
  
  // Change admin password
  changePassword(oldPassword, newPassword) {
    try {
      // First verify the old password
      const verifyResult = this.verifyAdmin(oldPassword);
      if (!verifyResult.success) {
        return verifyResult;
      }
      
      // Update the password
      const stmt = db.prepare('UPDATE users SET password = ? WHERE role = ?');
      const result = stmt.run(newPassword, 'admin');
      
      if (result.changes > 0) {
        return { success: true, message: 'Password updated successfully' };
      } else {
        return { success: false, message: 'Failed to update password' };
      }
    } catch (error) {
      console.error('Error changing password:', error);
      return { success: false, message: error.message };
    }
  }
};

// Player operations
export const playerDb = {
  // Get all players
  getAllPlayers() {
    return db.prepare('SELECT * FROM players').all();
  },
  
  // Get player by ID
  getPlayerById(id) {
    return db.prepare('SELECT * FROM players WHERE id = ?').get(id);
  },
  
  // Get player by Dota2ID
  getPlayerByDota2Id(dota2id) {
    return db.prepare('SELECT * FROM players WHERE dota2id = ?').get(dota2id);
  },
  
  // Add player
  addPlayer(player) {
    const stmt = db.prepare(`
      INSERT INTO players (id, name, dota2id, peakmmr, ipAddress, registrationDate)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      player.id || `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      player.name,
      player.dota2id,
      player.peakmmr || 0,
      player.ipAddress || null,
      player.registrationDate || new Date().toISOString()
    );
  },
  
  // Update player
  updatePlayer(player) {
    const stmt = db.prepare(`
      UPDATE players
      SET name = ?, dota2id = ?, peakmmr = ?, ipAddress = ?, registrationDate = ?
      WHERE id = ?
    `);
    
    return stmt.run(
      player.name,
      player.dota2id,
      player.peakmmr || 0,
      player.ipAddress || null,
      player.registrationDate || new Date().toISOString(),
      player.id
    );
  },
  
  // Delete player
  deletePlayer(id) {
    return db.prepare('DELETE FROM players WHERE id = ?').run(id);
  },
  
  // Delete all players
  deleteAllPlayers() {
    return db.prepare('DELETE FROM players').run();
  },
  
  // Search players
  searchPlayers(searchTerm) {
    searchTerm = `%${searchTerm}%`;
    return db.prepare(
      `SELECT * FROM players 
       WHERE name LIKE ? 
       OR dota2id LIKE ?
       OR id LIKE ?`
    ).all(searchTerm, searchTerm, searchTerm);
  }
};

// Masterlist operations for verified players
export const masterlistDb = {
  // Get all masterlist players
  getAllPlayers() {
    try {
      const stmt = db.prepare(`
        SELECT id, name, dota2id, mmr, created_at, updated_at, notes 
        FROM masterlist 
        ORDER BY name ASC
      `);
      return stmt.all();
    } catch (error) {
      console.error('Error getting masterlist players:', error);
      return [];
    }
  },
  
  // Find player by dota2id
  getPlayerByDota2Id(dota2id) {
    try {
      const stmt = db.prepare('SELECT * FROM masterlist WHERE dota2id = ?');
      return stmt.get(dota2id);
    } catch (error) {
      console.error('Error finding masterlist player:', error);
      return null;
    }
  },
  
  // Add new player to masterlist
  addPlayer(name, dota2id, mmr, notes = '') {
    try {
      const stmt = db.prepare(`
        INSERT INTO masterlist (name, dota2id, mmr, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `);
      
      const result = stmt.run(name, dota2id, parseInt(mmr), notes);
      return { 
        success: true, 
        message: 'Player added to masterlist successfully',
        playerId: result.lastInsertRowid 
      };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return { success: false, message: 'Player with this Dota2 ID already exists in masterlist' };
      }
      console.error('Error adding to masterlist:', error);
      return { success: false, message: error.message };
    }
  },
  
  // Update existing player in masterlist
  updatePlayer(id, name, dota2id, mmr, notes = '') {
    try {
      const stmt = db.prepare(`
        UPDATE masterlist 
        SET name = ?, dota2id = ?, mmr = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `);
      
      const result = stmt.run(name, dota2id, parseInt(mmr), notes, id);
      
      if (result.changes > 0) {
        return { success: true, message: 'Player updated successfully' };
      } else {
        return { success: false, message: 'Player not found' };
      }
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return { success: false, message: 'Another player with this Dota2 ID already exists' };
      }
      console.error('Error updating masterlist player:', error);
      return { success: false, message: error.message };
    }
  },
  
  // Delete player from masterlist
  deletePlayer(id) {
    try {
      const stmt = db.prepare('DELETE FROM masterlist WHERE id = ?');
      const result = stmt.run(id);
      
      if (result.changes > 0) {
        return { success: true, message: 'Player removed from masterlist' };
      } else {
        return { success: false, message: 'Player not found' };
      }
    } catch (error) {
      console.error('Error deleting masterlist player:', error);
      return { success: false, message: error.message };
    }
  },
  
  // Search players in masterlist
  searchPlayers(searchTerm) {
    try {
      const stmt = db.prepare(`
        SELECT * FROM masterlist 
        WHERE name LIKE ? OR dota2id LIKE ? OR CAST(mmr AS TEXT) LIKE ?
        ORDER BY name ASC
      `);
      const term = `%${searchTerm}%`;
      return stmt.all(term, term, term);
    } catch (error) {
      console.error('Error searching masterlist:', error);
      return [];
    }
  },
  
  // Get masterlist statistics
  getStats() {
    try {
      const totalStmt = db.prepare('SELECT COUNT(*) as total FROM masterlist');
      const avgMmrStmt = db.prepare('SELECT AVG(mmr) as avgMmr FROM masterlist');
      const maxMmrStmt = db.prepare('SELECT MAX(mmr) as maxMmr, name as topPlayer FROM masterlist');
      const minMmrStmt = db.prepare('SELECT MIN(mmr) as minMmr FROM masterlist');
      
      const total = totalStmt.get().total;
      const avgMmr = Math.round(avgMmrStmt.get().avgMmr || 0);
      const maxData = maxMmrStmt.get();
      const minMmr = minMmrStmt.get().minMmr || 0;
      
      return {
        total,
        avgMmr,
        maxMmr: maxData.maxMmr || 0,
        topPlayer: maxData.topPlayer || 'N/A',
        minMmr
      };
    } catch (error) {
      console.error('Error getting masterlist stats:', error);
      return { total: 0, avgMmr: 0, maxMmr: 0, topPlayer: 'N/A', minMmr: 0 };
    }
  }
};

// Migration function: JSON -> SQLite (optional)
export async function migrateFromJson() {
  const PLAYERS_JSON_PATH = path.join(__dirname, 'players.json');
  
  try {
    // Check if JSON file exists - migration is now optional
    if (!fs.existsSync(PLAYERS_JSON_PATH)) {
      return { success: true, message: 'No migration needed' };
    }
    
    // Read JSON file
    const data = fs.readFileSync(PLAYERS_JSON_PATH, 'utf8');
    
    // Parse JSON
    let players = [];
    if (data.trim()) {
      players = JSON.parse(data);
      if (!Array.isArray(players)) {
        players = players.players || [];
      }
    }
    
    // If no players, nothing to migrate
    if (players.length === 0) {
      return { success: true, message: 'No players to migrate' };
    }
    
    // Begin transaction
    const insertPlayer = db.prepare(
      `INSERT OR IGNORE INTO players (id, name, dota2id, peakmmr, ipAddress, registrationDate)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    
    const transaction = db.transaction((playersList) => {
      for (const player of playersList) {
        insertPlayer.run(
          player.id || `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          player.name,
          player.dota2id || 'N/A',
          player.peakmmr || player.mmr || 0,
          player.ipAddress || null,
          player.registrationDate || new Date().toISOString()
        );
      }
    });
    
    // Run transaction
    transaction(players);
    
    return { 
      success: true, 
      message: `Migrated ${players.length} players from JSON to SQLite` 
    };
    
  } catch (error) {
    console.error('Migration error:', error);
    return { 
      success: false, 
      message: `Migration failed: ${error.message}` 
    };
  }
}

// Create a JSON export from SQLite
export function exportToJson() {
  const players = playerDb.getAllPlayers();
  return players;
}

export default db; 