// assets.ts - Icone raw in scala di grigi a 4 bit (0-15)
// Dimensioni: 64x64 (4096 pixel)

function createIcon(draw: (x: number, y: number) => number): number[] {
  const data: number[] = [];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      data.push(draw(x, y));
    }
  }
  return data;
}

// Icona Spada (Boot/Quest)
export const ICON_SWORD = createIcon((x, y) => {
  // Lama
  if (x === y && x > 20 && x < 50) return 15;
  if (x === y + 1 && x > 20 && x < 50) return 10;
  // Elsa
  if (x + y === 40 && x > 15 && x < 25) return 12;
  return 0;
});

// Icona Trofeo (Ranking)
export const ICON_TROPHY = createIcon((x, y) => {
  // Coppa
  if (y > 15 && y < 35 && x > 20 && x < 44) return 15;
  // Base
  if (y > 45 && y < 50 && x > 25 && x < 39) return 12;
  // Gambo
  if (y >= 35 && y <= 45 && x > 30 && x < 34) return 10;
  return 0;
});

// Icona Player (Profilo)
export const ICON_PLAYER = createIcon((x, y) => {
  // Testa
  const dx = x - 32, dy = y - 20;
  if (dx*dx + dy*dy < 64) return 15;
  // Corpo
  if (x > 28 && x < 36 && y >= 28 && y < 50) return 12;
  return 0;
});

export const ICONS: Record<string, number[]> = {
  sword: ICON_SWORD,
  trophy: ICON_TROPHY,
  player: ICON_PLAYER,
};
