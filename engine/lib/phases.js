// The weekly machine. Pure logic over a `db` adapter (see memdb.js / fsdb.js), so it can be
// simulated offline and run unchanged against Firestore. Every phase is idempotent.
import { TUNING as T } from '../../web/js/shared/constants.js';
import { cycleAt, slotStart, HOURS } from '../../web/js/shared/schedule.js';
import { areaName } from '../../web/js/shared/areas.js';
import { hardFilter, mutual } from '../../web/js/shared/scoring.js';
import { pickVenue } from '../../web/js/shared/venues.js';
import { makeTeaser } from '../../web/js/shared/teaser.js';
import { maxWeightAssignment, effective } from '../../web/js/shared/assign.js';

const H = 3600e3;
const ACTIVE = ['pending_payment', 'paid', 'held', 'offered', 'confirmed'];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* ------------------------------------------------------------------ open */
export async function runOpen(ctx) {
  const { db, now, log, venues, notify } = ctx;
  const cyc = cycleAt(now);
  const meta = (await db.get('cycles', cyc.id)) || {};
  if (meta.opened) { log(`[open] ${cyc.id} already opened`); return { skipped: true }; }

  const users = await db.list('users', [['status', '==', 'approved']]);
  const byUid = new Map(users.map(u => [u.id, u]));
  const optins = (await db.list('optins', [['weekId', '==', cyc.id]])).filter(o => byUid.has(o.uid) && o.slots?.length);
  const W = optins.filter(o => o.role === 'woman'), M = optins.filter(o => o.role === 'man');
  const past = new Set((await db.list('dates')).map(d => `${d.womanUid}|${d.manUid}`));

  const edges = [];
  for (const w of W) for (const m of M) {
    if (past.has(`${w.uid}|${m.uid}`)) continue;
    const wu = byUid.get(w.uid), mu = byUid.get(m.uid);
    if (!hardFilter(wu, mu).ok) continue;
    let best = null;
    for (const slot of w.slots.filter(s => m.slots.includes(s))) {
      const p = pickVenue({ w: wu, m: mu, slot, venues });
      if (p && (!best || p.worst < best.p.worst)) best = { p, slot };
    }
    if (!best) continue;
    const score = mutual(wu, mu);
    if (score < T.minScore) continue;
    edges.push({ w: w.uid, m: m.uid, score, slot: best.slot, pick: best.p });
  }
  edges.sort((a, b) => b.score - a.score);

  const wc = new Map(), mc = new Map(), chosen = [];
  for (const e of edges) {
    if ((wc.get(e.w) || 0) >= T.shortlistSize || (mc.get(e.m) || 0) >= T.maxOpeningsPerMan) continue;
    wc.set(e.w, (wc.get(e.w) || 0) + 1); mc.set(e.m, (mc.get(e.m) || 0) + 1); chosen.push(e);
  }

  const bidCap = T.minBid * T.bidCapMultiple;
  for (const e of chosen) {
    const id = db.newId('openings');
    const wu = byUid.get(e.w);
    await db.set('openings', id, {
      weekId: cyc.id, forUid: e.m, status: 'open', bid: null, slot: e.slot,
      startsAt: slotStart(cyc.start, e.slot), arrangement: e.pick.arrangement,
      areaLabel: areaName(e.pick.venue.area), costForTwo: e.pick.venue.costForTwo,
      teaser: makeTeaser(wu), minBid: T.minBid, bidCap, closesAtMs: cyc.at(HOURS.bidsClose), createdAt: now,
    });
    await db.set('edges', id, {
      openingId: id, weekId: cyc.id, womanUid: e.w, manUid: e.m, score: Math.round(e.score * 10) / 10,
      slot: e.slot, venueId: e.pick.venue.id, arrangement: e.pick.arrangement,
    });
  }
  await db.merge('cycles', cyc.id, { opened: now, openings: chosen.length, women: W.length, men: M.length });
  for (const uid of mc.keys()) await notify(uid, { title: 'Evenings are open to you', body: 'Take a look and make your requests before Wednesday noon.', url: '/' });
  const covered = wc.size;
  log(`[open] ${cyc.id}: ${W.length} women, ${M.length} men in; ${edges.length} viable pairs; ${chosen.length} openings for ${covered} women`);
  return { openings: chosen.length, womenCovered: covered };
}

