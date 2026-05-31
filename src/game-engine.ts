// game-engine.ts - Sistema di progressione: livelli, rank, EXP, attributi

export type Rank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS'
export type Attribute = 'str' | 'agi' | 'vit' | 'int' | 'end'
export type Privacy = 'public' | 'anonymous' | 'private'
export type ClassType = 'combattente' | 'carro_armato' | 'assassino' | 'mago' | 'ranger' | 'guaritore'

export interface AbilityState {
  strQuestStreak: number      // Combattente: consecutive STR quests completed
  intQuestStreak: number      // Mago: consecutive INT quests completed
  weeklySkipUsed: string      // Assassino: date (YYYY-MM-DD) when weekly skip was last used
  pendingRecovery: number     // Guaritore: EXP to recover next morning
  adaptationDate: string      // Ranger: date of current adaptation tracking
  dailyAttrsCompleted: string[] // Ranger: attribute types completed today
}

const CLASS_WEIGHTS: Record<ClassType, Record<Attribute, number>> = {
  combattente:  { str: 3, agi: 1, vit: 0, int: 0, end: 0 },
  assassino:    { str: 1, agi: 3, vit: 0, int: 0, end: 0 },
  mago:         { str: 0, agi: 0, vit: 0, int: 3, end: 1 },
  ranger:       { str: 0, agi: 2, vit: 0, int: 2, end: 0 },
  carro_armato: { str: 0, agi: 0, vit: 1, int: 0, end: 3 },
  guaritore:    { str: 0, agi: 0, vit: 3, int: 1, end: 0 },
}

export function determineClass(attrs: Record<Attribute, number>, level: number): ClassType | null {
  if (level < 5) return null
  const classes = Object.keys(CLASS_WEIGHTS) as ClassType[]
  const attrsKeys = Object.keys(attrs) as Attribute[]
  let bestCls: ClassType = 'combattente'
  let bestScore = -1
  for (const cls of classes) {
    const score = attrsKeys.reduce((sum, attr) => sum + attrs[attr] * CLASS_WEIGHTS[cls][attr], 0)
    if (score > bestScore) { bestScore = score; bestCls = cls }
  }
  return bestCls
}

export function getClassAbilityName(cls: ClassType): string {
  const names: Record<ClassType, string> = {
    combattente: 'Berserker',
    carro_armato: 'Fortezza',
    assassino: 'Furtività',
    mago: 'Amplificazione',
    ranger: 'Adattamento',
    guaritore: 'Rigenerazione',
  }
  return names[cls]
}

export function isWeeklySkipAvailable(lastUsedDate: string): boolean {
  if (!lastUsedDate) return true
  const diff = Date.now() - new Date(lastUsedDate).getTime()
  return diff > 7 * 24 * 60 * 60 * 1000
}

export interface PlayerProfile {
  playerId: string
  name: string
  level: number
  rank: Rank
  expTotal: number
  expCurrent: number
  attributes: Record<Attribute, number>
  questsCompleted: number
  privacy: Privacy
  language: string
  lastDailyDate: string  // YYYY-MM-DD
  playerClass: ClassType | null
  artifacts: string[]
  abilityState: AbilityState
}

// ─── Tabella Rank ────────────────────────────────────────────────────────────

interface RankInfo {
  rank: Rank
  minLevel: number
  maxLevel: number
  questsPerDay: number
  expToNextLevel: number
}

const RANK_TABLE: RankInfo[] = [
  { rank: 'F',   minLevel: 1,  maxLevel: 10, questsPerDay: 3, expToNextLevel: 500 },
  { rank: 'E',   minLevel: 11, maxLevel: 20, questsPerDay: 3, expToNextLevel: 1_000 },
  { rank: 'D',   minLevel: 21, maxLevel: 30, questsPerDay: 4, expToNextLevel: 2_000 },
  { rank: 'C',   minLevel: 31, maxLevel: 40, questsPerDay: 4, expToNextLevel: 4_000 },
  { rank: 'B',   minLevel: 41, maxLevel: 50, questsPerDay: 5, expToNextLevel: 8_000 },
  { rank: 'A',   minLevel: 51, maxLevel: 60, questsPerDay: 5, expToNextLevel: 15_000 },
  { rank: 'S',   minLevel: 61, maxLevel: 70, questsPerDay: 6, expToNextLevel: 30_000 },
  { rank: 'SS',  minLevel: 71, maxLevel: 80, questsPerDay: 6, expToNextLevel: 60_000 },
  { rank: 'SSS', minLevel: 81, maxLevel: 99, questsPerDay: 7, expToNextLevel: 100_000 },
]

export function getRankInfo(level: number): RankInfo {
  return RANK_TABLE.find(r => level >= r.minLevel && level <= r.maxLevel) ?? RANK_TABLE[0]
}

export function getRankFromLevel(level: number): Rank {
  return getRankInfo(level).rank
}

export function getQuestsPerDay(level: number): number {
  return getRankInfo(level).questsPerDay
}

export function getExpToNextLevel(level: number): number {
  return getRankInfo(level).expToNextLevel
}

// ─── Player default ──────────────────────────────────────────────────────────

export function createDefaultPlayer(playerId: string, name: string, lang: string): PlayerProfile {
  return {
    playerId,
    name,
    level: 1,
    rank: 'F',
    expTotal: 0,
    expCurrent: 0,
    attributes: { str: 1, agi: 1, vit: 1, int: 1, end: 1 },
    questsCompleted: 0,
    privacy: 'public',
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
  }
}

