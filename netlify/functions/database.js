// Shared database module for Netlify functions
// Serverless-compatible implementation with in-memory caching and file persistence

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the correct file paths for both local and Netlify environments
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Files are in the site root directory
const PLAYERS_FILE = process.env.NETLIFY 
  ? path.resolve(__dirname, '../../players.json') 
  : './players.json';
const MASTERLIST_FILE = process.env.NETLIFY 
  ? path.resolve(__dirname, '../../masterlist.json') 
  : './masterlist.json';

// Debug: Log the resolved file paths
console.log('Database module initialized:');
console.log('NETLIFY environment:', !!process.env.NETLIFY);
console.log('Players file path:', PLAYERS_FILE);
console.log('Masterlist file path:', MASTERLIST_FILE);
console.log('Current directory:', __dirname);

// In-memory cache for serverless environments
let playersCache = null;
let masterlistCache = null;

// Read JSON file with cache support
async function readJsonFile(filePath, defaultData = []) {
  try {
    console.log(`Attempting to read file: ${filePath}`);
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    console.log(`Successfully read ${filePath} with ${parsed.length} items`);
    return parsed;
  } catch (error) {
    console.error(`Failed to read file ${filePath}:`, error.message);
    console.log(`Using default data instead`);
    return defaultData;
  }
}

// Write JSON file (for local development only)
async function writeJsonFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing file (normal in serverless):', error.message);
    // In serverless, file writes may fail - this is expected
    return false;
  }
}

// No hardcoded fallback data - use players.json directly

// No hardcoded fallback data - use masterlist.json directly

