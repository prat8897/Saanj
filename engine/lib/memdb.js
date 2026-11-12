// In-memory database with the same tiny interface as fsdb.js. Used by tests and the simulator.
const OPS = {
  '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b,
  '>': (a, b) => a > b, '>=': (a, b) => a >= b, in: (a, b) => b.includes(a),
};
let counter = 0;

export function memdb() {
  const cols = new Map();
  const col = n => { if (!cols.has(n)) cols.set(n, new Map()); return cols.get(n); };
  const clone = x => JSON.parse(JSON.stringify(x));
  return {
    cols,
    newId: () => 'id' + (++counter).toString(36).padStart(5, '0'),
    async list(name, filters = []) {
      return [...col(name).entries()]
        .map(([id, d]) => ({ id, ...clone(d) }))
        .filter(d => filters.every(([f, op, v]) => OPS[op](d[f], v)));
    },
    async get(name, id) { const d = col(name).get(id); return d ? { id, ...clone(d) } : null; },
    async set(name, id, data) { col(name).set(id, clone(data)); },
    async merge(name, id, patch) { col(name).set(id, { ...(col(name).get(id) || {}), ...clone(patch) }); },
    async del(name, id) { col(name).delete(id); },
  };
}
