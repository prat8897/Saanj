// Home: one screen that tells you exactly where your week stands.
import { api } from '../api.js';
import { h, sheet, toast, chips, icon, sun, money, relTime } from '../ui.js';
import { TUNING } from '../shared/constants.js';
import { SLOTS, MILESTONES, HOURS, fmtDay, fmtTime, fmtIST, slotLabel } from '../shared/schedule.js';
import { arrangementFor, mapsUrl } from '../shared/venues.js';
import { UPI } from '../config.js';

const ACTIVE = ['pending_payment', 'paid', 'held', 'offered', 'confirmed'];
const bidDraft = new Map(), payDraft = new Map(), slotDraft = { v: null };
const weekNo = id => Number(id.split('W')[1]);

export function currentDate(dates, cyc) {
  const mine = dates.filter(d => d.weekId === cyc.id);
  return mine.find(d => ACTIVE.includes(d.status)) || mine.find(d => d.status !== 'lapsed') || mine[0] || null;
}

export const view = ctx => (ctx.state.profile.role === 'woman' ? woman(ctx) : man(ctx));

/* ----------------------------------------------------------- shared bits */
const head = (title, sub) => [h('h1.h1', null, title), sub ? h('p.lede', null, sub) : null];

const stage = (title, sub, dim) => h('section.stage', null, h('div.orb' + (dim ? '.dim' : '')), h('h2.h2', null, title), h('p.lede', null, sub));

function timeline(cyc) {
  const firstPending = MILESTONES.findIndex(m => cyc.hrs < m.at);
  return h('section.panel', { 'aria-label': 'This week' },
    h('h3.h3', { style: { marginBottom: '14px' } }, 'This week'),
    h('ul.timeline', null, MILESTONES.map((m, i) => h('li' + (i < firstPending || firstPending < 0 ? '.done' : i === firstPending ? '.now' : ''), null, h('b', null, m.label), h('small', null, m.sub)))));
}

function optinCard(ctx) {
  const { state, cyc } = ctx, p = state.profile, uid = state.user.uid, role = p.role;
  const woman = role === 'woman';
  if (state.optin) {
    return h('section.panel', null, h('h3.h3', null, 'You’re in this week'),
      h('p.muted.small', null, state.optin.slots.map(slotLabel).join(', ') + '.'),
      cyc.phase === 'optin' ? h('button.btn.ghost.sm', { onclick: async () => { await api.optin.clear(uid, cyc.id); toast('You’re out this week.'); } }, 'Step out this week') : null);
  }
  if (cyc.phase !== 'optin') return null;
  slotDraft.v ??= [...p.logistics.slots];
  const btn = h('button.btn.primary.block', {
    onclick: async () => {
      if (!slotDraft.v.length) return toast('Pick at least one time.');
      btn.disabled = true;
      try { await api.optin.set(uid, cyc.id, role, slotDraft.v); slotDraft.v = null; toast('You’re in.'); } catch (e) { console.error(e); toast('Couldn’t save that. Try again.'); btn.disabled = false; }
    },
  }, woman ? 'I’m in this week' : 'I’m open this week');
  return h('section.panel', null,
    h('h2.h2', null, woman ? 'Free this week?' : 'Open to an evening this week?'),
    h('p.muted', null, woman ? 'Pick the times that work. If we find someone worth your evening, your invitation arrives Thursday at noon. If not, we skip you rather than send a filler date.'
      : 'Pick your times. On Monday night you’ll see the evenings you could be considered for, and choose which to request.'),
    chips({ options: SLOTS.map(s => [s.id, s.label]), value: slotDraft.v, multi: true, onChange: v => { slotDraft.v = v; } }),
    h('p.faint', { style: { margin: '10px 0 16px' } }, `Opt in by ${fmtIST(cyc.at(20), { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true })}.`), btn);
}

