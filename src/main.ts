// main.ts — G2 System v1.5.0

import {
  waitForEvenAppBridge,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

import {
  type PlayerProfile, type Rank,
  addExp, subtractExp, applyPenalty, incrementQuestCount,
  createDefaultPlayer, getQuestsPerDay,
} from './game-engine'

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

// ─── Stato globale ────────────────────────────────────────────────────────────

type Screen =
  | 'boot' | 'setup' | 'nameInput' | 'dailyMessage' | 'allDone'
  | 'warning' | 'questList' | 'questDetail'
  | 'levelUp' | 'rankUp' | 'profile' | 'ranking' | 'error'

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
  console.log('[Main] Starting app...')

  // Gestione errori globale
  window.addEventListener('error', (e) => {
    console.error('[Global Error]', e.error)
  })
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[Unhandled Rejection]', e.reason)
  })

  try {
    console.log('[Main] Waiting for bridge (with timeout)...')
    // Timeout di 4 secondi per il bridge
    try {
      bridge = await Promise.race([
        waitForEvenAppBridge(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Bridge timeout')), 4000))
      ])
      console.log('[Main] Bridge ready!')
    } catch (e) {
      console.error('[Main] Bridge initialization failed:', e)
      // Se il bridge fallisce, proviamo a procedere in "mock mode" per evitare freeze totale in certi simulatori
      // ma logghiamo pesantemente.
    }

    if (bridge) {
      initBridgeStorage(bridge as any)
      display = new G2Display(bridge)
    } else {
      console.error('[Main] Bridge not available after timeout.')
    }

    if (display) {
      console.log('[Main] Initializing page...')
      try {
        await display.initPage()
        console.log('[Main] Page initialized.')

        console.log('[Main] Updating initial image...')
        display.updateImage('sword').catch(e => console.error('[Main] Failed to set initial image', e))
      } catch (pageErr) {
        console.error('[Main] Failed to initialize page:', pageErr)
      }
    }

    const supaUrl = import.meta.env.VITE_SUPABASE_URL as string
    const supaKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

    if (!supaUrl || !supaKey) {
      console.warn('[Main] Supabase credentials missing. Global ranking will be disabled.')
    }
    supabase = new SupabaseClient(supaUrl || '', supaKey || '')

    console.log('[Main] Initializing game data...')
    await initialize()
    console.log('[Main] Game data initialized.')

    if (bridge) {
      setupEventListener()
    }
    console.log('[Main] App fully started.')
  } catch (err) {
    console.error('[Main] Fatal error during startup:', err)
    if (display) {
      await display.update(display.buildError('Avvio fallito'))
    }
  }
}

