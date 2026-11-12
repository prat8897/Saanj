// Tiny UI toolkit: hyperscript, icons, sheets, toasts.
export function h(tag, props, ...kids) {
  const [t, ...cls] = tag.split('.');
  const el = document.createElement(t || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = k => { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach(add); else el.append(k.nodeType ? k : document.createTextNode(k)); };
  kids.forEach(add);
  return el;
}

export const $ = (s, r = document) => r.querySelector(s);
export const mount = (root, ...nodes) => { root.replaceChildren(...nodes.flat().filter(Boolean)); };

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const icon = {
  home: svg('<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  dates: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  you: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  admin: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  pin: svg('<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  share: svg('<path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>'),
  shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: svg('<path d="M5 12l5 5 9-10"/>'),
};

export const sun = (s = 26) =>
  h('span', { html: `<svg viewBox="0 0 32 32" width="${s}" height="${s}" aria-hidden="true"><path d="M4 21a12 12 0 0 1 24 0z" fill="currentColor"/><path d="M3 25.5h26M8 29h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".6"/></svg>`, style: { display: 'inline-flex' } });

export const brand = (href = '#/') => h('a.brand', { href, 'aria-label': 'Saanj home' }, sun(26), 'Saanj');

/* Toasts */
let toastTimer;
export function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = h('div.toast', { role: 'status' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2800);
}

/* Bottom sheet. Returns close(). */
export function sheet(...content) {
  const prev = document.activeElement;
  const close = () => { bd.remove(); document.removeEventListener('keydown', esc); prev?.focus?.(); };
  const esc = e => { if (e.key === 'Escape') close(); };
  const bd = h('div.backdrop', { onclick: e => { if (e.target === bd) close(); } },
    h('div.sheet', { role: 'dialog', 'aria-modal': 'true' }, content));
  document.addEventListener('keydown', esc);
  document.body.append(bd);
  bd.querySelector('input,button,select,textarea')?.focus?.();
  return close;
}

export const money = n => '₹' + Number(n).toLocaleString('en-IN');

export function chips({ options, value, multi, max, onChange }) {
  let sel = new Set(multi ? value || [] : value != null ? [value] : []);
  const wrap = h('div.chips', { role: multi ? 'group' : 'radiogroup' });
  const paint = () => [...wrap.children].forEach(b => b.classList.toggle('on', sel.has(b.dataset.v)));
  for (const [v, label] of options) {
    wrap.append(h('button.chip', {
      type: 'button', 'data-v': String(v), 'aria-pressed': 'false',
      onclick: () => {
        if (multi) { sel.has(String(v)) ? sel.delete(String(v)) : (!max || sel.size < max) && sel.add(String(v)); }
        else sel = new Set([String(v)]);
        paint(); onChange?.(multi ? [...sel] : [...sel][0]);
      },
    }, label));
  }
  paint();
  return wrap;
}

// Large option rows (single or multi).
export function optionList({ options, value, multi, max, onChange }) {
  let sel = new Set(multi ? value || [] : value != null ? [String(value)] : []);
  const wrap = h('div.opts');
  const paint = () => [...wrap.children].forEach(b => { const on = sel.has(b.dataset.v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  for (const o of options) {
    const [v, label, sub] = o;
    wrap.append(h('button.opt' + (multi ? '.multi' : ''), {
      type: 'button', 'data-v': String(v),
      onclick: () => {
        const k = String(v);
        if (multi) { sel.has(k) ? sel.delete(k) : (!max || sel.size < max) && sel.add(k); }
        else sel = new Set([k]);
        paint(); onChange?.(multi ? [...sel] : k);
      },
    }, h('span.mark'), h('span', null, h('b', null, label), sub ? h('small', null, sub) : null)));
  }
  paint();
  return wrap;
}

export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export function relTime(ms, now) {
  const d = ms - now, a = Math.abs(d), m = Math.round(a / 60e3), hr = Math.round(a / 3600e3), dy = Math.round(a / 86400e3);
  const s = a < 3600e3 ? `${m} min` : a < 86400e3 ? `${hr} hr` : `${dy} day${dy > 1 ? 's' : ''}`;
  return d >= 0 ? `in ${s}` : `${s} ago`;
}

export const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
export const lsDel = k => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
