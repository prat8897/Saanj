// Demo implementation of the same data layer: in-memory, with scenarios so every screen can be seen.
import { sheet, h, toast } from './ui.js';
import { makeTeaser } from './shared/teaser.js';
import { UPI } from './config.js';

const H = 3600e3;
const MON = Date.UTC(2026, 10, 15, 18, 30); // Monday 16 Nov 2026, 00:00 IST
const WEEK = '2026-W47';
const SAT_EVE = MON + 5 * 24 * H + 19.5 * H, SUN_PM = MON + 6 * 24 * H + 16.5 * H;
const subs = new Set();
let clock = MON + 10 * H;
let S = fresh();

function fresh() {
  return { user: null, admin: false, profile: null, optin: null, openings: [], dates: [], payments: [], applicants: [], reports: [], role: 'woman' };
}
const emit = () => subs.forEach(f => f());
const watch = (get, cb) => { const f = () => cb(structuredClone(get())); subs.add(f); f(); return () => subs.delete(f); };

const answers = (o = {}) => ({ intent: 'serious', energy: 3, ambition: 4, planning: 2, family: 4, sunday: ['outdoors', 'cafe'], humour: 'dry', talk: 'deep', food: 4, fitness: 4, music: ['indie', 'jazz'], smoking: 'no', drinking: 'social', diet: 'nonveg', kids: 'open', languages: ['english', 'marathi'], ...o });
const person = (role, over = {}) => ({
  role, firstName: role === 'woman' ? 'Meera' : 'Arjun', age: role === 'woman' ? 29 : 32, area: 'koregaon_park', status: 'approved', verified: true,
  profession: role === 'woman' ? 'Product designer' : 'Architect', prompts: { a: role === 'woman' ? 'I read the last page first' : 'I make a serious sabudana khichdi' },
  prefs: { ageMin: 26, ageMax: 38 }, answers: answers(), dealbreakers: [], profileLink: 'https://linkedin.com/in/demo',
  logistics: { budget: 800, arrangements: ['split', role === 'woman' ? 'treatMe' : 'iTreat'], slots: ['sat_eve', 'sun_pm'] }, ...over,
});
const other = role => person(role, role === 'man'
  ? { firstName: 'Kabir', age: 31, profession: 'Software engineer', answers: answers({ sunday: ['outdoors', 'travel'], humour: 'witty' }), prompts: { a: 'Ask me about my worst trek' } }
  : { firstName: 'Isha', age: 28, profession: 'Doctor', answers: answers({ sunday: ['cafe', 'home'], humour: 'warm' }), prompts: { a: 'I will remember your coffee order' } });

const venue = { id: 'kp-germanbakery', name: 'German Bakery', area: 'koregaon_park', areaName: 'Koregaon Park', note: 'Garden seating, easy to spot each other.' };
const mkDate = (over = {}) => ({
  id: 'd1', weekId: WEEK, womanUid: 'demo-user', manUid: 'm9', uids: ['demo-user', 'm9'], status: 'offered', slot: 'sat_eve', startsAt: SAT_EVE,
  arrangement: 'split', code: 'cardamom', venue, teaserForWoman: makeTeaser(other('man')), teaserForMan: makeTeaser(other('woman')), ...over,
});
const mkOpening = (i, over = {}) => ({
  id: 'o' + i, weekId: WEEK, forUid: 'demo-user', status: 'open', bid: null, slot: ['sat_eve', 'sun_pm', 'sat_pm'][i % 3], startsAt: [SAT_EVE, SUN_PM, SAT_EVE - 3 * H][i % 3],
  arrangement: 'split', areaLabel: ['Koregaon Park', 'Baner', 'Kalyani Nagar'][i % 3], costForTwo: [700, 1200, 800][i % 3], minBid: 499, bidCap: 1497, closesAtMs: MON + 60 * H,
  teaser: makeTeaser(person('woman', { firstName: 'X', age: 27 + i, profession: ['Photographer', 'Doctor', 'Lawyer'][i % 3], prompts: { a: ['I read the last page first', 'I will remember your coffee order', 'I have opinions on Pune traffic'][i % 3] }, answers: answers({ sunday: [['cafe', 'travel'], ['outdoors', 'home'], ['events', 'cafe']][i % 3], humour: ['warm', 'dry', 'silly'][i % 3] }) })), ...over,
});
const pay = (over = {}) => ({ id: 'd1', dateId: 'd1', weekId: WEEK, manUid: 'demo-user', amount: 799, status: 'due', dueByMs: MON + 70 * H, provider: 'upi', ...over });

