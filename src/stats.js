import { state, SHEET_APPEND_URL, INVENTARI_URL, saveItems } from './config.js';
import { esc, fmtNum, toast, parseCSV, sendToSheet } from './helpers.js';
import { setView } from './main.js';

// ── STATS STRIP ──────────────────────────────────────────────────────

export function renderStatsStrip() {
  const strip     = document.getElementById('stats-strip');
  const total     = state.items.length;
  const lowCount  = state.items.filter(i => i.minStock > 0 && i.quantity <= i.minStock && i.quantity > 0).length;
  const zeroCount = state.items.filter(i => i.quantity === 0).length;
  const totalVal  = state.items.reduce((s, i) => s + i.quantity * (i.price || 0), 0);

  const card3 = (lowCount + zeroCount) > 0
    ? `<div class="stat-card is-warn">
         <span class="stat-value">${lowCount + zeroCount}</span>
         <span class="stat-label">Estoc baix</span>
       </div>`
    : `<div class="stat-card">
         <span class="stat-value">${totalVal > 0 ? '€' + Math.round(totalVal) : '—'}</span>
         <span class="stat-label">Valor est.</span>
       </div>`;

  strip.innerHTML = `
    <div class="stat-card">
      <span class="stat-value">${total}</span>
      <span class="stat-label">Articles</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">${state.categories.length}</span>
      <span class="stat-label">Categories</span>
    </div>
    ${card3}
  `;
}

// ── STATS VIEW ───────────────────────────────────────────────────────

