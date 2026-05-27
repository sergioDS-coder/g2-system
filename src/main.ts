// main.ts — G2 System v2.0.0

import {
  waitForEvenAppBridge,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

import {
  type PlayerProfile, type Rank, type AbilityState,
  addExp, subtractExp, applyPenalty, incrementQuestCount,
  createDefaultPlayer, getQuestsPerDay,
  isWeeklySkipAvailable,
} from './game-engine'

import { rollArtifactReward, calcExpMultiplier, calcPenaltyReduction, type ArtifactId } from './artifact-data'
import { type DailyQuest, generateDailyQuests } from './quest-data'
import { generateDailyQuestsAI, generateJollyQuest } from './ai-quest'
import { SupabaseClient, type RankingEntry } from './supabase-client'
import { G2Display } from './g2-display'
import { initBridgeStorage } from './bridge-storage'
import {
  loadPlayer, savePlayer, loadQuests, saveQuests,
  isSetupComplete, saveSetupComplete, generatePlayerId,
} from './storage'
import type { Lang } from './i18n'

// ─── Normalize player (migration for existing players without new fields) ────

function normalizePlayer(p: PlayerProfile): PlayerProfile {
  return {
    ...p,
    playerClass: p.playerClass ?? null,
    artifacts: p.artifacts ?? [],
    abilityState: p.abilityState ?? {
      strQuestStreak: 0,
      intQuestStreak: 0,
      weeklySkipUsed: '',
      pendingRecovery: 0,
      adaptationDate: '',
      dailyAttrsCompleted: [],
    } satisfies AbilityState,
  }
}

// ─── Stato globale ────────────────────────────────────────────────────────────

type Screen =
  | 'boot' | 'setup' | 'nameInput' | 'dailyMessage' | 'allDone'
  | 'warning' | 'questList' | 'questDetail'
  | 'levelUp' | 'rankUp' | 'profile' | 'ranking' | 'error'
  | 'artifactReward'

let currentScreen: Screen = 'boot'
let display: G2Display
let bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>
let supabase: SupabaseClient

let player: PlayerProfile | null = null
let quests: DailyQuest[] = []
let ranking: RankingEntry[] = []
let rankingPage = 0
let myRankPos: number | null = null

let questIdx   = 0
let profileIdx = 0
let detailIdx  = 0
let rankingIdx = 0
let allDoneIdx = 0
let msgIdx     = 0
let levelIdx   = 0
let rankUpIdx  = 0
let warningIdx = 0

let pendingLevelUp: { oldLevel: number } | null = null
let pendingRankUp: { oldRank: Rank } | null = null
let warningExpLost = 0

let pendingArtifact: ArtifactId | null = null
let artifactIdx = 0

// ─── Inserimento nome, lingua e privacy ───────────────────────────────────────

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-'
const LANGS: Lang[] = ['en', 'de', 'fr', 'es', 'it', 'zh', 'ja', 'ko']
const PRIVACY_OPTIONS = ['public', 'anonymous', 'private']
type InputStep = 'name' | 'lang' | 'privacy'

let nameBuffer = ''
let charIdx = 0
let inputStep: InputStep = 'name'
let selectedLang: Lang = 'en'
let selectedPrivacy = 'anonymous'
let isChangingName = false

function currentChar(): string {
  if (inputStep === 'lang') return LANGS[charIdx % LANGS.length]
  if (inputStep === 'privacy') return PRIVACY_OPTIONS[charIdx % PRIVACY_OPTIONS.length]
  if (charIdx < CHARSET.length) return CHARSET[charIdx]
  if (charIdx === CHARSET.length) return 'LANG'
  if (charIdx === CHARSET.length + 1) return 'PRIV'
  if (charIdx === CHARSET.length + 2) return 'OK'
  return 'ESC'
}

function charsetLen(): number {
  if (inputStep === 'lang') return LANGS.length
  if (inputStep === 'privacy') return PRIVACY_OPTIONS.length
  return CHARSET.length + 4
}

// ─── Avvio ────────────────────────────────────────────────────────────────────

async function main() {
  bridge = await waitForEvenAppBridge()
  initBridgeStorage(bridge as any)
  display = new G2Display(bridge)
  await display.initPage()

  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supaKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  supabase = new SupabaseClient(supaUrl, supaKey)

  await initialize()
  setupEventListener()
}

async function initialize() {
  const setupDone = await isSetupComplete()
  const savedPlayer = await loadPlayer()

  if (!setupDone || !savedPlayer || !savedPlayer.name || savedPlayer.name === 'Player') {
    const netlifyPlayer = readNetlifyPlayer()
    if (netlifyPlayer?.name && netlifyPlayer.name !== 'Player') {
      const normalized = normalizePlayer(netlifyPlayer)
      await savePlayer(normalized)
      await saveSetupComplete()
      player = normalized
    } else {
      nameBuffer = ''; charIdx = 0; inputStep = 'name'; isChangingName = false
      currentScreen = 'nameInput'
      await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep))
      return
    }
  } else {
    player = normalizePlayer(savedPlayer)
  }

  display.setLang(player.language as Lang)
  quests = await loadQuests()
  const today = new Date().toISOString().slice(0, 10)

  // ─── Apply Guaritore pending recovery at start of new day ────────────────
  if (player.lastDailyDate !== today && player.abilityState.pendingRecovery > 0) {
    const recovery = player.abilityState.pendingRecovery
    player.expTotal += recovery
    player.expCurrent += recovery
    player.abilityState.pendingRecovery = 0
    await savePlayer(player)
  }

  // ─── Reset Ranger daily tracking for new day ──────────────────────────────
  if (player.lastDailyDate !== today) {
    player.abilityState.dailyAttrsCompleted = []
    player.abilityState.adaptationDate = today
  }

  if (player.lastDailyDate !== today) {
    const missed = quests.filter(q => !q.completed && q.date === player!.lastDailyDate)
    if (missed.length > 0 && player.lastDailyDate) {
      const rawLost = missed.reduce((s, q) => s + Math.floor(q.expReward * 0.5), 0)

      // ─── Assassino weekly skip ─────────────────────────────────────────────
      if (player.playerClass === 'assassino' && isWeeklySkipAvailable(player.abilityState.weeklySkipUsed)) {
        // Skip penalty entirely
        player.abilityState.weeklySkipUsed = today
        warningExpLost = 0
        await savePlayer(player)
        // Still show warning but with 0 loss
        warningIdx = 0; currentScreen = 'warning'
        await display.update(display.buildWarningScreen(0, warningIdx))
        return
      }

      // ─── Calculate penalty with reductions ────────────────────────────────
      const artifactReduction = calcPenaltyReduction(player.artifacts)
      const classReduction = player.playerClass === 'carro_armato' ? 0.20 : 0
      const totalReduction = Math.min(0.90, artifactReduction + classReduction)
      const actualLost = Math.round(rawLost * (1 - totalReduction))

      player = applyPenalty(player, actualLost)
      warningExpLost = actualLost

      // ─── Guaritore: 10% of penalty queued for next morning recovery ───────
      if (player.playerClass === 'guaritore') {
        player.abilityState.pendingRecovery += Math.round(actualLost * 0.10)
      }

      await savePlayer(player)
      warningIdx = 0; currentScreen = 'warning'
      await display.update(display.buildWarningScreen(warningExpLost, warningIdx))
      return
    }

    const count = getQuestsPerDay(player.level)
    const aiQuests = await generateDailyQuestsAI(player.level, player.language, count)
    quests = aiQuests ?? generateDailyQuests(player.level, count, today)

    if (Math.random() < 0.1) {
      const jolly = await generateJollyQuest(player.level, player.language)
      if (jolly) quests.push(jolly)
    }

    await saveQuests(quests)
    player.lastDailyDate = today
    await savePlayer(player)
    await supabase.upsertPlayer(player)
    msgIdx = 0; currentScreen = 'dailyMessage'
    await display.showDailyMessage(player.rank, player.level, msgIdx)
  } else {
    const allDone = quests.length > 0 && quests.every(q => q.completed)
    if (allDone) {
      allDoneIdx = 0; currentScreen = 'allDone'
      await display.update(display.buildAllDoneScreen(allDoneIdx))
    } else {
      await goToQuestList()
    }
  }
}

