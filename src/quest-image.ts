// quest-image.ts — Canvas illustrations for G2 image containers
// Two stacked containers: 180×144 top + 180×144 bottom = 180×288 total

export const IMG_W = 180
export const IMG_H = 144  // height of each container (2 stacked = 288 total)

/** Returns [topBase64PNG, bottomBase64PNG] for the two image containers */
export function renderQuestImages(templateId: string): [string, string] {
  const canvas = document.createElement('canvas')
  canvas.width = IMG_W
  canvas.height = IMG_H * 2
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, IMG_W, IMG_H * 2)
  ctx.strokeStyle = '#fff'
  ctx.fillStyle = '#fff'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const drawFn = ILLUSTRATIONS[templateId] ?? drawDefault
  drawFn(ctx, IMG_W, IMG_H * 2)

  return [
    cropToDataURL(canvas, 0, 0, IMG_W, IMG_H),
    cropToDataURL(canvas, 0, IMG_H, IMG_W, IMG_H),
  ]
}

function cropToDataURL(src: HTMLCanvasElement, x: number, y: number, w: number, h: number): string {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(src, x, y, w, h, 0, 0, w, h)
  // The SDK calls atob() directly on the string, so strip the data-URL prefix
  // ("data:image/png;base64,") and return only the raw base64 payload.
  return c.toDataURL('image/png').split(',')[1]
}

// ── Drawing helpers ────────────────────────────────────────────────────────────

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function lines(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.stroke()
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lw = 4) {
  ctx.lineWidth = lw
  ctx.strokeRect(x, y, w, h)
}

// ── Illustrations ──────────────────────────────────────────────────────────────

function drawRunning(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.58, cy = h * 0.30

  // Head
  ctx.lineWidth = 5
  circle(ctx, cx, cy, 18)

  // Torso leaning forward
  ctx.lineWidth = 8
  lines(ctx, [[cx, cy + 18], [cx - 18, cy + 65]])

  // Back arm (up-right)
  ctx.lineWidth = 6
  lines(ctx, [[cx - 5, cy + 35], [cx + 32, cy + 20]])

  // Front arm (down-left)
  lines(ctx, [[cx - 5, cy + 35], [cx - 38, cy + 55]])

  // Lead leg (extended forward and down)
  ctx.lineWidth = 7
  lines(ctx, [[cx - 18, cy + 65], [cx + 18, cy + 120], [cx + 38, cy + 175]])

  // Trailing leg (back and up)
  lines(ctx, [[cx - 18, cy + 65], [cx - 46, cy + 110], [cx - 60, cy + 70]])

  // Speed lines
  ctx.lineWidth = 3
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = 0.65 - i * 0.13
    const ly = cy + 20 + i * 25
    line(ctx, 8, ly, 8 + 50 - i * 8, ly)
  }
  ctx.globalAlpha = 1
}

function drawPushup(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.5, cy = h * 0.45

  // Head
  ctx.lineWidth = 5
  circle(ctx, cx + 52, cy - 42, 16)

  // Body (angled 20°)
  ctx.lineWidth = 8
  lines(ctx, [[cx + 52, cy - 26], [cx - 52, cy + 10]])

  // Right arm (bent, near head)
  ctx.lineWidth = 6
  lines(ctx, [[cx + 38, cy - 20], [cx + 30, cy + 22]])

  // Left arm (straight)
  lines(ctx, [[cx + 10, cy - 5], [cx, cy + 38]])

  // Legs
  ctx.lineWidth = 7
  lines(ctx, [[cx - 52, cy + 10], [cx - 68, cy + 56], [cx - 72, cy + 95]])
  lines(ctx, [[cx - 52, cy + 10], [cx - 38, cy + 62], [cx - 32, cy + 100]])

  // Ground line
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.4
  line(ctx, 5, cy + 100, w - 5, cy + 100)
  ctx.globalAlpha = 1
}

