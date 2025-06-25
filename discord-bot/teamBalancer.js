// Team Balancer logic for Discord bot
// Each function: (players, numTeams, teamSize) => { teams, reserves }

function ensureNumericMmr(mmr) {
    const numericMmr = parseInt(mmr);
    return isNaN(numericMmr) ? 0 : numericMmr;
}

function calculateTotalMmr(players) {
    return players.reduce((sum, player) => sum + ensureNumericMmr(player.peakmmr), 0);
}

function highRanked(players, numTeams, teamSize) {
    // Sort players by MMR (highest first)
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    const maxPlayersForTeams = numTeams * teamSize;
    const playersForTeams = sortedPlayers.slice(0, maxPlayersForTeams);
    const reserves = sortedPlayers.slice(maxPlayersForTeams);
    // Tiered assignment
    const teams = Array.from({ length: numTeams }, () => []);
    const tiers = [];
    for (let i = 0; i < teamSize; i++) {
        tiers.push(playersForTeams.slice(i * numTeams, (i + 1) * numTeams));
    }
    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        for (let j = tier.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [tier[j], tier[k]] = [tier[k], tier[j]];
        }
        for (let t = 0; t < numTeams; t++) {
            if (tier[t]) teams[t].push(tier[t]);
        }
    }
    return { teams, reserves };
}

function perfectMmr(players, numTeams, teamSize) {
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    const maxPlayersForTeams = numTeams * teamSize;
    const playersForTeams = sortedPlayers.slice(0, maxPlayersForTeams);
    const reserves = sortedPlayers.slice(maxPlayersForTeams);
    const teams = Array.from({ length: numTeams }, () => []);
    const teamMmrTotals = new Array(numTeams).fill(0);
    for (const player of playersForTeams) {
        let targetTeamIndex = 0;
        let lowestMmr = teamMmrTotals[0];
        for (let i = 1; i < numTeams; i++) {
            if (teams[i].length < teamSize && teamMmrTotals[i] < lowestMmr) {
                targetTeamIndex = i;
                lowestMmr = teamMmrTotals[i];
            }
        }
        teams[targetTeamIndex].push(player);
        teamMmrTotals[targetTeamIndex] += player.peakmmr || 0;
    }
    return { teams, reserves };
}

function highLowShuffle(players, numTeams, teamSize) {
    const sortedPlayers = [...players].sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    const maxPlayersForTeams = numTeams * teamSize;
    const playersNeededForTeams = maxPlayersForTeams;
    const playersToReserve = sortedPlayers.length - playersNeededForTeams;
    const guaranteedTopCount = Math.floor(playersNeededForTeams * 0.4);
    const guaranteedBottomCount = Math.floor(playersNeededForTeams * 0.4);
    const flexibleCount = playersNeededForTeams - guaranteedTopCount - guaranteedBottomCount;
    const guaranteedTopPlayers = sortedPlayers.slice(0, guaranteedTopCount);
    const guaranteedBottomPlayers = sortedPlayers.slice(-guaranteedBottomCount);
    const flexibleCandidates = sortedPlayers.slice(guaranteedTopCount, sortedPlayers.length - guaranteedBottomCount);
    const shuffledFlexibleCandidates = [...flexibleCandidates].sort(() => Math.random() - 0.5);
    const flexiblePlayersForTeams = shuffledFlexibleCandidates.slice(0, flexibleCount);
    const reserves = shuffledFlexibleCandidates.slice(flexibleCount).concat(sortedPlayers.slice(maxPlayersForTeams));
    const playersForTeams = [
        ...guaranteedTopPlayers,
        ...flexiblePlayersForTeams,
        ...guaranteedBottomPlayers
    ];
    const teamPlayersResorted = playersForTeams.sort((a, b) => (b.peakmmr || 0) - (a.peakmmr || 0));
    const highTierSize = numTeams;
    const lowTierSize = numTeams;
    const midTierSize = teamPlayersResorted.length - highTierSize - lowTierSize;
    const highTierPlayers = teamPlayersResorted.slice(0, highTierSize);
    const midTierPlayers = teamPlayersResorted.slice(highTierSize, highTierSize + midTierSize);
    const lowTierPlayers = teamPlayersResorted.slice(-lowTierSize);
    const shuffledHighTier = [...highTierPlayers].sort(() => Math.random() - 0.5);
    const shuffledMidTier = [...midTierPlayers].sort(() => Math.random() - 0.5);
    const shuffledLowTier = [...lowTierPlayers].sort(() => Math.random() - 0.5);
    const teams = Array.from({ length: numTeams }, () => []);
    for (let teamIndex = 0; teamIndex < numTeams; teamIndex++) {
        // Slot 1: High MMR player
        if (shuffledHighTier.length > 0) {
            const highPlayer = shuffledHighTier.shift();
            teams[teamIndex].push(highPlayer);
        }
        // Slot 5: Low MMR player
        if (shuffledLowTier.length > 0) {
            const lowPlayer = shuffledLowTier.shift();
            teams[teamIndex].push(lowPlayer);
        }
    }
    let midTierIndex = 0;
    for (let teamIndex = 0; teamIndex < numTeams && midTierIndex < shuffledMidTier.length; teamIndex++) {
        while (teams[teamIndex].length < teamSize && midTierIndex < shuffledMidTier.length) {
            const midPlayer = shuffledMidTier[midTierIndex++];
            teams[teamIndex].push(midPlayer);
        }
    }
    return { teams, reserves };
}

function random(players, numTeams, teamSize) {
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    let currentTeam = 0;
    const teams = Array.from({ length: numTeams }, () => []);
    for (let i = 0; i < shuffledPlayers.length && i < numTeams * teamSize; i++) {
        const player = shuffledPlayers[i];
        teams[currentTeam].push(player);
        currentTeam = (currentTeam + 1) % numTeams;
    }
    const maxPlayersForTeams = numTeams * teamSize;
    const reserves = shuffledPlayers.slice(maxPlayersForTeams);
    return { teams, reserves };
}

module.exports = {
    highRanked,
    perfectMmr,
    highLowShuffle,
    random
}; 