function readNetlifyPlayer(): PlayerProfile | null {
  try {
    const raw = window.localStorage.getItem('g2sys_player')
    return raw ? JSON.parse(raw) as PlayerProfile : null
  } catch { return null }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function confirmSetup() {
  const name = nameBuffer.trim()
  if (!name) return

  if (isChangingName && player) {
    player.name = name
    player.language = selectedLang
    player.privacy = selectedPrivacy as import('./game-engine').Privacy
    await savePlayer(player)
    display.setLang(selectedLang)
    await supabase.upsertPlayer(player)
    isChangingName = false
    await goToProfile()
  } else {
    player = createDefaultPlayer(generatePlayerId(), name, selectedLang)
    player.privacy = selectedPrivacy as import('./game-engine').Privacy
    await savePlayer(player)
    await saveSetupComplete()
    display.setLang(selectedLang)
    nameBuffer = ''; charIdx = 0; inputStep = 'name'; isChangingName = false
    await initialize()
  }
}

async function startChangeName() {
  isChangingName = true
  nameBuffer = ''; charIdx = 0; inputStep = 'name'
  selectedLang = (player?.language as Lang) ?? 'en'
  selectedPrivacy = player?.privacy ?? 'anonymous'
  currentScreen = 'nameInput'
  await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep))
}

