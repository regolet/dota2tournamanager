// Function to handle tournament data operations (GET, POST, DELETE)
import { saveTournament, getTournament, getTournaments, validateSession, deleteTournament } from './database.js';

export async function handler(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                ...headers,
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            },
            body: ''
        };
    }

    try {
        const sessionId = event.headers['x-session-id'];

        if (event.httpMethod === 'POST') {
            // Require session for POST
            if (!sessionId) {
                return {
                    statusCode: 401,
                    body: JSON.stringify({ message: 'Invalid or expired session' }),
                    headers
                };
            }
            const session = await validateSession(sessionId);
            if (!session.valid) {
                return {
                    statusCode: 401,
                    body: JSON.stringify({ message: 'Invalid or expired session' }),
                    headers
                };
            }
            const { userId: adminUserId, role: adminRole } = session;

            try {
                const clientData = JSON.parse(event.body);
                console.log('Received tournament data:', JSON.stringify(clientData, null, 2));

                // Fetch the existing tournament if it exists
                let existingTournament = null;
                if (clientData.id) {
                    existingTournament = await getTournament(clientData.id);
                }
                let mergedTournament = {};
                if (existingTournament) {
                    // Merge all fields, but update tournament_data and team_set_id
                    mergedTournament = {
                        ...existingTournament,
                        ...clientData,
                        tournament_data: clientData.tournament_data || existingTournament.tournament_data,
                        team_set_id: clientData.team_set_id || existingTournament.team_set_id
                    };
                } else {
                    mergedTournament = clientData;
                }

                const dbPayload = {
                    id: mergedTournament.id,
                    admin_user_id: mergedTournament.admin_user_id || adminUserId,
                    team_set_id: mergedTournament.team_set_id,
                    tournament_data: mergedTournament.tournament_data
                };

                console.log('Saving tournament with payload:', JSON.stringify(dbPayload, null, 2));
                const result = await saveTournament(dbPayload);
                console.log('Save tournament result:', result);

                if (result.success) {
                    return {
                        statusCode: 200,
                        body: JSON.stringify(result),
                        headers
                    };
                } else {
                    console.error('Tournament save failed:', result.message);
                    return {
                        statusCode: 500,
                        body: JSON.stringify({ message: result.message }),
                        headers
                    };
                }
            } catch (error) {
                console.error('Error in POST tournament:', error);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ message: 'Error saving tournament', error: error.message }),
                    headers
                };
            }
        }

        if (event.httpMethod === 'GET') {
            const tournamentId = event.queryStringParameters?.id;
            
            if (tournamentId) {
                // Public: fetch a specific tournament by ID (no session required)
                const tournament = await getTournament(tournamentId);
                if (tournament) {
                    // Parse tournament_data if it's a string
                    let parsedTournament = { ...tournament };
                    if (parsedTournament.tournament_data && typeof parsedTournament.tournament_data === 'string') {
                        try {
                            parsedTournament.tournament_data = JSON.parse(parsedTournament.tournament_data);
                        } catch (e) {
                            console.error('Error parsing tournament_data:', e);
                        }
                    }
                    return {
                        statusCode: 200,
                        body: JSON.stringify(parsedTournament),
                        headers
                    };
                } else {
                    return {
                        statusCode: 404,
                        body: JSON.stringify({ message: 'Tournament not found' }),
                        headers
                    };
                }
            } else {
                // Public: get the list of tournaments (no session required)
                try {
                    const tournaments = await getTournaments(null); // null = all tournaments
                    const formattedTournaments = tournaments.map(t => {
                        let tournamentName = null;
                        let tournamentData = t.tournament_data;
                        if (tournamentData) {
                            if (typeof tournamentData === 'string') {
                                try {
                                    tournamentData = JSON.parse(tournamentData);
                                } catch (e) {
                                    console.error('Error parsing tournament_data', e);
                                    tournamentData = null;
                                }
                            }
                            if (tournamentData && typeof tournamentData === 'object' && tournamentData.name) {
                                tournamentName = tournamentData.name;
                            }
                        }
                        let createdAt = t.created_at;
                        if (createdAt && typeof createdAt === 'string') {
                            createdAt = new Date(createdAt.replace(' ', 'T') + 'Z');
                        }
                        return {
                            id: t.id,
                            name: tournamentName,
                            created_at: createdAt && !isNaN(createdAt) ? createdAt.toISOString() : null,
                        };
                    });
                    return {
                        statusCode: 200,
                        body: JSON.stringify(formattedTournaments),
                        headers
                    };
                } catch (error) {
                    console.error('Error getting tournaments:', error);
                    return {
                        statusCode: 200,
                        body: JSON.stringify([]),
                        headers
                    };
                }
            }
        }

        if (event.httpMethod === 'DELETE') {
            // Require session for DELETE
            if (!sessionId) {
                return {
                    statusCode: 401,
                    body: JSON.stringify({ message: 'Invalid or expired session' }),
                    headers
                };
            }
            const session = await validateSession(sessionId);
            if (!session.valid) {
                return {
                    statusCode: 401,
                    body: JSON.stringify({ message: 'Invalid or expired session' }),
                    headers
                };
            }
            const { userId: adminUserId, role: adminRole } = session;

            const tournamentId = event.queryStringParameters?.id;
            if (!tournamentId) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: 'Tournament ID is required' }),
                    headers
                };
            }

            // Superadmin can delete any tournament. Regular admins can only delete their own.
            if (adminRole !== 'superadmin') {
                const tournament = await getTournament(tournamentId);
                if (!tournament || tournament.admin_user_id !== adminUserId) {
                    return {
                        statusCode: 403,
                        body: JSON.stringify({ message: 'Forbidden: You do not have permission to delete this tournament.' }),
                        headers
                    };
                }
            }

            const result = await deleteTournament(tournamentId);
            if (result.success) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, message: 'Tournament deleted successfully' }),
                    headers
                };
            } else {
                return {
                    statusCode: 500,
                    body: JSON.stringify({ message: result.message }),
                    headers
                };
            }
        }

        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
            headers
        };
    } catch (error) {
        console.error('Error in tournaments function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
            headers
        };
    }
} 