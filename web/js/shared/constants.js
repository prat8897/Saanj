// Every tunable number in one place. Edit freely; the PWA and the weekly engine both read this.
export const BRAND = {
  name: 'Saanj',
  tagline: 'One evening. One stranger. Every week.',
  city: 'Pune',
  supportEmail: 'hello@example.com', // change me
};

export const TUNING = {
  minScore: 62,          // mutual compatibility (0-100) below which a pair is never shown
  shortlistSize: 4,      // how many men may be offered each woman's evening
  maxOpeningsPerMan: 3,  // how many evenings one man can be offered in a week
  tau: 5,                // a higher fee can offset at most this many compatibility points
  minBid: 499,           // INR, the floor to enter an opening
  bidStep: 100,
  bidCapMultiple: 3,     // bids above minBid * this add nothing
  depositShare: 0.3,     // share of the fee returned if both people turn up
  manualRelease: true,   // true: you approve each invitation before the woman sees it
  backfillUntilHour: 80, // hours after Monday 00:00 IST; no backfill after this
  codeWords: ['monsoon', 'saffron', 'lantern', 'cardamom', 'sparrow', 'marigold', 'jasmine', 'kulfi', 'tamarind', 'sitar', 'banyan', 'neem'],
};
