import {
  CATALOG_URL, OPEN_FOOD_FACTS_URL, SHEET_APPEND_URL, STORAGE_CAT_EXTRA, STORAGE_CAT_EDITS,
  state, saveItems, CAT_COLORS,
} from './config.js';
import { uid, esc, fmtNum, fmtQtyDisplay, toast, parseCSV, findCol, sendToSheet, createTagSearch, matchesTags } from './helpers.js';
import { ensureCategory } from './items.js';

let _catalogTags    = [];
let _catalogText    = '';
let _activeCat      = null;
let _scanFillTarget  = null;
let _pendingCreate   = null;

// ── CATALOG LOAD ─────────────────────────────────────────────────────

export async function loadCatalog() {
  if (state.catalogReady) return;
  try {
    const res  = await fetch(CATALOG_URL + '&t=' + Date.now(), { cache: 'no-store' });
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      state.catalogReady = true;
      return;
    }

    const headers = rows[0].map(h => String(h).toLowerCase().trim());
    const iId    = headers.indexOf('id');
    const iName  = findCol(headers, ['producte', 'nom', 'name', 'article']);
    const iCat   = findCol(headers, ['categoria', 'category', 'cat']);
    const iSupp  = findCol(headers, ['proveidor', 'proveedor', 'proveïdor', 'supplier', 'prove']);
    const iCode  = findCol(headers, ['codi', 'code', 'barcode', 'ean', 'upc']);
    const iMin   = findCol(headers, ['min', 'mínim', 'minim', 'min stock', 'estoc mínim']);
    const iUnit  = findCol(headers, ['unitat', 'unit', 'tipus']);
    const iMitja = findCol(headers, ['mitja', 'mitjana', 'media', 'average']);

    state.catalog = rows.slice(1)
      .filter(r => String(r[iName] ?? '').trim())
      .map(r => {
        let avgQty = 0, numCom = 0;
        if (iMitja >= 0) {
          const mitjaStr = String(r[iMitja] ?? '').trim();
          const parts    = mitjaStr.split(',');
          avgQty = parseFloat(String(parts[0] ?? '0').replace(',', '.').trim()) || 0;
          numCom = parseInt(String(parts[1]  ?? '0').trim()) || 0;
        }
        return {
          id:          parseInt(String(r[iId] ?? '0')) || 0,
          code:        String(r[iCode]  ?? '').trim(),
          name:        String(r[iName]  ?? '').trim(),
          category:    String(r[iCat]   ?? '').trim(),
          supplier:    String(r[iSupp]  ?? '').trim(),
          minStock:    parseFloat(String(r[iMin]  ?? '0').replace(',', '.')) || 0,
          unit:        iUnit >= 0 ? String(r[iUnit] ?? '').trim() : '',
          avgQty,
          numCom,
        };
      });

    state.maxCatalogId = state.catalog.reduce((max, p) => Math.max(max, p.id || 0), 0);

    // Apply local edits (overrides for products from the main sheet)
    const catalogEdits = JSON.parse(localStorage.getItem(STORAGE_CAT_EDITS) || '{}');
    if (Object.keys(catalogEdits).length > 0) {
      state.catalog = state.catalog.map(p => {
        const e = catalogEdits[p.id];
        return e ? { ...p, ...e } : p;
      });
    }

    state.catalogReady = true;
  } catch {
    /* offline o sheet privat */
  }

  if (state.catalogExtra.length > 0) {
    const sheetNames = new Set(state.catalog.map(p => p.name.toLowerCase()));
    const fresh = state.catalogExtra.filter(p => !sheetNames.has(p.name.toLowerCase()));
    // Remove from catalogExtra items that were deleted from the sheet
    if (fresh.length !== state.catalogExtra.length) {
      state.catalogExtra = fresh;
      localStorage.setItem(STORAGE_CAT_EXTRA, JSON.stringify(fresh));
    }
    state.catalog = [...state.catalog, ...fresh];
    fresh.forEach(p => { if ((p.id || 0) > state.maxCatalogId) state.maxCatalogId = p.id; });
    if (fresh.length > 0) state.catalogReady = true;
  }
}

