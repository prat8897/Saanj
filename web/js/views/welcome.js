import { api } from '../api.js';
import { h, sheet, toast, brand, sun } from '../ui.js';
import { BRAND, TUNING } from '../shared/constants.js';
import { legalSheet } from './legal.js';

export function openAuth() {
  const email = h('input', { type: 'email', placeholder: 'you@example.com', autocomplete: 'email', inputmode: 'email' });
  const close = sheet(
    h('h2.h2', null, `Welcome to ${BRAND.name}`),
    h('p.muted', null, 'Sign in to apply, or to see your evening.'),
    h('button.btn.primary.block', {
      onclick: async () => { try { await api.auth.signInGoogle(); close(); } catch (e) { toast('Couldn’t sign in with Google. Try email instead.'); } },
    }, 'Continue with Google'),
    h('hr.divider'),
    h('label.field', null, h('span', null, 'Or get a sign-in link by email'), email),
    h('button.btn.block.ghost', {
      onclick: async () => {
        if (!/^\S+@\S+\.\S+$/.test(email.value)) return toast('Enter a valid email address.');
        try { await api.auth.sendLink(email.value.trim()); toast('Link sent. Open it on this device.'); close(); } catch { toast('Couldn’t send the link. Check the address and try again.'); }
      },
    }, 'Email me a link'),
  );
}

export function view() {
  const cta = h('button.btn.primary.block', { onclick: openAuth }, 'Apply for membership');
  return [
    h('header.topbar', null, brand('#/'), h('button.btn.ghost.sm', { onclick: openAuth }, 'Sign in')),
    h('main.page', null,
      h('section.hero', null,
        h('div.sunrise', { 'aria-hidden': 'true' }, h('div.sun')),
        h('h1.h1', null, 'One evening. One stranger. Every week.'),
        h('p.lede', null, 'A blind date in Pune, chosen by people who read your answers, not your photos. No swiping, no chat. A table, a time, and someone worth meeting.'),
        h('div.stack', null, cta, h('p.faint', { style: { textAlign: 'center' } }, 'Pune only, for now. Every member is verified.')),
      ),
      h('ol.how', null,
        h('li', null, h('span.n', null, '1'), h('div', null, h('b', null, 'Answer honestly'), h('span.muted', null, 'Fifteen questions about how you live, not how you look. We meet every member on a short video call.'))),
        h('li', null, h('span.n', null, '2'), h('div', null, h('b', null, 'Get your invitation'), h('span.muted', null, 'On Thursday, one evening arrives: a café, a time, a few lines about who you’ll meet. No name, no photo.'))),
        h('li', null, h('span.n', null, '3'), h('div', null, h('b', null, 'Show up'), h('span.muted', null, 'Say the evening’s word to find each other. Nothing to rate afterwards.'))),
      ),
      h('section.panel', null,
        h('h2.h3', null, 'How it’s paid for'),
        h('p.muted.small', null, `Women never pay. Men pay only when they’re matched with an evening, and a higher fee can only break a tie between equally compatible people. Compatibility always leads.`),
        h('button.btn.ghost.sm', { onclick: () => legalSheet('how') }, 'Read how fees and priority work'),
      ),
      h('footer', { style: { margin: '34px 0 0', textAlign: 'center' } },
        h('div.row', { style: { justifyContent: 'center', gap: '18px' } },
          h('a.small', { href: '#', onclick: e => { e.preventDefault(); legalSheet('terms'); } }, 'Terms'),
          h('a.small', { href: '#', onclick: e => { e.preventDefault(); legalSheet('privacy'); } }, 'Privacy')),
        h('p.faint', { style: { marginTop: '10px' } }, `${BRAND.name}, in ${BRAND.city}`)),
    ),
  ];
}
