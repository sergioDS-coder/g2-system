// quest-data.ts - Database quest predefinite + generazione giornaliera

import type { Attribute, Rank } from './game-engine'

export interface QuestTemplate {
  id: string
  type: 'fitness' | 'mental' | 'fixed' | 'jolly'
  nameKey: keyof import('./i18n').Translations  // chiave traduzione
  attribute: Attribute
  unit: string  // 'km', 'reps', 'min', 'pages', 'h'
  expBase: number  // EXP per la versione base
  variants: number[]  // valori possibili (es. 10, 20, 30 flessioni)
  icon: string
}

// Quest fisse sempre presenti
export const FIXED_QUESTS: QuestTemplate[] = [
  {
    id: 'fixed_camminata',
    type: 'fixed',
    nameKey: 'questCamminata',
    attribute: 'agi',
    unit: 'steps',
    expBase: 50,
    variants: [5000],
    icon: 'walking',
  },
  {
    id: 'fixed_sonno',
    type: 'fixed',
    nameKey: 'questSonno',
    attribute: 'vit',
    unit: 'h',
    expBase: 80,
    variants: [7],
    icon: 'sleep',
  },
]

// Quest fitness random
export const FITNESS_QUESTS: QuestTemplate[] = [
  {
    id: 'corsa',
    type: 'fitness',
    nameKey: 'questCorsa',
    attribute: 'agi',
    unit: 'km',
    expBase: 100,
    variants: [1, 2, 3, 5],
    icon: 'run',
  },
  {
    id: 'flessioni',
    type: 'fitness',
    nameKey: 'questFlessioni',
    attribute: 'str',
    unit: 'reps',
    expBase: 50,
    variants: [10, 20, 30, 50],
    icon: 'pushup',
  },
  {
    id: 'addominali',
    type: 'fitness',
    nameKey: 'questAddominali',
    attribute: 'str',
    unit: 'reps',
    expBase: 50,
    variants: [15, 30, 50],
    icon: 'pushup',
  },
  {
    id: 'plank',
    type: 'fitness',
    nameKey: 'questPlank',
    attribute: 'end',
    unit: 'min',
    expBase: 60,
    variants: [1, 2, 3],
    icon: 'pushup',
  },
  {
    id: 'yoga',
    type: 'fitness',
    nameKey: 'questYoga',
    attribute: 'vit',
    unit: 'min',
    expBase: 80,
    variants: [10, 20, 30],
    icon: 'meditate',
  },
  {
    id: 'scale',
    type: 'fitness',
    nameKey: 'questScale',
    attribute: 'end',
    unit: 'floors',
    expBase: 70,
    variants: [5, 10, 20],
    icon: 'run',
  },
]

// Quest mentali
export const MENTAL_QUESTS: QuestTemplate[] = [
  {
    id: 'meditazione',
    type: 'mental',
    nameKey: 'questMeditazione',
    attribute: 'vit',
    unit: 'min',
    expBase: 100,
    variants: [10, 15, 20, 30],
    icon: 'meditate',
  },
  {
    id: 'lettura',
    type: 'mental',
    nameKey: 'questLettura',
    attribute: 'int',
    unit: 'pages',
    expBase: 80,
    variants: [10, 20, 30, 50],
    icon: 'book',
  },
  {
    id: 'studio',
    type: 'mental',
    nameKey: 'questStudio',
    attribute: 'int',
    unit: 'min',
    expBase: 100,
    variants: [30, 60, 90],
    icon: 'book',
  },
  {
    id: 'scrittura',
    type: 'mental',
    nameKey: 'questScrittura',
    attribute: 'int',
    unit: 'min',
    expBase: 70,
    variants: [15, 30],
    icon: 'book',
  },
  {
    id: 'noscreen',
    type: 'mental',
    nameKey: 'questNoScreen',
    attribute: 'vit',
    unit: 'h',
    expBase: 90,
    variants: [1, 2],
    icon: 'meditate',
  },
]

// ─── Generata Quest concreta da template ─────────────────────────────────────

