// Database module for serverless functions
// Since serverless functions can't persist to file system, we use in-memory storage

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
      const players = await deletePlayer(playerId);
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