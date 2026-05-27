// quest-image.ts — Quest illustrations for G2 image containers
// Loads PNG files from /quest-images/<templateId>.png when available,
// falls back to Canvas-generated silhouettes otherwise.
// Canvas: 180×288 total (two stacked 180×144 containers)

export const IMG_W = 180
export const IMG_H = 144

export interface QuestCardInfo {
  type: string    // FITNESS / MENTAL / JOLLY
  attr: string    // STR / AGI / VIT / INT / END
  exp: number
  amount: number
  unit: string
}

export async function renderQuestImages(
  templateId: string,
  info?: QuestCardInfo,
): Promise<[number[], number[]]> {
  const canvas = document.createElement('canvas')
  canvas.width = IMG_W
  canvas.height = IMG_H * 2
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, IMG_W, IMG_H * 2)

  const fileCanvas = await loadImageFile(`/quest-images/${templateId}.png`)
  if (fileCanvas) {
    ctx.drawImage(fileCanvas, 0, 0)
  } else {
    ctx.fillStyle = '#fff'
    const drawFn = ILLUSTRATIONS[templateId] ?? drawDefault
    drawFn(ctx, IMG_W, IMG_H * 2)
  }

  if (info) drawCardOverlay(ctx, info)

  return [
    canvasToImageBytes(canvas, 0, 0, IMG_W, IMG_H),
    canvasToImageBytes(canvas, 0, IMG_H, IMG_W, IMG_H),
  ]
}

/** Loads /wild-quest.png and splits it. Falls back to a Canvas-drawn card. */
export async function renderWildQuestImage(): Promise<[number[], number[]]> {
  const c = await loadImageFile('/wild-quest.png')
  if (c) {
    return [
      canvasToImageBytes(c, 0, 0, IMG_W, IMG_H),
      canvasToImageBytes(c, 0, IMG_H, IMG_W, IMG_H),
    ]
  }
  const canvas = document.createElement('canvas')
  canvas.width = IMG_W
  canvas.height = IMG_H * 2
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, IMG_W, IMG_H * 2)
  ctx.fillStyle = '#fff'
  drawWildQuestCard(ctx, IMG_W, IMG_H * 2)
  return [
    canvasToImageBytes(canvas, 0, 0, IMG_W, IMG_H),
    canvasToImageBytes(canvas, 0, IMG_H, IMG_W, IMG_H),
  ]
}

