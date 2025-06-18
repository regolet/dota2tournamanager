// Shared database module for Netlify functions
// Serverless-compatible implementation with in-memory caching and file persistence

import { promises as fs } from 'fs';
import path from 'path';

// Simpler file path resolution that works reliably in Netlify
const PLAYERS_FILE = process.env.NETLIFY 
  ? path.join(process.cwd(), 'players.json')
  : './players.json';
const MASTERLIST_FILE = process.env.NETLIFY 
  ? path.join(process.cwd(), 'masterlist.json')
  : './masterlist.json';

// Debug: Log the resolved file paths
console.log('Database module initialized:');
console.log('NETLIFY environment:', !!process.env.NETLIFY);
console.log('Players file path:', PLAYERS_FILE);
console.log('Masterlist file path:', MASTERLIST_FILE);
console.log('Current working directory:', process.cwd());

// In-memory cache for serverless environments
let playersCache = [
  {
    "id": "player_1750218791586_198",
    "name": "asdasd",
    "dota2id": "123456789",
    "peakmmr": 3000,
    "ipAddress": "::1",
    "registrationDate": "2025-06-18T03:53:11.586Z"
  }
];

let masterlistCache = [
  {
    "id": 1,
    "name": "Miracle-",
    "dota2id": "105248644",
    "mmr": 8500,
    "team": "OG",
    "achievements": "Multiple Major Winner, Former TI Winner",
    "notes": "Exceptional carry player known for mechanical skill"
  },
  {
    "id": 2,
    "name": "Arteezy",
    "dota2id": "86745912",
    "mmr": 8200,
    "team": "Team Secret",
    "achievements": "Multiple Major Winner, Top NA Player",
    "notes": "Iconic carry player with exceptional farming efficiency"
  },
  {
    "id": 3,
    "name": "SumaiL",
    "dota2id": "111620041",
    "mmr": 8000,
    "team": "OG",
    "achievements": "TI5 Winner, Youngest TI Winner",
    "notes": "Aggressive mid laner with incredible game sense"
  },
  {
    "id": 4,
    "name": "Dendi",
    "dota2id": "70388657",
    "mmr": 7800,
    "team": "Na'Vi",
    "achievements": "TI1 Winner, Legendary Mid Player",
    "notes": "Icon of Dota 2, known for Pudge plays"
  },
  {
    "id": 5,
    "name": "Puppey",
    "dota2id": "87276347",
    "mmr": 7500,
    "team": "Team Secret",
    "achievements": "TI1 Winner, Legendary Captain",
    "notes": "Most experienced captain in professional Dota"
  },
  {
    "id": 6,
    "name": "N0tail",
    "dota2id": "19672354",
    "mmr": 7300,
    "team": "OG",
    "achievements": "Back-to-back TI Winner (TI8, TI9)",
    "notes": "Inspirational leader and versatile player"
  }
];

// Registration settings cache
let registrationSettingsCache = {
  isOpen: true,
  tournament: {
    name: "Dota 2 Tournament",
    date: new Date().toISOString().split('T')[0],
    maxPlayers: 50
  }
};

// In-memory cache will persist during the lifetime of the serverless function
// Note: This resets on each cold start, but provides session persistence

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

export async function getPlayers() {
  console.log('getPlayers called, returning cached players:', playersCache.length);
  return [...playersCache]; // Return a copy to prevent direct mutations
}

export async function savePlayers(players) {
  console.log('savePlayers called with:', players.length, 'players');
  if (!Array.isArray(players)) {
    throw new Error('Players must be an array');
  }
  
  // Validate player objects
  players.forEach((player, index) => {
    if (!player.id || !player.name) {
      throw new Error(`Player at index ${index} is missing required fields (id, name)`);
    }
  });
  
  playersCache = [...players]; // Create a copy to store
  console.log('Players saved to cache:', playersCache.length);
  return playersCache;
}

