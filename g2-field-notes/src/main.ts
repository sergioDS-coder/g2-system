// main.ts — G2 Field Notes
// Flusso: doppio tap -> ascolto -> trascrizione -> Gemini -> anteprima ->
//         salvataggio sulla Daily Note locale -> conferma -> home.

import {
  waitForEvenAppBridge,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

import { FieldNotesDisplay } from './g2-display'
import { isSpeechAvailable, listenOnce } from './speech'
import { structureNote } from './gemini-client'
import { saveNote } from './local-save'
import { LISTEN_SECONDS, PREVIEW_SECONDS, SAVED_SECONDS } from './config'

type Screen =
  | 'home'
  | 'listening'
  | 'preview'
  | 'saved'
  | 'micUnavailable'
  | 'noSpeech'
  | 'saveError'
  | 'error'

let display: FieldNotesDisplay
let bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>

let currentScreen: Screen = 'home'
let busy = false
// Ultima nota strutturata, conservata per il retry del salvataggio.
let pendingNote = ''

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Avvio ────────────────────────────────────────────────────────────────────

async function main() {
  bridge = await waitForEvenAppBridge()
  display = new FieldNotesDisplay(bridge)
  await display.initPage()
  currentScreen = 'home'
  setupEventListener()
}

// ─── Navigazione ────────────────────────────────────────────────────────────

async function goHome() {
  currentScreen = 'home'
  await display.update(display.buildHome())
}

// ─── Flusso principale: registra una nota dal campo ─────────────────────────

async function startFieldNote() {
  if (busy) return
  busy = true
  try {
    if (!isSpeechAvailable()) {
      currentScreen = 'micUnavailable'
      await display.update(display.buildMicUnavailable())
      return
    }

    // Schermata di ascolto + registrazione concorrente.
    currentScreen = 'listening'
    const speechPromise = listenOnce()
    for (let s = LISTEN_SECONDS; s >= 1; s--) {
      await display.update(display.buildListening(s))
      await sleep(1000)
    }
    // Attendi l'eventuale coda di registrazione (hard timeout gestito in speech.ts).
    const result = await speechPromise

    if (result.status === 'unavailable') {
      currentScreen = 'micUnavailable'
      await display.update(display.buildMicUnavailable())
      return
    }
    const transcript = result.transcript.trim()
    if (!transcript) {
      currentScreen = 'noSpeech'
      await display.update(display.buildNoSpeech())
      return
    }

    // Struttura la nota con Gemini (fallback su testo grezzo se non risponde).
    const structured = await structureNote(transcript)
    await finalizeNote(structured)
  } catch (err) {
    console.error('Errore nel flusso nota:', err)
    currentScreen = 'error'
    await display.update(display.buildError('Errore imprevisto'))
  } finally {
    busy = false
  }
}

// Mostra l'anteprima, salva sulla Daily Note locale e conferma.
async function finalizeNote(testo: string) {
  pendingNote = testo
  currentScreen = 'preview'
  await display.update(display.buildPreview(testo))
  await sleep(PREVIEW_SECONDS * 1000)

  const ok = await saveNote(testo)
  if (ok) {
    pendingNote = ''
    currentScreen = 'saved'
    await display.update(display.buildSaved())
    await sleep(SAVED_SECONDS * 1000)
    await goHome()
  } else {
    currentScreen = 'saveError'
    await display.update(display.buildSaveError())
  }
}

// Riprova solo il salvataggio (senza registrare di nuovo).
async function retrySave() {
  if (busy || !pendingNote) {
    await startFieldNote()
    return
  }
  busy = true
  try {
    currentScreen = 'preview'
    await display.update(display.buildPreview(pendingNote))
    const ok = await saveNote(pendingNote)
    if (ok) {
      pendingNote = ''
      currentScreen = 'saved'
      await display.update(display.buildSaved())
      await sleep(SAVED_SECONDS * 1000)
      await goHome()
    } else {
      currentScreen = 'saveError'
      await display.update(display.buildSaveError())
    }
  } finally {
    busy = false
  }
}

// ─── Gestione eventi G2 ──────────────────────────────────────────────────────

function setupEventListener() {
  bridge.onEvenHubEvent(async (event) => {
    const textEvent = event.textEvent
    const sysEvent = (event as any).sysEvent
    const activeEvent = textEvent ?? sysEvent
    if (!activeEvent) return

    if (activeEvent.eventType === OsEventTypeList.FOREGROUND_EXIT_EVENT ||
        activeEvent.eventType === OsEventTypeList.ABNORMAL_EXIT_EVENT ||
        activeEvent.eventType === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
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
      default:
        // Scroll e altri eventi non sono usati in questo plugin.
        break
    }
  })
}

// Tap singolo: torna alla home dalle schermate di errore/conferma.
async function handlePress() {
  switch (currentScreen) {
    case 'micUnavailable':
    case 'noSpeech':
    case 'saveError':
    case 'error':
      await goHome()
      break
    default:
      break
  }
}

// Doppio tap: avvia la registrazione (o riprova dalle schermate di errore).
async function handleDoublePress() {
  switch (currentScreen) {
    case 'home':
    case 'micUnavailable':
    case 'noSpeech':
    case 'error':
      await startFieldNote()
      break
    case 'saveError':
      await retrySave()
      break
    default:
      // Durante ascolto/anteprima/conferma il doppio tap viene ignorato.
      break
  }
}

main().catch(async (err) => {
  console.error('Errore fatale:', err)
  try { await display?.update(display.buildError('Errore di avvio')) }
  catch { /* ignore */ }
})
