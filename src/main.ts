// main.ts — G2 System v2.1.0

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
import { type DailyQuest, generateDailyQuests, generateLocalJolly } from './quest-data'
import { generateDailyQuestsAI, generateJollyQuest } from './ai-quest'
import { renderClassImage } from './artifact-image'
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
  | 'boot' | 'setup' | 'nameInput' | 'privacy' | 'dailyMessage' | 'allDone'
  | 'warning' | 'questList' | 'questDetail'
  | 'levelUp' | 'rankUp' | 'profile' | 'artifacts'
  | 'ranking' | 'rankingDetail' | 'error'
  | 'artifactReward' | 'exitConfirm'

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

let selectedRankingEntry: RankingEntry | null = null
let handlingInput = false
let pendingPress  = false
let isPaused      = false
let pauseTimer: ReturnType<typeof setTimeout> | null = null

let exitConfirmIdx  = 0
let preExitScreen: Screen = 'questList'

let pendingLevelUp: { oldLevel: number } | null = null
let pendingRankUp:  { oldRank: Rank }    | null = null
let warningExpLost  = 0

let pendingArtifact: ArtifactId | null = null

// ─── Inserimento nome, lingua e privacy ───────────────────────────────────────

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-'
const LANGS: Lang[] = ['en', 'de', 'fr', 'es', 'it', 'zh', 'ja', 'ko']
const PRIVACY_OPTIONS = ['public', 'anonymous', 'private']
type InputStep = 'name' | 'lang'

let nameBuffer = ''
let charIdx    = 0
let inputStep: InputStep = 'name'
let selectedLang: Lang   = 'en'
let selectedPrivacy      = 'public'
let privacyIdx           = 0
let isChangingName       = false

function currentChar(): string {
  if (inputStep === 'lang') return LANGS[charIdx % LANGS.length]
  if (charIdx < CHARSET.length)      return CHARSET[charIdx]
  if (charIdx === CHARSET.length)    return 'LANG'
  if (charIdx === CHARSET.length + 1) return 'OK'
  return 'ESC'
}

function charsetLen(): number {
  return inputStep === 'lang' ? LANGS.length : CHARSET.length + 3
}

// ─── Normalizzazione player (migrazione campi aggiunti dopo v1) ───────────────

function normalizePlayer(p: PlayerProfile): PlayerProfile {
  return {
    ...p,
    playerClass: p.playerClass ?? null,
    artifacts:   p.artifacts   ?? [],
    abilityState: p.abilityState ?? {
      strQuestStreak: 0, intQuestStreak: 0,
      weeklySkipUsed: '', pendingRecovery: 0,
      adaptationDate: '', dailyAttrsCompleted: [],
    } satisfies AbilityState,
  }
}

// ─── Monitor diagnostico ──────────────────────────────────────────────────────
// Con DEBUG_MONITOR=true l'app NON avvia il gioco: mostra ogni evento ricevuto
// dall'anello/stanghette così da identificare canale e valore del doppio click.
// Diagnosi conclusa: il doppio click arriva come sysEvent.eventType === 3.

const DEBUG_MONITOR = false

function fmtEv(v: any): string {
  if (v === undefined) return '-'
  if (v === null)      return 'null'
  if (typeof v === 'string') return `"${v}"`
  return String(v)
}

async function setupMonitor() {
  const log: string[] = []

  const render = async () => {
    const lines = [
      '== MONITOR EVENTI ==',
      'premi/scorri e leggi',
      '─────────────',
      ...(log.length ? log : ['(in attesa...)']),
    ]
    await display.updateTextOnly(lines.join('\n'))
  }

  // Pausa extra dopo initPage per essere certi che l'SDK accetti textContainerUpgrade
  await new Promise(r => setTimeout(r, 500))
  await render()

  bridge.onEvenHubEvent((event: any) => {
    const top  = event?.eventType
    const tT   = event?.textEvent?.eventType
    const sT   = event?.sysEvent?.eventType
    const lT   = event?.listEvent?.eventType
    const keys = event ? Object.keys(event).slice(0, 3).join(',') : '?'
    log.unshift(`k:${keys}`)
    log.unshift(`e:${fmtEv(top)} t:${fmtEv(tT)} s:${fmtEv(sT)} l:${fmtEv(lT)}`)
    while (log.length > 8) log.pop()
    render().catch(() => {})
  })
}