/* --------------------------------------------------------------- resolve */
// Pick the best set of one-man-per-woman pairings among open bids, then create dates + payments.
async function resolve(ctx, cyc, pool, { dueBy, exclude = { w: new Set(), m: new Set() } }) {
  const { db, now, venues, pay, notify } = ctx;
  const bids = pool.filter(o => o.bid);
  if (!bids.length) return [];
  const edges = new Map((await db.list('edges', [['weekId', '==', cyc.id]])).map(e => [e.openingId, e]));
  const rows = [...new Set(bids.map(o => edges.get(o.id)?.womanUid).filter(w => w && !exclude.w.has(w)))];
  const cols = [...new Set(bids.map(o => o.forUid).filter(m => !exclude.m.has(m)))];
  const grid = rows.map(() => cols.map(() => null)), cell = {};
  for (const o of bids) {
    const e = edges.get(o.id); if (!e) continue;
    const i = rows.indexOf(e.womanUid), j = cols.indexOf(o.forUid);
    if (i < 0 || j < 0) continue;
    grid[i][j] = effective({ score: e.score, bid: o.bid }, T);
    cell[`${i}|${j}`] = { o, e };
  }
  const pairs = maxWeightAssignment(grid);
  const made = [];
  const venueById = new Map(venues.map(v => [v.id, v]));
  for (const [i, j] of pairs) {
    const { o, e } = cell[`${i}|${j}`];
    const venue = venueById.get(e.venueId);
    const [wu, mu] = await Promise.all([db.get('users', e.womanUid), db.get('users', e.manUid)]);
    const dateId = db.newId('dates');
    await db.set('dates', dateId, {
      weekId: cyc.id, womanUid: e.womanUid, manUid: e.manUid, uids: [e.womanUid, e.manUid], status: 'pending_payment',
      slot: e.slot, startsAt: o.startsAt, arrangement: e.arrangement, code: pick(T.codeWords),
      venue: { id: venue.id, name: venue.name, area: venue.area, areaName: areaName(venue.area), note: venue.note || '' },
      teaserForWoman: makeTeaser(mu), teaserForMan: makeTeaser(wu), createdAt: now,
    });
    let link = null;
    if (pay) link = await pay.createLink({ amountInr: o.bid, ref: dateId, name: mu?.firstName, email: mu?.email, expireBy: Math.floor((dueBy + 20 * 60e3) / 1000) });
    await db.set('payments', dateId, {
      dateId, weekId: cyc.id, manUid: e.manUid, amount: o.bid, status: 'due', dueByMs: dueBy,
      provider: link ? 'razorpay' : 'upi', linkId: link?.id ?? null, payUrl: link?.url ?? null, createdAt: now,
    });
    await db.merge('openings', o.id, { status: 'won', dateId });
    made.push({ dateId, manUid: e.manUid, womanUid: e.womanUid, amount: o.bid });
    await notify(e.manUid, { title: 'An evening is yours', body: 'Confirm your fee to secure the evening. The window is short.', url: '/' });
  }
  // A bid that touched a woman or man who is now matched is lost. Others stay open.
  const wonW = new Set(made.map(m => m.womanUid)), wonM = new Set(made.map(m => m.manUid));
  const wonIds = new Set(); for (const [i, j] of pairs) wonIds.add(cell[`${i}|${j}`].o.id);
  for (const o of bids) {
    if (wonIds.has(o.id) || o.status !== 'open') continue;
    const e = edges.get(o.id);
    if (wonM.has(o.forUid) || (e && wonW.has(e.womanUid))) await db.merge('openings', o.id, { status: 'lost' });
  }
  return made;
}