/* ------------------------------------------------------------ invitation */
function ics(d) {
  const f = ms => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Saanj//EN', 'BEGIN:VEVENT', `UID:${d.id}@saanj`, `DTSTAMP:${f(Date.now())}`,
    `DTSTART:${f(d.startsAt)}`, `DTEND:${f(d.startsAt + 2 * 3600e3)}`, `SUMMARY:Saanj evening at ${d.venue.name}`, `LOCATION:${d.venue.name}\\, ${d.venue.areaName}\\, Pune`,
    `DESCRIPTION:Say “${d.code}” to find each other.`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob([body], { type: 'text/calendar' })), download: 'saanj-evening.ics' });
  a.click();
}

function declineSheet(ctx, d) {
  const reasons = ['My plans changed', 'Not feeling it this week', 'I’d rather not say'];
  const close = sheet(h('h2.h2', null, 'Pass on this evening?'), h('p.muted', null, 'No explanation needed. We’ll look again next week.'),
    h('div.stack', null, reasons.map(r => h('button.btn.ghost.block', { onclick: async () => { await api.dates.respond(d.id, 'declined', r); close(); toast('Passed. See you Monday.'); } }, r))));
}

function reportSheet(ctx, d) {
  const t = h('textarea', { placeholder: 'What happened?' });
  const close = sheet(h('h2.h2', null, 'Report a problem'), h('p.muted', null, 'Our team reads every report and replies within a day.'), h('label.field', null, h('span', null, 'Tell us what happened'), t),
    h('button.btn.primary.block', { onclick: async () => { if (!t.value.trim()) return toast('Add a few words first.'); await api.report.create({ byUid: ctx.state.user.uid, dateId: d?.id ?? null, kind: 'report', text: t.value.trim() }); close(); toast('Report sent.'); } }, 'Send report'));
}

function safetySheet(ctx, d) {
  const role = ctx.state.profile.role;
  const close = sheet(h('h2.h2', null, 'Do you need help?'),
    h('a.btn.primary.block', { href: 'tel:112' }, 'Call 112 now'),
    h('div.stack', { style: { marginTop: '12px' } },
      h('button.btn.ghost.block', { onclick: async () => { await api.dates.sos(d.id, role); close(); toast('Our team has been alerted.'); } }, 'Alert the Saanj team'),
      h('button.btn.ghost.block', { onclick: () => { close(); reportSheet(ctx, d); } }, 'Report a problem')),
    h('p.faint', { style: { marginTop: '14px' } }, 'You can leave at any time. You never owe anyone an explanation.'));
}

