// artifact-image.ts — Artifact and class icon rendering for G2 image containers
// Loads PNG from /artifact-images/<id>.png or /class-images/<id>.png
// Falls back to a simple glyph if file not found.
// Output: two 180×144 PNG-encoded halves (top + bottom), matching SDK format.

import { BLACK_THRESHOLD } from './quest-image'

export const ART_IMG_W = 180
export const ART_IMG_H = 288

// ─── Cache pixel arrays per evitare ri-elaborazioni costose ──────────────────
// Come in quest-image.ts: la pipeline PNG→canvas→grayscale→PNG è lenta.
// Una volta elaborata, l'icona (artefatto o classe) resta in memoria per
// tutta la sessione, così profilo e schermata artefatto si aprono all'istante.
const _pixelCache = new Map<string, [number[], number[]]>()

function _loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** Process all pixels of the full 180×288 canvas in one pass, then encode
 *  each 180×144 half as a PNG byte array. */
function _processAndSplit(canvas: HTMLCanvasElement): [number[], number[]] {
  const halfH = ART_IMG_H / 2
  const ctx = canvas.getContext('2d')!
  const raw = ctx.getImageData(0, 0, ART_IMG_W, ART_IMG_H)
  const d = raw.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
    const g = lum < BLACK_THRESHOLD ? 0 : Math.round(lum / 17) * 17
    d[i] = d[i + 1] = d[i + 2] = g
    d[i + 3] = 255
  }
  ctx.putImageData(raw, 0, 0)
  return [_encodeHalf(canvas, 0), _encodeHalf(canvas, halfH)]
}

function _encodeHalf(src: HTMLCanvasElement, sy: number): number[] {
  const halfH = ART_IMG_H / 2
  const c = document.createElement('canvas')
  c.width = ART_IMG_W; c.height = halfH
  c.getContext('2d')!.drawImage(src, 0, sy, ART_IMG_W, halfH, 0, 0, ART_IMG_W, halfH)
  const bin = atob(c.toDataURL('image/png').split(',')[1])
  const out = new Array<number>(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function drawGlyph(ctx: CanvasRenderingContext2D, glyph: string): void {
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 96px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(glyph, ART_IMG_W / 2, ART_IMG_H / 2)
}

const FALLBACK_GLYPHS: Record<string, string> = {
  gauntlets_warrior: '🥊',
  shadow_cloak:      '🌑',
  ancient_tome:      '📖',
  iron_shield:       '🛡',
  dual_scope:        '🔭',
  elixir_flask:      '⚗',
  exp_crystal:       '💎',
  endurance_ring:    '💍',
  focus_stone:       '🔮',
  // classes
  combattente:       '⚔',
  assassino:         '🗡',
  mago:              '🔯',
  carro_armato:      '🛡',
  ranger:            '🏹',
  guaritore:         '✚',
}

export async function renderArtifactImage(artifactId: string): Promise<[number[], number[]]> {
  const cacheKey = `artifact_${artifactId}`
  if (_pixelCache.has(cacheKey)) return _pixelCache.get(cacheKey)!

  const canvas = document.createElement('canvas')
  canvas.width = ART_IMG_W
  canvas.height = ART_IMG_H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, ART_IMG_W, ART_IMG_H)

  const img = await _loadImage(`/artifact-images/${artifactId}.png`)
  if (img) {
    const scale = Math.min(ART_IMG_W / img.width, ART_IMG_H / img.height) * 0.88
    const dw = Math.round(img.width * scale)
    const dh = Math.round(img.height * scale)
    ctx.drawImage(img, (ART_IMG_W - dw) / 2, (ART_IMG_H - dh) / 2, dw, dh)
  } else {
    drawGlyph(ctx, FALLBACK_GLYPHS[artifactId] ?? '✦')
  }

  const result = _processAndSplit(canvas)
  _pixelCache.set(cacheKey, result)
  return result
}

export async function renderClassImage(classId: string): Promise<[number[], number[]]> {
  const cacheKey = `class_${classId}`
  if (_pixelCache.has(cacheKey)) return _pixelCache.get(cacheKey)!

  const canvas = document.createElement('canvas')
  canvas.width = ART_IMG_W
  canvas.height = ART_IMG_H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, ART_IMG_W, ART_IMG_H)

  const img = await _loadImage(`/class-images/${classId}.png`)
  if (img) {
    const scale = Math.min(ART_IMG_W / img.width, ART_IMG_H / img.height) * 0.88
    const dw = Math.round(img.width * scale)
    const dh = Math.round(img.height * scale)
    ctx.drawImage(img, (ART_IMG_W - dw) / 2, (ART_IMG_H - dh) / 2, dw, dh)
  } else {
    drawGlyph(ctx, FALLBACK_GLYPHS[classId] ?? '★')
  }

  const result = _processAndSplit(canvas)
  _pixelCache.set(cacheKey, result)
  return result
}
