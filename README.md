# Saanj: one evening, one stranger, every week (Pune)

A blind-date PWA with no messaging and no server bill. Women receive one curated evening a week, free. Men are shortlisted for evenings they're genuinely compatible with and request them, choosing a fee; a higher fee can only break a tie between equally compatible people.

**Try it now, no setup:** `cd web && python3 -m http.server 8080`, open `http://localhost:8080`. Until you add a Firebase config it runs in demo mode with a **Preview** button that jumps to any moment of the week (invitation, bidding, payment, admin…).

## How it works

| Piece | Where | Cost |
|---|---|---|
| PWA (no build step) | `web/` on Firebase Hosting | free |
| Accounts | Firebase Auth (Google + email link) | free |
| Data | Firestore, locked down by `firestore.rules` | free tier |
| Weekly matching, payments check, release | `engine/` run hourly by GitHub Actions | free |
| Push notifications | FCM, sent by the engine | free |
| Payments | UPI deep link + admin confirms, or Razorpay Payment Links (optional) | gateway fee only |

There are no Cloud Functions, so the Firebase **Spark** plan is enough. The engine uses the admin SDK from GitHub Actions, which is why only it can create matches.

### The weekly rhythm (IST)

| When | What happens |
|---|---|
| Mon, until 8 pm | Members say they're in, and which slots |
| Mon, 9 pm | Engine builds shortlists. Each woman's evening is offered to up to 4 compatible men |
| Mon 9 pm to Wed noon | Men request evenings and choose a fee (₹499 to ₹1,497, in ₹100 steps) |
| Wed, noon | Requests close. One global best assignment (Hungarian algorithm) |
| Wed, until 10 pm | Chosen men confirm their fee. Unpaid evenings go to the next-best request |
| Thu, noon | Invitations released (to your approval queue first, unless you set `manualRelease: false`) |
| Fri, 8 pm | Women answer by now |
| Sat to Sun | Dates. "I've arrived" check-in. Outcomes and refunds computed 3 hours after the start |

All the numbers live in `web/js/shared/constants.js` and `schedule.js`.

### How matching and fees work

1. **Hard filters** (both directions): age range, dealbreakers, relationship intent, kids, a shared language, budget and who-pays compatibility, a venue open in a shared slot.
2. **Compatibility** (0 to 100): weighted similarity across 14 dimensions, computed both ways and combined with a geometric mean.
3. **Shortlist**: only pairs above `minScore` are considered; each woman gets up to `shortlistSize` men; each man at most `maxOpeningsPerMan`.
4. **Fees**: effective value = compatibility + `tau` × (normalised fee). With `tau = 5`, money can offset at most 5 points. A 6-point-better fit always wins. This is what keeps it "curated matchmaking" and not "buy a date", and it's tested in `engine/test/engine.test.js`.
5. Women never see money; the `dates` document has no amounts.

## Setup

### 1. Firebase (about 15 minutes)
1. Create a project at console.firebase.google.com (Spark plan).
2. **Authentication**: enable Google and Email link (passwordless). Add your domain under Authorized domains.
3. **Firestore**: create the database (production mode), then `firebase deploy --only firestore:rules`.
4. **Project settings**: add a Web app, copy its config into `web/js/config.js`.
5. Set your UPI ID in `web/js/config.js` (`UPI.vpa`), or create a Firestore doc `config/app` with `{ upiVpa, payee }`.
6. `firebase deploy --only hosting`. (Install with `npm i -g firebase-tools`, then `firebase login` and `firebase use --add`.)
7. **Make yourself an admin**: sign in once, copy your UID from Authentication, then in Firestore create document `admins/<your uid>` (any field).

### 2. Weekly engine
1. Project settings > Service accounts > Generate new private key.
2. In your GitHub repo: Settings > Secrets > add `FIREBASE_SERVICE_ACCOUNT` (paste the whole JSON). Optional: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
3. Push the repo. `.github/workflows/weekly.yml` runs hourly. Run it by hand from the Actions tab to test.
4. Note: GitHub pauses scheduled workflows after 60 days without repo activity.

### 3. Push notifications (optional)
Firebase console > Cloud Messaging > Web Push certificates > generate a key pair and put the public key in `VAPID_KEY` in `config.js`. On iPhone, notifications only work after "Add to Home Screen".

### 4. Before launch, fill in the real world
- **Venues** (`engine/data/venues.json`): every entry has `"verified": false`. Costs are my estimates and several are placeholders called "Add a … café". Visit them, confirm prices and hours, and add partner venues.
- **Travel times** (`web/js/shared/areas.js`): estimated from coordinates. Put real Google Maps evening times in `TRAVEL_OVERRIDES`.
- **Contact email** in `constants.js`, **brand name** if you don't want "Saanj".

## Testing without Firebase
```
cd engine && node --test test/*.test.js    # logic tests
node simulate.js 120 120                   # a whole simulated week: matches, requests, lapsed payments, outcomes
```

## Running the product

- **Applications** arrive in the Team tab. Book the 5-minute video call, compare to the selfie, then Approve and verify (this deletes the selfie).
- **Release**: on Thursday, read the two teasers on each held evening and release it to her. Releasing is the only human step per evening.
- **Money**: with UPI, men tap "I've paid" with their reference; mark it paid in Team > Money. Refunds (the returned deposit, or a full credit when she can't make it) show up there too; send them by UPI and tick "I've sent it".
- **Safety**: an SOS from either person shows up red at the top of Team > Evenings. Reports land in Team > Reports.

## Legal checklist (not legal advice)
Have an Indian lawyer review these before taking money:
1. **Framing under the Immoral Traffic (Prevention) Act**: fees must be for curation, venue arrangements and safety, never for "access to a woman". Money must never flow to women. Keep the marketing copy in that spirit.
2. **Fees and gaming law**: only winners pay; losers are never charged. Keep it that way (and keep an eye on the Promotion and Regulation of Online Gaming Act 2025).
3. **Disclosure**: women are told about paid priority at signup (consent checkbox) and on every invitation.
4. **DPDP Act 2023**: consent, purpose, deletion. The app ships delete-account and data export; ID documents are intentionally not collected.
5. **IT Rules 2021**: publish a grievance officer; the `Terms` and `Privacy` sheets in `views/legal.js` are drafts.
6. **Consumer rules**: fee, refund and credit terms must be clear (they're shown before payment). No countdown pressure tricks on requests.
7. **GST and payments KYC** if you take money through a gateway.

## Layout
```
web/                 the PWA (static, no build)
  js/shared/         constants, schedule, scoring, venues, assignment (used by the app AND the engine)
  js/views/          welcome, onboarding, home (invitation/requests/payment), tabs, admin
  js/api-fb.js       Firestore/Auth/FCM
  js/api-demo.js     in-memory demo + scenarios
engine/              weekly machine for GitHub Actions (Node 20)
firestore.rules      who can read and write what
```

## One-time move
Your editor couldn't write into `.github/`, so the workflow is at the project root as `weekly-workflow.yml`. Run:
```
mkdir -p .github/workflows && mv weekly-workflow.yml .github/workflows/weekly.yml
```