export function inviteCard(ctx, d, { mode = 'offer', role }) {
  const woman = role === 'woman';
  const lines = woman ? d.teaserForWoman : d.teaserForMan;
  const arrived = d[woman ? 'womanArrivedAt' : 'manArrivedAt'];
  const t = ctx.now, open = t >= d.startsAt - 60 * 60e3 && t <= d.startsAt + 2 * 3600e3;
  const actions = mode === 'offer'
    ? h('div.actions', null,
      h('button.btn.ink', { onclick: async () => { await api.dates.respond(d.id, 'confirmed'); toast('You’re going. Details are saved here.'); } }, 'Accept this evening'),
      h('button.btn.ink-ghost', { onclick: () => declineSheet(ctx, d) }, 'I can’t make it'),
      h('p.faint', { style: { color: 'var(--paper-mute)', margin: 0 } }, 'Answer by Friday, 8 pm.'))
    : h('div.actions', null,
      h('button.btn.ink', { disabled: !!arrived || !open, onclick: async () => { await api.dates.arrived(d.id, role); toast('Checked in. Enjoy your evening.'); } }, arrived ? 'You’re checked in' : open ? 'I’ve arrived' : 'Check-in opens an hour before'),
      h('div.row', null,
        h('button.btn.ink-ghost.sm', { style: { flex: 1 }, onclick: () => ics(d) }, 'Add to calendar'),
        h('button.btn.ink-ghost.sm', { style: { flex: 1 }, onclick: async () => { const text = `I’m meeting someone at ${d.venue.name}, ${d.venue.areaName}, ${fmtDay(d.startsAt)} at ${fmtTime(d.startsAt)}.`; try { navigator.share ? await navigator.share({ text }) : (await navigator.clipboard.writeText(text), toast('Copied. Send it to someone you trust.')); } catch { /* cancelled */ } } }, 'Share my plans')));
  return h('article.invite' + (mode === 'confirmed' ? '.quiet' : ''), null,
    h('div.invite-head', null, h('span.brand', null, sun(22), 'Saanj'), h('span', null, `No. ${weekNo(d.weekId)}`)),
    h('div.seal', { 'aria-hidden': 'true' }, sun(30)),
    h('h2.when', null, fmtDay(d.startsAt)),
    h('p.at', null, `at ${fmtTime(d.startsAt)}`),
    h('p.where', null, d.venue.name),
    h('p.where-sub', null, `${d.venue.areaName}, Pune `, h('a', { href: mapsUrl(d.venue), target: '_blank', rel: 'noopener', style: { color: 'inherit', fontWeight: 600 } }, 'Open in Maps')),
    h('div.lines', null, h('p.who', null, woman ? 'A little about your evening companion' : 'A little about who you’ll meet'), lines.map(l => h('p', null, l))),
    h('dl', null,
      h('dt', null, 'Who pays'), h('dd', null, arrangementFor(d.arrangement, role)),
      h('dt', null, 'How you’ll find each other'), h('dd', null, `Say “${d.code}”. Whoever arrives first takes a table.`),
      d.venue.note ? [h('dt', null, 'About the place'), h('dd', null, d.venue.note)] : null),
    actions);
}

function safetyPanel(ctx, d) {
  return h('section.panel', null, h('h3.h3', null, 'Your safety'),
    h('p.muted.small', null, 'You’re meeting in a public place. Tell someone you trust where you’ll be. You can leave whenever you like.'),
    h('div.row.wrap', null, h('button.btn.ghost.sm', { onclick: () => safetySheet(ctx, d) }, 'I need help'), h('button.btn.ghost.sm', { onclick: () => reportSheet(ctx, d) }, 'Report a problem')));
}

/* ----------------------------------------------------------------- women */
function woman(ctx) {
  const { state, cyc } = ctx, d = currentDate(state.dates, cyc), out = [];
  if (d?.status === 'offered') return [...head('Your evening is ready', 'One person, one table. Accept if it feels right.'), inviteCard(ctx, d, { mode: 'offer', role: 'woman' }), h('p.faint', null, 'Men on Saanj pay to be considered. Compatibility, not the fee, chose this match.')];
  if (d?.status === 'confirmed') return [...head('You’re going.', `${fmtDay(d.startsAt)}, ${relTime(d.startsAt, ctx.now)}.`), inviteCard(ctx, d, { mode: 'confirmed', role: 'woman' }), safetyPanel(ctx, d)];
  if (d?.status === 'declined') return [stage('You passed on this one', 'No explanation needed. A new week starts Monday.', true), timeline(cyc)];
  if (d?.status === 'expired') return [stage('That invitation expired', 'It wasn’t answered in time, so we let it go. See you Monday.', true)];
  if (d) return [stage('A new week starts Monday', 'We hope it was a good evening. Nothing to fill in. Your next invitation comes if you’re in.')];

  const card = optinCard(ctx);
  if (!state.optin) return card ? [...head('Good evening, ' + state.profile.firstName + '.', 'Your week, in one place.'), card, timeline(cyc)] : [stage('This week’s tables are set', 'Opt-in closed Monday at 8 pm. Come back next Monday and say you’re in.'), timeline(cyc)];
  if (cyc.hrs >= HOURS.release) return [stage('No evening this week', 'We’d rather skip a week than send you a mismatch. You’ll hear from us on Monday.', true), card];
  return [stage('You’re in', cyc.hrs < 21 ? 'Shortlists are made Monday night. Your invitation, if we find someone, arrives Thursday at noon.' : 'We’re looking for someone worth your evening. Your invitation, if we find them, arrives Thursday at noon.'), card, timeline(cyc)];
}

