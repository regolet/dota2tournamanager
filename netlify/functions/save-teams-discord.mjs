// Discord Teams API endpoint for saving teams from Discord bot
import { 
  saveTeamConfiguration,
  saveTournament
} from './database.mjs';
import { getSecurityHeaders } from './security-utils.mjs';

export async function handler(event, context) {
  const headers = getSecurityHeaders();

  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  try {
    // Only allow POST method
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const data = JSON.parse(event.body);
    
    // Validate required fields
    if (!data.teams || !Array.isArray(data.teams) || !data.tournament) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: teams, tournament' })
      };
    }

    // Format teams for saving
    const formattedTeams = data.teams.map((team, index) => ({
      teamNumber: index + 1,
      name: team.name || `Team ${index + 1}`,
      players: team.players || team,
      averageMmr: team.averageMmr || Math.round((team.players || team).reduce((sum, p) => sum + (p.peakmmr || 0), 0) / ((team.players || team).length || 1))
    }));

    // Calculate team statistics
    const totalTeams = formattedTeams.length;
    const totalPlayers = formattedTeams.reduce((sum, team) => sum + team.players.length, 0);
    const allMmrs = formattedTeams.flatMap(team => team.players.map(p => p.peakmmr || 0));
    const averageMmr = allMmrs.length > 0 ? Math.round(allMmrs.reduce((sum, mmr) => sum + mmr, 0) / allMmrs.length) : 0;

    const teamConfigData = {
      title: data.title || `${data.tournament} - ${data.balance || 'Generated'} Teams`,
      description: data.description || `Teams generated from Discord bot`,
      balanceMethod: data.balance || 'discord_generated',
      totalTeams,
      totalPlayers,
      averageMmr,
      registrationSessionId: data.tournament,
      teams: formattedTeams,
      createdBy: 'discord_bot',
      createdByUsername: 'Discord Bot'
    };

    // Save team configuration
    const teamResult = await saveTeamConfiguration('discord_bot', 'Discord Bot', teamConfigData);
    
    if (!teamResult.success) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: teamResult.message || 'Failed to save team configuration' })
      };
    }

    // If tournament data is provided, save tournament bracket
    let tournamentResult = null;
    if (data.tournamentData) {
      const tournamentData = {
        id: data.tournamentData.id,
        team_set_id: teamResult.teamSetId,
        tournament_data: data.tournamentData,
        admin_user_id: 'discord_bot'
      };
      
      tournamentResult = await saveTournament(tournamentData);
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ 
        success: true, 
        teamSetId: teamResult.teamSetId,
        tournamentId: tournamentResult?.tournamentId || null,
        message: 'Teams and tournament saved successfully' 
      })
    };

  } catch (error) {
    console.error('Discord Teams API error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
} 