/* ----------------------------------------------------------------- close */
export async function runClose(ctx) {
  const { db, now, log, notify } = ctx;
  const cyc = cycleAt(now);
  const meta = (await db.get('cycles', cyc.id)) || {};
  if (!meta.opened) { log(`[close] ${cyc.id} never opened`); return { skipped: true }; }
  if (meta.closed) { log(`[close] ${cyc.id} already closed`); return { skipped: true }; }
  const openings = await db.list('openings', [['weekId', '==', cyc.id]]);
  const live = openings.filter(o => o.status === 'open');
  const made = await resolve(ctx, cyc, live, { dueBy: cyc.at(HOURS.payDue) });
  // Reload to see which are still open, then settle them.
  for (const o of await db.list('openings', [['weekId', '==', cyc.id]])) {
    if (o.status !== 'open') continue;
    if (o.bid) { await db.merge('openings', o.id, { status: 'lost' }); await notify(o.forUid, { title: 'Not this week', body: 'Another evening was a closer fit. You haven’t been charged.', url: '/' }); }
    else await db.merge('openings', o.id, { status: 'passed' });
  }
  await db.merge('cycles', cyc.id, { closed: now, matched: made.length });
  log(`[close] ${cyc.id}: ${made.length} evenings assigned`);
  return { matched: made.length };
}

/* ------------------------------------------------------------------ tick */
export async function settle(db, date, pay, kind) {
  const amount = pay?.amount ?? 0;
  const table = {
    completed: { type: 'deposit', refund: Math.round(amount * T.depositShare) },
    noshow_w: { type: 'credit', refund: amount },
    noshow_m: { type: 'forfeit', refund: 0 },
    credit: { type: 'credit', refund: amount },
    review: { type: 'review', refund: 0 },
  };
  const s = table[kind];
  if (pay && !pay.settlement) await db.merge('payments', pay.id, { settlement: { ...s, at: Date.now(), done: false } });
}