// ─── Navigazione ─────────────────────────────────────────────────────────────

async function goToQuestList() {
  currentScreen = 'questList'; questIdx = 0
  await display.update(display.buildQuestList(quests, questIdx))
}

async function refreshQuestList() {
  await display.update(display.buildQuestList(quests, questIdx))
}

async function goToProfile() {
  currentScreen = 'profile'; profileIdx = 0
  myRankPos = await supabase.getPlayerRank(player!.playerId)
  await display.showProfile(player!, myRankPos, profileIdx)
}

async function goToRanking() {
  currentScreen = 'ranking'; rankingPage = 0; rankingIdx = 0
  ranking = await supabase.getRanking(50)
  await display.update(display.buildRanking(ranking, rankingPage, rankingIdx, supabase.lastRankingError))
}

// ─── Quest ────────────────────────────────────────────────────────────────────

async function completeQuest() {
  const q = quests[questIdx]
  if (q.completed) return

  q.completed = true
  await saveQuests(quests)

  // Calculate EXP multiplier from artifacts
  const expMultiplier = calcExpMultiplier(player!.artifacts, q.attribute)

  const result = addExp(player!, q.expReward, q.attribute, expMultiplier)
  player = incrementQuestCount(result.player)

  // ─── Ranger Adattamento bonus ─────────────────────────────────────────────
  if (player.playerClass === 'ranger') {
    const today = new Date().toISOString().slice(0, 10)
    if (player.abilityState.adaptationDate !== today) {
      player.abilityState.adaptationDate = today
      player.abilityState.dailyAttrsCompleted = []
    }
    if (!player.abilityState.dailyAttrsCompleted.includes(q.attribute)) {
      player.abilityState.dailyAttrsCompleted.push(q.attribute)
      if (player.abilityState.dailyAttrsCompleted.length === 3) {
        // Exactly 3 unique attrs: bonus 100 EXP
        player.expTotal += 100
        player.expCurrent += 100
      }
    }
  }

  await savePlayer(player)
  await supabase.upsertPlayer(player)

  // ─── Jolly quest: roll artifact reward ───────────────────────────────────
  if (q.type === 'jolly') {
    const rolled = rollArtifactReward(player.playerClass, player.artifacts)
    if (rolled) {
      pendingArtifact = rolled
      pendingLevelUp = result.leveledUp ? { oldLevel: result.oldLevel } : pendingLevelUp
      pendingRankUp = result.rankedUp ? { oldRank: result.oldRank } : pendingRankUp
      artifactIdx = 0; currentScreen = 'artifactReward'
      await display.update(display.buildArtifactReward(rolled))
      return
    }
  }

  const allDone = quests.every(q => q.completed)
  if (result.rankedUp) {
    rankUpIdx = 0; currentScreen = 'rankUp'
    pendingRankUp = { oldRank: result.oldRank }
    await display.update(display.buildRankUp(player, result.oldRank, rankUpIdx))
  } else if (result.leveledUp) {
    levelIdx = 0; currentScreen = 'levelUp'
    pendingLevelUp = { oldLevel: result.oldLevel }
    await display.update(display.buildLevelUp(player, result.oldLevel, levelIdx))
  } else if (allDone) {
    allDoneIdx = 0; currentScreen = 'allDone'
    await display.update(display.buildAllDoneScreen(allDoneIdx))
  } else {
    await goToQuestList()
  }
}

