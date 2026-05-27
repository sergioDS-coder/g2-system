// artifact-image.ts — Artifact and class icon rendering for G2 image containers
// Loads PNG from /artifact-images/<id>.png or /class-images/<id>.png
// Falls back to a simple glyph if file not found.
// Output: two 180×144 PNG-encoded halves (top + bottom), matching SDK format.

export const ART_IMG_W = 180
export const ART_IMG_H = 288

async function loadImageFile(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function canvasHalfToPng(canvas: HTMLCanvasElement, sy: number): number[] {
  const halfH = ART_IMG_H / 2
  const c = document.createElement('canvas')
  c.width = ART_IMG_W
  c.height = halfH
  const ctx = c.getContext('2d')!
  ctx.drawImage(canvas, 0, sy, ART_IMG_W, halfH, 0, 0, ART_IMG_W, halfH)

  const img = ctx.getImageData(0, 0, ART_IMG_W, halfH)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
    const g = Math.round(lum / 17) * 17
    d[i] = d[i + 1] = d[i + 2] = g
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  const base64 = c.toDataURL('image/png').split(',')[1]
  const binary = atob(base64)
  return Array.from({ length: binary.length }, (_, i) => binary.charCodeAt(i))
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
  const canvas = document.createElement('canvas')
  canvas.width = ART_IMG_W
  canvas.height = ART_IMG_H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, ART_IMG_W, ART_IMG_H)

  const img = await loadImageFile(`/artifact-images/${artifactId}.png`)
  if (img) {
    const scale = Math.min(ART_IMG_W / img.width, ART_IMG_H / img.height) * 0.88
    const dw = Math.round(img.width * scale)
    const dh = Math.round(img.height * scale)
    const dx = (ART_IMG_W - dw) / 2
    const dy = (ART_IMG_H - dh) / 2
    ctx.drawImage(img, dx, dy, dw, dh)
  } else {
    drawGlyph(ctx, FALLBACK_GLYPHS[artifactId] ?? '✦')
  }

  return [canvasHalfToPng(canvas, 0), canvasHalfToPng(canvas, ART_IMG_H / 2)]
}

export async function renderClassImage(classId: string): Promise<[number[], number[]]> {
  const canvas = document.createElement('canvas')
  canvas.width = ART_IMG_W
  canvas.height = ART_IMG_H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, ART_IMG_W, ART_IMG_H)

  const img = await loadImageFile(`/class-images/${classId}.png`)
  if (img) {
    const scale = Math.min(ART_IMG_W / img.width, ART_IMG_H / img.height) * 0.88
    const dw = Math.round(img.width * scale)
    const dh = Math.round(img.height * scale)
    ctx.drawImage(img, (ART_IMG_W - dw) / 2, (ART_IMG_H - dh) / 2, dw, dh)
  } else {
    drawGlyph(ctx, FALLBACK_GLYPHS[classId] ?? '★')
  }

  return [canvasHalfToPng(canvas, 0), canvasHalfToPng(canvas, ART_IMG_H / 2)]
}
