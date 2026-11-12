// The few lines a blind date is allowed to know about you. Derived from structured answers
// plus one short quote you wrote (and our team approved), so nothing identifying slips through.
const SUNDAY = {
  outdoors: 'Happiest on a trail before sunrise.',
  cafe: 'Can disappear into a café for an afternoon.',
  home: 'Cooks for friends and loses count of seconds.',
  events: 'Always knows what’s playing this weekend.',
  travel: 'Keeps a bag half-packed for a day trip.',
};
const HUMOUR = {
  dry: 'Dry humour, delivered straight.',
  witty: 'Quick with words.',
  silly: 'Silly, and proud of it.',
  warm: 'A warm sense of humour, no sharp edges.',
};

export function ageBand(age) {
  const tens = age < 30 ? 'twenties' : age < 40 ? 'thirties' : age < 50 ? 'forties' : 'fifties';
  const d = age % 10;
  const part = d <= 3 ? 'early' : d <= 6 ? 'mid' : 'late';
  return `${part} ${tens}`;
}

export function makeTeaser(u) {
  const a = u.answers || {};
  const lines = [];
  lines.push(`${u.profession || 'Works in Pune'}, ${ageBand(u.age)}.`);
  const sun = (a.sunday || [])[0];
  if (SUNDAY[sun]) lines.push(SUNDAY[sun]);
  if (HUMOUR[a.humour]) lines.push(HUMOUR[a.humour]);
  if (u.prompts?.a) lines.push(`“${u.prompts.a}”`);
  return lines;
}
