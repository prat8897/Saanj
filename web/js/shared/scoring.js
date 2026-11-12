import { DIMENSIONS } from './questions.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const WANT = { less: -1, similar: 0, more: 1 };

const fail = reason => ({ ok: false, reason });
const ok = { ok: true };

function dealbroken(a, b) {
  const x = b.answers || {};
  for (const d of a.dealbreakers || []) {
    if (d === 'smoker' && x.smoking && x.smoking !== 'no') return d;
    if (d === 'drinker' && x.drinking && x.drinking !== 'never') return d;
    if (d === 'nonveg' && (x.diet === 'nonveg' || x.diet === 'egg')) return d;
    if (d === 'kids_yes' && x.kids === 'yes') return d;
    if (d === 'kids_no' && x.kids === 'no') return d;
  }
  return null;
}

// Pass/fail, in both directions. a and b are user profile docs.
export function hardFilter(a, b) {
  if (a.role === b.role) return fail('same-side');
  if (b.age < a.prefs.ageMin || b.age > a.prefs.ageMax) return fail('age');
  if (a.age < b.prefs.ageMin || a.age > b.prefs.ageMax) return fail('age');
  const da = dealbroken(a, b) || dealbroken(b, a);
  if (da) return fail('dealbreaker:' + da);
  const A = a.answers, B = b.answers;
  const iw = { casual: 1, serious: 2, marriage: 3 };
  if (Math.abs(iw[A.intent] - iw[B.intent]) >= 2) return fail('intent');
  if ((A.kids === 'yes' && B.kids === 'no') || (A.kids === 'no' && B.kids === 'yes')) return fail('kids');
  const la = new Set(A.languages || []);
  if (!(B.languages || []).some(l => la.has(l))) return fail('language');
  return ok;
}

function simDim(d, a, b) {
  const A = a.answers, B = b.answers;
  if (d.kind === 'ordinal') {
    const val = (u, k) => (d.map ? d.map[u[k]] : u[k]);
    let av = val(A, d.id);
    const bv = val(B, d.id);
    if (av == null || bv == null) return 0.5;
    if (d.want && A[d.want] in WANT) av = clamp(av + WANT[A[d.want]], d.min, d.max);
    return 1 - Math.abs(av - bv) / (d.max - d.min);
  }
  if (d.kind === 'set') {
    const sa = new Set(A[d.id] || []), sb = B[d.id] || [];
    if (!sa.size || !sb.length) return 0.5;
    const inter = sb.filter(x => sa.has(x)).length;
    return 0.25 + 0.75 * (inter / Math.min(sa.size, sb.length));
  }
  if (d.kind === 'cat') {
    if (!A[d.id] || !B[d.id]) return 0.5;
    if (A[d.id] === B[d.id]) return 1;
    const near = d.near.some(([x, y]) => (A[d.id] === x && B[d.id] === y) || (A[d.id] === y && B[d.id] === x));
    return near ? 0.7 : 0.3;
  }
  return 0.5;
}

// How well b fits what a is looking for, 0..100.
export function directional(a, b) {
  let num = 0, den = 0;
  for (const d of DIMENSIONS) { num += d.weight * simDim(d, a, b); den += d.weight; }
  return (100 * num) / den;
}

// Geometric mean: a great fit for one and a lukewarm fit for the other is a weak match.
export const mutual = (a, b) => Math.sqrt(directional(a, b) * directional(b, a));
