// artifact-image.ts — Artifact and class icon rendering for G2 image containers
// Loads PNG from /artifact-images/<id>.png or /class-images/<id>.png
// Falls back to a simple glyph if file not found.
// Output: single 180×288 container (full height, image centred vertically)

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

function canvasToBytes(canvas: HTMLCanvasElement): number[] {
  const ctx = canvas.getContext('2d')!
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const bytes: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    bytes.push(gray)
  }
  return bytes
}

function drawGlyph(ctx: CanvasRenderingContext2D, glyph: string): void {
  ctx.fillStyle = '#00ff88'
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

export async function renderArtifactImage(artifactId: string): Promise<number[]> {
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

  return canvasToBytes(canvas)
}

export async function renderClassImage(classId: string): Promise<number[]> {
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

  return canvasToBytes(canvas)
}
