// storage.ts

import type { PlayerProfile } from './game-engine'
import type { DailyQuest } from './quest-data'

const KEYS = {
  player: 'g2sys_player',
  quests: 'g2sys_quests',
  setupComplete: 'g2sys_setup_complete',
}

export function loadPlayer(): PlayerProfile | null {
  try {
    const raw = window.localStorage.getItem(KEYS.player)
    if (!raw) return null
    return JSON.parse(raw) as PlayerProfile
  } catch { return null }
}

export function savePlayer(p: PlayerProfile): void {
  window.localStorage.setItem(KEYS.player, JSON.stringify(p))
}

export function loadQuests(): DailyQuest[] {
  try {
    const raw = window.localStorage.getItem(KEYS.quests)
    if (!raw) return []
    return JSON.parse(raw) as DailyQuest[]
  } catch { return [] }
}

export function saveQuests(q: DailyQuest[]): void {
  window.localStorage.setItem(KEYS.quests, JSON.stringify(q))
}

export function isSetupComplete(): boolean {
  return window.localStorage.getItem(KEYS.setupComplete) === 'true'
}

export function saveSetupComplete(): void {
  window.localStorage.setItem(KEYS.setupComplete, 'true')
}

export function generatePlayerId(): string {
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
