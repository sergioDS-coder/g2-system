// main.ts — G2 System

import {
  waitForEvenAppBridge,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

import {
  type PlayerProfile,
  type Rank,
  addExp,
  applyPenalty,
  incrementQuestCount,
  createDefaultPlayer,
  getQuestsPerDay,
} from './game-engine'

import {
  type DailyQuest,
  generateDailyQuests,
} from './quest-data'

import { generateJollyQuest } from './ai-quest'
import { SupabaseClient, type RankingEntry } from './supabase-client'
import { G2Display } from './g2-display'
import {
  loadPlayer, savePlayer,
  loadQuests, saveQuests,
  isSetupComplete, saveSetupComplete,
  generatePlayerId,
} from './storage'
import type { Lang } from './i18n'

// ─── Stato globale ───────────────────────────────────────────────────────────

type Screen =
  | 'boot'
  | 'nameInput'
  | 'dailyMessage'
  | 'allDone'
  | 'warning'
  | 'questList'
  | 'questDetail'
  | 'levelUp'
  | 'rankUp'
  | 'profile'
  | 'ranking'
  | 'error'

let currentScreen: Screen = 'boot'
let display: G2Display
let bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>
let supabase: SupabaseClient

let player: PlayerProfile | null = null
let quests: DailyQuest[] = []
let ranking: RankingEntry[] = []
let rankingPage = 0
let myRankPos: number | null = null

let questIdx = 0
let pendingLevelUp: { oldLevel: number } | null = null
let pendingRankUp: { oldRank: Rank } | null = null
let warningExpLost = 0

// ─── Inserimento nome sugli occhiali ─────────────────────────────────────────

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-OK'
let nameBuffer = ''
let charIdx = 0

function currentChar(): string {
  return CHARSET[charIdx]
}

// ─── Avvio ───────────────────────────────────────────────────────────────────

async function main() {
  bridge = await waitForEvenAppBridge()
  display = new G2Display(bridge)
  await display.initPage()

  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supaKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  supabase = new SupabaseClient(supaUrl, supaKey)

  await initialize()
  setupEventListener()
}

async function initialize() {
  if (!isSetupComplete()) {
    nameBuffer = ''
    charIdx = 0
    await goToNameInput()
    return
  }

  player = loadPlayer()
  if (!player) {
    player = createDefaultPlayer(generatePlayerId(), 'Player', 'it')
    savePlayer(player)
  }

  display.setLang(player.language as Lang)

  quests = loadQuests()
  const today = new Date().toISOString().slice(0, 10)
  const isNewDay = player.lastDailyDate !== today

  if (isNewDay) {
    // Penalità ieri
    const yesterdayMissed = quests.filter(
      q => !q.completed && q.date === player!.lastDailyDate
    )
    if (yesterdayMissed.length > 0 && player.lastDailyDate) {
      const totalLost = yesterdayMissed.reduce((sum, q) => sum + Math.floor(q.expReward * 0.5), 0)
      player = applyPenalty(player, totalLost)
      warningExpLost = totalLost
      savePlayer(player)
      await goToWarning()
      return
    }

    // Genera quest
    const count = getQuestsPerDay(player.level)
    quests = generateDailyQuests(player.level, count, today)

    // Quest jolly 10% probabilità via Netlify Function
    if (Math.random() < 0.1) {
      const jolly = await generateJollyQuest(player.level, player.language)
      if (jolly) quests.push(jolly)
    }

    saveQuests(quests)
    player.lastDailyDate = today
    savePlayer(player)
    await supabase.upsertPlayer(player)
    await goToDailyMessage()
  } else {
    // Stesso giorno: controlla se tutte completate
    const allDone = quests.length > 0 && quests.every(q => q.completed)
    if (allDone) {
      await goToAllDone()
    } else {
      await goToQuestList()
    }
  }
}

// ─── Navigazione ─────────────────────────────────────────────────────────────

async function goToNameInput() {
  currentScreen = 'nameInput'
  await display.update(display.buildNameInput(nameBuffer, currentChar()))
}

async function goToDailyMessage() {
  currentScreen = 'dailyMessage'
  await display.update(display.buildDailyMessage())
}

async function goToWarning() {
  currentScreen = 'warning'
  await display.update(display.buildWarningScreen(warningExpLost))
}

async function goToAllDone() {
  currentScreen = 'allDone'
  await display.update(display.buildAllDoneScreen())
}

async function goToQuestList() {
  currentScreen = 'questList'
  questIdx = 0
  await display.update(display.buildQuestList(quests, questIdx))
}

async function refreshQuestList() {
  await display.update(display.buildQuestList(quests, questIdx))
}

async function goToQuestDetail() {
  currentScreen = 'questDetail'
  await display.update(display.buildQuestDetail(quests[questIdx]))
}

async function goToLevelUp(oldLevel: number) {
  currentScreen = 'levelUp'
  pendingLevelUp = { oldLevel }
  await display.update(display.buildLevelUp(player!, oldLevel))
}

async function goToRankUp(oldRank: Rank) {
  currentScreen = 'rankUp'
  pendingRankUp = { oldRank }
  await display.update(display.buildRankUp(player!, oldRank))
}

async function goToProfile() {
  currentScreen = 'profile'
  myRankPos = await supabase.getPlayerRank(player!.playerId)
  await display.update(display.buildProfile(player!, myRankPos))
}

async function goToRanking() {
  currentScreen = 'ranking'
  rankingPage = 0
  ranking = await supabase.getRanking(50)
  await display.update(display.buildRanking(ranking, rankingPage))
}

// ─── Quest completion ─────────────────────────────────────────────────────────

async function completeQuest() {
  const q = quests[questIdx]
  if (q.completed) return

  q.completed = true
  saveQuests(quests)

  const result = addExp(player!, q.expReward, q.attribute)
  player = incrementQuestCount(result.player)
  savePlayer(player)
  await supabase.upsertPlayer(player)

  // Tutte completate?
  const allDone = quests.every(q => q.completed)
  if (result.rankedUp) {
    await goToRankUp(result.oldRank)
  } else if (result.leveledUp) {
    await goToLevelUp(result.oldLevel)
  } else if (allDone) {
    await goToAllDone()
  } else {
    await goToQuestList()
  }
}

// ─── Conferma nome player ────────────────────────────────────────────────────

async function confirmName() {
  const name = nameBuffer.trim()
  if (!name) return

  // Crea player con nome inserito
  player = createDefaultPlayer(generatePlayerId(), name, 'it')
  savePlayer(player)
  saveSetupComplete()

  display.setLang('it')
  await initialize()
}

// ─── Gestione eventi G2 ───────────────────────────────────────────────────────

function setupEventListener() {
  bridge.onEvenHubEvent(async (event) => {
    const textEvent = event.textEvent
    const sysEvent = (event as any).sysEvent
    const activeEvent = textEvent ?? sysEvent
    if (!activeEvent) return

    if (activeEvent.eventType === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
      if (currentScreen === 'nameInput' && isSetupComplete()) {
        await initialize()
      }
      return
    }

    if (activeEvent.eventType === OsEventTypeList.FOREGROUND_EXIT_EVENT ||
        activeEvent.eventType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
      return
    }

    switch (activeEvent.eventType) {
      case OsEventTypeList.CLICK_EVENT:
      case undefined:
      case 0:
        await handlePress()
        break
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        await handleDoublePress()
        break
      case OsEventTypeList.SCROLL_TOP_EVENT:
        await handleSwipeUp()
        break
      case OsEventTypeList.SCROLL_BOTTOM_EVENT:
        await handleSwipeDown()
        break
      default:
        console.log('Evento non gestito:', activeEvent.eventType)
        break
    }
  })
}

async function handlePress() {
  switch (currentScreen) {

    case 'nameInput':
      // Press OK = conferma nome, altrimenti aggiungi carattere
      if (currentChar() === 'OK' && nameBuffer.trim().length > 0) {
        await confirmName()
      } else if (nameBuffer.length < 15 && currentChar() !== 'OK') {
        nameBuffer += currentChar()
        charIdx = 0
        await display.update(display.buildNameInput(nameBuffer, currentChar()))
      }
      break

    case 'dailyMessage':
    case 'warning':
      await goToQuestList()
      break

    case 'allDone':
      await goToProfile()
      break

    case 'questList':
      if (questIdx === quests.length) {
        await goToProfile()
      } else {
        await goToQuestDetail()
      }
      break

    case 'questDetail':
      if (!quests[questIdx].completed) {
        await completeQuest()
      }
      break

    case 'levelUp':
      pendingLevelUp = null
      if (pendingRankUp) {
        const oldRank = pendingRankUp.oldRank
        pendingRankUp = null
        await goToRankUp(oldRank)
      } else {
        await goToQuestList()
      }
      break

    case 'rankUp':
      pendingRankUp = null
      await goToQuestList()
      break

    case 'profile':
      await goToRanking()
      break
  }
}

async function handleDoublePress() {
  switch (currentScreen) {

    case 'nameInput':
      // Double press = cancella ultimo carattere
      if (nameBuffer.length > 0) {
        nameBuffer = nameBuffer.slice(0, -1)
        await display.update(display.buildNameInput(nameBuffer, currentChar()))
      }
      break

    case 'questList':
      await bridge.shutDownPageContainer(1)
      break

    case 'allDone':
    case 'questDetail':
    case 'profile':
    case 'ranking':
      await goToQuestList()
      break

    case 'dailyMessage':
    case 'warning':
    case 'levelUp':
    case 'rankUp':
      await bridge.shutDownPageContainer(1)
      break
  }
}

async function handleSwipeUp() {
  switch (currentScreen) {

    case 'nameInput':
      // Swipe up = lettera precedente nel charset
      charIdx = (charIdx - 1 + CHARSET.length) % CHARSET.length
      await display.update(display.buildNameInput(nameBuffer, currentChar()))
      break

    case 'questList':
      if (questIdx > 0) {
        questIdx--
        await refreshQuestList()
      }
      break

    case 'ranking':
      if (rankingPage > 0) {
        rankingPage--
        await display.update(display.buildRanking(ranking, rankingPage))
      }
      break
  }
}

async function handleSwipeDown() {
  switch (currentScreen) {

    case 'nameInput':
      // Swipe down = lettera successiva nel charset
      charIdx = (charIdx + 1) % CHARSET.length
      await display.update(display.buildNameInput(nameBuffer, currentChar()))
      break

    case 'questList':
      if (questIdx < quests.length) {
        questIdx++
        await refreshQuestList()
      }
      break

    case 'ranking':
      const totalPages = Math.ceil(ranking.length / 6)
      if (rankingPage < totalPages - 1) {
        rankingPage++
        await display.update(display.buildRanking(ranking, rankingPage))
      }
      break
  }
}

main().catch(async (err) => {
  console.error('Errore fatale:', err)
  try { await display?.update(display.buildError('Errore di avvio')) }
  catch {}
})
