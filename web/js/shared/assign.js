// Max-weight bipartite assignment (Hungarian algorithm). weights[i][j] is a number, or null
// when the pair is not allowed. Maximises how many pairs are made, then their total weight.
// Returns [[i, j], ...].
export function maxWeightAssignment(weights) {
  const n = weights.length, m = n ? weights[0].length : 0;
  if (!n || !m) return [];
  const T = n > m;
  const R = T ? m : n, C = T ? n : m;
  const BIG = 1e6, FORBID = 1e9;
  const cost = (i, j) => { const w = T ? weights[j][i] : weights[i][j]; return w == null ? FORBID : BIG - w; };
  const u = new Array(R + 1).fill(0), v = new Array(C + 1).fill(0);
  const p = new Array(C + 1).fill(0), way = new Array(C + 1).fill(0);
  for (let i = 1; i <= R; i++) {
    p[0] = i; let j0 = 0;
    const minv = new Array(C + 1).fill(Infinity), used = new Array(C + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0]; let delta = Infinity, j1 = 0;
      for (let j = 1; j <= C; j++) if (!used[j]) {
        const cur = cost(i0 - 1, j - 1) - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= C; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const out = [];
  for (let j = 1; j <= C; j++) if (p[j]) {
    const a = p[j] - 1, b = j - 1;
    const [r, c] = T ? [b, a] : [a, b];
    if (weights[r][c] != null) out.push([r, c]);
  }
  return out;
}

// Effective value of an edge: compatibility leads; a bid can only offset `tau` points.
export function effective({ score, bid }, { minBid, bidCapMultiple, tau }) {
  const cap = minBid * bidCapMultiple;
  const norm = Math.min(1, Math.max(0, (bid - minBid) / (cap - minBid)));
  return score + tau * norm;
}