// ─── Aggiunta EXP e level up ─────────────────────────────────────────────────

export interface ExpResult {
  player: PlayerProfile
  leveledUp: boolean
  rankedUp: boolean
  oldLevel: number
  newLevel: number
  oldRank: Rank
  newRank: Rank
  expGained: number
}

/** Consumes expCurrent across level thresholds and re-derives rank + class.
 *  Shared by addExp and awardBonusExp so every EXP gain handles level-ups
 *  identically. */
function processLevelUps(p: PlayerProfile): void {
  while (p.expCurrent >= getExpToNextLevel(p.level) && p.level < 99) {
    p.expCurrent -= getExpToNextLevel(p.level)
    p.level += 1
  }
  p.rank = getRankFromLevel(p.level)
  p.playerClass = determineClass(p.attributes, p.level)
}

/** Derives the canonical level + within-level EXP from a lifetime EXP total.
 *  Inverse of processLevelUps — used to rebuild a consistent state after undo. */
export function deriveLevelState(expTotal: number): { level: number; expCurrent: number } {
  let level = 1
  let remaining = Math.max(0, expTotal)
  while (level < 99 && remaining >= getExpToNextLevel(level)) {
    remaining -= getExpToNextLevel(level)
    level += 1
  }
  return { level, expCurrent: remaining }
}

export function addExp(player: PlayerProfile, exp: number, attribute: Attribute, expMultiplier = 1): ExpResult {
  const oldLevel = player.level
  const oldRank = player.rank

  const newPlayer: PlayerProfile = JSON.parse(JSON.stringify(player))

  // Update ability streaks
  if (attribute === 'str') {
    newPlayer.abilityState.strQuestStreak++
  } else {
    newPlayer.abilityState.strQuestStreak = 0
  }
  if (attribute === 'int') {
    newPlayer.abilityState.intQuestStreak++
  } else {
    newPlayer.abilityState.intQuestStreak = 0
  }

  // Apply class ability bonuses
  let finalExp = Math.round(exp * expMultiplier)

  if (newPlayer.playerClass === 'combattente' && attribute === 'str' && newPlayer.abilityState.strQuestStreak >= 3) {
    // Berserker: double EXP at streak >= 3
    finalExp *= 2
  }

  if (newPlayer.playerClass === 'mago' && attribute === 'int') {
    // Amplificazione: +10% per streak capped at +50%
    const bonus = Math.min(newPlayer.abilityState.intQuestStreak * 0.10, 0.50)
    finalExp = Math.round(finalExp * (1 + bonus))
  }

  newPlayer.expTotal += finalExp
  newPlayer.expCurrent += finalExp
  newPlayer.attributes[attribute] += 1

  processLevelUps(newPlayer)

  return {
    player: newPlayer,
    leveledUp: newPlayer.level > oldLevel,
    rankedUp: newPlayer.rank !== oldRank,
    oldLevel,
    newLevel: newPlayer.level,
    oldRank,
    newRank: newPlayer.rank,
    expGained: finalExp,
  }
}

/** Awards a flat EXP bonus (no attribute/streak change) and processes any
 *  resulting level/rank up — so class-ability bonuses can trigger a level-up
 *  screen just like normal quest EXP. */
export function awardBonusExp(player: PlayerProfile, bonus: number): ExpResult {
  const oldLevel = player.level
  const oldRank = player.rank
  const newPlayer: PlayerProfile = JSON.parse(JSON.stringify(player))
  newPlayer.expTotal += bonus
  newPlayer.expCurrent += bonus
  processLevelUps(newPlayer)
  return {
    player: newPlayer,
    leveledUp: newPlayer.level > oldLevel,
    rankedUp: newPlayer.rank !== oldRank,
    oldLevel,
    newLevel: newPlayer.level,
    oldRank,
    newRank: newPlayer.rank,
    expGained: bonus,
  }
}

export function subtractExp(player: PlayerProfile, exp: number, attribute: Attribute): PlayerProfile {
  const newPlayer: PlayerProfile = JSON.parse(JSON.stringify(player))
  newPlayer.expTotal = Math.max(0, newPlayer.expTotal - exp)
  newPlayer.attributes[attribute] = Math.max(1, newPlayer.attributes[attribute] - 1)
  // Re-derive level/rank/class from the reduced total so an undo fully reverses
  // a completion that had triggered a level-up (no orphaned level or class).
  const { level, expCurrent } = deriveLevelState(newPlayer.expTotal)
  newPlayer.level = level
  newPlayer.expCurrent = expCurrent
  newPlayer.rank = getRankFromLevel(level)
  newPlayer.playerClass = determineClass(newPlayer.attributes, level)
  return newPlayer
}

export function applyPenalty(player: PlayerProfile, expLoss: number): PlayerProfile {
  const newPlayer: PlayerProfile = JSON.parse(JSON.stringify(player))
  newPlayer.expCurrent = Math.max(0, newPlayer.expCurrent - expLoss)
  newPlayer.expTotal = Math.max(0, newPlayer.expTotal - expLoss)
  return newPlayer
}

export function incrementQuestCount(player: PlayerProfile): PlayerProfile {
  return { ...player, questsCompleted: player.questsCompleted + 1 }
}
