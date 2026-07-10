import { state, SHEET_APPEND_URL, STORAGE_GAS_URL } from './config.js';
import { t as translate, getLang } from './i18n.js';

// URL del GAS configurada per l'usuari (Admin → Configuració), amb fallback a la de config.js.
export function getGasUrl() {
  return localStorage.getItem(STORAGE_GAS_URL) || SHEET_APPEND_URL;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function getCat(id) {
  return state.categories.find(c => c.id === id);
}

export function matchesTags(haystack, tags) {
  if (!tags.length) return true;
  const groups = {};
  tags.forEach(t => { (groups[t.type] = groups[t.type] || []).push(t.value); });
  return Object.values(groups).every(vals => vals.some(v => haystack.includes(v)));
}

// Posició de la categoria dins l'ordre canònic de state.categories (el mateix ordre
// que es fa servir a les píndoles de filtre). Sense categoria queda sempre al final.
function _categoryRank(catName) {
  if (!catName) return Infinity;
  const idx = state.categories.findIndex(c => c.name.toLowerCase() === catName.toLowerCase());
  return idx === -1 ? Infinity : idx;
}

export function sortByCategory(list, getCatName, getName) {
  return [...list].sort((a, b) => {
    const diff = _categoryRank(getCatName(a)) - _categoryRank(getCatName(b));
    if (diff !== 0) return diff;
    return (getName(a) || '').localeCompare(getName(b) || '', 'ca');
  });
}

// Ordena per nom de categoria (alfabètic), igual que les píndoles de filtre del
// catàleg de productes. A diferència de sortByCategory (que usa l'ordre de
// state.categories), aquest ordre és sempre estable: no depèn de quan es
// "descobreix" cada categoria via ensureCategory (p.ex. en desar una quantitat
// o crear un producte), cosa que feia que l'ordre del catàleg canviés entre
// una visita i la següent.
export function sortByCategoryName(list, getCatName, getName) {
  return [...list].sort((a, b) => {
    const catA = getCatName(a) || '';
    const catB = getCatName(b) || '';
    const diff = catA.localeCompare(catB, 'ca');
    if (diff !== 0) return diff;
    return (getName(a) || '').localeCompare(getName(b) || '', 'ca');
  });
}

export function filteredItems() {
  let list = state.items;
  if (state.filter) list = list.filter(i => i.category === state.filter);
  if (state.search.length) {
    list = list.filter(i => {
      const catName  = (getCat(i.category)?.name || '').toLowerCase();
      const haystack = [i.name, catName, i.notes || ''].join(' ').toLowerCase();
      return matchesTags(haystack, state.search);
    });
  }
  return list;
}

export function createTagSearch(container, onChange, placeholder = translate('Filtra…'), getSuggestions = null, initialTags = []) {
  container.classList.add('tag-search-widget');
  container.innerHTML = `<div class="tsw-inner"><input class="tsw-input" type="text" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="${esc(placeholder)}"></div>${getSuggestions ? '<div class="tsw-suggestions"></div>' : ''}`;
  const inner   = container.querySelector('.tsw-inner');
  const input   = container.querySelector('.tsw-input');
  const sugsEl  = container.querySelector('.tsw-suggestions');
  let tags = [...initialTags]; // [{value, type, label}]

  function _renderSuggestions() {
    if (!sugsEl) return;
    const all = getSuggestions();
    const byType = {};
    all.filter(s => !tags.some(t => t.value === s.value && t.type === s.type))
       .forEach(s => { (byType[s.type] = byType[s.type] || []).push(s); });
    sugsEl.innerHTML = Object.entries(byType).map(([type, items]) => `
      <div class="tsw-sug-group">
        <span class="tsw-sug-label">${esc(type)}</span>
        <div class="tsw-sug-pills">
          ${items.map(s => `<button class="tsw-sug-pill" data-val="${esc(s.value)}" data-type="${esc(s.type)}" data-label="${esc(s.label)}" type="button">${esc(s.label)}</button>`).join('')}
        </div>
      </div>`).join('');
    sugsEl.hidden = !Object.keys(byType).length;
  }

  function _render() {
    inner.querySelectorAll('.tsw-tag').forEach(el => el.remove());
    tags.forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'tsw-tag';
      chip.innerHTML = `${esc(tag.label || tag.value)}<button class="tsw-tag-del" data-i="${i}" tabindex="-1" aria-label="${translate('Eliminar filtre')}">×</button>`;
      inner.insertBefore(chip, input);
    });
    onChange([...tags]);
    _renderSuggestions();
  }

  function _add(value, type = 'text', label = null) {
    const val = value.trim().toLowerCase();
    if (val && !tags.some(t => t.value === val && t.type === type)) {
      tags.push({ value: val, type, label: label || val });
      _render();
    }
    input.value = '';
  }

  if (sugsEl) {
    sugsEl.addEventListener('click', e => {
      const pill = e.target.closest('.tsw-sug-pill');
      if (pill) _add(pill.dataset.val, pill.dataset.type, pill.dataset.label);
    });
  }

  inner.addEventListener('click', e => {
    const del = e.target.closest('.tsw-tag-del');
    if (del) { tags.splice(parseInt(del.dataset.i), 1); _render(); return; }
    input.focus();
  });

  input.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault(); _add(input.value, 'text');
    } else if (e.key === 'Backspace' && !input.value && tags.length) {
      tags.pop(); _render();
    }
  });

  input.addEventListener('blur', () => { if (input.value.trim()) _add(input.value, 'text'); });

  if (tags.length) _render();
  else _renderSuggestions();

  return {
    focus() { input.focus(); },
    clear()  { tags = []; input.value = ''; _render(); },
  };
}