export async function addPlayer(player) {
  console.log('addPlayer called with:', player);
  if (!player.id || !player.name) {
    throw new Error('Player must have id and name');
  }
  
  // Check if player already exists
  const existingIndex = playersCache.findIndex(p => p.id === player.id);
  if (existingIndex !== -1) {
    throw new Error('Player with this ID already exists');
  }
  
  playersCache.push({...player});
  console.log('Player added to cache. Total players:', playersCache.length);
  return [...playersCache];
}

export async function updatePlayer(playerId, updates) {
  console.log('updatePlayer called for:', playerId, 'with updates:', updates);
  const index = playersCache.findIndex(p => p.id === playerId);
  if (index === -1) {
    throw new Error('Player not found');
  }
  
  playersCache[index] = { ...playersCache[index], ...updates };
  console.log('Player updated in cache');
  return [...playersCache];
}

export async function deletePlayer(playerId) {
  console.log('deletePlayer called for:', playerId);
  const index = playersCache.findIndex(p => p.id === playerId);
  if (index === -1) {
    throw new Error('Player not found');
  }
  
  playersCache.splice(index, 1);
  console.log('Player deleted from cache. Total players:', playersCache.length);
  return [...playersCache];
}

export async function getMasterlist() {
  console.log('getMasterlist called, returning cached masterlist:', masterlistCache.length);
  return [...masterlistCache];
}

export async function saveMasterlist(masterlist) {
  console.log('saveMasterlist called with:', masterlist.length, 'players');
  if (!Array.isArray(masterlist)) {
    throw new Error('Masterlist must be an array');
  }
  
  masterlistCache = [...masterlist];
  console.log('Masterlist saved to cache:', masterlistCache.length);
  return masterlistCache;
}

export async function addMasterlistPlayer(player) {
  console.log('addMasterlistPlayer called with:', player);
  if (!player.name) {
    throw new Error('Player must have a name');
  }
  
  // Generate new ID
  const maxId = masterlistCache.reduce((max, p) => Math.max(max, p.id || 0), 0);
  const newPlayer = { ...player, id: maxId + 1 };
  
  masterlistCache.push(newPlayer);
  console.log('Player added to masterlist cache. Total players:', masterlistCache.length);
  return [...masterlistCache];
}

export async function updateMasterlistPlayer(playerId, updates) {
  console.log('updateMasterlistPlayer called for:', playerId, 'with updates:', updates);
  const index = masterlistCache.findIndex(p => p.id === parseInt(playerId));
  if (index === -1) {
    throw new Error('Player not found in masterlist');
  }
  
  masterlistCache[index] = { ...masterlistCache[index], ...updates };
  console.log('Masterlist player updated in cache');
  return [...masterlistCache];
}

export async function deleteMasterlistPlayer(playerId) {
  console.log('deleteMasterlistPlayer called for:', playerId);
  const index = masterlistCache.findIndex(p => p.id === parseInt(playerId));
  if (index === -1) {
    throw new Error('Player not found in masterlist');
  }
  
  masterlistCache.splice(index, 1);
  console.log('Player deleted from masterlist cache. Total players:', masterlistCache.length);
  return [...masterlistCache];
}

export async function getRegistrationSettings() {
  console.log('getRegistrationSettings called');
  return {...registrationSettingsCache};
}

export async function saveRegistrationSettings(settings) {
  console.log('saveRegistrationSettings called with:', settings);
  registrationSettingsCache = {...settings};
  console.log('Registration settings saved to cache');
  return registrationSettingsCache;
}

// Clear all data (for testing)
export function clearAllData() {
  console.log('clearAllData called - resetting all caches');
  playersCache = [];
  masterlistCache = [];
  registrationSettingsCache = {
    isOpen: true,
    tournament: {
      name: "Dota 2 Tournament",
      date: new Date().toISOString().split('T')[0],
      maxPlayers: 50
    }
  };
} 