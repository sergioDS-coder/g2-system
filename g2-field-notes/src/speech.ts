// speech.ts — wrapper sulla Web Speech API per la dettatura della nota

import { SPEECH_LANG, RECORD_TIMEOUT_MS } from './config'

// La Web Speech API non è nei lib DOM standard di TS: dichiariamo il minimo.
interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative
  isFinal: boolean
  length: number
}
interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEventLike {
  error: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechAvailable(): boolean {
  return getRecognitionCtor() !== null
}

export interface SpeechResult {
  status: 'ok' | 'no-speech' | 'error' | 'unavailable'
  transcript: string
  error?: string
}

// Avvia il riconoscimento vocale e risolve con la trascrizione finale.
// Si chiude automaticamente alla fine del parlato o dopo RECORD_TIMEOUT_MS.
export function listenOnce(): Promise<SpeechResult> {
  const Ctor = getRecognitionCtor()
  if (!Ctor) {
    return Promise.resolve({ status: 'unavailable', transcript: '' })
  }

  return new Promise<SpeechResult>((resolve) => {
    const recognition = new Ctor()
    recognition.lang = SPEECH_LANG
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    let finalText = ''
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const finish = (result: SpeechResult) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      try { recognition.stop() } catch { /* ignore */ }
      resolve(result)
    }

    recognition.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      finalText = text.trim()
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        finish({ status: 'no-speech', transcript: finalText })
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        finish({ status: 'unavailable', transcript: '', error: event.error })
      } else {
        finish({ status: 'error', transcript: finalText, error: event.error })
      }
    }

    recognition.onend = () => {
      if (finalText) finish({ status: 'ok', transcript: finalText })
      else finish({ status: 'no-speech', transcript: '' })
    }

    // Hard timeout: chiudi la registrazione dopo RECORD_TIMEOUT_MS.
    timer = setTimeout(() => {
      try { recognition.stop() } catch { /* ignore */ }
      // onend gestirà la risoluzione con il testo accumulato.
    }, RECORD_TIMEOUT_MS)

    try {
      recognition.start()
    } catch (err) {
      finish({ status: 'error', transcript: '', error: String(err) })
    }
  })
}
