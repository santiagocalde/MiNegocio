// Genera public/og-image.png — corré con: node generate-og.cjs
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const W = 1200, H = 630;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// ── Background ──────────────────────────────────────────────────
ctx.fillStyle = '#080E1F';
ctx.fillRect(0, 0, W, H);

// Orbe teal izquierda
const ot = ctx.createRadialGradient(60, H * 0.5, 0, 60, H * 0.5, 460);
ot.addColorStop(0, 'rgba(20,187,166,0.22)');
ot.addColorStop(1, 'rgba(20,187,166,0)');
ctx.fillStyle = ot;
ctx.fillRect(0, 0, W, H);

// Orbe violeta derecha
const ov = ctx.createRadialGradient(W, H * 0.8, 0, W, H * 0.8, 380);
ov.addColorStop(0, 'rgba(99,102,241,0.16)');
ov.addColorStop(1, 'rgba(99,102,241,0)');
ctx.fillStyle = ov;
ctx.fillRect(0, 0, W, H);

// Borde superior teal
const topBar = ctx.createLinearGradient(0, 0, W, 0);
topBar.addColorStop(0,   'rgba(20,187,166,0)');
topBar.addColorStop(0.3, '#14BBA6');
topBar.addColorStop(0.7, '#14BBA6');
topBar.addColorStop(1,   'rgba(20,187,166,0)');
ctx.fillStyle = topBar;
ctx.fillRect(0, 0, W, 3);

// Línea divisoria vertical
const divX = 730;
ctx.strokeStyle = 'rgba(255,255,255,0.07)';
ctx.lineWidth = 1;
ctx.beginPath(); ctx.moveTo(divX, 60); ctx.lineTo(divX, H - 60); ctx.stroke();

// ── LADO IZQUIERDO ──────────────────────────────────────────────
const lx = 72;

// Tag superior
const tagW = 226, tagH = 34, tagX = lx, tagY = 66;
ctx.fillStyle = 'rgba(20,187,166,0.12)';
ctx.beginPath(); ctx.roundRect(tagX, tagY, tagW, tagH, 6); ctx.fill();
ctx.strokeStyle = 'rgba(20,187,166,0.35)';
ctx.lineWidth = 1;
ctx.beginPath(); ctx.roundRect(tagX, tagY, tagW, tagH, 6); ctx.stroke();
ctx.fillStyle = '#14BBA6';
ctx.beginPath(); ctx.arc(tagX + 14, tagY + 17, 5, 0, Math.PI * 2); ctx.fill();
ctx.font = '700 12px sans-serif';
ctx.textBaseline = 'middle';
ctx.fillText('SOFTWARE PARA KIOSCOS', tagX + 26, tagY + 17);

// Headline
ctx.fillStyle = '#FFFFFF';
ctx.font = '800 86px sans-serif';
ctx.textBaseline = 'alphabetic';
ctx.fillText('Vendé sin', lx, 208);

const tealGrad = ctx.createLinearGradient(lx, 0, lx + 400, 0);
tealGrad.addColorStop(0, '#14BBA6');
tealGrad.addColorStop(1, '#1ED8C2');
ctx.fillStyle = tealGrad;
ctx.fillText('internet.', lx, 310);

ctx.fillStyle = 'rgba(255,255,255,0.92)';
ctx.fillText('Crecé.', lx, 408);

// Subtítulo
ctx.fillStyle = 'rgba(205,240,235,0.70)';
ctx.font = '500 22px sans-serif';
ctx.fillText('El sistema de ventas para kioscos de Argentina.', lx, 460);
ctx.fillText('Stock, caja y fiados en una sola pantalla.', lx, 492);

// Pills
const pills = ['Sin tarjeta de crédito', '7 días gratis', 'Soporte WhatsApp'];
let px = lx;
ctx.textBaseline = 'middle';
pills.forEach(text => {
  ctx.font = '600 13.5px sans-serif';
  const tw = ctx.measureText(text).width;
  const pw = tw + 28, ph = 32, py = 528;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 100); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 100); ctx.stroke();
  ctx.fillStyle = 'rgba(230,255,251,0.78)';
  ctx.fillText(text, px + 14, py + 16);
  px += pw + 10;
});

// ── LADO DERECHO — POS card ─────────────────────────────────────
const rx = divX + 44;
const cardW = W - rx - 50;
const cardH = 430;
const cardY = (H - cardH) / 2;

ctx.shadowColor = 'rgba(0,0,0,0.55)';
ctx.shadowBlur = 50;
ctx.shadowOffsetY = 16;
ctx.fillStyle = 'rgba(14,28,58,0.72)';
ctx.beginPath(); ctx.roundRect(rx, cardY, cardW, cardH, 16); ctx.fill();
ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

ctx.strokeStyle = 'rgba(20,187,166,0.2)';
ctx.lineWidth = 1;
ctx.beginPath(); ctx.roundRect(rx, cardY, cardW, cardH, 16); ctx.stroke();

