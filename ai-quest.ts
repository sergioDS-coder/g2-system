// ai-quest.ts - Genera quest jolly via Netlify Function (Gemini server-side)

import type { Attribute } from './game-engine'
import type { DailyQuest } from './quest-data'

const FUNCTION_URL = 'https://g2-system.netlify.app/.netlify/functions/generate-quest'

export async function generateJollyQuest(
  level: number,
  language: string
): Promise<DailyQuest | null> {
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, language }),
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