// ─── Avvio ────────────────────────────────────────────────────────────────────

async function main() {
  bridge = await waitForEvenAppBridge()
  initBridgeStorage(bridge as any)
  display = new G2Display(bridge)
  await display.initPage()

  if (DEBUG_MONITOR) {
    await setupMonitor()
    return
  }

  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supaKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  supabase = new SupabaseClient(supaUrl, supaKey)

  await initialize()
  setupEventListener()

  // visibilitychange / pagehide come fallback per quando FOREGROUND_EXIT_EVENT
  // non arriva al JS (WebView sospeso prima che l'SDK lo consegni).
  // Debounce 1500ms: operazioni transitorie (BLE, dim, check sistema) ripristinano
  // la visibilità in meno di un secondo e non triggerano la pausa.
  const schedulePause = () => {
    if (pauseTimer) return
    pauseTimer = setTimeout(() => { pauseTimer = null; showPause().catch(() => {}) }, 1500)
  }
  const cancelPause = () => {
    if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null }
    restoreFromPause().catch(() => {})
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) schedulePause(); else cancelPause()
  })
  window.addEventListener('pagehide', schedulePause)
  window.addEventListener('pageshow', cancelPause)
}

async function initialize() {
  const setupDone  = await isSetupComplete()
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
      await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, inputStep))
      return
    }
  } else {
    player = normalizePlayer(savedPlayer)
  }

  display.setLang(player.language as Lang)

  // Pre-warm icona classe: renderClassImage è lento, farlo adesso (invisibile)
  // così il profilo si apre istantaneamente.
  if (player.playerClass) renderClassImage(player.playerClass).catch(() => {})

  quests = await loadQuests()
  const today = new Date().toISOString().slice(0, 10)

  if (player.lastDailyDate !== today && player.abilityState.pendingRecovery > 0) {
    const recovery = player.abilityState.pendingRecovery
    player.expTotal   += recovery
    player.expCurrent += recovery
    player.abilityState.pendingRecovery = 0
    await savePlayer(player)
  }

  if (player.lastDailyDate !== today) {
    player.abilityState.dailyAttrsCompleted = []
    player.abilityState.adaptationDate = today
  }

  if (player.lastDailyDate !== today) {
    const missed = quests.filter(q => !q.completed && q.date === player!.lastDailyDate)
    if (missed.length > 0 && player.lastDailyDate) {
      const rawLost = missed.reduce((s, q) => s + Math.floor(q.expReward * 0.5), 0)

      if (player.playerClass === 'assassino' && isWeeklySkipAvailable(player.abilityState.weeklySkipUsed)) {
        player.abilityState.weeklySkipUsed = today
        warningExpLost = 0
        await savePlayer(player)
        warningIdx = 0; currentScreen = 'warning'
        await display.update(display.buildWarningScreen(0, warningIdx))
        return
      }

      const artifactReduction = calcPenaltyReduction(player.artifacts)
      const classReduction    = player.playerClass === 'carro_armato' ? 0.20 : 0
      const totalReduction    = Math.min(0.90, artifactReduction + classReduction)
      const actualLost        = Math.round(rawLost * (1 - totalReduction))

      player = applyPenalty(player, actualLost)
      warningExpLost = actualLost

      if (player.playerClass === 'guaritore') {
        player.abilityState.pendingRecovery += Math.round(actualLost * 0.10)
      }

      await savePlayer(player)
      warningIdx = 0; currentScreen = 'warning'
      await display.update(display.buildWarningScreen(warningExpLost, warningIdx))
      return
    }

    const count    = getQuestsPerDay(player.level)
    const aiQuests = await generateDailyQuestsAI(player.level, player.language, count)
    quests = aiQuests ?? generateDailyQuests(player.level, count, today)

    if (Math.random() < 0.20) {
      const jolly = await generateJollyQuest(player.level, player.language)
                 ?? generateLocalJolly(player.level)
      quests.push(jolly)
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
    player.name     = name
    player.language = selectedLang
    player.privacy  = selectedPrivacy as import('./game-engine').Privacy
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
  selectedLang    = (player?.language as Lang) ?? 'en'
  selectedPrivacy = player?.privacy ?? 'public'
  currentScreen   = 'nameInput'
  await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, inputStep))
}

