// gemini-client.ts — invio del testo trascritto al backend Vercel (Gemini 2.5 Flash)

import { VERCEL_AGENT_URL, GEMINI_SYSTEM_PROMPT, GEMINI_TIMEOUT_MS } from './config'

// Estrae il testo dalla risposta del backend, tollerando diversi formati.
function extractText(data: any): string {
  if (typeof data === 'string') return data
  if (!data || typeof data !== 'object') return ''
  return (
    data.text ??
    data.reply ??
    data.result ??
    data.output ??
    data.message ??
    data.response ??
    data.content ??
    // Formato grezzo Gemini, nel caso il backend lo inoltri così com'è.
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    ''
  )
}

// Struttura la nota grezza tramite Gemini.
// Se il backend non risponde entro GEMINI_TIMEOUT_MS o fallisce,
// ritorna il testo grezzo così com'è (fallback richiesto dalle specifiche).
export async function structureNote(rawText: string): Promise<string> {
  const fallback = rawText.trim()
  if (!fallback) return fallback

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

  try {
    const response = await fetch(VERCEL_AGENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: GEMINI_SYSTEM_PROMPT,
        message: fallback,
        text: fallback,
        model: 'gemini-2.5-flash',
      }),
      signal: controller.signal,
    })

    if (!response.ok) return fallback

    const data = await response.json().catch(() => null)
    const structured = extractText(data).trim()
    return structured || fallback
  } catch (err) {
    // Timeout (abort) o errore di rete: salviamo il testo grezzo.
    console.warn('Gemini non disponibile, salvo testo grezzo:', err)
    return fallback
  } finally {
    clearTimeout(timer)
  }
}