export interface DailyQuest {
  id: string  // unico per la giornata
  templateId: string
  type: QuestTemplate['type']
  nameKey: keyof import('./i18n').Translations
  attribute: Attribute
  unit: string
  amount: number
  expReward: number
  completed: boolean
  date: string  // YYYY-MM-DD
  jollyName?: string
  icon: string
}

// ─── Jolly locali (fallback quando l'API Gemini non risponde) ────────────────
// Quest "sorpresa" creative usate solo se generateJollyQuest() torna null.
// Garantiscono che la Jolly compaia anche offline / con la function lenta.
interface JollyFallback {
  name: string
  attribute: Attribute
  amount: number
  unit: string
  icon: string
}

const JOLLY_FALLBACK: JollyFallback[] = [
  { name: 'Cold shower',   attribute: 'vit', amount: 1,   unit: 'min',   icon: 'meditate' },
  { name: 'Write 3 goals', attribute: 'int', amount: 3,   unit: 'goals', icon: 'book' },
  { name: 'No sugar today',attribute: 'vit', amount: 1,   unit: 'day',   icon: 'meditate' },
  { name: '100 jumps',     attribute: 'str', amount: 100, unit: 'reps',  icon: 'pushup' },
  { name: 'Learn 5 words', attribute: 'int', amount: 5,   unit: 'words', icon: 'book' },
]

export function generateLocalJolly(level: number): DailyQuest {
  const pick = JOLLY_FALLBACK[Math.floor(Math.random() * JOLLY_FALLBACK.length)]
  const dateStr = new Date().toISOString().slice(0, 10)
  return {
    id: `${dateStr}_jolly_${Date.now()}`,
    templateId: 'jolly',
    type: 'jolly',
    nameKey: 'reward',
    attribute: pick.attribute,
    unit: pick.unit,
    amount: pick.amount,
    expReward: 200 + level * 10,
    completed: false,
    date: dateStr,
    jollyName: pick.name,
    icon: pick.icon,
  }
}

function pickVariantForLevel(template: QuestTemplate, level: number): number {
  const totalVariants = template.variants.length
  // Più livello → variante più alta
  const idx = Math.min(totalVariants - 1, Math.floor(level / 20))
  return template.variants[idx]
}

function generateQuestFromTemplate(t: QuestTemplate, level: number, dateStr: string, idx: number): DailyQuest {
  const amount = pickVariantForLevel(t, level)
  const expMultiplier = (amount / t.variants[0])  // più valore = più EXP
  return {
    id: `${dateStr}_${idx}_${t.id}`,
    templateId: t.id,
    type: t.type,
    nameKey: t.nameKey,
    attribute: t.attribute,
    unit: t.unit,
    amount,
    expReward: Math.round(t.expBase * expMultiplier),
    completed: false,
    date: dateStr,
    icon: t.icon,
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Generazione lista quest giornaliera ─────────────────────────────────────

export function generateDailyQuests(level: number, count: number, dateStr: string): DailyQuest[] {
  const quests: DailyQuest[] = []
  let idx = 0

  // 1. Quest fisse sempre presenti
  for (const t of FIXED_QUESTS) {
    quests.push(generateQuestFromTemplate(t, level, dateStr, idx++))
  }

  // 2. Riempi il resto con mix fitness/mental
  const remaining = count - quests.length
  const fitnessShuffled = shuffle(FITNESS_QUESTS)
  const mentalShuffled = shuffle(MENTAL_QUESTS)
  const pool: QuestTemplate[] = []

  // Alternato: ~60% fitness, ~40% mentali
  const fitnessCount = Math.ceil(remaining * 0.6)
  const mentalCount = remaining - fitnessCount

  pool.push(...fitnessShuffled.slice(0, fitnessCount))
  pool.push(...mentalShuffled.slice(0, mentalCount))

  for (const t of shuffle(pool)) {
    quests.push(generateQuestFromTemplate(t, level, dateStr, idx++))
  }

  return quests.slice(0, count)
}
