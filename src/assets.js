// assets.ts - Definizioni grafiche per le icone
// Le icone vengono disegnate su un canvas 64x64 e convertite in PNG
export const drawSword = (ctx) => {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 54);
    ctx.lineTo(54, 10); // Lama
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(15, 40);
    ctx.lineTo(24, 49); // Elsa
    ctx.stroke();
};
export const drawTrophy = (ctx) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(20, 15, 24, 20); // Coppa
    ctx.fillRect(28, 35, 8, 10); // Gambo
    ctx.fillRect(22, 45, 20, 5); // Base
};
export const drawPlayer = (ctx) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(32, 20, 10, 0, Math.PI * 2); // Testa
    ctx.fill();
    ctx.fillRect(24, 32, 16, 20); // Corpo
};
export const drawWalking = (ctx) => {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(32, 15, 6, 0, Math.PI * 2); // Head
    ctx.moveTo(32, 21);
    ctx.lineTo(32, 40); // Body
    ctx.moveTo(32, 25);
    ctx.lineTo(20, 35); // Arm 1
    ctx.moveTo(32, 25);
    ctx.lineTo(44, 35); // Arm 2
    ctx.moveTo(32, 40);
    ctx.lineTo(24, 55); // Leg 1
    ctx.moveTo(32, 40);
    ctx.lineTo(40, 55); // Leg 2
    ctx.stroke();
};
export const drawSleep = (ctx) => {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 50);
    ctx.lineTo(54, 50); // Bed base
    ctx.moveTo(15, 50);
    ctx.lineTo(15, 40); // Headboard
    ctx.stroke();
    ctx.font = '24px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Z', 35, 30);
    ctx.fillText('z', 48, 15);
};
export const drawRun = (ctx) => {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(40, 15, 6, 0, Math.PI * 2); // Head
    ctx.moveTo(40, 21);
    ctx.lineTo(30, 35); // Body
    ctx.moveTo(30, 25);
    ctx.lineTo(15, 30); // Arm
    ctx.moveTo(30, 35);
    ctx.lineTo(20, 55); // Leg 1
    ctx.moveTo(30, 35);
    ctx.lineTo(50, 45); // Leg 2
    ctx.stroke();
};
export const drawPushup = (ctx) => {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 45);
    ctx.lineTo(54, 30); // Body
    ctx.arc(58, 25, 5, 0, Math.PI * 2); // Head
    ctx.moveTo(40, 35);
    ctx.lineTo(40, 55); // Arm
    ctx.stroke();
};
export const drawMeditate = (ctx) => {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(32, 15, 7, 0, Math.PI * 2); // Head
    ctx.moveTo(32, 22);
    ctx.lineTo(32, 40); // Body
    ctx.moveTo(32, 30);
    ctx.arc(32, 30, 15, 0.2, Math.PI - 0.2); // Arms
    ctx.stroke();
};
export const drawBook = (ctx) => {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 15, 44, 34);
    ctx.beginPath();
    ctx.moveTo(32, 15);
    ctx.lineTo(32, 49); // Middle spine
    ctx.stroke();
};
export const ICONS = {
    sword: drawSword,
    trophy: drawTrophy,
    player: drawPlayer,
    walking: drawWalking,
    sleep: drawSleep,
    run: drawRun,
    pushup: drawPushup,
    meditate: drawMeditate,
    book: drawBook,
};