// ── AUTOCOMPLETE ─────────────────────────────────────────────────────

let _ddResults = [];
let _ddIdx     = -1;

function highlightMatch(text, query) {
  if (!query) return esc(text);
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return esc(text).replace(re, '<mark>$1</mark>');
}

function openProductDropdown(results, query) {
  _ddResults = results;
  _ddIdx     = -1;
  const dd = document.getElementById('product-dropdown');
  if (!dd) return;

  if (results.length === 0) {
    dd.innerHTML = `<p class="product-dd-empty">Sense coincidències</p>`;
    dd.hidden = false;
    return;
  }

  dd.innerHTML = results.map((p, i) => `
    <div class="product-dd-item" data-dd="${i}" role="option" tabindex="-1">
      <span class="product-dd-name">${highlightMatch(p.name, query)}</span>
      ${p.category ? `<span class="product-dd-cat">${esc(p.category)}</span>` : ''}
    </div>
  `).join('');
  dd.hidden = false;
}

function closeProductDropdown() {
  const dd = document.getElementById('product-dropdown');
  if (dd) dd.hidden = true;
  _ddResults = [];
  _ddIdx     = -1;
}

function moveDDHighlight(dir) {
  _ddIdx = Math.max(-1, Math.min(_ddIdx + dir, _ddResults.length - 1));
  document.querySelectorAll('.product-dd-item').forEach((el, i) => {
    el.classList.toggle('is-active', i === _ddIdx);
    if (i === _ddIdx) el.scrollIntoView({ block: 'nearest' });
  });
}

function selectCatalogProduct(product) {
  document.getElementById('f-name').value = product.name;

  const catId = ensureCategory(product.category);
  const catSel = document.getElementById('f-category');
  catSel.innerHTML = state.categories
    .map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  catSel.value = catId;

  closeProductDropdown();
  document.getElementById('f-quantity').focus();
}

export function initCatalogSearch() {
  const input = document.getElementById('f-name');
  if (!input) return;

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!state.catalogReady) {
      if (q.length >= 2) {
        const dd = document.getElementById('product-dropdown');
        dd.innerHTML = `<p class="product-dd-loading">Carregant catàleg…</p>`;
        dd.hidden = false;
        loadCatalog().then(() => {
          const results = state.catalog.filter(p =>
            p.name.toLowerCase().includes(q.toLowerCase())
          ).slice(0, 8);
          openProductDropdown(results, q);
        });
      }
      return;
    }
    if (q.length < 2) { closeProductDropdown(); return; }
    const results = state.catalog
      .filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);
    openProductDropdown(results, q);
  });

  input.addEventListener('keydown', e => {
    if (_ddResults.length === 0) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); moveDDHighlight(1);  return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); moveDDHighlight(-1); return; }
    if (e.key === 'Enter' && _ddIdx >= 0) { e.preventDefault(); selectCatalogProduct(_ddResults[_ddIdx]); return; }
    if (e.key === 'Escape')     { closeProductDropdown(); }
  });

  document.getElementById('product-dropdown').addEventListener('mousedown', e => {
    const item = e.target.closest('.product-dd-item[data-dd]');
    if (item) {
      e.preventDefault();
      selectCatalogProduct(_ddResults[parseInt(item.dataset.dd)]);
    }
  });

  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.product-search-wrap')) closeProductDropdown();
  }, true);
}

// ── BARCODE SCANNER ──────────────────────────────────────────────────

let _html5QrLoaded = false;

function loadHtml5QrCode() {
  return new Promise((resolve, reject) => {
    if (window.Html5Qrcode) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    s.onload  = () => { _html5QrLoaded = true; resolve(); };
    s.onerror = () => reject(new Error("No s'ha pogut carregar l'escàner."));
    document.head.appendChild(s);
  });
}