// ─── Navigazione ─────────────────────────────────────────────────────────────

async function goToQuestList() {
  currentScreen = 'questList'; questIdx = 0
  await display.showQuestList(quests, questIdx)
}

async function refreshQuestList() {
  await display.showQuestList(quests, questIdx)
}

async function goToProfile() {
  currentScreen = 'profile'; profileIdx = 0
  await display.showProfile(player!, myRankPos, profileIdx)
  supabase.getPlayerRank(player!.playerId).then(r => { myRankPos = r ?? myRankPos }).catch(() => {})
}

async function refreshCurrentScreen() {
  if (!player) return
  try {
    switch (currentScreen) {
      case 'questList':     await display.showQuestList(quests, questIdx); break
      case 'questDetail':   await display.showQuestDetail(quests[questIdx], detailIdx); break
      case 'profile':       await display.showProfile(player, myRankPos, profileIdx); break
      case 'dailyMessage':  await display.showDailyMessage(player.rank, player.level, msgIdx); break
      case 'allDone':       await display.update(display.buildAllDoneScreen(allDoneIdx)); break
      case 'warning':       await display.update(display.buildWarningScreen(warningExpLost, warningIdx)); break
      case 'levelUp':       await display.update(display.buildLevelUp(player, pendingLevelUp?.oldLevel ?? player.level - 1, levelIdx)); break
      case 'rankUp':        await display.update(display.buildRankUp(player, pendingRankUp?.oldRank ?? player.rank as Rank, rankUpIdx)); break
      case 'ranking':       await display.update(display.buildRanking(ranking, rankingPage, rankingIdx, supabase.lastRankingError)); break
      case 'rankingDetail': if (selectedRankingEntry) await display.update(display.buildRankingDetail(selectedRankingEntry, rankingPage * 4 + rankingIdx + 1)); break
      case 'artifacts':     await display.update(display.buildArtifactList(player)); break
      case 'artifactReward': if (pendingArtifact) await display.showArtifactReward(pendingArtifact); break
      case 'exitConfirm':   await display.updateTextOnly(display.buildExitConfirmScreen(exitConfirmIdx)); break
      default: break
    }
  } catch (e) {
    console.error('[G2] refreshCurrentScreen failed:', e)
  }
}

// ─── Pausa / Ripristino ───────────────────────────────────────────────────────

async function showPause() {
  if (isPaused) return
  isPaused = true
  handlingInput = false; pendingPress = false
  try { await display.update(display.buildPauseScreen()) } catch {}
}

async function restoreFromPause() {
  if (!isPaused) return
  isPaused = false
  handlingInput = false; pendingPress = false
  await refreshCurrentScreen()
}

