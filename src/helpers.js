import { state } from './config.js';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function getCat(id) {
  return state.categories.find(c => c.id === id);
}

export function filteredItems() {
  let list = state.items;
  if (state.filter) list = list.filter(i => i.category === state.filter);
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.notes || '').toLowerCase().includes(q)
    );
  }
  return list;
}

export function fmtNum(n) {
  if (n === 0) return '0';
  return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(2)).toString();
}

export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ca', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

let _toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const delim = lines[0].includes(';') ? ';' : ',';
  return lines.map(line => {
    const cells = [];
    let inQuote = false;
    let cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cell += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === delim && !inQuote) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  });
}

export function findCol(headers, candidates) {
  for (const c of candidates) {
    const i = headers.findIndex(h => h.toLowerCase().includes(c));
    if (i >= 0) return i;
  }
  return -1;
}

const OFFLINE_QUEUE_KEY = 'uauu_inv_offline_queue';

function _fireIframe(url) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none';
  document.body.appendChild(iframe);
  iframe.src = url;
  setTimeout(() => { if (iframe.parentNode) iframe.remove(); }, 8000);
}

export function sendToSheet(gasUrl, params) {
  const url = `${gasUrl}?${params}`;
  if (!navigator.onLine) {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    queue.push(url);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    toast('Sense connexió — s\'enviarà quan hi hagi WiFi');
    return;
  }
  _fireIframe(url);
}

export function drainOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  if (!queue.length) return;
  queue.forEach(url => _fireIframe(url));
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
  toast(`${queue.length} ${queue.length === 1 ? 'enviament pendent enviat' : 'enviaments pendents enviats'}`);
}