export function renderStats() {
  const el = document.getElementById('stats-content');
  if (!el) return;

  if (document.body.dataset.role === 'comensal') {
    if (state.items.length === 0) {
      el.innerHTML = `<div class="stats-cat-row" style="justify-content:center;opacity:.4"><span class="stats-cat-name" style="flex:none;font-size:13px">Encara no s'ha comptat cap producte</span></div>`;
      return;
    }
    const groups = new Map();
    state.items.forEach(item => {
      const cat     = state.categories.find(c => c.id === item.category);
      const catName = cat ? cat.name : 'Sense categoria';
      if (!groups.has(catName)) groups.set(catName, []);
      groups.get(catName).push(item);
    });
    let html = `<div class="stats-total-row"><span class="stats-total-label">Total comptat</span><span class="stats-total-val">${state.items.length} productes</span></div>`;
    groups.forEach((items, catName) => {
      html += `<div class="stats-section-title">${esc(catName)}</div>`;
      items.forEach(item => {
        html += `<div class="stats-cat-row">
          <span class="stats-cat-name">${esc(item.name)}</span>
          <span class="stats-cat-count">${fmtNum(item.quantity)} ${esc(item.unit || 'u')}</span>
        </div>`;
      });
    });
    html += `<textarea class="inv-comment-input" id="inv-comment" placeholder="Comentari opcional…" rows="3"></textarea>`;
    html += `<button class="btn-send-report" data-action="send-report">Enviar inventari al coordinador</button>`;
    el.innerHTML = html;
    return;
  }

  const totalVal  = state.items.reduce((s, i) => s + i.quantity * (i.price || 0), 0);
  const lowItems  = state.items.filter(i => i.minStock > 0 && i.quantity <= i.minStock);
  const zeroItems = state.items.filter(i => i.quantity === 0);

  el.innerHTML = `
    ${totalVal > 0 ? `
      <div class="stats-total-row">
        <span class="stats-total-label">Valor total estoc</span>
        <span class="stats-total-val">€${totalVal.toLocaleString('ca', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
      </div>
    ` : ''}

    <div class="stats-section-title">Per categoria</div>

    ${state.categories.map(cat => {
      const catItems = state.items.filter(i => i.category === cat.id);
      return `
        <div class="stats-cat-row">
          <div class="cat-dot" style="background:${cat.color}"></div>
          <span class="stats-cat-name">${esc(cat.name)}</span>
          <div class="stats-cat-meta">
            <span class="stats-cat-count">${catItems.length} art.</span>
          </div>
        </div>
      `;
    }).join('')}

    ${lowItems.length > 0 ? `
      <div class="stats-section-title" style="color:var(--low)">Estoc baix</div>
      ${lowItems.map(item => `
        <div class="stats-cat-row">
          <span class="stats-cat-name">${esc(item.name)}</span>
          <span class="stats-cat-count" style="color:var(--low)">
            ${fmtNum(item.quantity)} / mín ${fmtNum(item.minStock)} ${esc(item.unit || '')}
          </span>
        </div>
      `).join('')}
    ` : ''}

    ${zeroItems.length > 0 ? `
      <div class="stats-section-title" style="color:rgba(255,255,255,0.28)">Sense estoc</div>
      ${zeroItems.map(item => `
        <div class="stats-cat-row" style="opacity:.45">
          <span class="stats-cat-name">${esc(item.name)}</span>
          <span class="stats-cat-count">0 ${esc(item.unit || '')}</span>
        </div>
      `).join('')}
    ` : ''}

    ${lowItems.length === 0 && zeroItems.length === 0 && state.items.length > 0 ? `
      <div class="stats-cat-row" style="justify-content:center;opacity:.4">
        <span class="stats-cat-name" style="flex:none;font-size:13px">Tot l'estoc està en ordre ✓</span>
      </div>
    ` : ''}
  `;
}

// ── INVENTORY REPORT ─────────────────────────────────────────────────

export function sendInventoryReport() {
  if (!state.items.length) return;

  const now     = new Date();
  const pad     = n => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const commentEl  = document.getElementById('inv-comment');
  const comment    = commentEl ? commentEl.value.trim() : '';
  const inventariStr = state.items.map(i => `${i.name}: ${fmtNum(i.quantity)} ${i.unit || 'u'}`).join(' | ');

  const params = new URLSearchParams({
    action:    'inventari',
    id:        String(now.getTime()),
    data:      dateStr,
    hora:      timeStr,
    comensal:  '',
    masia:     state.masia || '',
    inventari: inventariStr,
    comentari: comment,
  });
  sendToSheet(SHEET_APPEND_URL, params.toString());

  state.items = [];
  saveItems();
  renderStats();
  toast('Inventari enviat al coordinador');
  setView('catalog');
  renderStatsStrip();
}

// ── REPORTS VIEW (Coordinador) ───────────────────────────────────────

export async function renderReports() {
  const el = document.getElementById('reports-content');
  if (!el) return;
  el.innerHTML = `<div class="reports-loading">Carregant informes…</div>`;

  try {
    const res     = await fetch(INVENTARI_URL);
    const text    = await res.text();
    const rows    = parseCSV(text);
    const headers = (rows[0] || []).map(h => h.toLowerCase().trim());

    const isCorrectSheet = headers.some(h => h === 'inventari' || h === 'data' || h === 'hora');
    if (!isCorrectSheet) {
      el.innerHTML = `<div class="stats-cat-row" style="flex-direction:column;gap:6px;padding:20px 16px">
        <span class="stats-cat-name" style="flex:none;font-size:13px;color:var(--low)">Error: s'està llegint el full incorrecte.</span>
        <span class="stats-cat-count">Capçaleres trobades: ${esc((rows[0] || []).join(', '))}</span>
      </div>`;
      return;
    }

    const data = rows.slice(1).filter(r => r.length > 1 && r[0]);

    if (!data.length) {
      el.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" width="56" height="56" viewBox="0 0 64 64" fill="none" stroke="white" stroke-width="1.5" aria-hidden="true">
            <rect x="10" y="8" width="44" height="50" rx="4"/>
            <path d="M10 22h44"/><path d="M20 36h24M20 44h16"/>
          </svg>
          <p class="empty-title">Sense informes</p>
          <p class="empty-text">Els comensals enviaran informes<br>quan acabin l'inventari.</p>
        </div>`;
      return;
    }

    el.innerHTML = [...data].reverse().map(r => {
      const [id, date, hora, comensal, masia, inventari, comentari] = r;
      const items    = (inventari || '').split(' | ').filter(Boolean);
      const itemsHtml = items.map(item => {
        const sep  = item.indexOf(': ');
        const name = sep > -1 ? item.slice(0, sep) : item;
        const qty  = sep > -1 ? item.slice(sep + 2) : '';
        return `<div class="stats-cat-row">
          <span class="stats-cat-name">${esc(name)}</span>
          <span class="stats-cat-count">${esc(qty)}</span>
        </div>`;
      }).join('');
      const comentariHtml = comentari ? `<div class="report-comment">${esc(comentari)}</div>` : '';
      return `
        <div class="report-card">
          <div class="report-card-header">
            <span class="report-date-time">${esc(date)} · ${esc(hora)}</span>
            <span class="report-count-badge">${items.length} productes</span>
          </div>
          ${comentariHtml}
          <div class="report-items-list">${itemsHtml}</div>
        </div>`;
    }).join('');

  } catch {
    el.innerHTML = `<div class="stats-cat-row" style="justify-content:center;opacity:.5"><span class="stats-cat-name" style="flex:none;font-size:13px">Error carregant informes. Comprova la connexió.</span></div>`;
  }
}
