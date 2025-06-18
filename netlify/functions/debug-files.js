// Debug function to test file access in Netlify
import { promises as fs } from 'fs';
import path from 'path';

export const handler = async (event, context) => {
  try {
    console.log('Debug Files function called');
    
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
        }
      };
    }
    
    const isNetlify = !!process.env.NETLIFY;
    const cwd = process.cwd();
    
    console.log('Environment check:');
    console.log('NETLIFY env:', isNetlify);
    console.log('Current working directory:', cwd);
    
    // Test different path approaches
    const paths = {
      cwd_players: path.join(cwd, 'players.json'),
      cwd_masterlist: path.join(cwd, 'masterlist.json'),
      relative_players: './players.json',
      relative_masterlist: './masterlist.json',
      root_players: '/var/task/players.json',
      root_masterlist: '/var/task/masterlist.json'
    };
    
    const results = {};
    
    // Try to read each path
    for (const [key, filePath] of Object.entries(paths)) {
      try {
        console.log(`Testing path: ${key} -> ${filePath}`);
        const data = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(data);
        results[key] = {
          success: true,
          path: filePath,
          itemCount: parsed.length,
          firstItem: parsed[0] || null
        };
        console.log(`✅ ${key}: Found ${parsed.length} items`);
      } catch (error) {
        results[key] = {
          success: false,
          path: filePath,
          error: error.message
        };
        console.log(`❌ ${key}: ${error.message}`);
      }
    }
    
    // Try to list directory contents
    let directoryContents = {};
    try {
      const files = await fs.readdir(cwd);
      directoryContents = {
        success: true,
        files: files.filter(f => f.endsWith('.json')),
        allFiles: files
      };
      console.log('Directory contents:', files);
    } catch (error) {
      directoryContents = {
        success: false,
        error: error.message
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        environment: {
          isNetlify,
          cwd,
          nodeVersion: process.version
        },
        pathTests: results,
        directoryContents,
        timestamp: new Date().toISOString()
      }, null, 2)
    };
    
  } catch (error) {
    console.error('Debug function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
}; 