function drawWildQuestCard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Double border frame
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 3
  ctx.strokeRect(6, 6, w - 12, h - 12)
  ctx.lineWidth = 1
  ctx.strokeRect(11, 11, w - 22, h - 22)

  // Header band "WILD"
  ctx.fillStyle = '#fff'
  ctx.fillRect(6, 6, w - 12, 44)
  ctx.fillStyle = '#000'
  ctx.font = 'bold 26px monospace'
  ctx.fillText('WILD', w / 2, 28)
  ctx.fillStyle = '#fff'
  ctx.fillRect(11, 50, w - 22, 2)

  // Aura glow behind the question marks
  const cy = h / 2 - 16
  for (let r = 72; r >= 28; r -= 22) {
    ctx.globalAlpha = 0.07
    ctx.beginPath(); ctx.arc(w / 2, cy, r, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1

  // Three question marks arranged in a triangle
  ctx.font = 'bold 72px monospace'
  ctx.fillText('?', w / 2 - 44, cy - 14)
  ctx.fillText('?', w / 2 + 44, cy - 14)
  ctx.font = 'bold 80px monospace'
  ctx.fillText('?', w / 2, cy + 24)

  // Decorative corner marks
  ctx.lineWidth = 2
  ctx.strokeStyle = '#fff'
  for (const [x, y, dx, dy] of [[16,56,1,1],[w-16,56,-1,1],[16,h-56,1,-1],[w-16,h-56,-1,-1]] as [number,number,number,number][]) {
    ctx.globalAlpha = 0.55
    ctx.beginPath()
    ctx.moveTo(x, y); ctx.lineTo(x + dx * 14, y)
    ctx.moveTo(x, y); ctx.lineTo(x, y + dy * 14)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Footer band "QUEST"
  ctx.fillStyle = '#fff'
  ctx.fillRect(11, h - 52, w - 22, 2)
  ctx.fillRect(6, h - 50, w - 12, 44)
  ctx.fillStyle = '#000'
  ctx.font = 'bold 26px monospace'
  ctx.fillText('QUEST', w / 2, h - 28)
  ctx.fillStyle = '#fff'
}

/** Loads /welcome-images/<rank>.png and splits it into the two containers.
 *  Falls back to a Canvas-drawn rank card if the PNG file is not found. */
export async function renderWelcomeImage(rank: string): Promise<[number[], number[]]> {
  const c = await loadImageFile(`/welcome-images/${rank}.png`)
  if (c) {
    return [
      canvasToImageBytes(c, 0, 0, IMG_W, IMG_H),
      canvasToImageBytes(c, 0, IMG_H, IMG_W, IMG_H),
    ]
  }
  return renderRankCard(rank)
}

/** Draws a top "type" header and a bottom stats band over the icon. */
function drawCardOverlay(ctx: CanvasRenderingContext2D, info: QuestCardInfo) {
  const W = IMG_W, H = IMG_H * 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Top header band
  ctx.fillStyle = 'rgba(0,0,0,0.82)'
  ctx.fillRect(0, 0, W, 42)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 22px monospace'
  ctx.fillText(info.type, W / 2, 19)
  ctx.fillRect(24, 37, W - 48, 2)

  // Bottom stats band
  const bandY = H - 60
  ctx.fillStyle = 'rgba(0,0,0,0.82)'
  ctx.fillRect(0, bandY, W, 60)
  ctx.fillStyle = '#fff'
  ctx.fillRect(24, bandY, W - 48, 2)
  ctx.font = 'bold 26px monospace'
  ctx.fillText(`+${info.exp} EXP`, W / 2, bandY + 22)
  ctx.font = '17px monospace'
  ctx.fillText(`${info.attr} · ${info.amount} ${info.unit}`, W / 2, bandY + 45)
}

/** Canvas-drawn rank card — used when the PNG file is not found. */
function renderRankCard(rank: string): [number[], number[]] {
  const canvas = document.createElement('canvas')
  canvas.width = IMG_W
  canvas.height = IMG_H * 2
  const ctx = canvas.getContext('2d')!
  const W = IMG_W, H = IMG_H * 2

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Outer border (double frame)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.strokeRect(8, 8, W - 16, H - 16)
  ctx.lineWidth = 1
  ctx.strokeRect(13, 13, W - 26, H - 26)

  // Header band: filled white, black text "SYSTEM RANK"
  ctx.fillRect(8, 8, W - 16, 36)
  ctx.fillStyle = '#000'
  ctx.font = 'bold 14px monospace'
  ctx.fillText('SYSTEM RANK', W / 2, 26)
  ctx.fillStyle = '#fff'

  // Divider below header
  ctx.fillRect(13, 44, W - 26, 1)

  // Subtle aura circles behind the rank letter
  const cy = 128
  for (let r = 58; r >= 28; r -= 15) {
    ctx.globalAlpha = 0.07
    ctx.beginPath(); ctx.arc(W / 2, cy, r, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1

  // Large rank letter
  const fs = rank.length === 1 ? 92 : rank.length === 2 ? 68 : 50
  ctx.font = `bold ${fs}px monospace`
  ctx.fillText(rank, W / 2, cy)

  // Divider above stars
  ctx.font = '1px monospace'
  ctx.fillRect(13, 193, W - 26, 1)

  // Stars (1 per F … 9 per SSS)
  const STAR_COUNT: Record<string, number> = { F:1, E:2, D:3, C:4, B:5, A:6, S:7, SS:8, SSS:9 }
  const total = STAR_COUNT[rank] ?? 1
  ctx.font = '15px monospace'
  const sp = 19
  let left = total, sy = 211
  while (left > 0) {
    const n = Math.min(left, 5)
    const ox = W / 2 - (n * sp) / 2 + sp / 2
    for (let i = 0; i < n; i++) ctx.fillText('★', ox + i * sp, sy)
    left -= n; sy += 21
  }

  // Divider above footer
  ctx.fillRect(13, H - 36, W - 26, 1)

  // Footer label
  ctx.font = 'bold 13px monospace'
  ctx.fillText('H U N T E R', W / 2, H - 20)

  return [
    canvasToImageBytes(canvas, 0, 0, IMG_W, IMG_H),
    canvasToImageBytes(canvas, 0, IMG_H, IMG_W, IMG_H),
  ]
}

function loadImageFile(url: string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = IMG_W
      c.height = IMG_H * 2
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, IMG_W, IMG_H * 2)
      ctx.drawImage(img, 0, 0, IMG_W, IMG_H * 2)
      resolve(c)
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Extracts a region, quantizes to 16 gray levels and encodes as PNG.
 *  Returns raw bytes as number[] — the format recommended by the Even SDK for
 *  imageData in ImageRawDataUpdate (number[] is passed as List<int> to Flutter,
 *  which correctly forwards binary to the glasses firmware via BLE). */
function canvasToImageBytes(src: HTMLCanvasElement, sx: number, sy: number, w: number, h: number): number[] {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, sx, sy, w, h, 0, 0, w, h)

  // Quantize to 16 gray levels before encoding
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
    const g = Math.round(lum / 17) * 17
    d[i] = d[i + 1] = d[i + 2] = g
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  // PNG (lossless) → decode base64 → number[] of raw bytes
  const base64 = c.toDataURL('image/png').split(',')[1]
  const binary = atob(base64)
  return Array.from({ length: binary.length }, (_, i) => binary.charCodeAt(i))
}

// ── Silhouette primitives ──────────────────────────────────────────────────────

function head(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/** Filled capsule (pill) between two points — the core limb primitive */
function capsule(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, r: number) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.arc(x1, y1, r, a + Math.PI / 2, a - Math.PI / 2, true)
  ctx.arc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2, true)
  ctx.closePath()
  ctx.fill()
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

// ── Illustrations ──────────────────────────────────────────────────────────────

function drawRunning(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
  const cx = 108, top = 38
  // head
  head(ctx, cx, top + 22, 22)
  // torso (leaning forward)
  capsule(ctx, cx, top + 44, cx - 20, top + 118, 14)
  // arms
  capsule(ctx, cx - 6, top + 74, cx + 46, top + 46, 9)   // back arm (up-right)
  capsule(ctx, cx - 6, top + 74, cx - 46, top + 100, 9)  // front arm (down-left)
  // front leg
  capsule(ctx, cx - 20, top + 118, cx + 22, top + 190, 11)
  capsule(ctx, cx + 22, top + 190, cx + 36, top + 250, 10)
  // rear leg (kick up)
  capsule(ctx, cx - 20, top + 118, cx - 52, top + 174, 11)
  capsule(ctx, cx - 52, top + 174, cx - 65, top + 130, 9)
}

function drawWalking(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
  const cx = 90, top = 28
  // head
  head(ctx, cx, top + 22, 22)
  // torso (upright)
  capsule(ctx, cx, top + 44, cx, top + 122, 13)
  // arms (one forward, one back)
  capsule(ctx, cx, top + 68, cx + 36, top + 46, 9)
  capsule(ctx, cx, top + 68, cx - 36, top + 90, 9)
  // front leg
  capsule(ctx, cx, top + 122, cx + 24, top + 198, 11)
  capsule(ctx, cx + 24, top + 198, cx + 28, top + 258, 10)
  // back leg
  capsule(ctx, cx, top + 122, cx - 18, top + 196, 11)
  capsule(ctx, cx - 18, top + 196, cx - 10, top + 258, 10)
}

function drawPushup(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
  const cy = 138
  // head
  head(ctx, 148, cy - 50, 20)
  // torso (angled down-left)
  capsule(ctx, 148, cy - 30, 36, cy + 10, 13)
  // right arm (bent, near head)
  capsule(ctx, 132, cy - 22, 124, cy + 30, 9)
  // left arm (straight)
  capsule(ctx, 84, cy - 5, 76, cy + 40, 9)
  // legs (two close together)
  capsule(ctx, 36, cy + 10, 18, cy + 65, 11)
  capsule(ctx, 18, cy + 65, 16, cy + 108, 10)
  capsule(ctx, 52, cy + 6, 36, cy + 60, 11)
  capsule(ctx, 36, cy + 60, 34, cy + 104, 10)
}

function drawCrunches(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
  const cy = 165
  // head (raised, upper-left)
  head(ctx, 30, cy - 55, 19)
  // torso (angled up-left)
  capsule(ctx, 30, cy - 36, 95, cy - 8, 12)
  // arms reaching forward
  capsule(ctx, 58, cy - 24, 112, cy - 42, 8)
  capsule(ctx, 58, cy - 24, 112, cy - 10, 8)
  // hips + bent knees
  capsule(ctx, 95, cy - 8, 142, cy + 32, 12)
  capsule(ctx, 142, cy + 32, 112, cy + 80, 10)
  capsule(ctx, 95, cy - 8, 150, cy + 18, 12)
  capsule(ctx, 150, cy + 18, 124, cy + 68, 10)
  // lower spine to ground
  capsule(ctx, 30, cy - 36, 16, cy + 28, 10)
}

function drawPlank(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
  const cy = 158
  // head
  head(ctx, 158, cy - 44, 20)
  // body (horizontal)
  capsule(ctx, 158, cy - 24, 20, cy + 8, 13)
  // arms (straight down)
  capsule(ctx, 140, cy - 16, 132, cy + 38, 9)
  capsule(ctx, 108, cy - 6, 100, cy + 44, 9)
  // feet
  capsule(ctx, 20, cy + 8, 16, cy + 54, 10)
  capsule(ctx, 36, cy + 5, 32, cy + 50, 10)
}

function drawYoga(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
  const cx = 90, cy = 155
  // subtle aura rings
  for (let r = 82; r >= 46; r -= 18) {
    ctx.globalAlpha = 0.09
    ctx.beginPath()
    ctx.arc(cx, cy + 8, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // head
  head(ctx, cx, cy - 90, 22)
  // torso (straight)
  capsule(ctx, cx, cy - 68, cx, cy - 24, 13)
  // arms out (hands resting on knees)
  capsule(ctx, cx, cy - 46, cx - 55, cy - 20, 9)
  capsule(ctx, cx - 55, cy - 20, cx - 62, cy + 10, 8)
  capsule(ctx, cx, cy - 46, cx + 55, cy - 20, 9)
  capsule(ctx, cx + 55, cy - 20, cx + 62, cy + 10, 8)
  // lotus legs (crossed)
  capsule(ctx, cx, cy - 24, cx - 48, cy + 16, 11)
  capsule(ctx, cx - 48, cy + 16, cx + 14, cy + 40, 10)
  capsule(ctx, cx, cy - 24, cx + 48, cy + 16, 11)
  capsule(ctx, cx + 48, cy + 16, cx - 14, cy + 40, 10)
}

function drawStairs(ctx: CanvasRenderingContext2D, _w: number, h: number) {
  // staircase (4 steps, all right-edges aligned)
  ctx.globalAlpha = 0.52
  for (let i = 0; i < 4; i++) {
    const sx = 10 + i * 36
    const sy = h - 32 - i * 56
    rrect(ctx, sx, sy, h - 32 - sx, 13, 3)
  }
  ctx.globalAlpha = 1

  // person climbing (compact, ~125px tall)
  const fx = 40, fy = 74
  head(ctx, fx, fy + 13, 15)
  capsule(ctx, fx, fy + 28, fx - 3, fy + 72, 10)
  capsule(ctx, fx - 2, fy + 42, fx + 26, fy + 26, 8)
  capsule(ctx, fx - 2, fy + 42, fx - 26, fy + 58, 8)
  capsule(ctx, fx - 3, fy + 72, fx + 18, fy + 108, 10)
  capsule(ctx, fx + 18, fy + 108, fx + 22, fy + 140, 9)
  capsule(ctx, fx - 3, fy + 72, fx - 22, fy + 106, 10)
  capsule(ctx, fx - 22, fy + 106, fx - 16, fy + 140, 9)
}

function drawMeditation(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
  const cx = 90, cy = 158
  // aura rings
  for (let r = 84; r >= 48; r -= 18) {
    ctx.globalAlpha = 0.09
    ctx.beginPath()
    ctx.arc(cx, cy + 10, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // head
  head(ctx, cx, cy - 90, 22)
  // torso
  capsule(ctx, cx, cy - 68, cx, cy - 24, 13)
  // arms relaxed down-out (palms on knees)
  capsule(ctx, cx, cy - 46, cx - 50, cy - 12, 9)
  capsule(ctx, cx - 50, cy - 12, cx - 58, cy + 18, 8)
  capsule(ctx, cx, cy - 46, cx + 50, cy - 12, 9)
  capsule(ctx, cx + 50, cy - 12, cx + 58, cy + 18, 8)
  // lotus legs
  capsule(ctx, cx, cy - 24, cx - 48, cy + 18, 11)
  capsule(ctx, cx - 48, cy + 18, cx + 14, cy + 40, 10)
  capsule(ctx, cx, cy - 24, cx + 48, cy + 18, 11)
  capsule(ctx, cx + 48, cy + 18, cx - 14, cy + 40, 10)
}

function drawBook(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
  const cx = 90, cy = 144
  const bw = 72, bh = 96

  // left page
  ctx.save()
  ctx.translate(cx - bw / 2, cy - bh / 2)
  ctx.rotate(-0.04)
  rrect(ctx, 0, 0, bw, bh, 6)
  ctx.restore()

  // right page
  ctx.save()
  ctx.translate(cx, cy - bh / 2)
  ctx.rotate(0.04)
  rrect(ctx, 0, 0, bw, bh, 6)
  ctx.restore()

  // spine strip (black)
  ctx.fillStyle = '#000'
  rrect(ctx, cx - 8, cy - bh / 2, 16, bh, 5)
  ctx.fillStyle = '#fff'

  // text lines on pages (black = cutout effect)
  ctx.fillStyle = '#000'
  for (let i = 0; i < 5; i++) {
    const ly = cy - bh / 2 + 18 + i * 18
    ctx.fillRect(cx - bw + 10, ly, bw - 22, 6)
    ctx.fillRect(cx + 10, ly + 2, bw - 22, 6)
  }
  ctx.fillStyle = '#fff'
}

function drawStudy(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
  const cx = 90
  // large filled lightning bolt (knowledge/focus)
  ctx.beginPath()
  ctx.moveTo(cx + 28, 50)
  ctx.lineTo(cx - 20, 152)
  ctx.lineTo(cx + 10, 152)
  ctx.lineTo(cx - 30, 258)
  ctx.lineTo(cx + 20, 165)
  ctx.lineTo(cx - 10, 165)
  ctx.closePath()
  ctx.fill()
}

function drawWriting(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
  // paper
  ctx.globalAlpha = 0.2
  rrect(ctx, 14, 92, 148, 168, 8)
  ctx.globalAlpha = 1

  // text lines (filled rectangles)
  for (let i = 0; i < 5; i++) {
    const lw = i === 3 ? 82 : 128
    ctx.globalAlpha = 0.62 - i * 0.09
    ctx.fillRect(24, 110 + i * 28, lw, 7)
  }
  ctx.globalAlpha = 1

  // pencil (diagonal filled capsule, upper-right)
  capsule(ctx, 152, 44, 74, 178, 11)

  // pencil tip (dark point)
  ctx.fillStyle = '#000'
  capsule(ctx, 74, 178, 64, 198, 5)
  ctx.fillStyle = '#fff'

  // eraser cap (small circle at top)
  head(ctx, 152, 44, 13)
}

function drawNoScreen(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
  const cx = 90, cy = 118
  const mw = 144, mh = 92

  // monitor frame (white)
  rrect(ctx, cx - mw / 2, cy - mh / 2, mw, mh, 8)
  // screen (black cutout)
  ctx.fillStyle = '#000'
  rrect(ctx, cx - mw / 2 + 8, cy - mh / 2 + 8, mw - 16, mh - 16, 4)
  ctx.fillStyle = '#fff'
  // stand
  rrect(ctx, cx - 22, cy + mh / 2, 44, 10, 4)
  rrect(ctx, cx - 6, cy + mh / 2 + 10, 12, 30, 3)
  rrect(ctx, cx - 30, cy + mh / 2 + 40, 60, 13, 5)

  // X on screen (two diagonal capsules, white over black)
  capsule(ctx, cx - 40, cy - 28, cx + 40, cy + 28, 10)
  capsule(ctx, cx + 40, cy - 28, cx - 40, cy + 28, 10)
}

function drawSleep(ctx: CanvasRenderingContext2D, w: number, _h: number) {
  // crescent moon
  head(ctx, 50, 76, 54)
  ctx.fillStyle = '#000'
  head(ctx, 75, 55, 46)
  ctx.fillStyle = '#fff'

  // stars
  for (const [sx, sy, sr] of [[145, 22, 8], [162, 58, 5], [128, 78, 4]] as [number,number,number][]) {
    head(ctx, sx, sy, sr)
  }

  // sleeping figure (horizontal)
  const fy = 198
  head(ctx, 26, fy - 18, 18)
  capsule(ctx, 26, fy, 148, fy + 8, 12)
  // arm over body
  capsule(ctx, 52, fy - 4, 46, fy - 34, 8)
  // feet/legs
  capsule(ctx, 148, fy + 8, 138, fy + 54, 10)
  capsule(ctx, 124, fy + 7, 114, fy + 52, 10)

  // Zzz (stroke-based, small)
  ctx.strokeStyle = '#fff'
  ctx.lineCap = 'round'
  const drawZ = (zx: number, zy: number, s: number, alpha: number) => {
    ctx.globalAlpha = alpha
    ctx.lineWidth = Math.max(3, s * 0.28)
    ctx.beginPath()
    ctx.moveTo(zx, zy)
    ctx.lineTo(zx + s, zy)
    ctx.lineTo(zx, zy + s)
    ctx.lineTo(zx + s, zy + s)
    ctx.stroke()
  }
  drawZ(w * 0.58, 140, 20, 1)
  drawZ(w * 0.72, 118, 15, 0.72)
  drawZ(w * 0.84, 100, 11, 0.46)
  ctx.globalAlpha = 1
  ctx.strokeStyle = '#000'
}

function drawDefault(ctx: CanvasRenderingContext2D, w: number, _h: number) {
  const cx = w / 2
  head(ctx, cx, 78, 28)
  capsule(ctx, cx, 106, cx, 188, 16)
  capsule(ctx, cx, 136, cx - 40, 114, 10)
  capsule(ctx, cx, 136, cx + 40, 114, 10)
  capsule(ctx, cx, 188, cx - 22, 258, 12)
  capsule(ctx, cx, 188, cx + 22, 258, 12)
}

// ── Illustration map ───────────────────────────────────────────────────────────

const ILLUSTRATIONS: Record<string, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = {
  corsa: drawRunning,
  flessioni: drawPushup,
  addominali: drawCrunches,
  plank: drawPlank,
  yoga: drawYoga,
  scale: drawStairs,
  fixed_camminata: drawWalking,
  meditazione: drawMeditation,
  lettura: drawBook,
  studio: drawStudy,
  scrittura: drawWriting,
  noscreen: drawNoScreen,
  fixed_sonno: drawSleep,
}