/* ------------------------------------------------------------------- men */
function openingCard(ctx, o, editable) {
  const { cyc } = ctx;
  let v = bidDraft.get(o.id) ?? o.bid ?? o.minBid;
  const out = h('output', null, money(v));
  const set = n => { v = Math.min(o.bidCap, Math.max(o.minBid, n)); bidDraft.set(o.id, v); out.textContent = money(v); go.textContent = o.bid ? `Update request to ${money(v)}` : `Request this evening for ${money(v)}`; };
  const go = h('button.btn.primary.block', {
    onclick: async () => { go.disabled = true; try { await api.openings.bid(o.id, v); bidDraft.delete(o.id); toast('Request sent. You pay only if you’re chosen.'); } catch (e) { console.error(e); toast('Requests have closed for this evening.'); go.disabled = false; } },
  });
  const ctl = h('div.stack', null,
    h('div.bidrow', null, h('button.stepper-b', { 'aria-label': 'Lower fee', onclick: () => set(v - TUNING.bidStep) }, '−'), out, h('button.stepper-b', { 'aria-label': 'Raise fee', onclick: () => set(v + TUNING.bidStep) }, '+')), go);
  set(v);
  const verb = { split: 'You’ll split the bill.', manTreats: 'You’d be treating.', womanTreats: 'She’d be treating.' }[o.arrangement];
  return h('article.opening' + (o.bid ? '.bid' : ''), null,
    h('div.spread', null, h('h3', null, `${slotLabel(o.slot)}, ${fmtIST(o.startsAt, { day: 'numeric', month: 'short' })}`), o.bid ? h('span.pill.warn', null, `Requested at ${money(o.bid)}`) : null),
    h('p.muted.small', { style: { margin: 0 } }, `A table in ${o.areaLabel}, about ${money(o.costForTwo)} for two. ${verb}`),
    h('ul', null, o.teaser.map(l => h('li', null, l))),
    editable ? [ctl, o.bid ? h('button.btn.ghost.sm', { style: { marginTop: '10px' }, onclick: async () => { await api.openings.bid(o.id, null); toast('Request withdrawn.'); } }, 'Withdraw request') : null] : null);
}

function payCard(ctx, d, p) {
  const { state } = ctx;
  const cfg = state.config || {};
  const due = fmtIST(p.dueByMs, { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true });
  const upi = `upi://pay?pa=${encodeURIComponent(cfg.upiVpa || UPI.vpa)}&pn=${encodeURIComponent(cfg.payee || UPI.payee)}&am=${p.amount}&cu=INR&tn=${encodeURIComponent('Saanj ' + p.id.slice(0, 6))}`;
  const ref = h('input', { type: 'text', placeholder: 'UPI reference number', inputmode: 'numeric', value: payDraft.get(p.id) || '', oninput: e => payDraft.set(p.id, e.target.value) });
  const refund = Math.round(p.amount * TUNING.depositShare);
  const kids = p.status === 'claimed'
    ? [h('p.muted', null, 'Thanks. We’re confirming your payment, usually within a few hours. You’ll get a notification.')]
    : p.payUrl
      ? [h('a.btn.primary.block', { href: p.payUrl, target: '_blank', rel: 'noopener' }, `Pay ${money(p.amount)}`)]
      : [h('a.btn.primary.block', { href: upi }, `Pay ${money(p.amount)} with UPI`), h('label.field', { style: { marginTop: '16px' } }, h('span', null, 'After paying, enter the reference number'), ref),
        h('button.btn.ghost.block', { onclick: async () => { if (ref.value.trim().length < 6) return toast('Enter the reference number from your UPI app.'); await api.payments.claim(p.id, ref.value.trim()); payDraft.delete(p.id); toast('Thanks. We’re confirming it.'); } }, 'I’ve paid')];
  return [...head(`${slotLabel(d.slot)} is yours`, `Confirm your fee by ${due} to keep it.`),
    h('section.panel', null, h('div.spread', null, h('h3.h3', null, 'Your fee'), h('span', { style: { font: '400 28px var(--serif)' } }, money(p.amount))),
      h('p.muted.small', null, `${money(refund)} comes back when you both turn up. If she can’t make it, the full fee is credited to you.`), ...kids),
    h('p.callout', null, `${fmtDay(d.startsAt)}, ${d.venue.areaName}. Full details arrive on Thursday at noon.`)];
}