async function goToArtifacts() {
  currentScreen = 'artifacts'
  await display.update(display.buildArtifactList(player!))
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

  const expMultiplier = calcExpMultiplier(player!.artifacts, q.attribute)
  const result = addExp(player!, q.expReward, q.attribute, expMultiplier)
  player = incrementQuestCount(result.player)

  // Ranger Adattamento: bonus 100 EXP al completamento di 3 attributi distinti in un giorno
  if (player.playerClass === 'ranger') {
    const today = new Date().toISOString().slice(0, 10)
    if (player.abilityState.adaptationDate !== today) {
      player.abilityState.adaptationDate    = today
      player.abilityState.dailyAttrsCompleted = []
    }
    if (!player.abilityState.dailyAttrsCompleted.includes(q.attribute)) {
      player.abilityState.dailyAttrsCompleted.push(q.attribute)
      if (player.abilityState.dailyAttrsCompleted.length === 3) {
        player.expTotal   += 100
        player.expCurrent += 100
      }
    }
  }

  await savePlayer(player)
  await supabase.upsertPlayer(player)

  if (q.type === 'jolly') {
    const rolled = rollArtifactReward(player.playerClass, player.artifacts)
    if (rolled) {
      pendingArtifact = rolled
      pendingLevelUp  = result.leveledUp ? { oldLevel: result.oldLevel } : pendingLevelUp
      pendingRankUp   = result.rankedUp  ? { oldRank:  result.oldRank  } : pendingRankUp
      currentScreen   = 'artifactReward'
      await display.showArtifactReward(rolled)
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

// ─── Conferma uscita (doppio click) ──────────────────────────────────────────
// display.update() fa il rebuild a schermo intero uscendo dall'image-mode,
// esattamente come showPause() — confermato visibile sull'hardware.
// updateTextOnly aggiornava solo la colonnina destra in image-mode (invisibile).

async function showExitConfirm() {
  if (currentScreen === 'exitConfirm') return
  preExitScreen  = currentScreen
  exitConfirmIdx = 0
  currentScreen  = 'exitConfirm'
  await display.update(display.buildExitConfirmScreen(exitConfirmIdx))
}

// ─── Gestione eventi ──────────────────────────────────────────────────────────

function setupEventListener() {
  bridge.onEvenHubEvent(async (event: any) => {
    // Routing confermato sull'hardware: click/scroll su textEvent (0/1/2),
    // doppio click e lifecycle su sysEvent (3/4/5).
    const raw = event?.eventType
      ?? event?.textEvent?.eventType
      ?? event?.sysEvent?.eventType
      ?? event?.listEvent?.eventType
    const eventType = OsEventTypeList.fromJson(raw)

    // ─── Lifecycle ────────────────────────────────────────────────────────
    if (eventType === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
      await restoreFromPause(); return
    }
    if (eventType === OsEventTypeList.FOREGROUND_EXIT_EVENT) {
      await showPause(); return
    }

    // ─── Doppio click → conferma uscita (sysEvent.eventType === 3) ─────────
    // Gestito PRIMA di handlingInput così non viene mai scartato.
    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT || raw === 3 || raw === '3') {
      await showExitConfirm(); return
    }

    if (isPaused) return

    // Solo click e scroll sono input di gioco. Tutto il resto (IMU, sysEvent
    // senza eventType, ecc.) viene ignorato: in passato l'undefined veniva
    // trattato come click e causava selezioni/uscite spurie.
    const isClick      = eventType === OsEventTypeList.CLICK_EVENT
    const isScrollUp   = eventType === OsEventTypeList.SCROLL_TOP_EVENT
    const isScrollDown = eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT
    if (!isClick && !isScrollUp && !isScrollDown) return

    if (handlingInput) {
      if (isClick) pendingPress = true
      return
    }

    handlingInput = true
    const watchdog = setTimeout(() => { handlingInput = false; pendingPress = false }, 8000)
    try {
      if      (isScrollUp)   await handleSwipeUp()
      else if (isScrollDown) await handleSwipeDown()
      else { pendingPress = false; await handlePress() }
    } finally {
      clearTimeout(watchdog)
      handlingInput = false
      if (pendingPress) {
        pendingPress = false
        handlingInput = true
        const wd2 = setTimeout(() => { handlingInput = false }, 8000)
        try { await handlePress() }
        catch (e) { console.error('[G2] queued click failed:', e) }
        finally { clearTimeout(wd2); handlingInput = false }
      }
    }
  })
}

// ─── Handlers Click ───────────────────────────────────────────────────────────

async function handlePress() {
  const handlers: Record<Screen, () => Promise<void>> = {
    boot:     async () => {},
    setup:    async () => { await initialize() },
    nameInput: handleNameInputPress,
    privacy:   handlePrivacyPress,
    dailyMessage: async () => {
      if (msgIdx === 1) await bridge.shutDownPageContainer(0); else await goToQuestList()
    },
    warning: async () => {
      if (warningIdx === 1) await bridge.shutDownPageContainer(0); else await goToQuestList()
    },
    allDone: async () => {
      if (allDoneIdx === 1) await goToQuestList(); else await goToProfile()
    },
    questList:   handleQuestListPress,
    questDetail: handleQuestDetailPress,
    levelUp:     handleLevelUpPress,
    rankUp: async () => {
      if (rankUpIdx === 1) await bridge.shutDownPageContainer(0)
      else { pendingRankUp = null; await goToQuestList() }
    },
    profile:   handleProfilePress,
    artifacts: async () => { await goToProfile() },
    ranking:   handleRankingPress,
    rankingDetail: async () => {
      currentScreen = 'ranking'
      await display.update(display.buildRanking(ranking, rankingPage, rankingIdx, supabase.lastRankingError))
    },
    error: async () => { await initialize() },
    artifactReward: handleArtifactRewardPress,
    exitConfirm: async () => {
      if (exitConfirmIdx === 1) {
        await bridge.shutDownPageContainer(0)
      } else {
        currentScreen = preExitScreen
        await refreshCurrentScreen()
      }
    },
  }

  const handler = handlers[currentScreen]
  if (handler) {
    try { await handler() }
    catch (e) { console.error('[G2] handler threw:', e) }
  }
}

async function handleNameInputPress() {
  if (inputStep === 'lang') {
    selectedLang = currentChar() as Lang; inputStep = 'name'; charIdx = 0
  } else if (currentChar() === 'LANG') {
    inputStep = 'lang'; charIdx = LANGS.indexOf(selectedLang)
  } else if (currentChar() === 'OK' && nameBuffer.trim().length > 0) {
    await goToPrivacy(); return
  } else if (currentChar() === 'ESC') {
    if (isChangingName) { isChangingName = false; await goToProfile() }
    else { currentScreen = 'setup'; await display.update(display.buildSetupScreen()) }
    return
  } else if (nameBuffer.length < 15 && !['OK','ESC','LANG'].includes(currentChar())) {
    nameBuffer += currentChar()
  }
  await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, inputStep))
}

