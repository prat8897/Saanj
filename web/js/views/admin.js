// Team view: applications, this week's evenings, money, reports. Gated by an admins/{uid} document.
import { api } from '../api.js';
import { h, sheet, toast, money } from '../ui.js';
import { fmtDay, fmtTime, fmtIST } from '../shared/schedule.js';
import { areaName } from '../shared/areas.js';
import { QUESTIONS } from '../shared/questions.js';

let tab = 'apps';
const notes = new Map();

const answerText = (q, v) => (Array.isArray(v) ? v : [v]).map(x => q.options?.find(o => String(o[0]) === String(x))?.[1] ?? x).join(', ');

function applicant(a) {
  const note = h('input', { type: 'text', placeholder: 'Note (optional)', value: notes.get(a.id) || '', oninput: e => notes.set(a.id, e.target.value) });
  const decide = (status, verified) => async () => { await api.admin.decide(a.id, { status, verified, note: note.value }); toast(status === 'approved' ? 'Approved and verified.' : status === 'waitlist' ? 'Waitlisted.' : 'Rejected.'); };
  return h('article.panel', null,
    h('div.spread', null, h('h3.h3', null, `${a.firstName}, ${a.age}`), h('span.pill', null, a.role === 'woman' ? 'Woman' : 'Man')),
    h('p.muted.small', { style: { margin: '0 0 6px' } }, `${a.profession}, ${areaName(a.area)}`),
    h('p', null, `“${a.prompts?.a || ''}”`),
    h('details', null, h('summary.small.muted', { style: { cursor: 'pointer' } }, 'All answers'),
      h('dl.kv', null, QUESTIONS.flatMap(q => [h('dt', null, q.title.length > 28 ? q.id : q.title), h('dd', null, a.answers?.[q.id] == null ? '' : answerText(q, a.answers[q.id]))]),
        h('dt', null, 'Open to ages'), h('dd', null, `${a.prefs?.ageMin} to ${a.prefs?.ageMax}`), h('dt', null, 'Budget'), h('dd', null, money(a.logistics?.budget || 0)),
        h('dt', null, 'Dealbreakers'), h('dd', null, (a.dealbreakers || []).join(', ') || 'none'),
        h('dt', null, 'Profile link'), h('dd', null, a.profileLink ? h('a', { href: a.profileLink, target: '_blank', rel: 'noopener' }, a.profileLink) : ''))),
    h('div.row.wrap', { style: { margin: '12px 0' } },
      h('button.btn.ghost.sm', { onclick: async () => { const s = await api.admin.selfie(a.id); sheet(h('h2.h2', null, `${a.firstName}’s selfie`), s ? h('img', { src: s, alt: 'Selfie', style: { width: '100%', borderRadius: '12px' } }) : h('p.muted', null, 'No selfie on file.')); } }, 'View selfie')),
    h('label.field', null, h('span', null, 'Internal note'), note),
    h('div.row.wrap', null, h('button.btn.primary.sm', { onclick: decide('approved', true) }, 'Approve and verify'), h('button.btn.ghost.sm', { onclick: decide('waitlist', false) }, 'Waitlist'), h('button.btn.danger.sm', { onclick: decide('rejected', false) }, 'Reject')));
}

const tone = { held: 'warn', offered: 'warn', pending_payment: 'warn', confirmed: 'ok', paid: 'ok', completed: 'ok', lapsed: '', declined: '' };
function dateRow(d) {
  const sos = d.womanSos || d.manSos;
  return h('article.panel', null,
    h('div.spread', null, h('h3.h3', null, `${fmtDay(d.startsAt)}, ${fmtTime(d.startsAt)}`), h('span.pill' + (sos ? '.bad' : tone[d.status] ? '.' + tone[d.status] : ''), null, sos ? 'SOS' : d.status.replace('_', ' '))),
    h('p.muted.small', { style: { margin: '0 0 8px' } }, `${d.venue.name}, ${d.venue.areaName}. Word: ${d.code}. ${d.arrangement}.`),
    d.status === 'held' ? h('details', { open: true }, h('summary.small.muted', null, 'Read before releasing'),
      h('p.small', null, h('b', null, 'She will read: '), d.teaserForWoman.join(' ')), h('p.small', null, h('b', null, 'He will read: '), d.teaserForMan.join(' '))) : null,
    d.status === 'held' ? h('button.btn.primary.sm', { onclick: async () => { await api.admin.release(d.id); toast('Released to her.'); } }, 'Release invitation') : null);
}

function moneyRow(p) {
  const s = p.settlement;
  return h('article.panel', null,
    h('div.spread', null, h('h3.h3', null, money(p.amount)), h('span.pill' + (p.status === 'paid' ? '.ok' : p.status === 'claimed' ? '.warn' : ''), null, p.status)),
    h('p.muted.small', { style: { margin: '0 0 8px' } }, `Due ${fmtIST(p.dueByMs, { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}${p.claimedRef ? `. Reference ${p.claimedRef}` : ''}`),
    ['due', 'claimed'].includes(p.status) ? h('button.btn.primary.sm', { onclick: async () => { await api.admin.markPaid(p.id); toast('Marked paid.'); } }, 'Mark paid') : null,
    s && !s.done && s.refund > 0 ? h('div', { style: { marginTop: '8px' } }, h('p.small', null, `Return ${money(s.refund)} (${s.type}).`), h('button.btn.ghost.sm', { onclick: async () => { await api.admin.settleDone(p.id); toast('Marked done.'); } }, 'I’ve sent it')) : null);
}

export function view(ctx) {
  const adm = ctx.state.adm;
  const held = adm.dates.filter(d => d.status === 'held'), claimed = adm.payments.filter(p => p.status === 'claimed');
  const owed = adm.payments.filter(p => p.settlement && !p.settlement.done && p.settlement.refund > 0);
  const openReports = adm.reports.filter(r => r.status !== 'resolved');
  const tabs = [['apps', `Applications (${adm.applicants.length})`], ['week', `Evenings (${held.length} to release)`], ['money', `Money (${claimed.length + owed.length})`], ['reports', `Reports (${openReports.length})`]];
  const body = {
    apps: () => adm.applicants.length ? adm.applicants.map(applicant) : [h('p.muted', null, 'No applications waiting.')],
    week: () => [held.length > 1 ? h('button.btn.primary.sm', { style: { marginBottom: '12px' }, onclick: async () => { for (const d of held) await api.admin.release(d.id); toast('All released.'); } }, `Release all ${held.length}`) : null,
      ...[...adm.dates].sort((a, b) => (b.womanSos || b.manSos ? 1 : 0) - (a.womanSos || a.manSos ? 1 : 0) || a.startsAt - b.startsAt).map(dateRow), adm.dates.length ? null : h('p.muted', null, 'No evenings yet.')],
    money: () => { const rows = adm.payments.filter(p => ['due', 'claimed'].includes(p.status) || (p.settlement && !p.settlement.done && p.settlement.refund > 0)); return rows.length ? rows.map(moneyRow) : [h('p.muted', null, 'Nothing to do.')]; },
    reports: () => openReports.length ? openReports.map(r => h('article.panel', null, h('p', null, r.text), h('button.btn.ghost.sm', { onclick: async () => { await api.admin.resolveReport(r.id); toast('Resolved.'); } }, 'Mark resolved'))) : [h('p.muted', null, 'No open reports.')],
  }[tab]();
  return [h('h1.h1', null, 'The team'), h('div.seg', null, tabs.map(([k, l]) => h('button' + (k === tab ? '.on' : ''), { onclick: () => { tab = k; ctx.render(true); } }, l))), body];
}
