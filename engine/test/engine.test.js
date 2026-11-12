import test from 'node:test';
import assert from 'node:assert/strict';
import { maxWeightAssignment, effective } from '../../web/js/shared/assign.js';
import { cycleAt, cycleStart, isoWeekId, slotStart } from '../../web/js/shared/schedule.js';
import { hardFilter, mutual } from '../../web/js/shared/scoring.js';
import { affordable, arrangementsFor } from '../../web/js/shared/venues.js';
import { TUNING as T } from '../../web/js/shared/constants.js';
import { simulate } from '../simulate.js';

test('assignment finds the optimal pairing and skips forbidden edges', () => {
  const w = [[10, 9, null], [9, 1, null], [null, null, 5]];
  const pairs = maxWeightAssignment(w).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(pairs, [[0, 1], [1, 0], [2, 2]]); // 9+9+5 beats 10+1+5
  assert.deepEqual(maxWeightAssignment([[null, null]]), []);
  assert.equal(maxWeightAssignment([[1, 2], [3, 4], [5, 6]]).length, 2); // more rows than cols
});

test('a bid can offset at most tau points of compatibility', () => {
  const lo = effective({ score: 80, bid: T.minBid }, T), hi = effective({ score: 80, bid: 1e6 }, T);
  assert.equal(hi - lo, T.tau);
  assert.ok(effective({ score: 74, bid: 1e6 }, T) < effective({ score: 80, bid: T.minBid }, T)); // gap > tau: money loses
  assert.ok(effective({ score: 78, bid: 1e6 }, T) > effective({ score: 80, bid: T.minBid }, T)); // gap < tau: money breaks the tie
});

test('schedule: IST Monday boundaries and phases', () => {
  const mon = Date.UTC(2026, 10, 15, 18, 30); // Mon 16 Nov 2026 00:00 IST
  assert.equal(cycleStart(mon + 5 * 3600e3), mon);
  assert.equal(cycleStart(mon - 1), mon - 7 * 86400e3);
  assert.equal(cycleAt(mon + 10 * 3600e3).phase, 'optin');
  assert.equal(cycleAt(mon + 30 * 3600e3).phase, 'bidding');
  assert.equal(cycleAt(mon + 90 * 3600e3).phase, 'invites');
  assert.equal(isoWeekId(mon), '2026-W47');
  assert.equal(new Date(slotStart(mon, 'sat_eve') + 5.5 * 3600e3).toISOString(), '2026-11-21T19:30:00.000Z'); // Sat 7:30 pm IST
});

test('budget rules follow the arrangement', () => {
  const w = { logistics: { budget: 500, arrangements: ['split', 'treatMe'] } };
  const m = { logistics: { budget: 1200, arrangements: ['split', 'iTreat'] } };
  assert.deepEqual(arrangementsFor(w, m), ['split', 'manTreats']);
  assert.equal(affordable('split', 1000, w, m), true);
  assert.equal(affordable('split', 1100, w, m), false);
  assert.equal(affordable('manTreats', 1200, w, m), true);
});

test('full simulated week keeps every invariant', async () => {
  const { db, crowd, open, close } = await simulate({ women: 40, men: 40, seed: 5 });
  assert.ok(open.openings > 0 && close.matched > 0, 'something must match');
  const dates = await db.list('dates');
  const byUid = Object.fromEntries(crowd.map(u => [u.id, u]));
  const active = dates.filter(d => !['lapsed'].includes(d.status));
  const seenW = new Set(), seenM = new Set();
  for (const d of active) {
    assert.ok(!seenW.has(d.womanUid) && !seenM.has(d.manUid), 'nobody gets two evenings in one week');
    seenW.add(d.womanUid); seenM.add(d.manUid);
    assert.ok(hardFilter(byUid[d.womanUid], byUid[d.manUid]).ok, 'hard filters hold');
    assert.ok(mutual(byUid[d.womanUid], byUid[d.manUid]) >= T.minScore, 'score above cutoff');
    assert.ok(d.code && d.venue?.name && d.startsAt);
  }
  // Women never see money: no payment fields on dates.
  assert.ok(dates.every(d => !('amount' in d) && !('bid' in d)));
  // Outcome settlement exists for finished dates.
  const pays = Object.fromEntries((await db.list('payments')).map(p => [p.id, p]));
  for (const d of dates.filter(d => ['completed', 'noshow_w', 'noshow_m', 'declined'].includes(d.status))) assert.ok(pays[d.id].settlement, `settled ${d.status}`);
});