async function goToPrivacy() {
  currentScreen = 'privacy'
  privacyIdx    = Math.max(0, PRIVACY_OPTIONS.indexOf(selectedPrivacy))
  await display.update(display.buildPrivacyScreen(privacyIdx))
}

async function handlePrivacyPress() {
  selectedPrivacy = PRIVACY_OPTIONS[privacyIdx]
  await confirmSetup()
}

async function handleQuestListPress() {
  if (questIdx === quests.length + 1) {
    await bridge.shutDownPageContainer(0)
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

async function handleLevelUpPress() {
  if (levelIdx === 1) {
    await bridge.shutDownPageContainer(0)
  } else {
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
  if      (profileIdx === 0) await goToArtifacts()
  else if (profileIdx === 1) await goToRanking()
  else if (profileIdx === 2) await startChangeName()
  else                       await goToQuestList()
}

async function handleRankingPress() {
  const pageItems = ranking.slice(rankingPage * 4, rankingPage * 4 + 4)
  if (rankingIdx < pageItems.length) {
    selectedRankingEntry = pageItems[rankingIdx]
    const pos = rankingPage * 4 + rankingIdx + 1
    currentScreen = 'rankingDetail'
    await display.update(display.buildRankingDetail(selectedRankingEntry, pos))
  } else {
    await goToProfile()
  }
}

async function handleArtifactRewardPress() {
  if (!pendingArtifact || !player) { await goToQuestList(); return }

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
      await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, inputStep)); break
    case 'privacy':
      privacyIdx = (privacyIdx - 1 + PRIVACY_OPTIONS.length) % PRIVACY_OPTIONS.length
      await display.update(display.buildPrivacyScreen(privacyIdx)); break
    case 'dailyMessage':
      msgIdx = Math.max(0, msgIdx - 1)
      await display.showDailyMessage(player!.rank, player!.level, msgIdx); break
    case 'warning':
      warningIdx = Math.max(0, warningIdx - 1)
      await display.update(display.buildWarningScreen(warningExpLost, warningIdx)); break
    case 'allDone':
      allDoneIdx = Math.max(0, allDoneIdx - 1)
      await display.update(display.buildAllDoneScreen(allDoneIdx)); break
    case 'questList':
      if (questIdx > 0) { questIdx--; await refreshQuestList() } break
    case 'questDetail':
      if (detailIdx > 0) { detailIdx--; await display.showQuestDetail(quests[questIdx], detailIdx) } break
    case 'levelUp':
      levelIdx = Math.max(0, levelIdx - 1)
      await display.update(display.buildLevelUp(player!, pendingLevelUp?.oldLevel ?? player!.level - 1, levelIdx)); break
    case 'rankUp':
      rankUpIdx = Math.max(0, rankUpIdx - 1)
      await display.update(display.buildRankUp(player!, pendingRankUp?.oldRank ?? player!.rank as Rank, rankUpIdx)); break
    case 'profile':
      if (profileIdx > 0) { profileIdx--; await display.showProfile(player!, myRankPos, profileIdx) } break
    case 'exitConfirm':
      exitConfirmIdx = Math.max(0, exitConfirmIdx - 1)
      await display.updateTextOnly(display.buildExitConfirmScreen(exitConfirmIdx)); break
    case 'ranking': {
      if (rankingIdx > 0) {
        rankingIdx--
        await display.update(display.buildRanking(ranking, rankingPage, rankingIdx, supabase.lastRankingError))
      } else if (rankingPage > 0) {
        rankingPage--
        const prevItems = ranking.slice(rankingPage * 4, rankingPage * 4 + 4)
        rankingIdx = prevItems.length
        await display.update(display.buildRanking(ranking, rankingPage, rankingIdx, supabase.lastRankingError))
      }
      break
    }
  }
}

