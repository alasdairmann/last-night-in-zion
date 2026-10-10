// Title banner: a small pixel scene drawn with the game's own sprites, font and palette, scaled up crisp.
import { charSprite, pixelText, pixelTextWidth, makeCanvas } from '../render/sprites.js';
import { INK, RAMP } from '../render/palette.js';

const W = 180, H = 100, GROUND = 82;
const SKY = ['#141a2c', '#18203a', '#1e2744', '#252c4a', '#2e2f4a', '#3a3046'];

// rooftops: [x, w, h, kind]  kind: 0 flat, 1 pitched, 2 chapel spire
const ROOFS = [[0, 22, 20, 1], [20, 16, 26, 0], [36, 20, 18, 1], [56, 14, 34, 2], [70, 24, 22, 1], [110, 22, 24, 1], [132, 14, 30, 0], [146, 20, 18, 1], [166, 16, 26, 0]];
const WINDOWS = [[6, 70], [24, 64], [29, 64], [42, 72], [61, 60], [78, 68], [86, 68], [116, 66], [137, 60], [137, 68], [152, 72], [171, 64]];

function skyline(x) {
  x.fillStyle = '#10121c';
  for (const [rx, w, h, k] of ROOFS) {
    const top = GROUND - h;
    x.fillRect(rx, top, w, h);
    if (k === 1) for (let i = 0; i < w / 2; i++) x.fillRect(rx + i, top - Math.floor(i / 2), w - i * 2, 1);
    if (k === 2) { x.fillRect(rx + 5, top - 10, 4, 10); x.fillRect(rx + 6, top - 14, 2, 4); x.fillRect(rx + 6, top - 18, 2, 3); x.fillRect(rx + 5, top - 17, 4, 1); }
  }
  x.fillRect(48, GROUND - 22, 2, 6); x.fillRect(124, GROUND - 28, 3, 6); // chimneys
}

function bake() {
  const c = makeCanvas(W, H), x = c.getContext('2d');
  // banded sky, dithered at each step
  const band = Math.ceil(GROUND / SKY.length);
  SKY.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, i * band, W, band); });
  for (let i = 1; i < SKY.length; i++) { x.fillStyle = SKY[i]; for (let px = (i % 2); px < W; px += 2) x.fillRect(px, i * band - 1, 1, 1); }
  // stars
  x.fillStyle = '#8a90a8';
  for (let i = 0; i < 40; i++) x.fillRect((i * 53 + 7) % W, (i * 29) % 34, 1, 1);
  // moon, low and sick
  const mx = 166, my = 14, r = 8;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d = dx * dx + dy * dy; if (d > r * r) continue;
    x.fillStyle = d > (r - 1) * (r - 1) ? '#c8b070' : dx + dy > 4 ? '#d9c48a' : '#f0e2a8';
    x.fillRect(mx + dx, my + dy, 1, 1);
  }
  x.fillStyle = '#c8b070'; x.fillRect(mx - 3, my - 2, 2, 2); x.fillRect(mx + 2, my + 3, 3, 2); x.fillRect(mx + 1, my - 5, 1, 1);
  skyline(x);
  // road
  x.fillStyle = RAMP.tarmac[2]; x.fillRect(0, GROUND, W, H - GROUND);
  x.fillStyle = RAMP.tarmac[1]; x.fillRect(0, GROUND, W, 2);
  x.fillStyle = '#6a6448'; for (let px = 4; px < W; px += 14) x.fillRect(px, GROUND + 9, 7, 1);
  x.fillStyle = INK.darkest; for (let i = 0; i < 18; i++) x.fillRect((i * 37) % W, GROUND + 3 + (i * 7) % 14, 2, 1);
  return c;
}

// big blocky title: the 3x5 sign font at scale 3, outlined, with a 1px lit top edge
function title(x, text, cy, col, hi) {
  const s = 3, w = pixelTextWidth(text, s), tx = Math.round((W - w) / 2);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [2, 2], [1, 2], [2, 1]]) pixelText(x, text, tx + dx, cy + dy, INK.darkest, s);
  pixelText(x, text, tx, cy, col, s);
  x.save(); x.beginPath(); x.rect(0, cy, W, 1); x.clip(); pixelText(x, text, tx, cy, hi, s); x.restore();
}

export function mountTitleArt(cv) {
  if (!cv) return;
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  const bg = bake();
  // the dead shuffle in from both edges and loop
  const dead = [
    { k: 'walker', o: 0, x: -10, v: 3.2, f: 1 }, { k: 'walker', o: 2, x: 20, v: 2.6, f: 1 }, { k: 'runner', o: 1, x: -40, v: 6, f: 1 },
    { k: 'walker', o: 3, x: 190, v: 2.9, f: -1 }, { k: 'walker', o: 1, x: 160, v: 2.4, f: -1 }, { k: 'brute', o: 0, x: 215, v: 1.8, f: -1 },
  ];
  const embers = Array.from({ length: 10 }, (_, i) => ({ x: (i * 41) % W, y: GROUND - (i * 13) % 60, s: 6 + (i % 4) * 3 }));
  let last = performance.now(), t = 0;
  const frame = (now) => {
    if (!cv.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    x.drawImage(bg, 0, 0);
    // window lights, the odd one flickers out
    for (let i = 0; i < WINDOWS.length; i++) {
      const [wx, wy] = WINDOWS[i]; if ((Math.floor(t * 2 + i * 7) % 23) === 0) continue;
      x.fillStyle = i % 3 ? RAMP.led.amber : '#c8902a'; x.fillRect(wx, wy, 2, 2);
    }
    for (const e of embers) {
      e.y -= e.s * dt; e.x += Math.sin(t * 2 + e.s) * 4 * dt; if (e.y < 30) { e.y = GROUND; e.x = Math.random() * W; }
      x.fillStyle = e.s > 10 ? RAMP.blood.freshHi : RAMP.led.amber; x.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
    }
    // Cain holds the middle of the road
    const step = Math.floor(t * 3) % 2;
    const cain = charSprite('cain', 0, 0, 0, step ? 'attack' : 'walk');
    for (const d of dead) {
      d.x += d.v * d.f * dt;
      if (d.f > 0 && d.x > 70) d.x = -20 - Math.random() * 30;
      if (d.f < 0 && d.x < 94) d.x = W + 10 + Math.random() * 30;
      const spr = charSprite(d.k, d.o, 2, Math.floor(t * 4 + d.o) % 4, 'walk');
      x.save();
      if (d.f < 0) { x.translate(Math.round(d.x) + spr.width, 0); x.scale(-1, 1); x.drawImage(spr, 0, GROUND + 4 - spr.height); }
      else x.drawImage(spr, Math.round(d.x), GROUND + 4 - spr.height);
      x.restore();
    }
    x.fillStyle = 'rgba(20,16,13,0.5)'; x.fillRect(84, GROUND + 5, 12, 2);
    x.drawImage(cain, 82, GROUND + 6 - cain.height);
    title(x, 'LAST NIGHT', 6, RAMP.led.amber, '#ffe08a');
    title(x, 'IN ZION', 28, INK.lightest, INK.lightest);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
