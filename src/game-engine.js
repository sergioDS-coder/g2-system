// game-engine.ts - Sistema di progressione: livelli, rank, EXP, attributi
const CLASS_WEIGHTS = {
    combattente: { str: 3, agi: 1, vit: 0, int: 0, end: 0 },
    assassino: { str: 1, agi: 3, vit: 0, int: 0, end: 0 },
    mago: { str: 0, agi: 0, vit: 0, int: 3, end: 1 },
    ranger: { str: 0, agi: 2, vit: 0, int: 2, end: 0 },
    carro_armato: { str: 0, agi: 0, vit: 1, int: 0, end: 3 },
    guaritore: { str: 0, agi: 0, vit: 3, int: 1, end: 0 },
};
export function determineClass(attrs, level) {
    if (level < 5)
        return null;
    const classes = Object.keys(CLASS_WEIGHTS);
    const attrsKeys = Object.keys(attrs);
    let bestCls = 'combattente';
    let bestScore = -1;
    for (const cls of classes) {
        const score = attrsKeys.reduce((sum, attr) => sum + attrs[attr] * CLASS_WEIGHTS[cls][attr], 0);
        if (score > bestScore) {
            bestScore = score;
            bestCls = cls;
        }
    }
    return bestCls;
}
export function getClassAbilityName(cls) {
    const names = {
        combattente: 'Berserker',
        carro_armato: 'Fortezza',
        assassino: 'Furtività',
        mago: 'Amplificazione',
        ranger: 'Adattamento',
        guaritore: 'Rigenerazione',
    };
    return names[cls];
}
export function isWeeklySkipAvailable(lastUsedDate) {
    if (!lastUsedDate)
        return true;
    const diff = Date.now() - new Date(lastUsedDate).getTime();
    return diff > 7 * 24 * 60 * 60 * 1000;
}
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
        playerClass: null,
        artifacts: [],
        abilityState: {
            strQuestStreak: 0,
            intQuestStreak: 0,
            weeklySkipUsed: '',
            pendingRecovery: 0,
            adaptationDate: '',
            dailyAttrsCompleted: [],
        },
    };
}
export function addExp(player, exp, attribute, expMultiplier = 1) {
    const oldLevel = player.level;
    const oldRank = player.rank;
    const newPlayer = JSON.parse(JSON.stringify(player));
    // Update ability streaks
    if (attribute === 'str') {
        newPlayer.abilityState.strQuestStreak++;
    }
    else {
        newPlayer.abilityState.strQuestStreak = 0;
    }
    if (attribute === 'int') {
        newPlayer.abilityState.intQuestStreak++;
    }
    else {
        newPlayer.abilityState.intQuestStreak = 0;
    }
    // Apply class ability bonuses
    let finalExp = Math.round(exp * expMultiplier);
    if (newPlayer.playerClass === 'combattente' && attribute === 'str' && newPlayer.abilityState.strQuestStreak >= 3) {
        // Berserker: double EXP at streak >= 3
        finalExp *= 2;
    }
    if (newPlayer.playerClass === 'mago' && attribute === 'int') {
        // Amplificazione: +10% per streak capped at +50%
        const bonus = Math.min(newPlayer.abilityState.intQuestStreak * 0.10, 0.50);
        finalExp = Math.round(finalExp * (1 + bonus));
    }
    newPlayer.expTotal += finalExp;
    newPlayer.expCurrent += finalExp;
    newPlayer.attributes[attribute] += 1;
    // Check level up
    while (newPlayer.expCurrent >= getExpToNextLevel(newPlayer.level) && newPlayer.level < 99) {
        newPlayer.expCurrent -= getExpToNextLevel(newPlayer.level);
        newPlayer.level += 1;
    }
    newPlayer.rank = getRankFromLevel(newPlayer.level);
    // Update class based on new attributes and level
    newPlayer.playerClass = determineClass(newPlayer.attributes, newPlayer.level);
    return {
        player: newPlayer,
        leveledUp: newPlayer.level > oldLevel,
        rankedUp: newPlayer.rank !== oldRank,
        oldLevel,
        newLevel: newPlayer.level,
        oldRank,
        newRank: newPlayer.rank,
        expGained: finalExp,
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
