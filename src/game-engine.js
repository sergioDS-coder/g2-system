// game-engine.ts - Sistema di progressione: livelli, rank, EXP, attributi
const RANK_TABLE = [
    { rank: 'F', minLevel: 1, maxLevel: 10, questsPerDay: 3, expToNextLevel: 500 },
    { rank: 'E', minLevel: 11, maxLevel: 20, questsPerDay: 3, expToNextLevel: 1000 },
    { rank: 'D', minLevel: 21, maxLevel: 30, questsPerDay: 4, expToNextLevel: 2000 },
    { rank: 'C', minLevel: 31, maxLevel: 40, questsPerDay: 4, expToNextLevel: 4000 },
    { rank: 'B', minLevel: 41, maxLevel: 50, questsPerDay: 5, expToNextLevel: 8000 },
    { rank: 'A', minLevel: 51, maxLevel: 60, questsPerDay: 5, expToNextLevel: 15000 },
    { rank: 'S', minLevel: 61, maxLevel: 70, questsPerDay: 6, expToNextLevel: 30000 },
    { rank: 'SS', minLevel: 71, maxLevel: 80, questsPerDay: 6, expToNextLevel: 60000 },
    { rank: 'SSS', minLevel: 81, maxLevel: 99, questsPerDay: 7, expToNextLevel: 100000 },
];
export function getRankInfo(level) {
    return RANK_TABLE.find(r => level >= r.minLevel && level <= r.maxLevel) ?? RANK_TABLE[0];
}
export function getRankFromLevel(level) {
    return getRankInfo(level).rank;
}
export function getQuestsPerDay(level) {
    return getRankInfo(level).questsPerDay;
}
export function getExpToNextLevel(level) {
    return getRankInfo(level).expToNextLevel;
}
// ─── Player default ──────────────────────────────────────────────────────────
export function createDefaultPlayer(playerId, name, lang) {
    return {
        playerId,
        name,
        level: 1,
        rank: 'F',
        expTotal: 0,
        expCurrent: 0,
        attributes: { str: 1, agi: 1, vit: 1, int: 1, end: 1 },
        questsCompleted: 0,
        privacy: 'anonymous',
        language: lang,
        lastDailyDate: '',
    };
}
export function addExp(player, exp, attribute) {
    const oldLevel = player.level;
    const oldRank = player.rank;
    const newPlayer = JSON.parse(JSON.stringify(player));
    newPlayer.expTotal += exp;
    newPlayer.expCurrent += exp;
    newPlayer.attributes[attribute] += 1;
    // Check level up
    while (newPlayer.expCurrent >= getExpToNextLevel(newPlayer.level) && newPlayer.level < 99) {
        newPlayer.expCurrent -= getExpToNextLevel(newPlayer.level);
        newPlayer.level += 1;
    }
    newPlayer.rank = getRankFromLevel(newPlayer.level);
    return {
        player: newPlayer,
        leveledUp: newPlayer.level > oldLevel,
        rankedUp: newPlayer.rank !== oldRank,
        oldLevel,
        newLevel: newPlayer.level,
        oldRank,
        newRank: newPlayer.rank,
    };
}
export function subtractExp(player, exp, attribute) {
    const newPlayer = JSON.parse(JSON.stringify(player));
    newPlayer.expCurrent = Math.max(0, newPlayer.expCurrent - exp);
    newPlayer.expTotal = Math.max(0, newPlayer.expTotal - exp);
    newPlayer.attributes[attribute] = Math.max(1, newPlayer.attributes[attribute] - 1);
    return newPlayer;
}
export function applyPenalty(player, expLoss) {
    const newPlayer = JSON.parse(JSON.stringify(player));
    newPlayer.expCurrent = Math.max(0, newPlayer.expCurrent - expLoss);
    newPlayer.expTotal = Math.max(0, newPlayer.expTotal - expLoss);
    return newPlayer;
}
export function incrementQuestCount(player) {
    return { ...player, questsCompleted: player.questsCompleted + 1 };
}
