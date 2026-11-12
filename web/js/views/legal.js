import { h, sheet } from '../ui.js';
import { BRAND, TUNING } from '../shared/constants.js';

const DRAFT = h('p.callout', null, 'Draft wording. Have a lawyer review this before launch (see README, “Legal checklist”).');

const DOCS = {
  how: {
    title: 'How fees and priority work',
    body: () => [
      h('p', null, 'Women never pay, and no one pays a woman. Men pay a fee only when they’re assigned an evening.'),
      h('p', null, 'Each week our matching picks a small shortlist of men who are genuinely compatible with each woman who is free. Those men can request the evening and choose a fee. A higher fee can only break a tie between men who are equally compatible; it can never lift a worse fit above a clearly better one.'),
      h('p', null, `The fee pays for the curation, the venue arrangements and the safety checks. ${Math.round(TUNING.depositShare * 100)}% of it is returned when both of you turn up. If she can’t make it, the fee is credited back to you in full.`),
      h('p', null, 'Women are told this before they apply and again with every invitation.'),
    ],
  },
  terms: {
    title: 'Terms of use',
    body: () => [DRAFT,
      h('p', null, `${BRAND.name} arranges first meetings between verified adults in ${BRAND.city}. You must be 21 or older and use your own, real details.`),
      h('p', null, 'Meet only at the venue we assign, in public. You can leave at any time. We may remove anyone who behaves badly, harasses, or doesn’t turn up without notice.'),
      h('p', null, 'A fee is charged to men only when they are assigned an evening. Refunds and credits follow “How fees and priority work”. We do not guarantee a match, a date or a relationship.'),
      h('p', null, `Questions or complaints: ${BRAND.supportEmail}. Our grievance officer will respond within the time the law requires.`),
    ],
  },
  privacy: {
    title: 'Privacy',
    body: () => [DRAFT,
      h('p', null, 'What we keep: your answers, area, availability and budget, and a short note about you that a person on our team reads before it’s ever shown.'),
      h('p', null, 'Who sees it: no member can browse profiles. Your date sees only a few approved lines about you, and only after you are matched. Our small team sees applications to verify them.'),
      h('p', null, 'Your verification selfie is used for a video-call check and deleted when we decide on your application.'),
      h('p', null, 'You can export or delete everything from the You tab at any time. Evening records are deleted shortly after the date.'),
    ],
  },
};

export function legalSheet(kind) {
  const d = DOCS[kind];
  const close = sheet(h('h2.h2', null, d.title), h('div.stack', null, d.body()), h('button.btn.block.ghost', { style: { marginTop: '20px' }, onclick: () => close() }, 'Close'));
}
