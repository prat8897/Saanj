// The weekly rhythm, all in India Standard Time (UTC+5:30, no DST).
// Hours are offsets from Monday 00:00 IST of the cycle.
const IST = 5.5 * 3600e3;
const H = 3600e3;

export const SLOTS = [
  { id: 'sat_pm',  label: 'Saturday afternoon', day: 5, h: 16, m: 30 },
  { id: 'sat_eve', label: 'Saturday evening',   day: 5, h: 19, m: 30 },
  { id: 'sun_pm',  label: 'Sunday afternoon',   day: 6, h: 16, m: 30 },
  { id: 'sun_eve', label: 'Sunday evening',     day: 6, h: 19, m: 0 },
];

export const PHASES = [
  { id: 'optin',    from: 0,   to: 20,  title: 'Tell us you’re in' },
  { id: 'matching', from: 20,  to: 21,  title: 'Shortlists being composed' },
  { id: 'bidding',  from: 21,  to: 60,  title: 'Openings and requests' },
  { id: 'settling', from: 60,  to: 84,  title: 'Confirming the evenings' },
  { id: 'invites',  from: 84,  to: 116, title: 'Invitations out' },
  { id: 'dates',    from: 116, to: 168, title: 'The weekend' },
];

// Milestones (hours from Monday 00:00 IST) shown on the weekly timeline.
export const MILESTONES = [
  { at: 20,  label: 'Opt in by', sub: 'Monday, 8 pm' },
  { at: 21,  label: 'Openings go out', sub: 'Monday, 9 pm' },
  { at: 60,  label: 'Requests close', sub: 'Wednesday, noon' },
  { at: 84,  label: 'Invitations arrive', sub: 'Thursday, noon' },
  { at: 120, label: 'Your evening', sub: 'Saturday or Sunday' },
];

export const HOURS = { bidsClose: 60, payDue: 70, release: 84, respondBy: 116 };

export function cycleStart(now) {
  const t = now + IST;
  const d = new Date(t);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return dayStart - dow * 24 * H - IST;
}

export function isoWeekId(startMs) {
  const d = new Date(startMs + IST);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const thursday = new Date(date.getTime() + 3 * 24 * H); // Monday + 3
  const year = thursday.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.floor((thursday.getTime() - jan1) / (7 * 24 * H)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function cycleAt(now) {
  const start = cycleStart(now);
  const hrs = (now - start) / H;
  const phase = PHASES.find(p => hrs >= p.from && hrs < p.to) || PHASES[PHASES.length - 1];
  return {
    id: isoWeekId(start), start, hrs, phase: phase.id, phaseInfo: phase,
    at: h => start + h * H,
    nextPhaseAt: start + phase.to * H,
  };
}

export const slotStart = (start, slotId) => {
  const s = SLOTS.find(x => x.id === slotId);
  return start + s.day * 24 * H + (s.h * 60 + s.m) * 60e3 - 0; // IST wall-clock is encoded by cycleStart
};

export const slotLabel = slotId => SLOTS.find(s => s.id === slotId)?.label ?? slotId;

// Formatting in IST regardless of the viewer's timezone.
export function fmtIST(ms, opts) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...opts }).format(ms);
}
export const fmtDay = ms => fmtIST(ms, { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtTime = ms => fmtIST(ms, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?([ap])m/i, (_, x) => ` ${x.toLowerCase()}m`);
export const fmtShort = ms => fmtIST(ms, { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