export async function runTick(ctx) {
  const { db, now, log, notify, pay } = ctx;
  const cyc = cycleAt(now);
  const out = { paid: 0, lapsed: 0, backfilled: 0, released: 0, expired: 0, closedOut: 0 };

  // 1. payments
  const pays = await db.list('payments', [['weekId', '==', cyc.id]]);
  for (const p of pays) {
    if (pay && p.linkId && ['due', 'claimed'].includes(p.status) && (await pay.status(p.linkId)) === 'paid') {
      await db.merge('payments', p.id, { status: 'paid', paidAt: now }); p.status = 'paid';
    }
    if (p.status === 'paid') {
      const d = await db.get('dates', p.id);
      if (d && d.status === 'pending_payment') { await db.merge('dates', p.id, { status: 'paid' }); out.paid++; await notify(p.manUid, { title: 'Your evening is secured', body: 'Details arrive Thursday at noon.', url: '/' }); }
    }
  }

  // 2. lapse unpaid, then backfill from runner-up bidders
  const lapsedWomen = new Set();
  for (const p of pays) {
    if (p.status === 'due' && now > p.dueByMs) {
      await db.merge('payments', p.id, { status: 'lapsed' });
      await db.merge('dates', p.id, { status: 'lapsed' });
      const d = await db.get('dates', p.id); lapsedWomen.add(d.womanUid); out.lapsed++;
      await notify(p.manUid, { title: 'Your evening was released', body: 'The payment window closed.', url: '/' });
    }
  }
  if (lapsedWomen.size && cyc.hrs < T.backfillUntilHour) {
    const openings = await db.list('openings', [['weekId', '==', cyc.id]]);
    const edges = new Map((await db.list('edges', [['weekId', '==', cyc.id]])).map(e => [e.openingId, e]));
    const dates = (await db.list('dates', [['weekId', '==', cyc.id]])).filter(d => ACTIVE.includes(d.status));
    const exclude = { w: new Set(dates.map(d => d.womanUid)), m: new Set(dates.map(d => d.manUid)) };
    const lapsedMen = new Set((await db.list('dates', [['weekId', '==', cyc.id], ['status', '==', 'lapsed']])).map(d => d.manUid));
    const pool = openings.filter(o => o.status === 'lost' && o.bid && lapsedWomen.has(edges.get(o.id)?.womanUid) && !lapsedMen.has(o.forUid));
    // `resolve` expects them to be assignable; flip back to open temporarily by id.
    const made = await resolve(ctx, cyc, pool, { dueBy: Math.min(now + 6 * H, cyc.at(HOURS.release - 2)), exclude });
    out.backfilled = made.length;
  }

  // 3. release at invitation time
  if (cyc.hrs >= HOURS.release) {
    for (const d of await db.list('dates', [['weekId', '==', cyc.id], ['status', '==', 'paid']])) {
      const next = T.manualRelease ? 'held' : 'offered';
      await db.merge('dates', d.id, { status: next, releasedAt: now });
      if (next === 'offered') await notify(d.womanUid, { title: 'Your invitation has arrived', body: 'Someone has been matched to your Saturday or Sunday.', url: '/' });
      out.released++;
    }
  }
  // Admin approves 'held' -> 'offered' in the app; remind the woman once we see it.
  for (const d of await db.list('dates', [['weekId', '==', cyc.id], ['status', '==', 'offered']])) {
    if (!d.womanNotified) { await db.merge('dates', d.id, { womanNotified: now }); await notify(d.womanUid, { title: 'Your invitation has arrived', body: 'Open Saanj to see your evening.', url: '/' }); }
  }

  // 4. offers nobody answered
  if (cyc.hrs >= HOURS.respondBy) {
    for (const d of await db.list('dates', [['weekId', '==', cyc.id], ['status', 'in', ['offered', 'held']]])) {
      await db.merge('dates', d.id, { status: 'expired' });
      await settle(db, d, await db.get('payments', d.id), 'credit'); out.expired++;
    }
  }
  // Declines by women → man is credited.
  for (const d of await db.list('dates', [['weekId', '==', cyc.id], ['status', '==', 'declined']])) {
    const p = await db.get('payments', d.id);
    if (p && !p.settlement) await settle(db, d, p, 'credit');
  }

  // 5. outcomes, 3 hours after the start time
  for (const d of await db.list('dates', [['weekId', '==', cyc.id], ['status', '==', 'confirmed']])) {
    if (now < d.startsAt + 3 * H) continue;
    const p = await db.get('payments', d.id);
    const w = !!d.womanArrivedAt, m = !!d.manArrivedAt;
    const [status, kind] = w && m ? ['completed', 'completed'] : m ? ['noshow_w', 'noshow_w'] : w ? ['noshow_m', 'noshow_m'] : ['completed', 'review'];
    await db.merge('dates', d.id, { status, closedAt: now });
    await settle(db, d, p, kind); out.closedOut++;
  }
  log(`[tick] ${cyc.id}: ${JSON.stringify(out)}`);
  return out;
}

/* --------------------------------------------------------------- cleanup */
export async function runCleanup(ctx) {
  const { db, now, log } = ctx;
  const cutoff = now - 21 * 24 * H;
  let n = 0;
  for (const col of ['openings', 'edges', 'optins']) {
    for (const x of await db.list(col, [['createdAt', '<', cutoff]])) { await db.del(col, x.id); n++; }
  }
  log(`[cleanup] removed ${n} stale docs`);
  return { removed: n };
}

/* ------------------------------------------------------------------ auto */
export async function runAuto(ctx) {
  const cyc = cycleAt(ctx.now);
  const meta = (await ctx.db.get('cycles', cyc.id)) || {};
  const res = {};
  if (cyc.hrs >= 21 && cyc.hrs < HOURS.bidsClose && !meta.opened) res.open = await runOpen(ctx);
  if (cyc.hrs >= HOURS.bidsClose && meta.opened && !meta.closed) res.close = await runClose(ctx);
  if (cyc.hrs >= HOURS.bidsClose) res.tick = await runTick(ctx);
  if (cyc.hrs >= 150) res.cleanup = await runCleanup(ctx);
  return res;
}
