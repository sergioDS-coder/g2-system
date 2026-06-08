#!/usr/bin/env node
// server.js — Server locale per G2 Field Notes
//
// Resta in ascolto su http://localhost:5199 e appende le note dettate
// alla sezione "## 🧠 Note rapide" della Daily Note di Obsidian di oggi:
//   ~/Documents/VaultSergio/Daily Notes/YYYY-MM-DD.md
//
// Avvio:  node local-server/server.js     (oppure: npm run server)
// Funziona solo quando il Mac è acceso e questo processo è attivo.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const PORT = 5199
const SECTION = '## 🧠 Note rapide'
const VAULT_DIR = path.join(os.homedir(), 'Documents', 'VaultSergio', 'Daily Notes')

// ─── Utilità ─────────────────────────────────────────────────────────────────

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function nowHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Inserisce una riga in coda alla sezione SECTION, creandola se assente.
function appendToSection(content, line) {
  const lines = content.split('\n')
  const headerIdx = lines.findIndex(l => l.trim() === SECTION)

  if (headerIdx === -1) {
    // Sezione assente: la creiamo in fondo al file.
    const sep = content.length > 0 && !content.endsWith('\n') ? '\n' : ''
    const lead = content.length > 0 ? '\n' : ''
    return `${content}${sep}${lead}${SECTION}\n${line}\n`
  }

  // Trova la fine della sezione (prossimo header "## " o fine file).
  let endIdx = lines.length
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { endIdx = i; break }
  }

  // Indietreggia oltre le righe vuote finali della sezione.
  let insertIdx = endIdx
  while (insertIdx > headerIdx + 1 && lines[insertIdx - 1].trim() === '') {
    insertIdx--
  }

  lines.splice(insertIdx, 0, line)
  return lines.join('\n')
}

function saveNote(testo, data) {
  fs.mkdirSync(VAULT_DIR, { recursive: true })
  const filePath = path.join(VAULT_DIR, `${data}.md`)

  let content = ''
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8')
  }

  const line = `- ${nowHHMM()} ${testo.trim()}`
  const updated = appendToSection(content, line)
  fs.writeFileSync(filePath, updated, 'utf8')
  return filePath
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS })
  res.end(JSON.stringify(obj))
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/nota') {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 1e6) req.destroy() // guardia anti-abuso
    })
    req.on('end', () => {
      let payload
      try { payload = JSON.parse(body || '{}') }
      catch { return sendJson(res, 400, { ok: false, error: 'JSON non valido' }) }

      const testo = (payload.testo ?? '').toString().trim()
      const data = payload.data

      if (!testo) return sendJson(res, 400, { ok: false, error: 'Campo "testo" mancante' })
      if (!isValidDate(data)) return sendJson(res, 400, { ok: false, error: 'Campo "data" non valido (YYYY-MM-DD)' })

      try {
        const filePath = saveNote(testo, data)
        console.log(`[${nowHHMM()}] Nota salvata in ${filePath}`)
        sendJson(res, 200, { ok: true, file: filePath })
      } catch (err) {
        console.error('Errore salvataggio:', err)
        sendJson(res, 500, { ok: false, error: 'Errore di scrittura file' })
      }
    })
    return
  }

  sendJson(res, 404, { ok: false, error: 'Not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`G2 Field Notes — server locale in ascolto su http://localhost:${PORT}`)
  console.log(`Daily Notes: ${VAULT_DIR}`)
  console.log(`Sezione di destinazione: "${SECTION}"`)
})