async function initialize() {
  console.log('[Init] Loading setup status and player data...')
  const setupDone = await isSetupComplete()
  const savedPlayer = await loadPlayer()
  console.log('[Init] Setup done:', setupDone, 'Player loaded:', !!savedPlayer)

  if (!setupDone || !savedPlayer || !savedPlayer.name || savedPlayer.name === 'Player') {
    console.log('[Init] Player setup required.')
    const netlifyPlayer = readNetlifyPlayer()
    if (netlifyPlayer?.name && netlifyPlayer.name !== 'Player') {
      await savePlayer(netlifyPlayer)
      await saveSetupComplete()
      player = netlifyPlayer
    } else {
      nameBuffer = ''; charIdx = 0; inputStep = 'name'; isChangingName = false
      currentScreen = 'nameInput'
      if (display) {
        await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep))
      }
      return
    }
  } else {
    player = savedPlayer
  }

  if (display) {
    display.setLang(player.language as Lang)
  }
  console.log('[Init] Loading quests...')
  quests = await loadQuests()
  const today = new Date().toISOString().slice(0, 10)

  console.log('[Init] Today is:', today, 'Last daily:', player.lastDailyDate)
  if (player.lastDailyDate !== today) {
    console.log('[Init] New day detected.')
    const missed = quests.filter(q => !q.completed && q.date === player!.lastDailyDate)
    if (missed.length > 0 && player.lastDailyDate) {
      const lost = missed.reduce((s, q) => s + Math.floor(q.expReward * 0.5), 0)
      player = applyPenalty(player, lost)
      warningExpLost = lost
      await savePlayer(player)
      warningIdx = 0; currentScreen = 'warning'
      await display.update(display.buildWarningScreen(warningExpLost, warningIdx))
      return
    }

    const count = getQuestsPerDay(player.level)
    console.log('[Init] Generating AI quests...')
    const aiQuests = await generateDailyQuestsAI(player.level, player.language, count)
    quests = aiQuests ?? generateDailyQuests(player.level, count, today)
    console.log('[Init] Quests ready:', quests.length)

    if (Math.random() < 0.1) {
      const jolly = await generateJollyQuest(player.level, player.language)
      if (jolly) quests.push(jolly)
    }

    await saveQuests(quests)
    player.lastDailyDate = today
    await savePlayer(player)
    await supabase.upsertPlayer(player)
    msgIdx = 0; currentScreen = 'dailyMessage'
    if (display) {
      await display.update(display.buildDailyMessage(msgIdx))
    }
  } else {
    const allDone = quests.length > 0 && quests.every(q => q.completed)
    if (allDone) {
      allDoneIdx = 0; currentScreen = 'allDone'
      if (display) {
        await display.update(display.buildAllDoneScreen(allDoneIdx))
      }
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
  await display.updateImage("sword")
  currentScreen = 'questList'; questIdx = 0
  await display.update(display.buildQuestList(quests, questIdx))
}

async function refreshQuestList() {
  await display.update(display.buildQuestList(quests, questIdx))
}

async function goToProfile() {
  await display.updateImage("player")
  currentScreen = 'profile'; profileIdx = 0
  myRankPos = await supabase.getPlayerRank(player!.playerId)
  await display.update(display.buildProfile(player!, myRankPos, profileIdx))
}

async function goToRanking() {
  await display.updateImage("trophy")
  currentScreen = 'ranking'; rankingPage = 0; rankingIdx = 0
  ranking = await supabase.getRanking(50)
  await display.update(display.buildRanking(ranking, rankingPage, rankingIdx))
}

// ─── Quest ────────────────────────────────────────────────────────────────────

async function completeQuest() {
  const q = quests[questIdx]
  if (q.completed) return

  q.completed = true
  await saveQuests(quests)

  const result = addExp(player!, q.expReward, q.attribute)
  player = incrementQuestCount(result.player)
  await savePlayer(player)
  await supabase.upsertPlayer(player)

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
  await display.update(display.buildQuestDetail(quests[questIdx], detailIdx))
}

// ─── Gestione eventi ──────────────────────────────────────────────────────────

function setupEventListener() {
  bridge.onEvenHubEvent(async (event) => {
    const textEvent = event.textEvent
    const sysEvent = event.sysEvent
    const activeEvent = textEvent ?? sysEvent
    if (!activeEvent || activeEvent.eventType === undefined) return

    if ([
      OsEventTypeList.FOREGROUND_ENTER_EVENT,
      OsEventTypeList.FOREGROUND_EXIT_EVENT,
      OsEventTypeList.ABNORMAL_EXIT_EVENT,
      OsEventTypeList.SYSTEM_EXIT_EVENT,
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
    error: async () => { await initialize() }
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
    await display.update(display.buildQuestDetail(quests[questIdx], detailIdx))
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

// ─── Handlers Swipe ───────────────────────────────────────────────────────────

async function handleSwipeUp() {
  switch (currentScreen) {
    case 'nameInput':
      charIdx = (charIdx - 1 + charsetLen()) % charsetLen()
      await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, selectedPrivacy, inputStep))
      break
    case 'dailyMessage':
      msgIdx = Math.max(0, msgIdx - 1); await display.update(display.buildDailyMessage(msgIdx)); break
    case 'warning':
      warningIdx = Math.max(0, warningIdx - 1); await display.update(display.buildWarningScreen(warningExpLost, warningIdx)); break
    case 'allDone':
      allDoneIdx = Math.max(0, allDoneIdx - 1); await display.update(display.buildAllDoneScreen(allDoneIdx)); break
    case 'questList':
      if (questIdx > 0) { questIdx--; await refreshQuestList() } break
    case 'questDetail':
      if (detailIdx > 0) { detailIdx--; await display.update(display.buildQuestDetail(quests[questIdx], detailIdx)) } break
    case 'levelUp':
      levelIdx = Math.max(0, levelIdx - 1); await display.update(display.buildLevelUp(player!, pendingLevelUp?.oldLevel ?? player!.level - 1, levelIdx)); break
    case 'rankUp':
      rankUpIdx = Math.max(0, rankUpIdx - 1); await display.update(display.buildRankUp(player!, pendingRankUp?.oldRank ?? player!.rank as Rank, rankUpIdx)); break
    case 'profile':
      if (profileIdx > 0) { profileIdx--; await display.update(display.buildProfile(player!, myRankPos, profileIdx)) } break
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
      msgIdx = Math.min(1, msgIdx + 1); await display.update(display.buildDailyMessage(msgIdx)); break
    case 'warning':
      warningIdx = Math.min(1, warningIdx + 1); await display.update(display.buildWarningScreen(warningExpLost, warningIdx)); break
    case 'allDone':
      allDoneIdx = Math.min(1, allDoneIdx + 1); await display.update(display.buildAllDoneScreen(allDoneIdx)); break
    case 'questList':
      if (questIdx < quests.length + 1) { questIdx++; await refreshQuestList() } break
    case 'questDetail':
      if (detailIdx < 1) { detailIdx++; await display.update(display.buildQuestDetail(quests[questIdx], detailIdx)) } break
    case 'levelUp':
      levelIdx = Math.min(1, levelIdx + 1); await display.update(display.buildLevelUp(player!, pendingLevelUp?.oldLevel ?? player!.level - 1, levelIdx)); break
    case 'rankUp':
      rankUpIdx = Math.min(1, rankUpIdx + 1); await display.update(display.buildRankUp(player!, pendingRankUp?.oldRank ?? player!.rank as Rank, rankUpIdx)); break
    case 'profile':
      if (profileIdx < 2) { profileIdx++; await display.update(display.buildProfile(player!, myRankPos, profileIdx)) } break
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
  if (currentScreen === 'questList') await bridge.shutDownPageContainer(1)
  else await bridge.shutDownPageContainer(0)
}

main().catch(async (err) => {
  console.error('[Main] Fatal error:', err)
  if (display) {
    try {
      currentScreen = 'error'
      await display.update(display.buildError('Avvio fallito: ' + (err instanceof Error ? err.message : 'Unknown')))
    } catch (dispErr) {
      console.error('[Main] Could not display error on glasses:', dispErr)
    }
  }
})