function man(ctx) {
  const { state, cyc } = ctx, d = currentDate(state.dates, cyc);
  const p = d && state.payments.find(x => x.id === d.id);
  if (d?.status === 'pending_payment' && p) return payCard(ctx, d, p);
  if (d && ['paid', 'held'].includes(d.status)) return [...head('Your evening is secured', `${fmtDay(d.startsAt)}, in ${d.venue.areaName}. The full invitation goes out ${cyc.hrs >= HOURS.release ? 'shortly' : 'Thursday at noon'}.`), timeline(cyc)];
  if (d?.status === 'offered') return [...head('Waiting on her reply', 'She answers by Friday at 8 pm. If she can’t make it, your fee is credited in full.'), h('section.panel', null, h('h3.h3', null, `${fmtDay(d.startsAt)}, ${fmtTime(d.startsAt)}`), h('p.muted.small', null, `A table in ${d.venue.areaName}. The venue is revealed once she says yes.`))];
  if (d?.status === 'confirmed') return [...head('She said yes.', `${fmtDay(d.startsAt)}, ${relTime(d.startsAt, ctx.now)}.`), inviteCard(ctx, d, { mode: 'confirmed', role: 'man' }), safetyPanel(ctx, d)];
  if (d && ['declined', 'expired', 'noshow_w'].includes(d.status)) return [stage('She couldn’t make it', 'Your fee is credited in full. It’s waiting for you next week.', true)];
  if (d?.status === 'noshow_m') return [stage('This one didn’t happen', 'You weren’t checked in, so the fee wasn’t returned. Next week is a fresh start.', true)];
  if (d) return [stage('A new week starts Monday', 'Nothing to fill in. Your next openings arrive Monday night if you’re in.')];

  const ops = state.openings.filter(o => o.weekId === cyc.id);
  const card = optinCard(ctx);
  if (!state.optin) return card ? [...head('Good evening, ' + state.profile.firstName + '.', 'Your week, in one place.'), card, timeline(cyc)] : [stage('This week’s tables are set', 'Opt-in closed Monday at 8 pm. Come back next Monday.'), timeline(cyc)];
  if (cyc.hrs < 21) return [stage('You’re open this week', 'Your openings arrive Monday at 9 pm.'), card, timeline(cyc)];
  if (cyc.phase === 'bidding') {
    const open = ops.filter(o => o.status === 'open');
    if (!open.length) return [stage('Nothing matched this week', 'We only offer evenings with real compatibility. You haven’t been charged. See you Monday.', true)];
    return [...head('Evenings open to you', `Requests close ${fmtIST(open[0].closesAtMs, { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true })}, ${relTime(open[0].closesAtMs, ctx.now)}.`),
      h('p.callout', null, 'A better fit always leads. A higher fee can only break a tie between people who are equally compatible. You pay only if you’re chosen.'),
      open.map(o => openingCard(ctx, o, true)), timeline(cyc)];
  }
  if (cyc.hrs < HOURS.release) return [stage('Requests are in', 'We’re finishing the matches. If you were chosen, you’ll be asked to confirm your fee.'), timeline(cyc)];
  return [stage('Not this week', 'Another evening was a closer fit, so you haven’t been charged. See you Monday.', true)];
}