export async function openScanModalForField(fieldId) {
  _scanFillTarget = fieldId;
  await openScanModal();
}

export async function openScanModal() {
  document.getElementById('modal-scan').classList.add('open');
  document.getElementById('scan-status-text').textContent = 'Apunta la càmera al codi de barres';

  try {
    await loadHtml5QrCode();
  } catch {
    document.getElementById('scan-status-text').textContent = "Error carregant l'escàner. Comprova la connexió.";
    return;
  }

  try {
    state.scannerInstance = new Html5Qrcode('barcode-reader');
    await state.scannerInstance.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 100 } },
      (code) => handleBarcode(code),
      () => {}
    );
  } catch {
    document.getElementById('scan-status-text').textContent = "No s'ha pogut accedir a la càmera.";
  }
}

export async function closeScanModal() {
  document.getElementById('modal-scan').classList.remove('open');
  document.getElementById('barcode-reader').hidden = false;
  document.getElementById('scan-result').hidden     = true;
  const statusEl = document.getElementById('scan-status-text');
  if (statusEl) statusEl.textContent = 'Apunta la càmera al codi';
  _pendingCreate  = null;
  _scanFillTarget = null;
  if (state.scannerInstance) {
    try {
      await state.scannerInstance.stop();
      state.scannerInstance.clear();
    } catch {}
    state.scannerInstance = null;
  }
}

export function scanCreateProduct() {
  const data = _pendingCreate;
  _pendingCreate = null;
  closeScanModal();
  if (data) openNewProductModal(data);
}

async function lookupOpenFoodFacts(code) {
  try {
    const res  = await fetch(`${OPEN_FOOD_FACTS_URL}${code}.json`);
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const name = (p.product_name_ca || p.product_name_es || p.product_name || '').trim();
    if (!name) return null;
    const rawCat = (p.categories || '').split(',')[0].trim();
    return {
      name,
      category: rawCat.replace(/^[a-z]{2}:/, ''),
      supplier: (p.brands || '').split(',')[0].trim(),
    };
  } catch {
    return null;
  }
}

async function handleBarcode(code) {
  if (state.scannerInstance) {
    try { await state.scannerInstance.stop(); state.scannerInstance.clear(); state.scannerInstance = null; } catch {}
  }

  if (_scanFillTarget) {
    const el = document.getElementById(_scanFillTarget);
    if (el) el.value = code;
    _scanFillTarget = null;
    closeScanModal();
    return;
  }

  const statusEl = document.getElementById('scan-status-text');
  if (statusEl) statusEl.textContent = 'Buscant producte…';

  const localIdx = state.catalog.findIndex(p => p.code && p.code === code);
  if (localIdx >= 0) {
    closeScanModal();
    toast(`Trobat: ${state.catalog[localIdx].name}`);
    openQtyModal(localIdx);
    return;
  }

  const offProduct = await lookupOpenFoodFacts(code);

  document.getElementById('barcode-reader').hidden = true;
  document.getElementById('scan-result').hidden     = false;
  const msgEl = document.getElementById('scan-result-msg');

  if (offProduct) {
    _pendingCreate = { ...offProduct, code };
    msgEl.textContent = `"${offProduct.name}" no és al nostre catàleg però existeix a la base de dades pública. Vols afegir-lo?`;
  } else {
    _pendingCreate = { code };
    msgEl.textContent = `El codi ${code} no és al nostre catàleg. Vols crear un producte nou a partir d'aquest codi?`;
  }
}

// ── CATALOG VIEW (Comensal) ──────────────────────────────────────────

function _catColor(catName) {
  const cat = state.categories.find(c => c.name.toLowerCase() === (catName || '').toLowerCase());
  if (cat) return cat.color;
  let h = 0;
  for (let i = 0; i < (catName || '').length; i++) h = (h * 31 + catName.charCodeAt(i)) & 0xFFFF;
  return CAT_COLORS[h % CAT_COLORS.length];
}

