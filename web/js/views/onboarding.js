// The application: one question per screen, saved as you go. Ends with a verification selfie.
import { api } from '../api.js';
import { h, toast, brand, chips, optionList, lsGet, lsSet, lsDel } from '../ui.js';
import { QUESTIONS, DEALBREAKERS, ARRANGEMENTS, BUDGETS } from '../shared/questions.js';
import { AREAS } from '../shared/areas.js';
import { SLOTS } from '../shared/schedule.js';
import { TUNING } from '../shared/constants.js';
import { legalSheet } from './legal.js';

const KEY = 'saanj.draft.v1';
const HINTS = {
  role: 'Choose “I’m a woman” or “I’m a man” to continue.',
  basics: 'Fill in your name, age (21+), what you do and your area.',
  prefs: 'The “To” age must be at least the “From” age.',
  evening: 'Pick a budget, at least one way of paying and one free slot.',
  words: 'Write at least a few words (8 characters or more).',
  verify: 'Add your profile link and a selfie, and tick all three boxes.',
};

async function shrink(file) {
  const img = await createImageBitmap(file);
  const k = 480 / Math.max(img.width, img.height, 480);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}

export function view(ctx) {
  const { user } = ctx.state;
  const d = lsGet(KEY, null) || { role: null, answers: {}, dealbreakers: [], prefs: { ageMin: 25, ageMax: 38 }, logistics: { budget: 800, arrangements: ['split'], slots: ['sat_eve', 'sun_pm'] }, prompts: {}, consent: {} };
  let selfie = null, step = d._step || 0;
  const save = () => lsSet(KEY, { ...d, _step: step });

  const qs = QUESTIONS.map(q => ({
    id: q.id, valid: () => (q.type === 'multi' ? (d.answers[q.id] || []).length > 0 : d.answers[q.id] != null),
    auto: q.type === 'single',
    render: next => {
      const body = [h('h2.h2', null, q.title)];
      if (q.type === 'scale') {
        const row = h('div.scale', { role: 'radiogroup' }, [1, 2, 3, 4, 5].map(n => h('button', { type: 'button', 'aria-label': String(n), class: d.answers[q.id] === n ? 'on' : '', onclick: e => { d.answers[q.id] = n; save(); [...row.children].forEach((b, i) => b.classList.toggle('on', i + 1 === n)); next.refresh(); } })));
        body.push(row, h('div.scale-ends', null, h('span', null, q.lo), h('span', { style: { textAlign: 'right' } }, q.hi)));
      } else {
        body.push(optionList({ options: q.options, value: d.answers[q.id], multi: q.type === 'multi', max: q.max, onChange: v => { d.answers[q.id] = v; save(); next.refresh(); if (q.type === 'single') setTimeout(next.go, 220); } }));
        if (q.type === 'multi' && q.max) body.push(h('p.faint', { style: { marginTop: '10px' } }, `Choose up to ${q.max}.`));
      }
      return body;
    },
  }));

  const steps = [
    {
      id: 'role', valid: () => !!d.role,
      render: next => [
        h('h2.h2', null, 'Let’s begin. Which describes you?'),
        optionList({ options: [['woman', 'I’m a woman', 'Free. You receive an evening each week we find someone worth your time.'], ['man', 'I’m a man', `You pay only when you’re matched. Fees start at ₹${TUNING.minBid}.`]], value: d.role, onChange: v => { d.role = v; save(); next.refresh(); } }),
        h('p.callout', null, 'Women never pay. Men on Saanj request evenings and pay a fee, but a higher fee can only break a tie between equally compatible people. Compatibility always leads.'),
        h('button.btn.ghost.sm', { type: 'button', onclick: () => legalSheet('how') }, 'How fees and priority work'),
      ],
    },
    {
      id: 'basics', valid: () => d.firstName?.trim() && d.age >= 21 && d.age <= 65 && d.area && d.profession?.trim(),
      render: next => {
        const on = k => e => { d[k] = k === 'age' ? Number(e.target.value) : e.target.value; save(); next.refresh(); };
        return [
          h('h2.h2', null, 'A little about you'),
          h('label.field', null, h('span', null, 'First name'), h('input', { type: 'text', value: d.firstName || '', autocomplete: 'given-name', oninput: on('firstName') })),
          h('label.field', null, h('span', null, 'Age'), h('input', { type: 'number', inputmode: 'numeric', min: 21, max: 65, value: d.age || '', oninput: on('age') })),
          h('label.field', null, h('span', null, 'What you do (shown to your date, like “Architect”)'), h('input', { type: 'text', maxlength: 40, value: d.profession || '', oninput: on('profession') })),
          h('label.field', null, h('span', null, 'Where in Pune do you live or work?'), h('select', { onchange: on('area') }, h('option', { value: '' }, 'Choose an area'), AREAS.map(a => h('option', { value: a.id, selected: d.area === a.id }, a.name)))),
          h('p.faint', null, 'Your area only decides where you’ll meet. It’s never shown.'),
        ];
      },
    },
    {
      id: 'prefs', valid: () => d.prefs.ageMax >= d.prefs.ageMin,
      render: next => {
        const stepper = (k, label, lo, hi) => {
          const out = h('output', null, d.prefs[k]);
          return h('div.panel', null, h('div.spread', null, h('b', null, label), h('div.stepper', null,
            h('button', { type: 'button', 'aria-label': `${label} down`, onclick: () => { d.prefs[k] = Math.max(lo, d.prefs[k] - 1); out.textContent = d.prefs[k]; save(); next.refresh(); } }, '−'), out,
            h('button', { type: 'button', 'aria-label': `${label} up`, onclick: () => { d.prefs[k] = Math.min(hi, d.prefs[k] + 1); out.textContent = d.prefs[k]; save(); next.refresh(); } }, '+'))));
        };
        return [h('h2.h2', null, `You’d meet ${d.role === 'man' ? 'women' : 'men'} aged…`), stepper('ageMin', 'From', 21, 60), stepper('ageMax', 'To', 21, 70)];
      },
    },
    ...qs,
    {
      id: 'dealbreakers', valid: () => true,
      render: next => [h('h2.h2', null, 'Anything that’s a firm no?'), h('p.muted', null, 'We will never match you with someone who has these. Skip if nothing applies.'),
        optionList({ options: DEALBREAKERS, value: d.dealbreakers, multi: true, onChange: v => { d.dealbreakers = v; save(); } })],
    },
    {
      id: 'evening', valid: () => d.logistics.arrangements.length && d.logistics.slots.length,
      render: next => [
        h('h2.h2', null, 'Your kind of evening'),
        h('p.muted', null, 'The most you’d comfortably spend. If you’re treating, that’s the whole bill.'),
        optionList({ options: BUDGETS.map(([v, t, s]) => [v, t, s]), value: d.logistics.budget, onChange: v => { d.logistics.budget = Number(v); save(); } }),
        h('h3.h3', { style: { margin: '26px 0 10px' } }, 'Who pays? Pick any that suit you'),
        optionList({ options: ARRANGEMENTS, value: d.logistics.arrangements, multi: true, onChange: v => { d.logistics.arrangements = v; save(); next.refresh(); } }),
        h('h3.h3', { style: { margin: '26px 0 10px' } }, 'When you’re usually free'),
        chips({ options: SLOTS.map(s => [s.id, s.label]), value: d.logistics.slots, multi: true, onChange: v => { d.logistics.slots = v; save(); next.refresh(); } }),
        h('p.faint', { style: { marginTop: '10px' } }, 'You confirm your times again each week.'),
      ],
    },
    {
      id: 'words', valid: () => (d.prompts.a || '').trim().length >= 8,
      render: next => [h('h2.h2', null, 'One line, in your words'), h('p.muted', null, 'Your date sees this and a few lines drawn from your answers. Our team reads it first. Keep it light and free of names, workplaces or contact details.'),
        h('label.field', null, h('span', null, 'Something small that you’d like someone to know'), h('textarea', { maxlength: 90, placeholder: 'I read the last page first', oninput: e => { d.prompts.a = e.target.value; save(); next.refresh(); } }, d.prompts.a || ''))],
    },
    {
      id: 'verify', valid: () => !!d.profileLink?.trim() && !!selfie && d.consent.terms && d.consent.disclosure && d.consent.age,
      render: next => {
        const preview = h('img.selfie', { alt: 'Your selfie', hidden: true });
        const pick = h('input', { type: 'file', accept: 'image/*', capture: 'user', hidden: true, onchange: async e => { const f = e.target.files[0]; if (!f) return; try { selfie = await shrink(f); preview.src = selfie; preview.hidden = false; next.refresh(); } catch { toast('Couldn’t read that photo. Try another.'); } } });
        const consent = (k, text) => h('button.opt.multi' + (d.consent[k] ? '.on' : ''), { type: 'button', onclick: e => { d.consent[k] = d.consent[k] ? 0 : Date.now(); e.currentTarget.classList.toggle('on', !!d.consent[k]); save(); next.refresh(); } }, h('span.mark'), h('span', null, text));
        return [
          h('h2.h2', null, 'Last step: verify it’s you'),
          h('p.muted', null, 'Every member is checked. After you apply, someone from our team will book a 5-minute video call and compare you with this selfie. We delete it once we’ve decided.'),
          h('label.field', null, h('span', null, 'LinkedIn or Instagram link'), h('input', { type: 'url', placeholder: 'https://', value: d.profileLink || '', oninput: e => { d.profileLink = e.target.value; save(); next.refresh(); } })),
          h('div.row', { style: { marginBottom: '22px' } }, preview, pick, h('button.btn.ghost', { type: 'button', onclick: () => pick.click() }, 'Take a selfie')),
          h('div.opts', null,
            consent('age', 'I’m 21 or older and these details are my own.'),
            consent('terms', 'I agree to the Terms and Privacy notice.'),
            consent('disclosure', d.role === 'woman'
              ? 'I understand men on Saanj pay a fee to be considered for an evening, that I never pay or get paid, and that compatibility decides who I meet.'
              : 'I understand I pay only if I’m matched, that a higher fee only breaks ties between equally compatible people, and that a match or second date isn’t guaranteed.')),
          h('div.row', { style: { marginTop: '12px' } }, h('a.small', { href: '#', onclick: e => { e.preventDefault(); legalSheet('terms'); } }, 'Terms'), h('a.small', { href: '#', onclick: e => { e.preventDefault(); legalSheet('privacy'); } }, 'Privacy')),
        ];
      },
    },
  ];

  const stage = h('div'), bar = h('i'), foot = h('div.footbar'), count = h('span.faint');
  const back = h('button.btn.ghost', { type: 'button', onclick: () => { if (step > 0) { step--; save(); paint(); } else api.auth.signOut(); } }, 'Back');
  const cont = h('button.btn.primary', { type: 'button' }, 'Continue');
  const next = {
    go: () => { if (!steps[step].valid()) { toast(HINTS[steps[step].id] || 'Please answer to continue.'); return; } if (step < steps.length - 1) { step++; save(); paint(); window.scrollTo(0, 0); } else submit(); },
    refresh: () => { const ok = !!steps[step].valid(); cont.classList.toggle('is-off', !ok); cont.setAttribute('aria-disabled', String(!ok)); },
  };
  cont.onclick = next.go;
  foot.append(back, cont);

  function paint() {
    const s = steps[step];
    stage.replaceChildren(h('div.step', { key: s.id }, s.render(next)));
    bar.style.width = `${((step + 1) / steps.length) * 100}%`;
    cont.textContent = step === steps.length - 1 ? 'Submit my application' : 'Continue';
    count.textContent = `${step + 1} of ${steps.length}`;
    next.refresh();
  }

  async function submit() {
    cont.disabled = true; cont.classList.remove('is-off');
    const { _step, ...rest } = d;
    try {
      await api.profile.create(user.uid, { ...rest, email: user.email || null, consent: { ...d.consent, at: Date.now() } });
      await api.profile.selfie(user.uid, selfie);
      lsDel(KEY); location.hash = '#/';
    } catch (e) { console.error(e); toast('We couldn’t send your application. Check your connection and try again.'); cont.disabled = false; }
  }

  paint();
  return [h('header.topbar', null, brand('#/'), count),
    h('main.page', null, h('div.progress', null, bar), stage, foot)];
}
