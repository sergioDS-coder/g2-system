// config.ts — costanti di configurazione del plugin G2 Field Notes

// Backend Vercel già esistente che inoltra a Gemini 2.5 Flash.
// NB: nello specifico il prefisso "https://" va indicato una sola volta.
export const VERCEL_AGENT_URL =
  'https://even-gemini-agent-4nt9npg3m-sergiods-coders-projects.vercel.app/api/agent'

// Server Node.js locale sul Mac che appende la nota alla Daily Note di Obsidian.
export const LOCAL_SAVE_URL = 'http://localhost:5199/nota'

// System prompt inviato a Gemini per strutturare la nota dettata dal campo.
export const GEMINI_SYSTEM_PROMPT =
  "Sei l'assistente di un ingegnere strutturale italiano. Ricevi una nota " +
  'vocale dal campo. Strutturala in modo conciso come voce di diario tecnico: ' +
  "massimo 2 righe, inizia con un verbo all'infinito (es. 'Verificare...', " +
  "'Contattare...', 'Aggiornare...'). Non aggiungere niente altro."

// Lingua del riconoscimento vocale.
export const SPEECH_LANG = 'it-IT'

// Timeout (ms).
export const LISTEN_SECONDS = 5      // durata countdown schermata di ascolto
export const RECORD_TIMEOUT_MS = 8000 // hard timeout registrazione
export const GEMINI_TIMEOUT_MS = 10000 // oltre questo si salva il testo grezzo
export const PREVIEW_SECONDS = 3     // anteprima prima del salvataggio automatico
export const SAVED_SECONDS = 2       // schermata di conferma