export const SCENARIOS = {
  landing: { label: 'Signed out: welcome page', build: () => { clock = MON + 10 * H; } },
  w_apply: { label: 'Woman: starting her application', build: s => { s.user = true; s.role = 'woman'; s.profile = null; } },
  w_pending: { label: 'Woman: application under review', build: s => { s.user = true; s.profile = person('woman', { status: 'pending', verified: false }); } },
  w_optin: { label: 'Woman: Monday, asked if she’s in', build: s => { clock = MON + 10 * H; s.user = true; s.profile = person('woman'); } },
  w_waiting: { label: 'Woman: waiting on this week’s match', build: s => { clock = MON + 34 * H; s.user = true; s.profile = person('woman'); s.optin = { slots: ['sat_eve', 'sun_pm'] }; } },
  w_invite: { label: 'Woman: invitation has arrived', build: s => { clock = MON + 85 * H; s.user = true; s.profile = person('woman'); s.optin = { slots: ['sat_eve'] }; s.dates = [mkDate()]; } },
  w_confirmed: { label: 'Woman: confirmed, Saturday afternoon', build: s => { clock = SAT_EVE - 5 * H; s.user = true; s.profile = person('woman'); s.optin = { slots: ['sat_eve'] }; s.dates = [mkDate({ status: 'confirmed' })]; } },
  w_none: { label: 'Woman: no match this week', build: s => { clock = MON + 90 * H; s.user = true; s.profile = person('woman'); s.optin = { slots: ['sat_eve'] }; } },
  m_optin: { label: 'Man: Monday, asked if he’s open', build: s => { clock = MON + 10 * H; s.user = true; s.role = 'man'; s.profile = person('man'); } },
  m_openings: { label: 'Man: three openings to request', build: s => { clock = MON + 30 * H; s.user = true; s.role = 'man'; s.profile = person('man'); s.optin = { slots: ['sat_eve', 'sun_pm'] }; s.openings = [0, 1, 2].map(i => mkOpening(i)); } },
  m_bid: { label: 'Man: request sent for one', build: s => { SCENARIOS.m_openings.build(s); s.openings[0].bid = 799; } },
  m_won: { label: 'Man: evening assigned, fee due', build: s => { clock = MON + 62 * H; s.user = true; s.role = 'man'; s.profile = person('man'); s.optin = { slots: ['sat_eve'] }; s.openings = [mkOpening(0, { status: 'won', bid: 799, dateId: 'd1' }), mkOpening(1, { status: 'lost' })]; s.dates = [mkDate({ status: 'pending_payment' })]; s.payments = [pay()]; } },
  m_secured: { label: 'Man: fee paid, invitation Thursday', build: s => { SCENARIOS.m_won.build(s); clock = MON + 75 * H; s.dates[0].status = 'paid'; s.payments[0].status = 'paid'; } },
  m_confirmed: { label: 'Man: she said yes', build: s => { SCENARIOS.m_won.build(s); clock = SAT_EVE - 20 * H; s.dates[0].status = 'confirmed'; s.payments[0].status = 'paid'; } },
  m_lost: { label: 'Man: not matched this week', build: s => { clock = MON + 90 * H; s.user = true; s.role = 'man'; s.profile = person('man'); s.optin = { slots: ['sat_eve'] }; s.openings = [mkOpening(0, { status: 'lost', bid: 699 }), mkOpening(1, { status: 'passed' })]; } },
  admin: {
    label: 'Admin: team view', route: '#/admin', build: s => {
      clock = MON + 85 * H; s.user = true; s.admin = true; s.role = 'woman'; s.profile = person('woman');
      s.applicants = [
        { id: 'a1', ...person('woman', { firstName: 'Tanvi', age: 27, status: 'pending', verified: false, profession: 'Architect', area: 'baner', prompts: { a: 'I make a serious filter coffee' } }), createdAt: clock - 5 * H },
        { id: 'a2', ...person('man', { firstName: 'Rohan', age: 33, status: 'pending', verified: false, profession: 'Founder', area: 'aundh', prompts: { a: 'Ask me about my worst trek' } }), createdAt: clock - 20 * H },
      ];
      s.dates = [mkDate({ id: 'd1', status: 'held' }), mkDate({ id: 'd2', status: 'confirmed', womanUid: 'w2' })];
      s.payments = [pay({ id: 'd1', status: 'paid' }), pay({ id: 'd3', status: 'claimed', claimedRef: '4021 8890 1123', manUid: 'm4' })];
    },
  },
};

