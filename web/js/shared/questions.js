// The application questionnaire, and the scoring dimensions derived from it.
// type: single | scale | multi. Scale answers are stored as numbers 1..5.
export const QUESTIONS = [
  { id: 'intent', type: 'single', title: 'What are you hoping this leads to?',
    options: [['casual', 'Something easy, to see where it goes'], ['serious', 'A real relationship'], ['marriage', 'Marriage, in good time']] },
  { id: 'energy', type: 'scale', title: 'Your ideal Saturday night is…', lo: 'A quiet night in', hi: 'Out until late' },
  { id: 'ambition', type: 'scale', title: 'How central is work to who you are?', lo: 'It pays for life', hi: 'It is the life' },
  { id: 'planning', type: 'scale', title: 'Plans, or spontaneity?', lo: 'A spreadsheet, please', hi: 'We’ll decide at the door' },
  { id: 'family', type: 'scale', title: 'How close is family to your daily life?', lo: 'A call on Sundays', hi: 'Part of every decision' },
  { id: 'sunday', type: 'multi', max: 2, title: 'Pick the two Sundays you’d choose',
    options: [['outdoors', 'A sunrise trek or a long ride'], ['cafe', 'A café, a book, no agenda'], ['home', 'Cooking for people'], ['events', 'A gig, a film, a comedy night'], ['travel', 'A spontaneous day trip']] },
  { id: 'humour', type: 'single', title: 'Your humour is closest to…',
    options: [['dry', 'Dry, said with a straight face'], ['witty', 'Quick and wordy'], ['silly', 'Silly, and proud of it'], ['warm', 'Gentle, never at anyone’s expense']] },
  { id: 'talk', type: 'single', title: 'On a first evening you’d rather…',
    options: [['playful', 'Laugh a lot and keep it light'], ['mixed', 'Move between the two'], ['deep', 'Get to the real things early']] },
  { id: 'food', type: 'scale', title: 'How adventurous is your plate?', lo: 'I know what I like', hi: 'I order the strangest thing' },
  { id: 'fitness', type: 'scale', title: 'Where does movement sit in your week?', lo: 'Now and then', hi: 'Daily, non-negotiable' },
  { id: 'music', type: 'multi', max: 3, title: 'Music that gets you going',
    options: [['indie', 'Indie'], ['bollywood', 'Bollywood classics'], ['classical', 'Classical and ghazal'], ['electronic', 'Electronic'], ['rock', 'Rock'], ['hiphop', 'Hip-hop'], ['jazz', 'Jazz and soul']] },
  { id: 'smoking', type: 'single', title: 'Do you smoke?', options: [['no', 'No'], ['social', 'Socially'], ['yes', 'Yes']] },
  { id: 'drinking', type: 'single', title: 'And alcohol?', options: [['never', 'Never'], ['social', 'Socially'], ['often', 'Often']] },
  { id: 'diet', type: 'single', title: 'What do you eat?', options: [['veg', 'Vegetarian'], ['vegan', 'Vegan'], ['egg', 'Eggetarian'], ['nonveg', 'Non-vegetarian']] },
  { id: 'kids', type: 'single', title: 'Children, someday?', options: [['yes', 'Yes'], ['open', 'Open to it'], ['no', 'No']] },
  { id: 'languages', type: 'multi', max: 4, title: 'Languages you can hold a conversation in',
    options: [['english', 'English'], ['hindi', 'Hindi'], ['marathi', 'Marathi'], ['gujarati', 'Gujarati'], ['tamil', 'Tamil'], ['bengali', 'Bengali'], ['other', 'Another']] },
  { id: 'want_ambition', type: 'single', title: 'In a partner, you’d like someone who is…', options: [['less', 'Less driven than me'], ['similar', 'About as driven as me'], ['more', 'More driven than me']] },
  { id: 'want_energy', type: 'single', title: 'And socially…', options: [['less', 'Quieter than me'], ['similar', 'About like me'], ['more', 'More outgoing than me']] },
];

export const DEALBREAKERS = [
  ['smoker', 'Smokes'], ['drinker', 'Drinks at all'], ['nonveg', 'Eats meat or eggs'],
  ['kids_yes', 'Definitely wants children'], ['kids_no', 'Definitely doesn’t want children'],
];

export const ARRANGEMENTS = [
  ['split', 'Split the bill'],
  ['iTreat', 'I’m happy to treat'],
  ['treatMe', 'I’d be happy to be treated'],
];

export const BUDGETS = [
  [500, 'Relaxed café', 'Up to ₹500 for the evening'],
  [800, 'A good café', 'Up to ₹800'],
  [1200, 'Casual dinner', 'Up to ₹1,200'],
  [2000, 'A proper evening', 'Up to ₹2,000'],
];

// Similarity dimensions. weight = how much it matters; want = directional preference question.
const ORD = (id, min, max, weight, extra = {}) => ({ id, kind: 'ordinal', min, max, weight, ...extra });
export const DIMENSIONS = [
  ORD('intent', 1, 3, 3.0, { map: { casual: 1, serious: 2, marriage: 3 } }),
  ORD('energy', 1, 5, 1.6, { want: 'want_energy' }),
  ORD('ambition', 1, 5, 1.4, { want: 'want_ambition' }),
  ORD('planning', 1, 5, 0.9),
  ORD('family', 1, 5, 1.4),
  ORD('talk', 1, 3, 1.2, { map: { playful: 1, mixed: 2, deep: 3 } }),
  ORD('food', 1, 5, 0.6),
  ORD('fitness', 1, 5, 0.7),
  ORD('drinking', 1, 3, 0.7, { map: { never: 1, social: 2, often: 3 } }),
  ORD('smoking', 1, 3, 0.5, { map: { no: 1, social: 2, yes: 3 } }),
  { id: 'sunday', kind: 'set', weight: 1.2 },
  { id: 'music', kind: 'set', weight: 0.5 },
  { id: 'humour', kind: 'cat', weight: 0.8, near: [['dry', 'witty'], ['silly', 'warm']] },
  { id: 'diet', kind: 'cat', weight: 0.5, near: [['veg', 'vegan'], ['veg', 'egg'], ['egg', 'nonveg']] },
];
