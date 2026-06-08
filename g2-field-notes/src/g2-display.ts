// g2-display.ts — rendering testuale per il display e-ink 576x288 (4-bit grayscale)

import {
  TextContainerProperty,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'

const W = 576
const H = 288
const PAD = 6
const LINE = '------------------------------'

// Spezza un testo lungo su un numero massimo di righe da `width` caratteri.
function wrap(text: string, width: number, maxLines: number): string[] {
  const words = (text ?? '').trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= width) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word.length > width ? word.slice(0, width) : word
    }
    if (lines.length === maxLines) break
  }
  if (current && lines.length < maxLines) lines.push(current)

  // Se il testo è stato troncato, segnala con i puntini di sospensione.
  if (lines.length === maxLines) {
    const joined = lines.join(' ')
    if (joined.length < text.trim().length) {
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, width - 1) + '…'
    }
  }
  return lines.length ? lines : ['']
}

export class FieldNotesDisplay {
  private bridge: EvenAppBridge
  private initialized = false
  private lastContent = ''

  constructor(bridge: EvenAppBridge) {
    this.bridge = bridge
  }

  async initPage(): Promise<void> {
    const content = this.buildHome()
    const container = new TextContainerProperty({
      xPosition: 0, yPosition: 0, width: W, height: H,
      borderWidth: 0, borderColor: 5, paddingLength: PAD,
      containerID: 1, containerName: 'main', content, isEventCapture: 1,
    })
    await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: [container] })
    )
    this.lastContent = content
    await new Promise(r => setTimeout(r, 600))
    this.initialized = true
  }

  async update(content: string): Promise<void> {
    if (!this.initialized || content === this.lastContent) return
    this.lastContent = content
    const container = new TextContainerProperty({
      xPosition: 0, yPosition: 0, width: W, height: H,
      borderWidth: 0, borderColor: 5, paddingLength: PAD,
      containerID: 1, containerName: 'main', content, isEventCapture: 1,
    })
    await this.bridge.rebuildPageContainer(
      new RebuildPageContainer({ containerTotalNum: 1, textObject: [container] })
    )
  }

  // Schermata home — in attesa del doppio tap.
  buildHome(): string {
    return [
      '============================',
      '   🎙 G2 FIELD NOTES',
      '============================',
      '',
      ' Pronto a registrare.',
      '',
      ' Doppio tap per dettare',
      ' una nota dal campo.',
      LINE,
      ' [2x] Registra una nota',
    ].join('\n')
  }

  // Schermata di ascolto con countdown.
  buildListening(secondsLeft: number): string {
    return [
      '============================',
      '   🎙 Field Note',
      '============================',
      '',
      ' In ascolto...',
      '',
      `        ${secondsLeft}`,
      '',
      LINE,
      ' Parla ora.',
    ].join('\n')
  }

  // Anteprima del testo strutturato da Gemini (max 2 righe).
  buildPreview(testo: string): string {
    const [l1, l2] = wrap(testo, 30, 2)
    return [
      '== ANTEPRIMA NOTA ==',
      LINE,
      '',
      ` ${l1 ?? ''}`,
      ` ${l2 ?? ''}`,
      '',
      LINE,
      ' Salvataggio in corso...',
    ].join('\n')
  }

  // Conferma salvataggio riuscito.
  buildSaved(): string {
    return [
      '============================',
      '',
      '       ✅ Salvato',
      '',
      ' Nota aggiunta alla',
      ' Daily Note di oggi.',
      '',
      '============================',
    ].join('\n')
  }

  // Web Speech API non disponibile.
  buildMicUnavailable(): string {
    return [
      '============================',
      '',
      '   ⚠️ Mic non disponibile',
      '',
      ' Riconoscimento vocale',
      ' non supportato qui.',
      LINE,
      ' [2x] Riprova   [tap] Home',
    ].join('\n')
  }

  // Nessun parlato rilevato.
  buildNoSpeech(): string {
    return [
      '============================',
      '',
      '   ⚠️ Nessun audio',
      '',
      ' Non ho sentito nulla.',
      '',
      LINE,
      ' [2x] Riprova   [tap] Home',
    ].join('\n')
  }

  // Errore di salvataggio (server locale non raggiungibile).
  buildSaveError(): string {
    return [
      '============================',
      '',
      '   ⚠️ Salvataggio fallito',
      '',
      ' Server locale (5199)',
      ' non raggiungibile.',
      ' Mac acceso e server attivo?',
      LINE,
      ' [2x] Riprova   [tap] Home',
    ].join('\n')
  }

  buildError(message: string): string {
    const [l1, l2] = wrap(message, 28, 2)
    return [
      '== ERRORE ==',
      LINE,
      ` ${l1 ?? ''}`,
      ` ${l2 ?? ''}`,
      LINE,
      ' [2x] Riprova   [tap] Home',
    ].join('\n')
  }
}