async function handleSwipeDown() {
  switch (currentScreen) {
    case 'nameInput':
      charIdx = (charIdx + 1) % charsetLen()
      await display.update(display.buildNameInput(nameBuffer, currentChar(), selectedLang, inputStep)); break
    case 'privacy':
      privacyIdx = (privacyIdx + 1) % PRIVACY_OPTIONS.length
      await display.update(display.buildPrivacyScreen(privacyIdx)); break
    case 'dailyMessage':
      msgIdx = Math.min(1, msgIdx + 1)
      await display.showDailyMessage(player!.rank, player!.level, msgIdx); break
    case 'warning':
      warningIdx = Math.min(1, warningIdx + 1)
      await display.update(display.buildWarningScreen(warningExpLost, warningIdx)); break
    case 'allDone':
      allDoneIdx = Math.min(1, allDoneIdx + 1)
      await display.update(display.buildAllDoneScreen(allDoneIdx)); break
    case 'questList':
      if (questIdx < quests.length + 1) { questIdx++; await refreshQuestList() } break
    case 'questDetail':
      if (detailIdx < 1) { detailIdx++; await display.showQuestDetail(quests[questIdx], detailIdx) } break
    case 'levelUp':
      levelIdx = Math.min(1, levelIdx + 1)
      await display.update(display.buildLevelUp(player!, pendingLevelUp?.oldLevel ?? player!.level - 1, levelIdx)); break
    case 'rankUp':
      rankUpIdx = Math.min(1, rankUpIdx + 1)
      await display.update(display.buildRankUp(player!, pendingRankUp?.oldRank ?? player!.rank as Rank, rankUpIdx)); break
    case 'profile':
      if (profileIdx < 3) { profileIdx++; await display.showProfile(player!, myRankPos, profileIdx) } break
    case 'exitConfirm':
      exitConfirmIdx = Math.min(1, exitConfirmIdx + 1)
      await display.updateTextOnly(display.buildExitConfirmScreen(exitConfirmIdx)); break
    case 'ranking': {
      const downItems  = ranking.slice(rankingPage * 4, rankingPage * 4 + 4)
      const totalPages = Math.ceil(ranking.length / 4)
      if (rankingIdx < downItems.length) {
        rankingIdx++
        await display.update(display.buildRanking(ranking, rankingPage, rankingIdx, supabase.lastRankingError))
      } else if (rankingPage < totalPages - 1) {
        rankingPage++; rankingIdx = 0
        await display.update(display.buildRanking(ranking, rankingPage, rankingIdx, supabase.lastRankingError))
      }
      break
    }
  }
}

main().catch(async (err) => {
  console.error('Errore fatale:', err)
  const msg = err instanceof Error ? err.message.slice(0, 26) : 'Errore di avvio'
  try { await display?.update(display.buildError(msg)) } catch {}
})