function _iconType(unit) {
  const u = (unit || '').toLowerCase();
  if (/botel|ampol|vi\b|cava|cerves|llaun|garraf/.test(u)) return 'bottle';
  return 'box';
}

const _ICON_SVG = {
  bottle: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6"/><path d="M10.5 3v3L7.5 9.5V19a1.5 1.5 0 001.5 1.5h6A1.5 1.5 0 0016.5 19V9.5L13.5 6V3"/><line x1="7.5" y1="14" x2="16.5" y2="14"/></svg>`,
  box:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  pkg:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`,
};

export function renderCatalogView() {
  const panel = document.getElementById('view-catalog');
  if (!panel) return;

  if (!state.catalogReady) {
    panel.innerHTML = '<div class="catalog-loading">Carregant catàleg…</div>';
    loadCatalog()
      .then(() => renderCatalogView())
      .catch(() => {
        panel.innerHTML = "<div class=\"catalog-empty\">No s'ha pogut carregar el catàleg.<br>Comprova la connexió a internet.</div>";
      });
    return;
  }

  if (state.catalog.length === 0) {
    panel.innerHTML = '<div class="catalog-empty">Cap producte al catàleg.</div>';
    return;
  }

  const role     = document.body.dataset.role || 'comensal';
  const isEditor = role === 'admin' || role === 'coordinador';

  const editSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

  if (isEditor) {
    // ── Editor view: flat list grouped by category ──────────────────
    const groups = new Map();
    state.catalog.forEach((p, i) => {
      const cat = p.category || 'Sense categoria';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push({ p, i });
    });

    const html = [`<div class="catalog-list"><div id="catalog-tag-search"></div>`];
    groups.forEach((entries, catName) => {
      html.push(`<div class="catalog-section-title" data-section="${esc(catName)}">${esc(catName)}</div>`);
      entries.forEach(({ p, i }) => {
        const searchVal = [p.name, p.category, p.supplier].filter(Boolean).join(' ').toLowerCase();
        html.push(`
          <div class="catalog-btn catalog-edit-row" data-search="${esc(searchVal)}">
            <span class="catalog-btn-name">${esc(p.name)}</span>
            <div style="display:flex;align-items:center;gap:6px">
              ${p.supplier ? `<span class="catalog-btn-qty" style="font-size:11px">${esc(p.supplier)}</span>` : ''}
              <button class="item-edit-btn" data-catalog-edit="${i}" aria-label="Editar ${esc(p.name)}">${editSvg}</button>
            </div>
          </div>
        `);
      });
    });
    html.push('</div>');
    panel.innerHTML = html.join('');
  } else {
    // ── Comensal view: card grid ─────────────────────────────────────
    const cats = [...new Set(state.catalog.map(p => p.category).filter(Boolean))].sort();
    if (_activeCat && !cats.includes(_activeCat)) _activeCat = null;

    const catPills = cats.map(c => {
      const color = _catColor(c);
      const active = c === _activeCat ? ' active' : '';
      return `<button class="catalog-cat-pill${active}" data-cat="${esc(c)}" style="background:${color};color:rgba(34,31,30,0.8)">${esc(c)}</button>`;
    }).join('');

    const scanBtn = `
      <button class="catalog-scan-btn" id="btn-scan-barcode">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M15 3h4a2 2 0 012 2v4M15 21h4a2 2 0 002-2v-4"/>
          <line x1="7" y1="12" x2="7" y2="12.01"/><line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="17" y1="12" x2="17" y2="12.01"/>
        </svg>
        Escaneja codi de barres
      </button>`;

    const cards = state.catalog.map((p, i) => {
      const existing  = state.items.find(it => it.name.toLowerCase() === p.name.toLowerCase());
      const qty       = existing != null ? fmtQtyDisplay(existing) : '';
      const hasQty    = !!qty;
      const color     = _catColor(p.category);
      const iconKey   = _iconType(p.unit);
      const icon      = _ICON_SVG[iconKey] || _ICON_SVG.pkg;
      const catLabel  = p.category || '';
      const searchVal = [p.name, p.supplier].filter(Boolean).join(' ').toLowerCase();
      const cls       = ['catalog-card', hasQty && 'has-qty'].filter(Boolean).join(' ');
      return `
        <button class="${cls}" data-catalog="${i}" data-search="${esc(searchVal)}" data-cat="${esc(p.category || '')}">
          <div class="catalog-card-top">
            <div class="catalog-card-icon">${icon}</div>
            ${catLabel ? `<span class="catalog-card-cat" style="background:${color};color:rgba(34,31,30,0.8)">${esc(catLabel)}</span>` : ''}
          </div>
          <span class="catalog-card-name">${esc(p.name)}</span>
          <span class="catalog-card-qty">${qty || '—'}</span>
        </button>`;
    });

    panel.innerHTML = `
      <div class="catalog-list">
        <input class="catalog-simple-search" id="catalog-simple-search" type="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Cerca producte…" value="${esc(_catalogText)}">
        ${scanBtn}
      </div>
      ${cats.length ? `<div class="catalog-cat-pills" id="catalog-cat-pills">${catPills}</div>` : ''}
      <div class="catalog-grid">${cards.join('')}</div>`;

    document.getElementById('catalog-simple-search').addEventListener('input', e => {
      _catalogText = e.target.value.trim().toLowerCase();
      _filterCatalogView(panel);
    });

    // Category pill click handler
    const pillsEl = panel.querySelector('#catalog-cat-pills');
    if (pillsEl) {
      pillsEl.addEventListener('click', e => {
        const pill = e.target.closest('.catalog-cat-pill');
        if (!pill) return;
        const cat = pill.dataset.cat;
        if (_activeCat === cat) {
          _activeCat = null;
          pill.classList.remove('active');
        } else {
          pillsEl.querySelectorAll('.catalog-cat-pill').forEach(p => p.classList.remove('active'));
          _activeCat = cat;
          pill.classList.add('active');
        }
        _filterCatalogView(panel);
      });
    }
    _filterCatalogView(panel);
    return;
  }

  createTagSearch(
    document.getElementById('catalog-tag-search'),
    tags => { _catalogTags = tags; _filterCatalogView(panel); },
    'Nom, categoria, proveïdor… (Enter per text)',
    () => {
      const cats2 = [...new Set(state.catalog.map(p => p.category).filter(Boolean))].sort()
        .map(c => ({ value: c.toLowerCase(), label: c, type: 'Categoria' }));
      const supps = [...new Set(state.catalog.map(p => p.supplier).filter(Boolean))].sort()
        .map(s => ({ value: s.toLowerCase(), label: s, type: 'Proveïdor' }));
      return [...cats2, ...supps];
    },
    _catalogTags
  );
}

function _filterCatalogView(panel) {
  const tags = _catalogTags;
  const grid = panel.querySelector('.catalog-grid');
  if (grid) {
    grid.querySelectorAll('.catalog-card').forEach(el => {
      const textOk = !_catalogText || (el.dataset.search || '').includes(_catalogText);
      const catOk  = !_activeCat || el.dataset.cat === _activeCat;
      el.hidden = !(textOk && catOk);
    });
    return;
  }

  let lastSection = null;
  let sectionVisible = false;
  panel.querySelectorAll('.catalog-list > *').forEach(el => {
    if (el.classList.contains('catalog-section-title')) {
      if (lastSection) lastSection.hidden = !sectionVisible;
      lastSection = el;
      sectionVisible = false;
    } else if (el.classList.contains('catalog-btn')) {
      const haystack = el.dataset.search || el.querySelector('.catalog-btn-name').textContent.toLowerCase();
      const show = matchesTags(haystack, tags);
      el.hidden = !show;
      if (show) sectionVisible = true;
    }
  });
  if (lastSection) lastSection.hidden = !sectionVisible;
}

// ── QTY MODAL ────────────────────────────────────────────────────────

function _pluralCa(word, n) {
  if (!word) return word;
  if (Math.abs(parseFloat(n)) === 1) return word;
  return word.endsWith('a') ? word.slice(0, -1) + 'es' : word + 's';
}

function _cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function _updateQtyLabels() {
  const boxesInput = document.getElementById('f-qty-boxes');
  const boxesLabel = document.getElementById('qty-boxes-label');
  const boxesVal   = boxesInput.value === '' ? 1 : boxesInput.value;
  boxesLabel.textContent = _cap(_pluralCa('caixa', boxesVal));
}

document.addEventListener('input', e => {
  if (e.target.id === 'f-qty-boxes') _updateQtyLabels();
});

export function openQtyModal(idx) {
  const product = state.catalog[idx];
  if (!product) return;
  state.editingCatalogIdx = idx;

  const existing = state.items.find(i => i.name.toLowerCase() === product.name.toLowerCase());

  document.getElementById('modal-qty-title').textContent = product.name;

  const boxesInput = document.getElementById('f-qty-boxes');
  boxesInput.value = existing?.boxes != null ? existing.boxes : '';
  _updateQtyLabels();

  document.getElementById('btn-remove-qty').hidden = !existing;
  document.getElementById('modal-qty').classList.add('open');
  setTimeout(() => { boxesInput.focus(); boxesInput.select(); }, 350);
}

export function closeQtyModal() {
  document.getElementById('modal-qty').classList.remove('open');
  state.editingCatalogIdx = null;
}

export function removeQtyItem() {
  const product = state.catalog[state.editingCatalogIdx];
  if (!product) return;
  state.items = state.items.filter(i => i.name.toLowerCase() !== product.name.toLowerCase());
  saveItems();
  closeQtyModal();
  toast(`${product.name} desmarcat`);
  renderCatalogView();
}

export function saveQty() {
  const product = state.catalog[state.editingCatalogIdx];
  if (!product) return;

  const boxesVal = document.getElementById('f-qty-boxes').value;

  if (boxesVal === '') {
    document.getElementById('f-qty-boxes').focus();
    return;
  }

  const boxes = parseFloat(boxesVal) || 0;

  const catId     = ensureCategory(product.category);
  const existing  = state.items.find(i => i.name.toLowerCase() === product.name.toLowerCase());
  const update    = {
    quantity:  boxes,
    boxes:     boxes,
    unit:      product.unit || '',
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    Object.assign(existing, update);
  } else {
    state.items.unshift({
      id: uid(), createdAt: new Date().toISOString(),
      name: product.name, category: catId,
      minStock: product.minStock || 0, notes: '',
      ...update,
    });
  }

  saveItems();
  closeQtyModal();
  toast(`${product.name}: ${fmtQtyDisplay({ boxes, unit: product.unit || 'u' })}`);
  renderCatalogView();
}

// ── GAS CONFIG (Admin) ───────────────────────────────────────────────

export function openGasModal() {
  const saved = localStorage.getItem('uauu_inv_gas_url') || '';
  document.getElementById('f-gas-url').value = saved;
  document.getElementById('modal-gas').classList.add('open');
  setTimeout(() => document.getElementById('f-gas-url').focus(), 380);
}

export function closeGasModal() {
  document.getElementById('modal-gas').classList.remove('open');
}

export function saveGasUrl() {
  const url = document.getElementById('f-gas-url').value.trim();
  if (url) {
    localStorage.setItem('uauu_inv_gas_url', url);
    toast('URL desada correctament');
  } else {
    localStorage.removeItem('uauu_inv_gas_url');
    toast('URL eliminada');
  }
  closeGasModal();
}

export function testGasUrl() {
  const url = document.getElementById('f-gas-url').value.trim()
           || localStorage.getItem('uauu_inv_gas_url') || '';
  if (!url) { toast('Enganxa primer la URL'); return; }
  const params = new URLSearchParams({
    id: 0, producte: 'TEST_CONNEXIO', proveidor: '', categoria: 'TEST', codi: '',
  });
  window.open(`${url}?${params}`, '_blank');
  toast('Comprova si ha aparegut una fila TEST al full');
}

// ── NOU PRODUCTE (Comensal) ──────────────────────────────────────────

function _fillProductDataLists() {
  const categories = [...new Set(state.catalog.map(p => p.category).filter(Boolean))].sort();
  const suppliers  = [...new Set(state.catalog.map(p => p.supplier).filter(Boolean))].sort();
  document.getElementById('dl-np-categories').innerHTML = categories.map(c => `<option value="${esc(c)}">`).join('');
  document.getElementById('dl-np-suppliers').innerHTML  = suppliers.map(s => `<option value="${esc(s)}">`).join('');
}

export function openNewProductModal(prefill = {}) {
  state.editingCatalogProductIdx = null;
  document.getElementById('modal-np-title').textContent = 'Nou producte';
  document.getElementById('btn-save-new-product').textContent = 'Afegir al catàleg';
  const delBtn = document.getElementById('btn-delete-product');
  if (delBtn) delBtn.hidden = true;

  _fillProductDataLists();
  document.getElementById('f-np-name').value        = prefill.name        || '';
  document.getElementById('f-np-category').value    = prefill.category    || '';
  document.getElementById('f-np-supplier').value    = prefill.supplier    || '';
  document.getElementById('f-np-unit').value        = prefill.unit        || '';
  document.getElementById('f-np-minstock').value    = prefill.minStock    || '';
  document.getElementById('f-np-code').value        = prefill.code        || '';
  document.getElementById('modal-new-product').classList.add('open');
  const focusField = prefill.name ? 'f-np-category' : 'f-np-name';
  setTimeout(() => document.getElementById(focusField).focus(), 380);
}

export function openEditProductModal(idx) {
  const product = state.catalog[idx];
  if (!product) return;
  state.editingCatalogProductIdx = idx;

  document.getElementById('modal-np-title').textContent = 'Editar producte';
  document.getElementById('btn-save-new-product').textContent = 'Desar canvis';

  _fillProductDataLists();
  document.getElementById('f-np-name').value        = product.name        || '';
  document.getElementById('f-np-category').value    = product.category    || '';
  document.getElementById('f-np-supplier').value    = product.supplier    || '';
  document.getElementById('f-np-unit').value        = product.unit        || '';
  document.getElementById('f-np-minstock').value    = product.minStock    || '';
  document.getElementById('f-np-code').value        = product.code        || '';

  const isExtra = state.catalogExtra.some(e => e.id === product.id);
  const delBtn = document.getElementById('btn-delete-product');
  if (delBtn) delBtn.hidden = !isExtra;

  document.getElementById('modal-new-product').classList.add('open');
  setTimeout(() => document.getElementById('f-np-name').focus(), 380);
}

export function saveEditProduct() {
  const idx = state.editingCatalogProductIdx;
  if (idx === null) return;
  const original = state.catalog[idx];

  const name        = document.getElementById('f-np-name').value.trim();
  const category    = document.getElementById('f-np-category').value.trim();
  const supplier    = document.getElementById('f-np-supplier').value.trim();
  const unit        = document.getElementById('f-np-unit').value.trim();
  const minStock    = parseFloat(document.getElementById('f-np-minstock').value) || 0;
  const code        = document.getElementById('f-np-code').value.trim();

  if (!name) {
    const el = document.getElementById('f-np-name');
    el.focus();
    el.style.borderColor = 'rgba(176,32,32,0.5)';
    setTimeout(() => { el.style.borderColor = ''; }, 1200);
    return;
  }

  const updated = { ...original, name, category, supplier, unit, minStock, code };
  state.catalog[idx] = updated;

  const extraIdx = state.catalogExtra.findIndex(p => p.id === original.id);
  if (extraIdx >= 0) {
    state.catalogExtra[extraIdx] = updated;
    localStorage.setItem(STORAGE_CAT_EXTRA, JSON.stringify(state.catalogExtra));
  } else {
    const edits = JSON.parse(localStorage.getItem(STORAGE_CAT_EDITS) || '{}');
    edits[original.id] = { name, category, supplier, code };
    localStorage.setItem(STORAGE_CAT_EDITS, JSON.stringify(edits));
  }

  closeNewProductModal();
  renderCatalogView();
  toast(`"${name}" actualitzat`);
}

export function deleteEditProduct() {
  const idx = state.editingCatalogProductIdx;
  if (idx === null) return;
  const product = state.catalog[idx];

  const extraIdx = state.catalogExtra.findIndex(p => p.id === product.id);
  if (extraIdx < 0) return;

  if (!confirm(`Eliminar "${product.name}" del catàleg?`)) return;

  state.catalogExtra.splice(extraIdx, 1);
  localStorage.setItem(STORAGE_CAT_EXTRA, JSON.stringify(state.catalogExtra));
  state.catalog.splice(idx, 1);

  closeNewProductModal();
  renderCatalogView();
  toast(`"${product.name}" eliminat del catàleg`);
}

export function closeNewProductModal() {
  document.getElementById('modal-new-product').classList.remove('open');
}

export function saveNewProduct() {
  try {
    const name        = document.getElementById('f-np-name').value.trim();
    const category    = document.getElementById('f-np-category').value.trim();
    const supplier    = document.getElementById('f-np-supplier').value.trim();
    const unit        = document.getElementById('f-np-unit').value.trim();
    const minStock    = parseFloat(document.getElementById('f-np-minstock').value) || 0;
    const code        = document.getElementById('f-np-code').value.trim();

    if (!name) {
      const el = document.getElementById('f-np-name');
      el.focus();
      el.style.borderColor = 'rgba(176,32,32,0.5)';
      setTimeout(() => { el.style.borderColor = ''; }, 1200);
      return;
    }

    state.maxCatalogId++;
    const newId   = state.maxCatalogId;
    const product = { id: newId, code, name, category, supplier, unit, minStock };

    state.catalog.push(product);
    state.catalogExtra.push(product);
    state.catalogReady = true;
    localStorage.setItem(STORAGE_CAT_EXTRA, JSON.stringify(state.catalogExtra));

    const gasUrl = localStorage.getItem('uauu_inv_gas_url') || SHEET_APPEND_URL;
    if (gasUrl) {
      const params = new URLSearchParams({
        action: 'add-producte',
        id: newId, producte: name, proveidor: supplier,
        categoria: category, codi: code, min: minStock,
        unitat: unit,
      });
      sendToSheet(gasUrl, params);

      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const histParams = new URLSearchParams({
        action:    'inventari',
        id:        String(now.getTime()),
        data:      `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,
        hora:      `${pad(now.getHours())}:${pad(now.getMinutes())}`,
        comensal:  state.authProfile?.nom || state.user || '',
        masia:     state.masia || '',
        inventari: `[PRODUCTE]: ${name}`,
        comentari: [category, supplier].filter(Boolean).join(' · '),
      });
      sendToSheet(SHEET_APPEND_URL, histParams.toString());

      toast(`"${name}" afegit i enviat al full`);
    } else {
      toast(`"${name}" desat localment`);
    }

    closeNewProductModal();
    renderCatalogView();
  } catch (err) {
    toast(`Error al desar: ${err.message}`);
  }
}
