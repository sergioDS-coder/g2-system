// local-save.ts — salvataggio della nota sul server locale (Mac, porta 5199)

import { LOCAL_SAVE_URL } from './config'

// Data di oggi in formato YYYY-MM-DD (ora locale, coerente con la Daily Note).
export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Appende la nota alla Daily Note di oggi tramite il server locale.
// Ritorna true se il salvataggio è andato a buon fine.
export async function saveNote(testo: string): Promise<boolean> {
  const body = JSON.stringify({ testo: testo.trim(), data: todayISO() })

  // Piccola tolleranza di rete: il server locale dovrebbe rispondere subito.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(LOCAL_SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    })
    return response.ok
  } catch (err) {
    console.error('Server locale 5199 non raggiungibile:', err)
    return false
  } finally {
    clearTimeout(timer)
  }
}
