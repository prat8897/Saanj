// Fake Pune members for simulation and for seeding the Firestore emulator.
import { AREAS } from '../../web/js/shared/areas.js';
import { QUESTIONS } from '../../web/js/shared/questions.js';

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const W_NAMES = ['Aarohi', 'Meera', 'Isha', 'Tanvi', 'Riya', 'Sana', 'Kavya', 'Nisha', 'Ananya', 'Pooja', 'Devika', 'Mitali'];
const M_NAMES = ['Arjun', 'Kabir', 'Rohan', 'Vikram', 'Neel', 'Siddharth', 'Aditya', 'Yash', 'Imran', 'Varun', 'Tejas', 'Omkar'];
const JOBS = ['Product designer', 'Doctor', 'Software engineer', 'Architect', 'Lawyer', 'Chartered accountant', 'Photographer', 'Founder', 'Data analyst', 'Teacher', 'Marketing lead'];
const LINES = ['I will remember your coffee order', 'I read the last page first', 'Ask me about my worst trek', 'I make a serious sabudana khichdi', 'I have opinions on Pune traffic'];

export function fakeUser(r, role, i) {
  const pick = a => a[Math.floor(r() * a.length)];
  const answers = {};
  for (const q of QUESTIONS) {
    if (q.type === 'scale') answers[q.id] = 1 + Math.floor(r() * 5);
    else if (q.type === 'single') answers[q.id] = pick(q.options)[0];
    else {
      const pool = q.options.map(o => o[0]); const n = 1 + Math.floor(r() * q.max); const s = new Set();
      while (s.size < Math.min(n, pool.length)) s.add(pick(pool));
      answers[q.id] = [...s];
    }
  }
  if (!answers.languages.includes('english') && r() < 0.8) answers.languages.push('english');
  const age = role === 'woman' ? 24 + Math.floor(r() * 14) : 26 + Math.floor(r() * 15);
  const d = [];
  if (r() < 0.2) d.push('smoker'); if (r() < 0.1) d.push('nonveg'); if (r() < 0.1) d.push('kids_no');
  const slots = ['sat_pm', 'sat_eve', 'sun_pm', 'sun_eve'].filter(() => r() < 0.65);
  return {
    id: `${role[0]}${i}`, role, status: 'approved', verified: true,
    firstName: pick(role === 'woman' ? W_NAMES : M_NAMES), age, area: pick(AREAS).id,
    prefs: { ageMin: age - 6 - Math.floor(r() * 3), ageMax: age + 5 + Math.floor(r() * 6) },
    answers, dealbreakers: d, profession: pick(JOBS), prompts: { a: pick(LINES) },
    logistics: {
      budget: pick([500, 800, 800, 1200, 2000]),
      arrangements: role === 'woman' ? ['split', ...(r() < 0.5 ? ['treatMe'] : [])] : ['split', ...(r() < 0.6 ? ['iTreat'] : [])],
      slots: slots.length ? slots : ['sat_eve'],
    },
  };
}

export const fakeCrowd = (nW, nM, seed = 7) => {
  const r = rng(seed);
  return [...Array.from({ length: nW }, (_, i) => fakeUser(r, 'woman', i)), ...Array.from({ length: nM }, (_, i) => fakeUser(r, 'man', i))];
};