// Player database operations
export const playerDb = {
  // Initialize cache from file or use empty array
  async initCache() {
    if (playersCache === null) {
      try {
        playersCache = await readJsonFile(PLAYERS_FILE, []);
        console.log(`Initialized players cache with ${playersCache.length} players`);
      } catch (error) {
        console.log('Failed to read players file, starting with empty cache');
        playersCache = [];
      }
    }
  },

  // Get all players
  async getAllPlayers() {
    await this.initCache();
    console.log(`Retrieved ${playersCache.length} players from cache`);
    return [...playersCache]; // Return copy to prevent mutations
  },

  // Get player by ID
  async getPlayerById(id) {
    await this.initCache();
    return playersCache.find(player => player.id === id) || null;
  },

  // Get player by Dota2ID
  async getPlayerByDota2Id(dota2id) {
    await this.initCache();
    return playersCache.find(player => player.dota2id === dota2id) || null;
  },

  // Add player
  async addPlayer(player) {
    try {
      await this.initCache();
      
      // Check for duplicate Dota2ID
      if (playersCache.some(p => p.dota2id === player.dota2id)) {
        throw new Error('Player with this Dota2ID already exists');
      }
      
      // Check for duplicate name
      if (playersCache.some(p => p.name.toLowerCase() === player.name.toLowerCase())) {
        throw new Error('Player with this name already exists');
      }
      
      const newPlayer = {
        id: player.id || `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: player.name,
        dota2id: player.dota2id,
        peakmmr: player.peakmmr || 0,
        ipAddress: player.ipAddress || `192.168.1.${Math.floor(Math.random() * 200 + 50)}`,
        registrationDate: player.registrationDate || new Date().toISOString()
      };
      
      playersCache.push(newPlayer);
      await writeJsonFile(PLAYERS_FILE, playersCache); // Try to persist but don't fail if it doesn't work
      
      console.log(`Added player: ${newPlayer.name} (${newPlayer.id})`);
      return { success: true, player: newPlayer };
    } catch (error) {
      console.error('Error adding player:', error);
      return { success: false, error: error.message };
    }
  },

  // Update player
  async updatePlayer(playerId, updates) {
    try {
      await this.initCache();
      const playerIndex = playersCache.findIndex(p => p.id === playerId);
      
      if (playerIndex === -1) {
        throw new Error('Player not found');
      }
      
      // Check for duplicate Dota2ID (excluding current player)
      if (updates.dota2id) {
        const existingPlayer = playersCache.find(p => p.dota2id === updates.dota2id && p.id !== playerId);
        if (existingPlayer) {
          throw new Error('Another player with this Dota2ID already exists');
        }
      }
      
      // Update player
      playersCache[playerIndex] = {
        ...playersCache[playerIndex],
        ...updates,
        registrationDate: playersCache[playerIndex].registrationDate // Keep original registration date
      };
      
      await writeJsonFile(PLAYERS_FILE, playersCache);
      
      console.log(`Updated player: ${playersCache[playerIndex].name} (${playerId})`);
      return { success: true, player: playersCache[playerIndex] };
    } catch (error) {
      console.error('Error updating player:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete player
  async deletePlayer(playerId) {
    try {
      await this.initCache();
      const playerIndex = playersCache.findIndex(p => p.id === playerId);
      
      if (playerIndex === -1) {
        throw new Error('Player not found');
      }
      
      const deletedPlayer = playersCache.splice(playerIndex, 1)[0];
      await writeJsonFile(PLAYERS_FILE, playersCache);
      
      console.log(`Deleted player: ${deletedPlayer.name} (${playerId})`);
      return { success: true, player: deletedPlayer };
    } catch (error) {
      console.error('Error deleting player:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete all players
  async deleteAllPlayers() {
    try {
      await this.initCache();
      playersCache.length = 0; // Clear the array
      await writeJsonFile(PLAYERS_FILE, playersCache);
      console.log('Deleted all players');
      return { success: true, count: 0 };
    } catch (error) {
      console.error('Error deleting all players:', error);
      return { success: false, error: error.message };
    }
  }
};

// Masterlist database operations
export const masterlistDb = {
  // Initialize masterlist cache
  async initCache() {
    if (masterlistCache === null) {
      try {
        masterlistCache = await readJsonFile(MASTERLIST_FILE, []);
        console.log(`Initialized masterlist cache with ${masterlistCache.length} players from masterlist.json`);
      } catch (error) {
        console.log('Failed to read masterlist.json file, starting with empty masterlist');
        masterlistCache = [];
      }
    }
  },

  // Get all masterlist players
  async getAllPlayers() {
    await this.initCache();
    console.log(`Retrieved ${masterlistCache.length} masterlist players from cache`);
    return [...masterlistCache]; // Return copy to prevent mutations
  },

  // Get masterlist player by ID
  async getPlayerById(id) {
    await this.initCache();
    return masterlistCache.find(player => player.id === id) || null;
  },

  // Get masterlist player by Dota2ID
  async getPlayerByDota2Id(dota2id) {
    await this.initCache();
    return masterlistCache.find(player => player.dota2id === dota2id) || null;
  },

  // Add masterlist player
  async addPlayer(player) {
    try {
      await this.initCache();
      
      // Check for duplicate Dota2ID
      if (masterlistCache.some(p => p.dota2id === player.dota2id)) {
        throw new Error('Player with this Dota2ID already exists in masterlist');
      }
      
      const newPlayer = {
        id: Math.max(...masterlistCache.map(p => p.id), 0) + 1,
        name: player.name,
        dota2id: player.dota2id,
        mmr: player.mmr || 0,
        team: player.team || '',
        achievements: player.achievements || '',
        notes: player.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      masterlistCache.push(newPlayer);
      await writeJsonFile(MASTERLIST_FILE, masterlistCache);
      
      console.log(`Added masterlist player: ${newPlayer.name} (${newPlayer.id})`);
      return { success: true, player: newPlayer };
    } catch (error) {
      console.error('Error adding masterlist player:', error);
      return { success: false, error: error.message };
    }
  },

  // Update masterlist player
  async updatePlayer(playerId, updates) {
    try {
      await this.initCache();
      const playerIndex = masterlistCache.findIndex(p => p.id === playerId);
      
      if (playerIndex === -1) {
        throw new Error('Masterlist player not found');
      }
      
      // Update player
      masterlistCache[playerIndex] = {
        ...masterlistCache[playerIndex],
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      await writeJsonFile(MASTERLIST_FILE, masterlistCache);
      
      console.log(`Updated masterlist player: ${masterlistCache[playerIndex].name} (${playerId})`);
      return { success: true, player: masterlistCache[playerIndex] };
    } catch (error) {
      console.error('Error updating masterlist player:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete masterlist player
  async deletePlayer(playerId) {
    try {
      await this.initCache();
      const playerIndex = masterlistCache.findIndex(p => p.id === playerId);
      
      if (playerIndex === -1) {
        throw new Error('Masterlist player not found');
      }
      
      const deletedPlayer = masterlistCache.splice(playerIndex, 1)[0];
      await writeJsonFile(MASTERLIST_FILE, masterlistCache);
      
      console.log(`Deleted masterlist player: ${deletedPlayer.name} (${playerId})`);
      return { success: true, player: deletedPlayer };
    } catch (error) {
      console.error('Error deleting masterlist player:', error);
      return { success: false, error: error.message };
    }
  }
}; 