export function fmtNum(n) {
  if (n === 0) return '0';
  return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(2)).toString();
}

// Lletra abreujada segons la unitat del producte: ampolla/sac → 'a'/'s', per defecte caixa → 'c'.
export function unitSuffix(unit) {
  const u = (unit || '').toLowerCase();
  if (/botel|ampol|vi\b|cava|cerves|llaun|garraf/.test(u)) return 'a';
  if (/sac/.test(u)) return 's';
  return 'c';
}

export function fmtQtyDisplay(item) {
  const boxes = item.boxes != null ? item.boxes : (item.quantity || 0);
  return `${fmtNum(boxes)}${unitSuffix(item.unit)}`;
}

export function parseTotalQty(qtyStr) {
  if (!qtyStr) return 0;
  const clean = String(qtyStr).replace(/\s/g, '');
  const boxM  = clean.match(/^(\d+(?:\.\d+)?)c/);
  if (boxM) return parseFloat(boxM[1]);
  return parseFloat(qtyStr) || 0;
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
    return new Date(iso).toLocaleDateString(getLang() === 'es' ? 'es' : 'ca', { day: 'numeric', month: 'short', year: 'numeric' });
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
  if (!text) return [];
  const semiIdx = text.indexOf(';');
  const nlIdx   = text.indexOf('\n');
  const delim   = semiIdx > 0 && semiIdx < nlIdx ? ';' : ',';
  const rows   = [];
  let cells    = [];
  let cell     = '';
  let inQuote  = false;

  for (let i = 0; i < text.length; i++) {
    const ch   = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuote && next === '"') { cell += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === delim && !inQuote) {
      cells.push(cell.trim());
      cell = '';
    } else if ((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuote) {
      if (ch === '\r') i++;
      cells.push(cell.trim());
      if (cells.some(c => c)) rows.push(cells);
      cells = [];
      cell  = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  if (cells.some(c => c)) rows.push(cells);
  return rows;
}

export function findCol(headers, candidates) {
  for (const c of candidates) {
    const i = headers.findIndex(h => h.toLowerCase().includes(c));
    if (i >= 0) return i;
  }
  return -1;
}

const OFFLINE_QUEUE_KEY = 'uauu_inv_offline_queue';

// Google respon amb X-Frame-Options a script.google.com, així que carregar-lo
// dins un <iframe> amagat (la tècnica que es feia servir abans) sempre dona
// 403. fetch en mode 'no-cors' no pateix aquesta restricció (no intenta
// renderitzar la resposta, només disparar la petició).
function _sendGasRequest(url) {
  fetch(url, { method: 'GET', mode: 'no-cors', keepalive: true }).catch(() => {});
}

export function updateOfflineQueueBadge() {
  const badge = document.getElementById('offline-sync-badge');
  if (!badge) return;
  const count = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]').length;
  badge.hidden = count === 0;
  badge.textContent = count === 1 ? translate('1 enviament pendent') : translate('{n} enviaments pendents', { n: count });
}

export function sendToSheet(gasUrl, params) {
  const url = `${gasUrl}?${params}`;
  if (!navigator.onLine) {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    queue.push(url);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    updateOfflineQueueBadge();
    toast(translate('Sense connexió — s\'enviarà quan hi hagi WiFi'));
    return;
  }
  _sendGasRequest(url);
}

// Sincronitza una comanda amb la pestanya "Comandes" del Google Sheets
// (action: 'add-comanda' | 'update-comanda').
export function sendComandaToSheet(order, action = 'add-comanda') {
  sendToSheet(getGasUrl(), new URLSearchParams({
    action,
    id:                order.id || '',
    ref:               order.ref || '',
    date:              order.date || '',
    supplier:          order.supplier || '',
    status:            order.status || '',
    desc:              order.desc || '',
    notes:             order.notes || '',
    createdBy:         order.createdBy || '',
    masia:             order.masia || '',
    sourceHistorialId: order.sourceHistorialId || '',
    createdAt:         order.createdAt || '',
    updatedAt:         order.updatedAt || '',
    adults:            order.adults || 0,
  }).toString());
}

// Elimina la comanda de la pestanya "Comandes" del Google Sheets.
export function deleteComandaFromSheet(id) {
  sendToSheet(getGasUrl(), new URLSearchParams({ action: 'delete-comanda', id }).toString());
}

export function drainOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  if (!queue.length) return;
  queue.forEach(url => _sendGasRequest(url));
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
  updateOfflineQueueBadge();
  toast(queue.length === 1 ? translate('1 enviament pendent enviat') : translate('{n} enviaments pendents enviats', { n: queue.length }));
}
