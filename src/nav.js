// Flow fields (PRD §27.4): BFS distance from a goal tile over walkable tiles. O(1) lookup per enemy.
export const INF = 65535;

export function bfs(W, H, walk, sx, sy, out, queue) {
  out.fill(INF);
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return out;
  const start = sy * W + sx;
  let head = 0, tail = 0;
  out[start] = 0; queue[tail++] = start;
  while (head < tail) {
    const i = queue[head++]; const d = out[i] + 1;
    const x = i % W;
    if (x > 0 && walk[i - 1] && out[i - 1] === INF) { out[i - 1] = d; queue[tail++] = i - 1; }
    if (x < W - 1 && walk[i + 1] && out[i + 1] === INF) { out[i + 1] = d; queue[tail++] = i + 1; }
    if (i >= W && walk[i - W] && out[i - W] === INF) { out[i - W] = d; queue[tail++] = i - W; }
    if (i < W * (H - 1) && walk[i + W] && out[i + W] === INF) { out[i + W] = d; queue[tail++] = i + W; }
  }
  return out;
}

const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Returns the centre of the best neighbouring tile to step towards, or null if at goal / unreachable.
export function nextStep(W, H, walk, field, tx, ty) {
  const i = ty * W + tx; const d0 = field[i];
  if (d0 === INF || d0 === 0) return null;
  let best = d0, bx = -1, by = -1;
  for (const [dx, dy] of N8) {
    const nx = tx + dx, ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const n = ny * W + nx;
    if (!walk[n]) continue;
    if (dx && dy && (!walk[ty * W + nx] || !walk[ny * W + tx])) continue; // no corner cutting
    const d = field[n] + (dx && dy ? 0.4 : 0);
    if (d < best) { best = d; bx = nx; by = ny; }
  }
  return bx < 0 ? null : { x: bx * 16 + 8, y: by * 16 + 8 };
}
