// Runs a full week offline: opt-in -> openings -> bids -> close -> pay -> release -> responses -> outcomes.
// Usage: node simulate.js [women] [men]
import { readFileSync } from 'node:fs';
import { memdb } from './lib/memdb.js';
import { fakeCrowd, rng } from './lib/fake.js';
import { runOpen, runClose, runTick } from './lib/phases.js';
import { cycleStart, isoWeekId } from '../web/js/shared/schedule.js';
import { TUNING as T } from '../web/js/shared/constants.js';

const H = 3600e3;
export async function simulate({ women = 40, men = 40, seed = 11, log = () => {}, bidRate = 0.75, payRate = 0.85, acceptRate = 0.85 } = {}) {
  const venues = JSON.parse(readFileSync(new URL('./data/venues.json', import.meta.url)));
  const db = memdb(), r = rng(seed), pushes = [];
  const monday = cycleStart(Date.UTC(2026, 10, 18)); // a Wednesday in Nov 2026 -> its Monday
  const week = isoWeekId(monday);
  const at = h => monday + h * H;
  const ctx = now => ({ db, now, venues, log, pay: null, notify: async (uid, m) => { pushes.push([uid, m.title]); } });

  const crowd = fakeCrowd(women, men, seed);
  for (const u of crowd) {
    const { id, logistics, ...rest } = u;
    await db.set('users', id, { ...rest, logistics });
    await db.set('optins', `${week}_${id}`, { uid: id, weekId: week, role: u.role, slots: logistics.slots, createdAt: at(2) });
  }

  const open = await runOpen(ctx(at(21.5)));
  // bids
  for (const o of await db.list('openings')) {
    if (r() < bidRate) await db.merge('openings', o.id, { bid: T.minBid + Math.floor(r() * 16) * 100 > T.minBid * T.bidCapMultiple ? T.minBid * T.bidCapMultiple : T.minBid + Math.floor(r() * 16) * 100, bidAt: at(30) });
  }
  const close = await runClose(ctx(at(60.5)));
  // payments
  for (const p of await db.list('payments')) if (r() < payRate) await db.merge('payments', p.id, { status: 'paid' });
  const t1 = await runTick(ctx(at(61)));
  const t2 = await runTick(ctx(at(71)));   // lapse + backfill
  for (const p of await db.list('payments', [['status', '==', 'due']])) if (r() < payRate) await db.merge('payments', p.id, { status: 'paid' });
  const t3 = await runTick(ctx(at(72)));
  const t4 = await runTick(ctx(at(84.5))); // release to 'held'
  for (const d of await db.list('dates', [['status', '==', 'held']])) await db.merge('dates', d.id, { status: 'offered' });
  for (const d of await db.list('dates', [['status', '==', 'offered']])) {
    if (r() < acceptRate) await db.merge('dates', d.id, { status: 'confirmed' });
    else await db.merge('dates', d.id, { status: 'declined' });
  }
  for (const d of await db.list('dates', [['status', '==', 'confirmed']])) {
    const patch = {};
    if (r() < 0.93) patch.womanArrivedAt = d.startsAt; if (r() < 0.95) patch.manArrivedAt = d.startsAt;
    await db.merge('dates', d.id, patch);
  }
  const t5 = await runTick(ctx(at(150)));
  return { db, week, open, close, ticks: [t1, t2, t3, t4, t5], pushes, crowd };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [w = 40, m = 40] = process.argv.slice(2).map(Number);
  const { db, open, close, ticks } = await simulate({ women: w, men: m, log: console.log });
  const dates = await db.list('dates');
  const count = s => dates.filter(d => d.status === s).length;
  const edges = await db.list('edges');
  const won = await db.list('openings', [['status', '==', 'won']]);
  const avg = won.length ? won.reduce((s, o) => s + edges.find(e => e.openingId === o.id).score, 0) / won.length : 0;
  console.log({ women: w, men: m, openings: open.openings, womenWithShortlist: open.womenCovered, matched: close.matched, avgScoreOfMatched: +avg.toFixed(1),
    final: Object.fromEntries([...new Set(dates.map(d => d.status))].map(s => [s, count(s)])), ticks });
}
