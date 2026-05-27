import type { ClassType, Attribute } from './game-engine'

export type ArtifactId =
  | 'gauntlets_warrior'   // Combattente exclusive
  | 'shadow_cloak'        // Assassino exclusive
  | 'ancient_tome'        // Mago exclusive
  | 'iron_shield'         // Carro Armato exclusive
  | 'dual_scope'          // Ranger exclusive
  | 'elixir_flask'        // Guaritore exclusive
  | 'exp_crystal'         // Any class
  | 'endurance_ring'      // Any class
  | 'focus_stone'         // Any class

export interface Artifact {
  id: ArtifactId
  requiredClass: ClassType | null
  expBonus: Partial<Record<Attribute | 'all', number>>  // fraction, e.g. 0.15 = +15%
  penaltyReduction: number  // fraction 0-1
}

export const ARTIFACT_CATALOG: Artifact[] = [
  { id: 'gauntlets_warrior', requiredClass: 'combattente',  expBonus: { str: 0.15 },            penaltyReduction: 0 },
  { id: 'shadow_cloak',      requiredClass: 'assassino',    expBonus: { agi: 0.15 },            penaltyReduction: 0 },
  { id: 'ancient_tome',      requiredClass: 'mago',         expBonus: { int: 0.15 },            penaltyReduction: 0 },
  { id: 'iron_shield',       requiredClass: 'carro_armato', expBonus: {},                       penaltyReduction: 0.20 },
  { id: 'dual_scope',        requiredClass: 'ranger',       expBonus: { agi: 0.10, int: 0.10 }, penaltyReduction: 0 },
  { id: 'elixir_flask',      requiredClass: 'guaritore',    expBonus: { vit: 0.15 },            penaltyReduction: 0 },
  { id: 'exp_crystal',       requiredClass: null,           expBonus: { all: 0.05 },            penaltyReduction: 0 },
  { id: 'endurance_ring',    requiredClass: null,           expBonus: { end: 0.10 },            penaltyReduction: 0 },
  { id: 'focus_stone',       requiredClass: null,           expBonus: {},                       penaltyReduction: 0.10 },
]

export function getArtifact(id: string): Artifact | undefined {
  return ARTIFACT_CATALOG.find(a => a.id === id)
}

export function getEligibleArtifacts(playerClass: ClassType | null): Artifact[] {
  return ARTIFACT_CATALOG.filter(a => a.requiredClass === null || a.requiredClass === playerClass)
}

export function rollArtifactReward(playerClass: ClassType | null, owned: string[]): ArtifactId | null {
  const eligible = getEligibleArtifacts(playerClass).filter(a => !owned.includes(a.id))
  if (eligible.length === 0) return null
  return eligible[Math.floor(Math.random() * eligible.length)].id
}

export function calcExpMultiplier(artifactIds: string[], attribute: Attribute): number {
  let bonus = 0
  for (const id of artifactIds) {
    const a = getArtifact(id)
    if (!a) continue
    bonus += a.expBonus[attribute] ?? a.expBonus['all'] ?? 0
  }
  return 1 + bonus
}

export function calcPenaltyReduction(artifactIds: string[]): number {
  return artifactIds.reduce((sum, id) => sum + (getArtifact(id)?.penaltyReduction ?? 0), 0)
}
