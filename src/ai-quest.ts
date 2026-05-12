// ai-quest.ts - Genera quest via Netlify Function (Gemini server-side)

import type { Attribute } from './game-engine'
import type { DailyQuest } from './quest-data'

const FUNCTION_URL = 'https://g2-system.netlify.app/.netlify/functions/generate-quest'

interface AIQuestData {
  name: string
  attribute: Attribute
  amount: number
  unit: string
  type?: string
}

function buildDailyQuest(data: AIQuestData, level: number, dateStr: string, idx: number): DailyQuest {
  return {
    id: `${dateStr}_ai_${idx}_${Date.now()}`,
    templateId: 'ai_daily',
    type: (data.type === 'mental' ? 'mental' : 'fitness') as DailyQuest['type'],
    nameKey: 'reward',
    attribute: data.attribute,
    unit: data.unit ?? 'count',
    amount: data.amount ?? 1,
    expReward: Math.round((100 + level * 15) * (data.amount / 10)),
    completed: false,
    date: dateStr,
    jollyName: data.name,
  }
}

// Genera tutte le quest giornaliere via Gemini
export async function generateDailyQuestsAI(
  level: number,
  language: string,
  count: number
): Promise<DailyQuest[] | null> {
  console.log('[AI] Generating daily quests...')
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, language, count, mode: 'daily' }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    if (!response.ok) {
      console.error('[AI] Netlify function returned error:', response.status)
      return null
    }

    const data = await response.json()
    if (!data.quests || !Array.isArray(data.quests)) return null

    const dateStr = new Date().toISOString().slice(0, 10)
    return data.quests
      .slice(0, count)
      .map((q: AIQuestData, i: number) => buildDailyQuest(q, level, dateStr, i))
  } catch (err) {
    console.error('Errore generazione quest AI:', err)
    return null
  }
}

// Genera singola quest jolly
export async function generateJollyQuest(
  level: number,
  language: string
): Promise<DailyQuest | null> {
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, language, mode: 'jolly' }),
    })

    if (!response.ok) return null

    const data = await response.json()
    if (!data.name || !data.attribute) return null

    const dateStr = new Date().toISOString().slice(0, 10)
    return {
      id: `${dateStr}_jolly_${Date.now()}`,
      templateId: 'jolly',
      type: 'jolly',
      nameKey: 'reward',
      attribute: data.attribute as Attribute,
      unit: data.unit ?? 'count',
      amount: data.amount ?? 1,
      expReward: 200 + level * 10,
      completed: false,
      date: dateStr,
      jollyName: data.name,
    }
  } catch (err) {
    console.error('Errore quest jolly:', err)
    return null
  }
}
