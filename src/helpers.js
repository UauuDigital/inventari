import { state } from './config.js';

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

export function createTagSearch(container, onChange, placeholder = 'Filtra…', getSuggestions = null) {
  container.classList.add('tag-search-widget');
  container.innerHTML = `<div class="tsw-inner"><input class="tsw-input" type="text" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="${esc(placeholder)}"></div>${getSuggestions ? '<div class="tsw-suggestions"></div>' : ''}`;
  const inner   = container.querySelector('.tsw-inner');
  const input   = container.querySelector('.tsw-input');
  const sugsEl  = container.querySelector('.tsw-suggestions');
  let tags = []; // [{value, type, label}]

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
      chip.innerHTML = `${esc(tag.label || tag.value)}<button class="tsw-tag-del" data-i="${i}" tabindex="-1" aria-label="Eliminar filtre">×</button>`;
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

  _renderSuggestions();

  return {
    focus() { input.focus(); },
    clear()  { tags = []; input.value = ''; _render(); },
  };
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
