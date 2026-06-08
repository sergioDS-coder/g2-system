# 🎙 G2 Field Notes

Plugin Even Hub SDK per gli occhiali **Even Realities G2**. Permette di dettare
note rapide dal campo durante sopralluoghi e cantieri: la nota vocale viene
trascritta, strutturata da **Gemini 2.5 Flash** (via backend Vercel) e appesa
automaticamente alla sezione **`## 🧠 Note rapide`** della Daily Note di Obsidian
di oggi tramite un piccolo server Node.js locale.

## Flusso

1. **Doppio tap** sul touchpad degli occhiali.
2. Display: `🎙 Field Note` → `In ascolto...` con countdown `5..4..3..2..1`.
3. Registrazione audio via **Web Speech API** (`it-IT`, timeout 8 s).
4. Il testo trascritto viene inviato al backend Vercel con il system prompt
   da ingegnere strutturale (vedi `src/config.ts`).
5. Anteprima del testo strutturato per 3 s, poi salvataggio automatico
   tramite `POST http://localhost:5199/nota`.
6. Display: `✅ Salvato` per 2 s, poi ritorno alla home.

Se Gemini non risponde entro 10 s, viene salvato il **testo grezzo** non
strutturato. Se la Web Speech API non è disponibile, il display mostra
`⚠️ Mic non disponibile`.

## Struttura del progetto

```
g2-field-notes/
├── index.html              # entrypoint del plugin
├── app.json                # manifest Even Hub SDK
├── src/
│   ├── main.ts             # macchina a stati + flusso completo
│   ├── g2-display.ts       # rendering e-ink 576x288
│   ├── speech.ts           # wrapper Web Speech API (it-IT)
│   ├── gemini-client.ts    # chiamata al backend Vercel (Gemini 2.5 Flash)
│   ├── local-save.ts       # POST al server locale (porta 5199)
│   └── config.ts           # URL, prompt e timeout
└── local-server/
    └── server.js           # server Node.js locale per la Daily Note
```

## Avvio

### Plugin (sviluppo)

```bash
npm install
npm run dev      # Vite su http://localhost:5177
npm run build    # build di produzione in dist/
```

### Server locale (sul Mac)

Il plugin salva le note solo quando il **Mac è acceso** e questo server è in
esecuzione. Resta in ascolto su `http://localhost:5199`.

```bash
npm run server   # node local-server/server.js
```

Scrive in `~/Documents/VaultSergio/Daily Notes/YYYY-MM-DD.md`, appendendo una
riga `- HH:MM <nota>` alla sezione `## 🧠 Note rapide` (creando file e sezione
se non esistono).

#### Contratto API del server locale

```
POST http://localhost:5199/nota
Content-Type: application/json

{ "testo": "Verificare ancoraggi pilastro P3", "data": "2026-06-08" }
```

Risposta: `{ "ok": true, "file": "...".md }`

## Note tecniche

- Display e-ink 576×288, 4-bit grayscale; layout solo testo via
  `CreateStartUpPageContainer` / `RebuildPageContainer`.
- Controlli: **doppio tap** = registra; **tap singolo** = torna alla home dalle
  schermate di errore/conferma.
- Il backend Vercel e `localhost:5199` sono in whitelist in `app.json`.