async function undoQuest() {
  const q = quests[questIdx]
  if (!q.completed) return

  q.completed = false
  await saveQuests(quests)

  if (player) {
    player = subtractExp(player, q.expReward, q.attribute)
    player.questsCompleted = Math.max(0, player.questsCompleted - 1)
    await savePlayer(player)
    await supabase.upsertPlayer(player)
  }

  detailIdx = 0
  await display.showQuestDetail(quests[questIdx], detailIdx)
}

// ─── Gestione eventi ──────────────────────────────────────────────────────────

function setupEventListener() {
  bridge.onEvenHubEvent(async (event) => {
    const textEvent = event.textEvent
    const sysEvent = (event as any).sysEvent
    const activeEvent = textEvent ?? sysEvent
    if (!activeEvent) return

    if ([
      OsEventTypeList.FOREGROUND_ENTER_EVENT,
      OsEventTypeList.FOREGROUND_EXIT_EVENT,
      OsEventTypeList.ABNORMAL_EXIT_EVENT,
    ].includes(activeEvent.eventType)) return

    switch (activeEvent.eventType) {
      case OsEventTypeList.CLICK_EVENT:
      case undefined:
      case 0:
        await handlePress(); break
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        await handleDoublePress(); break
      case OsEventTypeList.SCROLL_TOP_EVENT:
        await handleSwipeUp(); break
      case OsEventTypeList.SCROLL_BOTTOM_EVENT:
        await handleSwipeDown(); break
    }
  })
}

// ─── Handlers Click ───────────────────────────────────────────────────────────

async function handlePress() {
  const handlers: Record<Screen, () => Promise<void>> = {
    boot: async () => {},
    setup: async () => { await initialize() },
    nameInput: handleNameInputPress,
    dailyMessage: async () => { if (msgIdx === 1) await bridge.shutDownPageContainer(0); else await goToQuestList() },
    warning: async () => { if (warningIdx === 1) await bridge.shutDownPageContainer(0); else await goToQuestList() },
    allDone: async () => { if (allDoneIdx === 1) await goToQuestList(); else await goToProfile() },
    questList: handleQuestListPress,
    questDetail: handleQuestDetailPress,
    levelUp: handleLevelUpPress,
    rankUp: async () => { if (rankUpIdx === 1) await bridge.shutDownPageContainer(0); else { pendingRankUp = null; await goToQuestList() } },
    profile: handleProfilePress,
    ranking: async () => { if (rankingIdx === 4) await goToProfile() },
    error: async () => { await initialize() },
    artifactReward: handleArtifactRewardPress,
  }

  const handler = handlers[currentScreen]
  if (handler) await handler()
}

