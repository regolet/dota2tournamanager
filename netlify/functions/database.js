// Shared database module for Netlify functions
// Serverless-compatible implementation with in-memory caching and file persistence

import { promises as fs } from 'fs';
import path from 'path';

// Use root directory files that persist with deployment
const PLAYERS_FILE = process.env.NETLIFY ? '../../players.json' : './players.json';
const MASTERLIST_FILE = process.env.NETLIFY ? '../../masterlist.json' : './masterlist.json';

// In-memory cache for serverless environments
let playersCache = null;
let masterlistCache = null;

// Read JSON file with cache support
async function readJsonFile(filePath, defaultData = []) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log(`File ${filePath} not found, using default data:`, error.message);
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

// Default player data
const DEFAULT_PLAYERS = [
  {
    id: "player_1",
    name: "Alice Johnson",
    dota2id: "123456789",
    peakmmr: 3500,
    registrationDate: "2025-01-18T10:00:00.000Z",
    ipAddress: "192.168.1.1"
  },
  {
    id: "player_2", 
    name: "Bob Smith",
    dota2id: "987654321",
    peakmmr: 4200,
    registrationDate: "2025-01-18T11:00:00.000Z",
    ipAddress: "192.168.1.2"
  },
  {
    id: "player_3",
    name: "Charlie Brown",
    dota2id: "456789123",
    peakmmr: 2800,
    registrationDate: "2025-01-18T12:00:00.000Z",
    ipAddress: "192.168.1.3"
  },
  {
    id: "player_4",
    name: "Diana Prince",
    dota2id: "789123456",
    peakmmr: 5100,
    registrationDate: "2025-01-18T13:00:00.000Z",
    ipAddress: "192.168.1.4"
  },
  {
    id: "player_5",
    name: "Edward Norton",
    dota2id: "321654987",
    peakmmr: 3800,
    registrationDate: "2025-01-18T14:00:00.000Z",
    ipAddress: "192.168.1.5"
  },
  {
    id: "player_6",
    name: "Fiona Green",
    dota2id: "654987321",
    peakmmr: 4500,
    registrationDate: "2025-01-18T15:00:00.000Z",
    ipAddress: "192.168.1.6"
  }
];

// Default masterlist data
const DEFAULT_MASTERLIST = [
  {
    id: 1,
    name: "Miracle-",
    dota2id: "105248644",
    mmr: 8500,
    team: "OG",
    achievements: "Multiple Major Winner, Former TI Winner",
    notes: "Exceptional carry player known for mechanical skill"
  },
  {
    id: 2,
    name: "Arteezy",
    dota2id: "86745912",
    mmr: 8200,
    team: "Team Secret",
    achievements: "Multiple Major Winner, Top NA Player",
    notes: "Iconic carry player with exceptional farming efficiency"
  },
  {
    id: 3,
    name: "SumaiL",
    dota2id: "111620041",
    mmr: 8000,
    team: "OG",
    achievements: "TI5 Winner, Youngest TI Winner",
    notes: "Aggressive mid laner with incredible game sense"
  },
  {
    id: 4,
    name: "Dendi",
    dota2id: "70388657",
    mmr: 7800,
    team: "Na'Vi",
    achievements: "TI1 Winner, Legendary Mid Player",
    notes: "Icon of Dota 2, known for Pudge plays"
  },
  {
    id: 5,
    name: "Puppey",
    dota2id: "87276347",
    mmr: 7500,
    team: "Team Secret",
    achievements: "TI1 Winner, Legendary Captain",
    notes: "Most experienced captain in professional Dota"
  },
  {
    id: 6,
    name: "N0tail",
    dota2id: "19672354",
    mmr: 7300,
    team: "OG",
    achievements: "Back-to-back TI Winner (TI8, TI9)",
    notes: "Inspirational leader and versatile player"
  }
];

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
        
        // If empty, initialize with default masterlist
        if (masterlistCache.length === 0) {
          masterlistCache = [...DEFAULT_MASTERLIST];
          await writeJsonFile(MASTERLIST_FILE, masterlistCache);
          console.log('Initialized masterlist cache with default professional players');
        } else {
          console.log(`Initialized masterlist cache with ${masterlistCache.length} players`);
        }
      } catch (error) {
        console.log('Failed to read masterlist file, using default data');
        masterlistCache = [...DEFAULT_MASTERLIST];
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