export function load(name) {
  S = fresh(); (SCENARIOS[name] || SCENARIOS.landing).build(S); S.scenario = name;
  if (!S.user) S.user = null; emit();
}

const need = fn => { fn(S); emit(); };

export const api = {
  mode: 'demo',
  now: () => clock,
  demo: {
    load, scenarios: SCENARIOS,
    mount() {
      document.body.append(h('button.demo-fab', {
        onclick: () => {
          const close = sheet(h('h2.h2', null, 'Preview a screen'), h('p.muted.small', null, 'Demo mode: no Firebase yet. Pick any moment in the week.'),
            h('div.opts', null, Object.entries(SCENARIOS).map(([k, v]) => h('button.opt' + (S.scenario === k ? '.on' : ''), { onclick: () => { load(k); close(); location.hash = SCENARIOS[k].route || '#/'; } }, h('span.mark'), h('span', null, h('b', null, v.label))))));
        },
      }, 'Preview'));
    },
  },
  auth: {
    onChange: cb => { const f = () => cb(S.user ? { uid: 'demo-user', email: 'demo@example.com', name: 'Demo' } : null); subs.add(f); f(); return () => subs.delete(f); },
    async signInGoogle() { S.user = true; S.profile = null; S.scenario = 'w_apply'; emit(); },
    async sendLink() { toast('Demo: no email is sent. Signing you in.'); S.user = true; emit(); },
    async finishLink() { return false; },
    async signOut() { load('landing'); },
  },
  profile: {
    watch: (uid, cb) => watch(() => S.profile, cb),
    create: async (uid, data) => need(s => { s.profile = { ...data, status: 'pending', verified: false }; }),
    update: async (uid, patch) => need(s => { s.profile = { ...s.profile, ...patch }; }),
    selfie: async () => {},
    isAdmin: async () => S.admin,
    remove: async () => load('landing'),
    pushEnable: async () => { toast('Demo: notifications would be switched on here.'); return true; },
  },
  optin: {
    watch: (uid, week, cb) => watch(() => S.optin, cb),
    set: async (uid, week, role, slots) => need(s => { s.optin = { slots, weekId: week }; }),
    clear: async () => need(s => { s.optin = null; }),
  },
  openings: {
    watch: (uid, cb) => watch(() => S.openings, cb),
    bid: async (id, amount) => need(s => { s.openings.find(o => o.id === id).bid = amount; }),
  },
  dates: {
    watch: (uid, role, cb) => watch(() => S.dates, cb),
    respond: async (id, status) => need(s => { s.dates.find(d => d.id === id).status = status; }),
    arrived: async (id, role) => need(s => { s.dates.find(d => d.id === id)[role === 'woman' ? 'womanArrivedAt' : 'manArrivedAt'] = clock; }),
    sos: async (id, role) => need(s => { s.dates.find(d => d.id === id)[role === 'woman' ? 'womanSos' : 'manSos'] = clock; }),
  },
  payments: {
    watch: (uid, cb) => watch(() => S.payments, cb),
    claim: async (id, ref) => need(s => { Object.assign(s.payments.find(p => p.id === id), { status: 'claimed', claimedRef: ref }); }),
  },
  config: { get: async () => ({ upiVpa: UPI.vpa, payee: UPI.payee }) },
  report: { create: async () => toast('Report sent to our team.') },
  admin: {
    applicants: cb => watch(() => S.applicants, cb),
    optins: (week, cb) => watch(() => [], cb),
    selfie: async () => null,
    decide: async (uid, { status, verified }) => need(s => { s.applicants = s.applicants.filter(a => a.id !== uid || status === 'waitlist'); const a = s.applicants.find(x => x.id === uid); if (a) a.status = status; }),
    dates: cb => watch(() => S.dates, cb),
    release: async id => need(s => { s.dates.find(d => d.id === id).status = 'offered'; }),
    payments: cb => watch(() => S.payments, cb),
    markPaid: async id => need(s => { s.payments.find(p => p.id === id).status = 'paid'; }),
    settleDone: async () => {},
    reports: cb => watch(() => S.reports, cb),
    resolveReport: async () => {},
  },
};