async function handleNameInputPress() {
  if (inputStep === 'lang') {
    selectedLang = currentChar() as Lang; inputStep = 'name'; charIdx = 0
  } else if (inputStep === 'privacy') {
    selectedPrivacy = currentChar(); inputStep = 'name'; charIdx = 0
  } else if (currentChar() === 'LANG') {
    inputStep = 'lang'; charIdx = LANGS.indexOf(selectedLang)
  } else if (currentChar() === 'PRIV') {
    inputStep = 'privacy'; charIdx = PRIVACY_OPTIONS.indexOf(selectedPrivacy)
  } else if (currentChar() === 'OK' && nameBuffer.trim().length > 0) {
    await confirmSetup(); return
  } else if (currentChar() === 'ESC') {
    if (isChangingName) { isChangingName = false; await goToProfile() }
    else { currentScreen = 'setup'; await display.update(display.buildSetupScreen()) }
    return
  } else if (nameBuffer.length < 15 && !['OK','ESC','LANG','PRIV'].includes(currentChar())) {
    nameBuffer += currentChar()
  }
  await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep))
}

async function handleQuestListPress() {
  if (questIdx === quests.length + 1) {
    await bridge.shutDownPageContainer(1)
  } else if (questIdx === quests.length) {
    await goToProfile()
  } else {
    detailIdx = 0; currentScreen = 'questDetail'
    await display.showQuestDetail(quests[questIdx], detailIdx)
  }
}

async function handleQuestDetailPress() {
  const q = quests[questIdx]
  if (q.completed) {
    if (detailIdx === 1) await undoQuest(); else await goToQuestList()
  } else {
    if (detailIdx === 0) await completeQuest(); else await goToQuestList()
  }
}

async function refreshQuestDetail() {
  await display.showQuestDetail(quests[questIdx], detailIdx)
}

async function handleLevelUpPress() {
  if (levelIdx === 1) { await bridge.shutDownPageContainer(0) }
  else {
    pendingLevelUp = null
    if (pendingRankUp) {
      const r = pendingRankUp.oldRank; pendingRankUp = null
      rankUpIdx = 0; currentScreen = 'rankUp'
      await display.update(display.buildRankUp(player!, r, rankUpIdx))
    } else {
      await goToQuestList()
    }
  }
}

async function handleProfilePress() {
  if (profileIdx === 1) await startChangeName()
  else if (profileIdx === 2) await goToQuestList()
  else await goToRanking()
}

async function handleArtifactRewardPress() {
  if (!pendingArtifact || !player) {
    await goToQuestList()
    return
  }

  // Confirm artifact: add to player
  player.artifacts.push(pendingArtifact)
  await savePlayer(player)
  await supabase.upsertPlayer(player)
  pendingArtifact = null

  const allDone = quests.every(q => q.completed)

  if (pendingRankUp) {
    const r = pendingRankUp.oldRank; pendingRankUp = null
    rankUpIdx = 0; currentScreen = 'rankUp'
    await display.update(display.buildRankUp(player, r, rankUpIdx))
  } else if (pendingLevelUp) {
    const lvl = pendingLevelUp.oldLevel; pendingLevelUp = null
    levelIdx = 0; currentScreen = 'levelUp'
    await display.update(display.buildLevelUp(player, lvl, levelIdx))
  } else if (allDone) {
    allDoneIdx = 0; currentScreen = 'allDone'
    await display.update(display.buildAllDoneScreen(allDoneIdx))
  } else {
    await goToQuestList()
  }
}

// ─── Handlers Swipe ───────────────────────────────────────────────────────────

