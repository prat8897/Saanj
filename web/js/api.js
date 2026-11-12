import { DEMO } from './config.js';
export const api = DEMO ? (await import('./api-demo.js')).api : (await import('./api-fb.js')).api;