ctx.fillStyle = 'rgba(255,255,255,0.025)';
ctx.beginPath(); ctx.roundRect(rx, cardY, cardW, 44, [16, 16, 0, 0]); ctx.fill();
ctx.strokeStyle = 'rgba(255,255,255,0.06)';
ctx.lineWidth = 1;
ctx.beginPath(); ctx.moveTo(rx, cardY + 44); ctx.lineTo(rx + cardW, cardY + 44); ctx.stroke();

[12, 28, 44].forEach((ox, i) => {
  ctx.fillStyle = i === 0 ? '#ff5f57' : i === 1 ? '#febc2e' : '#28c840';
  ctx.beginPath(); ctx.arc(rx + ox, cardY + 22, 5, 0, Math.PI * 2); ctx.fill();
});

ctx.fillStyle = 'rgba(255,255,255,0.5)';
ctx.font = '600 12px sans-serif';
ctx.textBaseline = 'middle';
ctx.textAlign = 'center';
ctx.fillText('MiNegocio · Caja', rx + cardW / 2, cardY + 22);

ctx.fillStyle = 'rgba(20,187,166,0.15)';
ctx.beginPath(); ctx.roundRect(rx + cardW - 68, cardY + 12, 56, 20, 4); ctx.fill();
ctx.fillStyle = '#14BBA6';
ctx.font = '700 10px sans-serif';
ctx.fillText('● EN VIVO', rx + cardW - 40, cardY + 22);
ctx.textAlign = 'left';

const items = [
  { emoji: '🥤', name: 'Coca-Cola 2.25L', price: '$2.500', qty: '×1' },
  { emoji: '🍞', name: 'Pan lactal',       price: '$1.800', qty: '×2' },
  { emoji: '🧉', name: 'Yerba 1kg',        price: '$3.200', qty: '×1' },
];

const itemStartY = cardY + 60;
items.forEach((it, i) => {
  const iy = itemStartY + i * 62;
  if (i > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(rx + 16, iy - 8); ctx.lineTo(rx + cardW - 16, iy - 8); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath(); ctx.roundRect(rx + 16, iy + 6, 36, 36, 8); ctx.fill();
  ctx.font = '20px serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(it.emoji, rx + 24, iy + 24);
  ctx.fillStyle = '#fff';
  ctx.font = '600 14px sans-serif';
  ctx.fillText(it.name, rx + 62, iy + 18);
  ctx.fillStyle = 'rgba(230,255,251,0.4)';
  ctx.font = '500 12px sans-serif';
  ctx.fillText(it.qty, rx + 62, iy + 36);
  ctx.fillStyle = 'rgba(230,255,251,0.88)';
  ctx.font = '700 14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(it.price, rx + cardW - 16, iy + 24);
  ctx.textAlign = 'left';
});

const totalY = itemStartY + items.length * 62 + 4;
ctx.strokeStyle = 'rgba(255,255,255,0.08)';
ctx.lineWidth = 1;
ctx.beginPath(); ctx.moveTo(rx, totalY); ctx.lineTo(rx + cardW, totalY); ctx.stroke();

ctx.fillStyle = 'rgba(230,255,251,0.45)';
ctx.font = '700 11px sans-serif';
ctx.textBaseline = 'middle';
ctx.fillText('TOTAL', rx + 16, totalY + 26);

ctx.fillStyle = '#FFFFFF';
ctx.font = '900 32px sans-serif';
ctx.textAlign = 'right';
ctx.fillText('$7.500', rx + cardW - 16, totalY + 26);
ctx.textAlign = 'left';

const btnY = totalY + 50;
const btnGrad = ctx.createLinearGradient(rx + 16, 0, rx + cardW - 16, 0);
btnGrad.addColorStop(0, '#14BBA6');
btnGrad.addColorStop(1, '#0EA896');
ctx.fillStyle = btnGrad;
ctx.shadowColor = 'rgba(20,187,166,0.4)';
ctx.shadowBlur = 20;
ctx.beginPath(); ctx.roundRect(rx + 16, btnY, cardW - 32, 46, 10); ctx.fill();
ctx.shadowBlur = 0;

ctx.fillStyle = '#fff';
ctx.font = '800 15px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('✓  Venta registrada', rx + cardW / 2, btnY + 23);
ctx.textAlign = 'left';

ctx.fillStyle = 'rgba(20,187,166,0.75)';
ctx.font = '600 11px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('Stock actualizado automáticamente', rx + cardW / 2, btnY + 60);
ctx.textAlign = 'left';

// ── Logo + dominio ──────────────────────────────────────────────
const logoPath = path.join(__dirname, 'src/assets/images/MiNegocio_transparente_real.png');

(async () => {
  try {
    const logo = await loadImage(logoPath);
    const lh = 40, lw = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, lx, H - lh - 28, lw, lh);
  } catch (_) { /* logo no disponible */ }

  ctx.fillStyle = 'rgba(230,255,251,0.35)';
  ctx.font = '500 14px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillText('mi-negocio.app', W - 52, H - 30);
  ctx.textAlign = 'left';

  const out = path.join(__dirname, 'public/og-image.png');
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  console.log('✓ og-image.png generado →', out);
})();