async function handleSwipeUp() {
  switch (currentScreen) {
    case 'nameInput':
      charIdx = (charIdx - 1 + charsetLen()) % charsetLen()
      await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep))
      break
    case 'dailyMessage':
      msgIdx = Math.max(0, msgIdx - 1); await display.showDailyMessage(player!.rank, player!.level, msgIdx); break
    case 'warning':
      warningIdx = Math.max(0, warningIdx - 1); await display.update(display.buildWarningScreen(warningExpLost, warningIdx)); break
    case 'allDone':
      allDoneIdx = Math.max(0, allDoneIdx - 1); await display.update(display.buildAllDoneScreen(allDoneIdx)); break
    case 'questList':
      if (questIdx > 0) { questIdx--; await refreshQuestList() } break
    case 'questDetail':
      if (detailIdx > 0) { detailIdx--; await display.showQuestDetail(quests[questIdx], detailIdx) } break
    case 'levelUp':
      levelIdx = Math.max(0, levelIdx - 1); await display.update(display.buildLevelUp(player!, pendingLevelUp?.oldLevel ?? player!.level - 1, levelIdx)); break
    case 'rankUp':
      rankUpIdx = Math.max(0, rankUpIdx - 1); await display.update(display.buildRankUp(player!, pendingRankUp?.oldRank ?? player!.rank as Rank, rankUpIdx)); break
    case 'profile':
      if (profileIdx > 0) { profileIdx--; await display.showProfile(player!, myRankPos, profileIdx) } break
    case 'ranking':
      if (rankingIdx > 0) {
        rankingIdx--; await display.update(display.buildRanking(ranking, rankingPage, rankingIdx))
      } else if (rankingPage > 0) {
        rankingPage--; rankingIdx = 4; await display.update(display.buildRanking(ranking, rankingPage, rankingIdx))
      }
      break
  }
}

async function handleSwipeDown() {
  switch (currentScreen) {
    case 'nameInput':
      charIdx = (charIdx + 1) % charsetLen()
      await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep))
      break
    case 'dailyMessage':
      msgIdx = Math.min(1, msgIdx + 1); await display.showDailyMessage(player!.rank, player!.level, msgIdx); break
    case 'warning':
      warningIdx = Math.min(1, warningIdx + 1); await display.update(display.buildWarningScreen(warningExpLost, warningIdx)); break
    case 'allDone':
      allDoneIdx = Math.min(1, allDoneIdx + 1); await display.update(display.buildAllDoneScreen(allDoneIdx)); break
    case 'questList':
      if (questIdx < quests.length + 1) { questIdx++; await refreshQuestList() } break
    case 'questDetail':
      if (detailIdx < 1) { detailIdx++; await display.showQuestDetail(quests[questIdx], detailIdx) } break
    case 'levelUp':
      levelIdx = Math.min(1, levelIdx + 1); await display.update(display.buildLevelUp(player!, pendingLevelUp?.oldLevel ?? player!.level - 1, levelIdx)); break
    case 'rankUp':
      rankUpIdx = Math.min(1, rankUpIdx + 1); await display.update(display.buildRankUp(player!, pendingRankUp?.oldRank ?? player!.rank as Rank, rankUpIdx)); break
    case 'profile':
      if (profileIdx < 3) { profileIdx++; await display.showProfile(player!, myRankPos, profileIdx) } break
    case 'ranking': {
      const itemsPerPage = 4
      const totalPages = Math.ceil(ranking.length / itemsPerPage)
      if (rankingIdx < itemsPerPage) {
        rankingIdx++; await display.update(display.buildRanking(ranking, rankingPage, rankingIdx))
      } else if (rankingPage < totalPages - 1) {
        rankingPage++; rankingIdx = 0; await display.update(display.buildRanking(ranking, rankingPage, rankingIdx))
      }
      break
    }
  }
}

async function handleDoublePress() {
  await bridge.shutDownPageContainer(1)
}

main().catch(async (err) => {
  console.error('Errore fatale:', err)
  const msg = err instanceof Error ? err.message.slice(0, 26) : 'Errore di avvio'
  try { await display?.update(display.buildError(msg)) }
  catch {}
})
