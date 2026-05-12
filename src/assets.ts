// assets.ts - Definizioni grafiche per le icone
// Le icone vengono disegnate su un canvas 64x64 e convertite in PNG

export type IconDrawer = (ctx: CanvasRenderingContext2D) => void;

export const drawSword: IconDrawer = (ctx) => {
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(10, 54); ctx.lineTo(54, 10); // Lama
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(15, 40); ctx.lineTo(24, 49); // Elsa
  ctx.stroke();
};

export const drawTrophy: IconDrawer = (ctx) => {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(20, 15, 24, 20); // Coppa
  ctx.fillRect(28, 35, 8, 10);  // Gambo
  ctx.fillRect(22, 45, 20, 5);  // Base
};

export const drawPlayer: IconDrawer = (ctx) => {
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(32, 20, 10, 0, Math.PI * 2); // Testa
  ctx.fill();
  ctx.fillRect(24, 32, 16, 20); // Corpo
};

export const ICONS: Record<string, IconDrawer> = {
  sword: drawSword,
  trophy: drawTrophy,
  player: drawPlayer,
};
