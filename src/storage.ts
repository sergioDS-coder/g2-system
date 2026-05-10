import type { PlayerProfile } from './game-engine'
import type { DailyQuest } from './quest-data'
import { bGet, bSet } from './bridge-storage'

const KEYS = {
  player: 'g2sys_player',
  quests: 'g2sys_quests',
  setupComplete: 'g2sys_setup_complete',
}

export async function loadPlayer(): Promise<PlayerProfile | null> {
  try {
    const raw = await bGet(KEYS.player)
    if (!raw) return null
    return JSON.parse(raw) as PlayerProfile
  } catch { return null }
}

export async function savePlayer(p: PlayerProfile): Promise<void> {
  await bSet(KEYS.player, JSON.stringify(p))
}

export async function loadQuests(): Promise<DailyQuest[]> {
  try {
    const raw = await bGet(KEYS.quests)
    if (!raw) return []
    return JSON.parse(raw) as DailyQuest[]
  } catch { return [] }
}

export async function saveQuests(q: DailyQuest[]): Promise<void> {
  await bSet(KEYS.quests, JSON.stringify(q))
}

export async function isSetupComplete(): Promise<boolean> {
  const val = await bGet(KEYS.setupComplete)
  return val === 'true'
}

export async function saveSetupComplete(): Promise<void> {
  await bSet(KEYS.setupComplete, 'true')
}

export function generatePlayerId(): string {
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
