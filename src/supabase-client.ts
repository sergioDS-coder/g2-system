// supabase-client.ts - Sync profilo player e classifica globale

import type { PlayerProfile } from './game-engine'

interface SupabasePlayerRow {
  player_id: string
  name: string
  level: number
  rank: string
  exp_total: number
  exp_current: number
  str_stat: number
  agi_stat: number
  vit_stat: number
  int_stat: number
  end_stat: number
  quests_completed: number
  privacy: string
  language: string
  player_class?: string | null
  artifacts_json?: string
}

export interface RankingEntry {
  playerId: string
  name: string
  level: number
  rank: string
  expTotal: number
  questsCompleted: number
}

export class SupabaseClient {
  private url: string
  private key: string
  public lastRankingError: string | null = null

  constructor(url: string, anonKey: string) {
    this.url = url ? url.replace(/\/$/, '') : ''
    this.key = anonKey ?? ''
    if (!this.url || !this.key) {
      console.warn('SupabaseClient: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — ranking and sync disabled')
    }
  }

  private isConfigured(): boolean {
    return !!(this.url && this.key)
  }

  /**
   * fetch con timeout via AbortController. Fondamentale: le chiamate Supabase
   * sono await-ate dentro il lock di input (handlingInput) dell'app occhiali.
   * Senza timeout, una rete bloccata terrebbe il lock per sempre e l'app non
   * risponderebbe più ad anello/aste.
   */
  private async fetchWithTimeout(url: string, init: RequestInit, ms = 6000): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ms)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  private headers() {
    return {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    }
  }

  // ─── Sincronizza profilo player ──────────────────────────────────────────

  async upsertPlayer(player: PlayerProfile): Promise<boolean> {
    if (!this.isConfigured()) return false
    if (player.privacy === 'private') return true  // non sincronizza

    const baseRow: SupabasePlayerRow = {
      player_id: player.playerId,
      name: player.privacy === 'anonymous' ? `Player_${player.playerId.slice(0, 6)}` : player.name,
      level: player.level,
      rank: player.rank,
      exp_total: player.expTotal,
      exp_current: player.expCurrent,
      str_stat: player.attributes.str,
      agi_stat: player.attributes.agi,
      vit_stat: player.attributes.vit,
      int_stat: player.attributes.int,
      end_stat: player.attributes.end,
      quests_completed: player.questsCompleted,
      privacy: player.privacy,
      language: player.language,
    }
    const extendedRow: SupabasePlayerRow = {
      ...baseRow,
      player_class: player.playerClass ?? null,
      artifacts_json: JSON.stringify(player.artifacts ?? []),
    }

    const opts = {
      method: 'POST' as const,
      headers: { ...this.headers(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    }

    try {
      // Try with extended fields (class + artifacts); fall back if columns don't exist yet
      const r1 = await this.fetchWithTimeout(`${this.url}/rest/v1/players?on_conflict=player_id`, {
        ...opts, body: JSON.stringify(extendedRow),
      })
      if (r1.ok) return true

      // Extended columns may not exist — retry with base fields only
      const r2 = await this.fetchWithTimeout(`${this.url}/rest/v1/players?on_conflict=player_id`, {
        ...opts, body: JSON.stringify(baseRow),
      })
      return r2.ok
    } catch (err) {
      console.error('Errore upsert player:', err)
      return false
    }
  }

  // ─── Recupera top 50 classifica ──────────────────────────────────────────

  async getRanking(limit = 50): Promise<RankingEntry[]> {
    this.lastRankingError = null
    if (!this.isConfigured()) {
      this.lastRankingError = 'not_configured'
      return []
    }
    try {
      const response = await this.fetchWithTimeout(
        `${this.url}/rest/v1/players?select=*&privacy=in.(public,anonymous)&order=exp_total.desc&limit=${limit}`,
        { headers: this.headers() }
      )
      if (!response.ok) {
        this.lastRankingError = `http_${response.status}`
        return []
      }

      const rows = (await response.json()) as SupabasePlayerRow[]
      return rows.map(r => ({
        playerId: r.player_id,
        name: r.name,
        level: r.level,
        rank: r.rank,
        expTotal: r.exp_total,
        questsCompleted: r.quests_completed,
      }))
    } catch (err) {
      this.lastRankingError = 'network_err'
      console.error('Errore fetch ranking:', err)
      return []
    }
  }

  // ─── Posizione player in classifica ──────────────────────────────────────

  async getPlayerRank(playerId: string): Promise<number | null> {
    try {
      const ranking = await this.getRanking(500)
      const idx = ranking.findIndex(r => r.playerId === playerId)
      return idx >= 0 ? idx + 1 : null
    } catch {
      return null
    }
  }
}
