import { api } from './api.js';
import { DEMO } from './config.js';
import { h, mount, brand, icon } from './ui.js';
import { cycleAt } from './shared/schedule.js';
import * as welcome from './views/welcome.js';
import * as onboarding from './views/onboarding.js';
import * as home from './views/home.js';
import * as tabs from './views/tabs.js';
import * as admin from './views/admin.js';

const root = document.getElementById('app');
const state = { user: null, profile: undefined, admin: false, optin: null, openings: [], dates: [], payments: [], config: {}, adm: { applicants: [], dates: [], payments: [], reports: [] } };
let curUid = null, unsubProfile = null, subs = {}, watchKey = '', lastKey = '', phaseKey = '';

function rewatch(cyc) {
  const p = state.profile, key = [state.user?.uid, p?.status, p?.role, cyc.id, state.admin].join('|');
  if (key === watchKey) return;
  watchKey = key;
  Object.values(subs).forEach(u => u && u()); subs = {};
  const uid = state.user?.uid;
  if (uid && p?.status === 'approved') {
    subs.optin = api.optin.watch(uid, cyc.id, o => { state.optin = o; render(); });
    subs.dates = api.dates.watch(uid, p.role, d => { state.dates = d; render(); });
    if (p.role === 'man') {
      subs.openings = api.openings.watch(uid, o => { state.openings = o; render(); });
      subs.payments = api.payments.watch(uid, x => { state.payments = x; render(); });
    }
    api.config.get().then(c => { state.config = c; });
  }
  if (uid && state.admin) {
    for (const k of ['applicants', 'dates', 'payments', 'reports']) subs['adm' + k] = api.admin[k](rows => { state.adm[k] = rows; render(); });
  }
}

const NAV = [['#/', 'Home', icon.home], ['#/dates', 'Evenings', icon.dates], ['#/you', 'You', icon.you]];

export function render(force) {
  const now = api.now(), cyc = cycleAt(now), ctx = { state, cyc, now, render };
  rewatch(cyc);
  const route = location.hash.slice(1).split('?')[0] || '/';
  let key, nodes;
  if (!state.user) { key = 'welcome'; nodes = welcome.view(ctx); }
  else if (state.profile === undefined) { key = 'splash'; nodes = [h('div.splash', null, h('div.orb'))]; }
  else if (state.profile === null) { key = 'onboard'; if (lastKey === key && !force) return; nodes = onboarding.view(ctx); }
  else if (state.profile.status !== 'approved') { key = 'status'; nodes = tabs.status(ctx); }
  else {
    key = 'app:' + route;
    const view = { '/': home.view, '/dates': tabs.dates, '/you': tabs.you, '/admin': admin.view }[route] || home.view;
    const items = state.admin ? [...NAV, ['#/admin', 'Team', icon.admin]] : NAV;
    const cur = (route in { '/': 1, '/dates': 1, '/you': 1, '/admin': 1 }) ? '#' + route : '#/';
    nodes = [
      h('header.topbar', null, brand('#/'), h('span.faint', null, `Week ${cyc.id.split('W')[1]}`)),
      h('main.page', { id: 'main' }, view(ctx)),
      h('div.tabbar', null, h('nav', { 'aria-label': 'Main' }, items.map(([href, label, ic]) => h('a.tab' + (href === cur ? '.on' : ''), { href, 'aria-current': href === cur ? 'page' : null }, h('span', { html: ic }), label)))),
    ];
  }
  const y = lastKey === key ? scrollY : 0;
  lastKey = key;
  mount(root, h('div.shell', null, ...nodes));
  scrollTo(0, y);
}

api.auth.onChange(u => {
  state.user = u;
  if ((u?.uid ?? null) === curUid) { render(); return; }
  curUid = u?.uid ?? null;
  unsubProfile?.(); state.profile = undefined; state.admin = false; watchKey = '';
  if (!u) { render(true); return; }
  unsubProfile = api.profile.watch(u.uid, p => { state.profile = p; render(); });
  api.profile.isAdmin(u.uid).then(a => { if (a !== state.admin) { state.admin = a; render(); } });
  render();
});

addEventListener('hashchange', () => render(true));
setInterval(() => { const c = cycleAt(api.now()); const k = c.id + c.phase; if (k !== phaseKey) { phaseKey = k; render(true); } }, 30000);
phaseKey = (c => c.id + c.phase)(cycleAt(api.now()));

if (DEMO) {
  api.demo.mount();
  const s = new URLSearchParams(location.search).get('s');
  if (s) { api.demo.load(s); const r = api.demo.scenarios[s]?.route; if (r) location.hash = r; }
} else {
  api.auth.finishLink().catch(e => console.warn(e));
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('/sw.js').catch(() => {});
render(true);
