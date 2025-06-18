// Bulk insert players into masterlist
import { addMasterlistPlayer, getMasterlist } from './database.js';

export const handler = async (event, context) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
      };
    }
    
    // Only handle POST requests for this endpoint
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Method not allowed'
        })
      };
    }
    
    // Parse request body
    let requestBody = {};
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid JSON in request body'
        })
      };
    }
    
    // This function uses predefined players - no need to validate input players
    
    // Predefined player list to insert
    const playersToInsert = [
      {
        "name": "kasuuuzxc",
        "dota2id": "192707167",
        "mmr": 8000
      },
      {
        "name": "Jho",
        "dota2id": "206306528",
        "mmr": 4200
      },
      {
        "name": "Bimbo",
        "dota2id": "135495981",
        "mmr": 11000
      },
      {
        "name": "Rxx",
        "dota2id": "345780550",
        "mmr": 8000
      },
      {
        "name": "Jiji",
        "dota2id": "882831166",
        "mmr": 3000
      },
      {
        "name": "HATHAWAY",
        "dota2id": "192065509",
        "mmr": 7500
      },
      {
        "name": "KSHMR",
        "dota2id": "0000000",
        "mmr": 3700
      },
      {
        "name": "DAR",
        "dota2id": "35562933",
        "mmr": 7700
      },
      {
        "name": "Bigboy",
        "dota2id": "224600007",
        "mmr": 9000
      },
      {
        "name": "Malone",
        "dota2id": "76561198807551883",
        "mmr": 6000
      },
      {
        "name": "X.B",
        "dota2id": "477349401",
        "mmr": 2800
      },
      {
        "name": "OdinidO",
        "dota2id": "374861254",
        "mmr": 5400
      },
      {
        "name": "Ash",
        "dota2id": "00000000",
        "mmr": 6000
      },
      {
        "name": "kotoko_o.o",
        "dota2id": "837536670",
        "mmr": 8800
      },
      {
        "name": "qw3g#0728",
        "dota2id": "191396401",
        "mmr": 6000
      },
      {
        "name": "dondi9197",
        "dota2id": "177377746",
        "mmr": 3000
      },
      {
        "name": "Kelslsls",
        "dota2id": "913773965",
        "mmr": 7200
      },
      {
        "name": "ange",
        "dota2id": "1236573721",
        "mmr": 4000
      },
      {
        "name": "Gold1e",
        "dota2id": "138214069",
        "mmr": 3000
      },
      {
        "name": "davepuso",
        "dota2id": "415172576",
        "mmr": 6000
      },
      {
        "name": "Gabby (Jax)",
        "dota2id": "204228861",
        "mmr": 4000
      },
      {
        "name": "Kirezo",
        "dota2id": "165014940",
        "mmr": 9000
      },
      {
        "name": "313ambi.",
        "dota2id": "199700193",
        "mmr": 8600
      },
      {
        "name": "jer3328",
        "dota2id": "100563562",
        "mmr": 9000
      },
      {
        "name": "Sawj",
        "dota2id": "353785879",
        "mmr": 6000
      },
      {
        "name": "n1tsuga#4773",
        "dota2id": "399121895",
        "mmr": 10000
      },
      {
        "name": "karding",
        "dota2id": "297627210",
        "mmr": 6000
      },
      {
        "name": "Pao",
        "dota2id": "379693212",
        "mmr": 6000
      },
      {
        "name": "Aday",
        "dota2id": "168995116",
        "mmr": 6200
      },
      {
        "name": "jz",
        "dota2id": "334855270",
        "mmr": 5800
      },
      {
        "name": "zxc ジ👽",
        "dota2id": "182927263",
        "mmr": 4900
      },
      {
        "name": "Yabmub",
        "dota2id": "454532408",
        "mmr": 4500
      },
      {
        "name": "Shin su hyun",
        "dota2id": "252766891",
        "mmr": 7000
      },
      {
        "name": "TheAsianCaster catguy231231",
        "dota2id": "443522039",
        "mmr": 2500
      },
      {
        "name": "Tusef2502",
        "dota2id": "376482578",
        "mmr": 5740
      },
      {
        "name": "Salisii",
        "dota2id": "155849727",
        "mmr": 6000
      },
      {
        "name": "hakob",
        "dota2id": "162044560",
        "mmr": 6500
      },
      {
        "name": "tep",
        "dota2id": "199224957",
        "mmr": 6300
      }
    ];
    
    const results = [];
    const errors = [];
    
    // Insert each player
    for (const player of playersToInsert) {
      try {
        // Validate required fields
        if (!player.name || !player.dota2id) {
          errors.push(`Player missing required fields: ${JSON.stringify(player)}`);
          continue;
        }
        
        // Prepare player data for masterlist
        const masterlistPlayer = {
          name: player.name.trim(),
          dota2id: player.dota2id.trim(),
          mmr: player.mmr || 0,
          team: '',
          achievements: '',
          notes: ''
        };
        
        await addMasterlistPlayer(masterlistPlayer);
        results.push({
          success: true,
          player: masterlistPlayer.name,
          dota2id: masterlistPlayer.dota2id,
          mmr: masterlistPlayer.mmr
        });
        
      } catch (error) {
        errors.push(`Failed to add ${player.name}: ${error.message}`);
      }
    }
    
    // Get updated masterlist
    const updatedMasterlist = await getMasterlist();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: `Bulk insert completed. Successfully added ${results.length} players.`,
        results,
        errors: errors.length > 0 ? errors : undefined,
        totalPlayersInMasterlist: updatedMasterlist.length,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Bulk insert masterlist function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error: ' + error.message,
        error: error.toString(),
        timestamp: new Date().toISOString()
      })
    };
  }
}; 