function drawCrunches(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.5, cy = h * 0.55

  // Head (raised)
  ctx.lineWidth = 5
  circle(ctx, cx - 48, cy - 50, 16)

  // Torso (angled up)
  ctx.lineWidth = 8
  lines(ctx, [[cx - 48, cy - 34], [cx + 20, cy - 8]])

  // Arms reaching forward
  ctx.lineWidth = 5
  lines(ctx, [[cx - 20, cy - 25], [cx + 42, cy - 45]])
  lines(ctx, [[cx - 20, cy - 25], [cx + 42, cy - 15]])

  // Hips
  ctx.lineWidth = 7
  // Left leg (bent, knee up)
  lines(ctx, [[cx + 20, cy - 8], [cx + 55, cy + 28], [cx + 25, cy + 72]])
  // Right leg (bent)
  lines(ctx, [[cx + 20, cy - 8], [cx + 65, cy + 15], [cx + 35, cy + 65]])

  // Ground line
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.4
  line(ctx, 5, cy + 72, w - 5, cy + 72)
  ctx.globalAlpha = 1
}

function drawPlank(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cy = h * 0.50

  // Head
  ctx.lineWidth = 5
  circle(ctx, w - 25, cy - 36, 16)

  // Horizontal body
  ctx.lineWidth = 9
  lines(ctx, [[w - 25, cy - 20], [20, cy + 8]])

  // Arms (straight, under body near head)
  ctx.lineWidth = 6
  lines(ctx, [[w - 40, cy - 10], [w - 52, cy + 38]])
  lines(ctx, [[w - 62, cy - 5], [w - 72, cy + 42]])

  // Legs (horizontal)
  ctx.lineWidth = 7
  lines(ctx, [[20, cy + 8], [12, cy + 55]])
  lines(ctx, [[35, cy + 5], [28, cy + 52]])

  // Ground line
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.4
  line(ctx, 5, cy + 56, w - 5, cy + 56)
  ctx.globalAlpha = 1

  // Timer dots (left side)
  ctx.globalAlpha = 0.7
  for (let i = 0; i < 5; i++) {
    ctx.lineWidth = 0
    circle(ctx, 12, cy - 100 + i * 22, 4 - i * 0.4)
    ctx.globalAlpha -= 0.12
  }
  ctx.globalAlpha = 1
}

