import { travelMinutes } from './areas.js';
import { SLOTS } from './schedule.js';

// Who pays, and which of those two people's budgets applies.
export function arrangementsFor(w, m) {
  const A = new Set(w.logistics.arrangements), B = new Set(m.logistics.arrangements);
  const out = [];
  if (A.has('split') && B.has('split')) out.push('split');
  if (A.has('treatMe') && B.has('iTreat')) out.push('manTreats');
  if (A.has('iTreat') && B.has('treatMe')) out.push('womanTreats');
  return out;
}

export function affordable(arr, cost, w, m) {
  const bw = w.logistics.budget, bm = m.logistics.budget;
  if (arr === 'split') return cost / 2 <= Math.min(bw, bm);
  if (arr === 'manTreats') return cost <= bm;
  return cost <= bw;
}

const mins = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

export function openAt(v, slotId) {
  const s = SLOTS.find(x => x.id === slotId);
  const t = s.h * 60 + s.m;
  return t >= mins(v.open) && t + 90 <= mins(v.close);
}

// Cheapest-commute venue that fits budget, hours and who-pays. The commute that matters
// is the worse of the two, so neither person gets a punishing trip.
export function pickVenue({ w, m, slot, venues }) {
  for (const arr of arrangementsFor(w, m)) {
    const cands = venues
      .filter(v => openAt(v, slot) && affordable(arr, v.costForTwo, w, m))
      .map(v => {
        const tw = travelMinutes(w.area, v.area), tm = travelMinutes(m.area, v.area);
        return { venue: v, arrangement: arr, worst: Math.max(tw, tm), total: tw + tm };
      })
      .sort((a, b) => a.worst - b.worst || a.total - b.total || (b.venue.quality ?? 0) - (a.venue.quality ?? 0));
    if (cands.length) return cands[0];
  }
  return null;
}

export const arrangementText = {
  split: 'You’ll split the bill.',
  manTreats: 'Your date is treating.',
  womanTreats: 'Your date is treating.',
};
export const arrangementFor = (arr, role) => {
  if (arr === 'split') return 'Split the bill';
  const treater = arr === 'manTreats' ? 'man' : 'woman';
  return role === treater ? 'You’re treating' : 'You’re being treated';
};

export const mapsUrl = v =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name} ${v.areaName || ''} Pune`)}`;
