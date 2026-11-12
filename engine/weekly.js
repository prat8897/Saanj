#!/usr/bin/env node
// Usage: node weekly.js <auto|open|close|tick|cleanup> [--now=ISO]
// `auto` looks at the IST clock and runs whatever is due; it is safe to run every hour.
import { readFileSync } from 'node:fs';
import { connect } from './lib/fsdb.js';
import { makePay } from './lib/pay.js';
import { runAuto, runOpen, runClose, runTick, runCleanup } from './lib/phases.js';

const [cmd = 'auto', ...rest] = process.argv.slice(2);
const nowArg = rest.find(a => a.startsWith('--now='))?.slice(6);
const now = nowArg ? Date.parse(nowArg) : Date.now();
const venues = JSON.parse(readFileSync(new URL('./data/venues.json', import.meta.url)));

const { db, notify } = connect();
const ctx = { db, now, venues, notify, pay: makePay(), log: m => console.log(m) };
const run = { auto: runAuto, open: runOpen, close: runClose, tick: runTick, cleanup: runCleanup }[cmd];
if (!run) { console.error('unknown command', cmd); process.exit(1); }
const res = await run(ctx);
console.log(JSON.stringify(res));
