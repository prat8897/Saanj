// "Dates" history, "You" settings, and the application-status screen.
import { api } from '../api.js';
import { h, sheet, toast, chips, optionList, brand, money } from '../ui.js';
import { SLOTS, fmtDay, fmtTime } from '../shared/schedule.js';
import { AREAS, areaName } from '../shared/areas.js';
import { ARRANGEMENTS, BUDGETS } from '../shared/questions.js';
import { legalSheet } from './legal.js';
import { BRAND } from '../shared/constants.js';

const LABEL = {
  pending_payment: ['Awaiting your fee', 'warn'], paid: ['Secured', 'ok'], held: ['Being finalised', 'warn'], offered: ['Awaiting reply', 'warn'],
  confirmed: ['Confirmed', 'ok'], declined: ['Passed', ''], completed: ['Done', 'ok'], expired: ['Not answered', ''],
  noshow_w: ['Not completed', ''], noshow_m: ['Not completed', ''], lapsed: ['Released', ''],
};

export function dates(ctx) {
  const list = [...ctx.state.dates].filter(d => d.status !== 'lapsed').sort((a, b) => b.startsAt - a.startsAt);
  if (!list.length) return [h('h1.h1', null, 'Your evenings'), h('section.stage', null, h('div.orb.dim'), h('p.lede', null, 'Evenings you’ve been invited to will collect here.'))];
  return [h('h1.h1', null, 'Your evenings'), list.map(d => {
    const [t, tone] = LABEL[d.status] || [d.status, ''];
    const hide = ctx.state.profile.role === 'man' && !['confirmed', 'completed', 'noshow_w', 'noshow_m'].includes(d.status);
    return h('article.panel', null, h('div.spread', null, h('h3.h3', null, fmtDay(d.startsAt)), h('span.pill' + (tone ? '.' + tone : ''), null, t)),
      h('p.muted.small', { style: { margin: 0 } }, `${fmtTime(d.startsAt)}, ${hide ? d.venue.areaName : `${d.venue.name}, ${d.venue.areaName}`}`));
  })];
}

function logisticsSheet(ctx) {
  const p = ctx.state.profile, l = structuredClone(p.logistics), area = { v: p.area };
  const close = sheet(h('h2.h2', null, 'Your evening preferences'),
    h('label.field', null, h('span', null, 'Area'), h('select', { onchange: e => { area.v = e.target.value; } }, AREAS.map(a => h('option', { value: a.id, selected: a.id === p.area }, a.name)))),
    h('h3.h3', { style: { margin: '10px 0' } }, 'Budget'), optionList({ options: BUDGETS, value: l.budget, onChange: v => { l.budget = Number(v); } }),
    h('h3.h3', { style: { margin: '22px 0 10px' } }, 'Who pays'), optionList({ options: ARRANGEMENTS, value: l.arrangements, multi: true, onChange: v => { l.arrangements = v; } }),
    h('h3.h3', { style: { margin: '22px 0 10px' } }, 'Usually free'), chips({ options: SLOTS.map(s => [s.id, s.label]), value: l.slots, multi: true, onChange: v => { l.slots = v; } }),
    h('button.btn.primary.block', { style: { marginTop: '22px' }, onclick: async () => { if (!l.arrangements.length || !l.slots.length) return toast('Pick at least one payment option and one time.'); await api.profile.update(ctx.state.user.uid, { logistics: l, area: area.v }); close(); toast('Saved.'); } }, 'Save'));
}

export function you(ctx) {
  const { state } = ctx, p = state.profile, uid = state.user.uid;
  const kv = (k, v) => [h('dt', null, k), h('dd', null, v)];
  return [h('h1.h1', null, p.firstName),
    h('section.panel', null, h('dl.kv', null,
      kv('Member', p.verified ? 'Verified' : 'Verification pending'), kv('Area', areaName(p.area)), kv('Budget', money(p.logistics.budget)),
      kv('Who pays', p.logistics.arrangements.map(a => ARRANGEMENTS.find(x => x[0] === a)?.[1]).join(', ')), kv('Usually free', p.logistics.slots.map(s => SLOTS.find(x => x.id === s)?.label).join(', '))),
      h('button.btn.ghost.sm', { onclick: () => logisticsSheet(ctx) }, 'Edit preferences')),
    h('section.panel.stack', null,
      h('button.btn.ghost.block', { onclick: async () => { try { (await api.profile.pushEnable(uid)) && toast('Notifications are on.'); } catch (e) { toast(e.message || 'Couldn’t switch on notifications.'); } } }, 'Turn on notifications'),
      h('button.btn.ghost.block', { onclick: () => legalSheet('how') }, 'How fees and priority work'),
      h('button.btn.ghost.block', { onclick: () => legalSheet('terms') }, 'Terms'), h('button.btn.ghost.block', { onclick: () => legalSheet('privacy') }, 'Privacy'),
      h('a.btn.ghost.block', { href: `mailto:${BRAND.supportEmail}` }, 'Contact us')),
    h('section.panel.stack', null,
      h('button.btn.ghost.block', { onclick: () => { const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' })), download: 'saanj-my-data.json' }); a.click(); } }, 'Download my data'),
      h('button.btn.ghost.block', { onclick: () => api.auth.signOut() }, 'Sign out'),
      h('button.btn.danger.block', { onclick: () => { const close = sheet(h('h2.h2', null, 'Delete your account?'), h('p.muted', null, 'This removes your profile and answers for good. It can’t be undone.'), h('div.stack', null, h('button.btn.danger.block', { onclick: async () => { try { await api.profile.remove(uid); close(); } catch { toast('For security, sign in again and retry.'); } } }, 'Delete everything'), h('button.btn.ghost.block', { onclick: () => close() }, 'Keep my account'))); } }, 'Delete my account')),
    h('p.faint', { style: { textAlign: 'center' } }, 'Saanj v1')];
}

export function status(ctx) {
  const p = ctx.state.profile;
  const copy = {
    pending: ['We’re reading your application', 'Someone from our team will message you to book a 5-minute video call. After that you’re in, usually within two days.'],
    waitlist: ['You’re on the list', 'We’re opening Pune one area at a time so every member gets real choice. We’ll notify you the moment there’s room.'],
    rejected: ['We can’t offer a place right now', 'It isn’t a judgement on you. Our matching needs a certain fit with the people already here.'],
  }[p.status] || ['Hold on', ''];
  return [h('header.topbar', null, brand('#/'), h('button.btn.ghost.sm', { onclick: () => api.auth.signOut() }, 'Sign out')),
    h('main.page', null, h('section.stage', null, h('div.orb' + (p.status === 'rejected' ? '.dim' : '')), h('h1.h2', null, copy[0]), h('p.lede', null, copy[1]),
      null))];
}