function drawYoga(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.5, cy = h * 0.42

  // Aura rings
  ctx.lineWidth = 1.5
  for (let r = 55; r <= 100; r += 15) {
    ctx.globalAlpha = 0.15
    ctx.beginPath()
    ctx.arc(cx, cy + 30, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Head
  ctx.lineWidth = 5
  circle(ctx, cx, cy - 45, 18)

  // Torso straight
  ctx.lineWidth = 8
  lines(ctx, [[cx, cy - 27], [cx, cy + 10]])

  // Arms out to sides (hands on knees)
  ctx.lineWidth = 5
  lines(ctx, [[cx, cy - 15], [cx - 42, cy + 10], [cx - 52, cy + 42]])
  lines(ctx, [[cx, cy - 15], [cx + 42, cy + 10], [cx + 52, cy + 42]])

  // Legs crossed (lotus)
  ctx.lineWidth = 6
  lines(ctx, [[cx, cy + 10], [cx - 42, cy + 48], [cx + 10, cy + 70]])
  lines(ctx, [[cx, cy + 10], [cx + 42, cy + 48], [cx - 10, cy + 70]])

  // Rays from head
  ctx.lineWidth = 2.5
  const rays = [[-50, -28], [50, -28], [-60, 0], [60, 0], [-40, 25], [40, 25]]
  rays.forEach(([dx, dy], i) => {
    ctx.globalAlpha = 0.5 - i * 0.06
    line(ctx, cx + dx * 0.6, cy - 45 + dy * 0.6, cx + dx, cy - 45 + dy)
  })
  ctx.globalAlpha = 1
}

function drawStairs(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Staircase (4 steps going up-right)
  ctx.lineWidth = 5
  const steps: [number, number][] = [
    [12, h - 30],
    [12, h - 80],
    [50, h - 80],
    [50, h - 130],
    [88, h - 130],
    [88, h - 180],
    [126, h - 180],
    [126, h - 230],
    [w - 14, h - 230],
  ]
  ctx.globalAlpha = 0.6
  lines(ctx, steps)
  // Vertical fills
  ctx.globalAlpha = 0.25
  line(ctx, 50, h - 80, 50, h - 30)
  line(ctx, 88, h - 130, 88, h - 80)
  line(ctx, 126, h - 180, 126, h - 130)
  ctx.globalAlpha = 1

  // Running figure on stairs
  const fx = 95, fy = h - 240
  ctx.lineWidth = 5
  circle(ctx, fx, fy, 14)

  ctx.lineWidth = 6
  lines(ctx, [[fx, fy + 14], [fx - 12, fy + 50]])
  lines(ctx, [[fx - 4, fy + 28], [fx + 20, fy + 15]])
  lines(ctx, [[fx - 4, fy + 28], [fx - 26, fy + 42]])
  lines(ctx, [[fx - 12, fy + 50], [fx + 10, fy + 82], [fx + 22, fy + 115]])
  lines(ctx, [[fx - 12, fy + 50], [fx - 30, fy + 80], [fx - 38, fy + 55]])
}

function drawWalking(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.55, cy = h * 0.28

  // Head
  ctx.lineWidth = 5
  circle(ctx, cx, cy, 18)

  // Torso (upright)
  ctx.lineWidth = 8
  lines(ctx, [[cx, cy + 18], [cx, cy + 68]])

  // Arms (one forward, one back)
  ctx.lineWidth = 6
  lines(ctx, [[cx, cy + 32], [cx + 30, cy + 16]])
  lines(ctx, [[cx, cy + 32], [cx - 30, cy + 52]])

  // Legs
  ctx.lineWidth = 7
  // Front leg (extended forward)
  lines(ctx, [[cx, cy + 68], [cx + 22, cy + 118], [cx + 30, cy + 168]])
  // Back leg (slightly behind)
  lines(ctx, [[cx, cy + 68], [cx - 18, cy + 118], [cx - 10, cy + 168]])

  // Footstep dots behind
  const dotY = cy + 172
  ctx.lineWidth = 0
  const dotAlphas = [0.6, 0.45, 0.32, 0.2, 0.12]
  dotAlphas.forEach((a, i) => {
    ctx.globalAlpha = a
    circle(ctx, cx - 28 - i * 22, dotY, 5 - i * 0.5)
    circle(ctx, cx - 40 - i * 22, dotY + 10, 4 - i * 0.4)
  })
  ctx.globalAlpha = 1
}

function drawMeditation(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.5, cy = h * 0.40

  // Concentric aura rings
  ctx.lineWidth = 1.5
  for (let r = 50; r <= 95; r += 15) {
    ctx.globalAlpha = 0.18
    ctx.beginPath()
    ctx.arc(cx, cy + 25, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Head with glow
  ctx.lineWidth = 5
  circle(ctx, cx, cy - 42, 18)

  // Torso
  ctx.lineWidth = 8
  lines(ctx, [[cx, cy - 24], [cx, cy + 12]])

  // Arms relaxed down-out
  ctx.lineWidth = 5
  lines(ctx, [[cx, cy - 10], [cx - 38, cy + 8], [cx - 48, cy + 38]])
  lines(ctx, [[cx, cy - 10], [cx + 38, cy + 8], [cx + 48, cy + 38]])

  // Crossed legs
  ctx.lineWidth = 6
  lines(ctx, [[cx, cy + 12], [cx - 40, cy + 50], [cx + 12, cy + 68]])
  lines(ctx, [[cx, cy + 12], [cx + 40, cy + 50], [cx - 12, cy + 68]])

  // Rays from head (6 directions)
  ctx.lineWidth = 2.5
  const angles = [-70, -50, -30, 210, 230, 250]
  angles.forEach((a, i) => {
    const rad = (a * Math.PI) / 180
    ctx.globalAlpha = 0.55 - i * 0.04
    line(ctx,
      cx + Math.cos(rad) * 22,
      cy - 42 + Math.sin(rad) * 22,
      cx + Math.cos(rad) * 50,
      cy - 42 + Math.sin(rad) * 50,
    )
  })
  ctx.globalAlpha = 1
}

function drawBook(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.5, cy = h * 0.48
  const bw = 68, bh = 85  // half-book dimensions

  // Left page
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(cx, cy - bh)
  ctx.lineTo(cx - bw, cy - bh + 8)
  ctx.lineTo(cx - bw, cy + bh - 8)
  ctx.lineTo(cx, cy + bh)
  ctx.closePath()
  ctx.globalAlpha = 0.12
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.stroke()

  // Right page
  ctx.beginPath()
  ctx.moveTo(cx, cy - bh)
  ctx.lineTo(cx + bw, cy - bh + 8)
  ctx.lineTo(cx + bw, cy + bh - 8)
  ctx.lineTo(cx, cy + bh)
  ctx.closePath()
  ctx.globalAlpha = 0.12
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.stroke()

  // Spine
  ctx.lineWidth = 3
  line(ctx, cx, cy - bh, cx, cy + bh)

  // Text lines on left page
  ctx.lineWidth = 2.5
  for (let i = 0; i < 5; i++) {
    const ly = cy - 55 + i * 24
    const lx1 = cx - bw + 10
    ctx.globalAlpha = 0.7 - i * 0.08
    line(ctx, lx1, ly, cx - 12, ly + 2)
  }

  // Text lines on right page
  for (let i = 0; i < 5; i++) {
    const ly = cy - 55 + i * 24
    const lx2 = cx + bw - 10
    ctx.globalAlpha = 0.7 - i * 0.08
    line(ctx, cx + 12, ly + 2, lx2, ly)
  }
  ctx.globalAlpha = 1
}

function drawStudy(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.5, cy = h * 0.45

  // Brain outline
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.ellipse(cx, cy, 58, 65, 0, 0, Math.PI * 2)
  ctx.globalAlpha = 0.08
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.stroke()

  // Brain lobe divisions
  ctx.lineWidth = 2.5
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.moveTo(cx, cy - 65)
  ctx.bezierCurveTo(cx + 20, cy - 40, cx + 20, cy + 40, cx, cy + 65)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx - 58, cy)
  ctx.bezierCurveTo(cx - 30, cy - 20, cx + 30, cy - 20, cx + 58, cy)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Neural nodes
  const nodes: [number, number][] = [
    [cx, cy - 40], [cx - 35, cy - 25], [cx + 35, cy - 25],
    [cx - 42, cy + 10], [cx + 42, cy + 10],
    [cx - 25, cy + 38], [cx + 25, cy + 38], [cx, cy + 48],
  ]
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.5
  // Connections
  const edges = [[0,1],[0,2],[1,3],[2,4],[1,5],[2,6],[3,5],[4,6],[5,7],[6,7],[0,7]]
  edges.forEach(([a, b]) => {
    line(ctx, nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1])
  })
  ctx.globalAlpha = 1

  nodes.forEach(([nx, ny], i) => {
    ctx.lineWidth = 0
    circle(ctx, nx, ny, i === 0 ? 8 : 5)
  })
}

function drawWriting(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const px = w * 0.72, py = h * 0.18  // pen tip

  // Paper background
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.1
  ctx.fillRect(12, h * 0.35, w - 24, h * 0.55)
  ctx.globalAlpha = 1
  rect(ctx, 12, h * 0.35, w - 24, h * 0.55, 3)

  // Pen/quill (diagonal)
  ctx.lineWidth = 5
  lines(ctx, [[px, py], [px - 80, py + 120], [px - 88, py + 138]])
  // Pen body
  ctx.lineWidth = 14
  ctx.globalAlpha = 0.7
  lines(ctx, [[px - 8, py + 12], [px - 68, py + 108]])
  ctx.globalAlpha = 1

  // Written lines on paper
  ctx.lineWidth = 2.5
  for (let i = 0; i < 4; i++) {
    const ly = h * 0.42 + i * 26
    ctx.globalAlpha = 0.55 - i * 0.08
    const maxX = i < 2 ? w - 22 : w * 0.6
    line(ctx, 22, ly, maxX, ly)
  }
  ctx.globalAlpha = 1
}

function drawNoScreen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.5, cy = h * 0.44
  const mw = 130, mh = 85

  // Monitor frame
  ctx.lineWidth = 5
  ctx.strokeRect(cx - mw / 2, cy - mh / 2, mw, mh)
  ctx.globalAlpha = 0.08
  ctx.fillRect(cx - mw / 2, cy - mh / 2, mw, mh)
  ctx.globalAlpha = 1

  // Stand
  ctx.lineWidth = 5
  line(ctx, cx - 22, cy + mh / 2, cx + 22, cy + mh / 2)
  line(ctx, cx, cy + mh / 2, cx, cy + mh / 2 + 30)
  line(ctx, cx - 26, cy + mh / 2 + 30, cx + 26, cy + mh / 2 + 30)

  // Big X across screen
  ctx.lineWidth = 10
  line(ctx, cx - mw / 2 + 15, cy - mh / 2 + 12, cx + mw / 2 - 15, cy + mh / 2 - 12)
  line(ctx, cx + mw / 2 - 15, cy - mh / 2 + 12, cx - mw / 2 + 15, cy + mh / 2 - 12)
}

function drawSleep(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.38, cy = h * 0.30

  // Moon crescent
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(cx, cy, 52, 0, Math.PI * 2)
  ctx.globalAlpha = 0.08
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.stroke()

  // Inner circle (crescent cutout effect)
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(cx + 30, cy - 18, 42, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'

  // Stars
  const stars: [number, number, number][] = [
    [w * 0.78, h * 0.08, 5],
    [w * 0.88, h * 0.20, 3.5],
    [w * 0.72, h * 0.28, 3],
    [w * 0.92, h * 0.38, 2.5],
  ]
  stars.forEach(([sx, sy, sr]) => {
    ctx.lineWidth = 0
    circle(ctx, sx, sy, sr)
  })

  // Sleeping figure (horizontal)
  const fy = h * 0.65
  ctx.lineWidth = 5
  circle(ctx, w * 0.22, fy - 16, 16)

  ctx.lineWidth = 7
  lines(ctx, [[w * 0.22, fy], [w * 0.80, fy + 5]])

  ctx.lineWidth = 5
  lines(ctx, [[w * 0.38, fy - 5], [w * 0.32, fy - 35]])
  lines(ctx, [[w * 0.55, fy - 2], [w * 0.60, fy - 28]])

  ctx.lineWidth = 6
  lines(ctx, [[w * 0.80, fy + 5], [w * 0.75, fy + 45]])
  lines(ctx, [[w * 0.68, fy + 4], [w * 0.64, fy + 42]])

  // Zzz letters
  ctx.lineWidth = 5
  const zx = w * 0.60, zy = h * 0.38
  // Z1
  lines(ctx, [[zx, zy], [zx + 22, zy], [zx, zy + 22], [zx + 22, zy + 22]])
  // Z2 (smaller)
  ctx.lineWidth = 3.5
  ctx.globalAlpha = 0.7
  lines(ctx, [[zx + 26, zy - 12], [zx + 42, zy - 12], [zx + 26, zy + 4], [zx + 42, zy + 4]])
  // Z3 (smallest)
  ctx.lineWidth = 2.5
  ctx.globalAlpha = 0.45
  lines(ctx, [[zx + 46, zy - 22], [zx + 58, zy - 22], [zx + 46, zy - 10], [zx + 58, zy - 10]])
  ctx.globalAlpha = 1
}

function drawDefault(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2, cy = h / 2
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(cx, cy, 50, 0, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = 8
  line(ctx, cx, cy - 28, cx, cy + 12)
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.arc(cx, cy + 26, 4, 0, Math.PI * 2)
  ctx.fill()
}

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
