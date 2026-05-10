// game-engine.ts - Sistema di progressione: livelli, rank, EXP, attributi

export type Rank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS'
export type Attribute = 'str' | 'agi' | 'vit' | 'int' | 'end'
export type Privacy = 'public' | 'anonymous' | 'private'

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
    privacy: 'anonymous',
    language: lang,
    lastDailyDate: '',
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
}

export function addExp(player: PlayerProfile, exp: number, attribute: Attribute): ExpResult {
  const oldLevel = player.level
  const oldRank = player.rank

  const newPlayer: PlayerProfile = JSON.parse(JSON.stringify(player))
  newPlayer.expTotal += exp
  newPlayer.expCurrent += exp
  newPlayer.attributes[attribute] += 1

  // Check level up
  while (newPlayer.expCurrent >= getExpToNextLevel(newPlayer.level) && newPlayer.level < 99) {
    newPlayer.expCurrent -= getExpToNextLevel(newPlayer.level)
    newPlayer.level += 1
  }

  newPlayer.rank = getRankFromLevel(newPlayer.level)

  return {
    player: newPlayer,
    leveledUp: newPlayer.level > oldLevel,
    rankedUp: newPlayer.rank !== oldRank,
    oldLevel,
    newLevel: newPlayer.level,
    oldRank,
    newRank: newPlayer.rank,
  }
}

export function subtractExp(player: PlayerProfile, exp: number, attribute: Attribute): PlayerProfile {
  const newPlayer: PlayerProfile = JSON.parse(JSON.stringify(player))
  newPlayer.expCurrent = Math.max(0, newPlayer.expCurrent - exp)
  newPlayer.expTotal = Math.max(0, newPlayer.expTotal - exp)
  newPlayer.attributes[attribute] = Math.max(1, newPlayer.attributes[attribute] - 1)
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
