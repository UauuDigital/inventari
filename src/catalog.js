import {
  CATALOG_URL, OPEN_FOOD_FACTS_URL, STORAGE_CAT_EXTRA, STORAGE_CAT_EDITS, STORAGE_CAT_DELETED, STORAGE_GAS_URL,
  state, saveItems, CAT_COLORS,
} from './config.js';
import { uid, esc, fmtNum, fmtQtyDisplay, toast, parseCSV, findCol, sendToSheet, getGasUrl, createTagSearch, matchesTags, sortByCategoryName } from './helpers.js';
import { ensureCategory } from './items.js';
import { t, getLang } from './i18n.js';

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

    // Remove products deleted locally (from the main sheet, not re-added on reload)
    const deletedIds = new Set(JSON.parse(localStorage.getItem(STORAGE_CAT_DELETED) || '[]'));
    if (deletedIds.size > 0) {
      state.catalog = state.catalog.filter(p => !deletedIds.has(p.id));
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
    dd.innerHTML = `<p class="product-dd-empty">${t('Sense coincidències')}</p>`;
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
        dd.innerHTML = `<p class="product-dd-loading">${t('Carregant catàleg…')}</p>`;
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
    s.onerror = () => reject(new Error(t("No s'ha pogut carregar l'escàner.")));
    document.head.appendChild(s);
  });
}

export async function openScanModalForField(fieldId) {
  _scanFillTarget = fieldId;
  await openScanModal();
}

export async function openScanModal() {
  document.getElementById('modal-scan').classList.add('open');
  document.getElementById('scan-status-text').textContent = t('Apunta la càmera al codi de barres');

  try {
    await loadHtml5QrCode();
  } catch {
    document.getElementById('scan-status-text').textContent = t("Error carregant l'escàner. Comprova la connexió.");
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
    document.getElementById('scan-status-text').textContent = t("No s'ha pogut accedir a la càmera.");
  }
}

export async function closeScanModal() {
  document.getElementById('modal-scan').classList.remove('open');
  document.getElementById('barcode-reader').hidden = false;
  document.getElementById('scan-result').hidden     = true;
  const statusEl = document.getElementById('scan-status-text');
  if (statusEl) statusEl.textContent = t('Apunta la càmera al codi');
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
  if (statusEl) statusEl.textContent = t('Buscant producte…');

  const localIdx = state.catalog.findIndex(p => p.code && p.code === code);
  if (localIdx >= 0) {
    closeScanModal();
    toast(t('Trobat: {name}', { name: state.catalog[localIdx].name }));
    openQtyModal(localIdx);
    return;
  }

  const offProduct = await lookupOpenFoodFacts(code);

  document.getElementById('barcode-reader').hidden = true;
  document.getElementById('scan-result').hidden     = false;
  const msgEl = document.getElementById('scan-result-msg');

  if (offProduct) {
    _pendingCreate = { ...offProduct, code };
    msgEl.textContent = t('"{name}" no és al nostre catàleg però existeix a la base de dades pública. Vols afegir-lo?', { name: offProduct.name });
  } else {
    _pendingCreate = { code };
    msgEl.textContent = t("El codi {code} no és al nostre catàleg. Vols crear un producte nou a partir d'aquest codi?", { code });
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
  if (/sac/.test(u)) return 'sack';
  return 'box';
}

const _ICON_SVG = {
  bottle: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6"/><path d="M10.5 3v3L7.5 9.5V19a1.5 1.5 0 001.5 1.5h6A1.5 1.5 0 0016.5 19V9.5L13.5 6V3"/><line x1="7.5" y1="14" x2="16.5" y2="14"/></svg>`,
  box:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  sack:   `<svg width="18" height="22" viewBox="0 0 99.734 122.88" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round" aria-hidden="true"><path d="M78.899,83.047c0.926-0.1,1.752,0.563,1.861,1.489c0.227,1.997,0.481,5.065,0.463,7.808 c-0.009,2.033-0.182,3.912-0.626,5.12c-0.318,0.871-1.29,1.325-2.161,0.998c-0.871-0.317-1.325-1.289-0.999-2.16 c0.31-0.826,0.418-2.306,0.437-3.977c0-2.542-0.255-5.483-0.463-7.417C77.311,83.982,77.977,83.156,78.899,83.047L78.899,83.047z M71.225,12.88c1.562-0.172,3.032-0.218,4.403-0.108c1.316,0.1,2.533,0.345,3.622,0.754c0.872,0.317,1.843-0.128,2.161-0.999 s-0.127-1.843-0.999-2.161c-1.389-0.508-2.904-0.816-4.521-0.943c-1.58-0.137-3.269-0.092-5.039,0.108 C68.667,9.766,69.003,13.119,71.225,12.88L71.225,12.88z M28.938,12.88c-1.562-0.172-3.032-0.218-4.403-0.108 c-1.316,0.1-2.533,0.345-3.623,0.754c-0.872,0.317-1.843-0.128-2.161-0.999s0.127-1.843,0.999-2.161 c1.389-0.508,2.905-0.816,4.521-0.943c1.58-0.137,3.269-0.092,5.039,0.108C31.496,9.766,31.16,13.119,28.938,12.88L28.938,12.88z M12.031,55.268c-0.359-7.886-0.941-13.054-1.218-14.975C9.851,33.657,9.958,29.17,10.24,20.936 c0.036-1.063,0.136-1.87,0.217-2.479c0.418-3.295,0.454-3.567-3.722-4.693c-1.516-0.408-2.633-0.989-3.086-1.979 C3.194,10.786,3.24,9.279,3.975,7.019c1.525-0.109,3.241,0,4.984,0.117c2.36,0.155,4.767,0.31,7.09-0.018 c3.205-0.454,6.664-1.025,10.25-1.616c4.449-0.734,9.105-0.459,13.708-1.076c9.387-1.253,6.107-1.308,14.859-0.545 C63.69,4.652,72.688,5.212,82.928,7.3c0.118,0.027,0.236,0.036,0.345,0.036l12.755-0.172c0.382,1.725,0.445,3.031,0.146,4.021 c-0.317,1.044-1.153,1.815-2.578,2.46l-0.2,0.091c-2.56,1.171-3.586,1.634-4.131,2.933c-0.354,0.835-0.299,1.58-0.208,2.814 c0.063,0.881,0.163,2.088,0.118,3.722C89,29.978,88.817,34.71,87.628,41.482c-0.239,1.436-0.754,4.17-1.217,12.202 c-0.417,7.215-0.436,3.563-0.069,10.265c0.431,7.896,1.038,12.814,1.286,14.304c1.189,6.772,1.372,14.39,1.546,21.162 c0.045,1.634-0.055,2.842-0.118,3.722c-0.091,1.234-0.146,1.979,0.208,2.814c0.545,1.298,1.571,1.761,4.131,2.933l0.2,0.091 c1.425,0.644,2.261,1.416,2.578,2.46c0.3,0.989,0.236,2.297-0.146,4.021l-12.755-0.173c-0.108,0-0.227,0.01-0.345,0.036 c-10.24,2.089-19.237,2.908-28.062,3.68c-8.751,0.763-5.472,0.708-14.859-0.545c-4.603-0.617-9.26-0.602-13.708-1.336 c-3.586-0.591-7.045-1.162-10.25-1.616c-2.324-0.327-4.73-0.173-7.09-0.019c-1.743,0.118-3.458,0.227-4.984,0.118 c-0.735-2.261-0.781-3.768-0.327-4.767c0.454-0.989,1.571-1.57,3.086-1.979c4.176-1.126,4.14-1.398,3.722-4.693 c-0.082-0.608-0.181-1.417-0.217-2.479c-0.282-8.234-0.389-15.605,0.574-22.242c0.27-1.869,0.782-7.479,1.168-15.555 C12.271,57.856,12.289,60.912,12.031,55.268L12.031,55.268z M89.725,53.69c0.377-7.867,1.013-10.304,1.235-11.572 c1.097-7.437,1.404-11.305,1.591-18.85c0.045-1.88-0.046-3.132-0.118-4.049c-0.055-0.727-0.091-1.171-0.055-1.243 c0.045-0.101,0.727-0.409,2.433-1.19l0.2-0.09c2.352-1.071,3.768-2.497,4.394-4.549c0.572-1.879,0.382-4.167-0.436-7.145 c-0.2-0.717-0.862-1.243-1.643-1.234l-13.908,0.19c-10.341-2.098-19.41-2.675-28.252-3.446c-8.961-0.79-5.908-0.718-15.585,0.572 c-4.73,0.626-9.378,0.35-13.817,1.086c-3.541,0.59-6.954,1.152-10.177,1.606c-1.979,0.281-4.222,0.137-6.418-0.009 c-2.315-0.154-4.584-0.3-6.673,0.018l0,0c-0.59,0.092-1.107,0.481-1.334,1.081c-1.399,3.73-1.462,6.372-0.572,8.306 c0.944,2.079,2.832,3.187,5.266,3.841c1.343,0.363,1.334,0.408,1.252,1.017c-0.091,0.69-0.2,1.589-0.245,2.797 c-0.291,8.46-0.38,13.139,0.601,19.938c0.259,1.789,0.997,6.708,1.234,14.528c0.11,3.594,0.058,4.927-0.047,8.544 c-0.233,8-0.935,13.391-1.187,15.133c-0.98,6.8-0.892,14.362-0.601,22.823c0.045,1.207,0.154,2.105,0.245,2.796 c0.082,0.608,0.091,0.653-1.252,1.017c-2.434,0.653-4.322,1.761-5.266,3.84c-0.89,1.934-0.827,4.575,0.572,8.307 c0.227,0.6,0.744,0.99,1.334,1.08l0,0c2.088,0.318,4.358,0.173,6.673,0.019c2.197-0.146,4.439-0.291,6.418-0.009 c3.223,0.454,6.636,1.017,10.177,1.606c4.439,0.735,9.087,0.72,13.817,1.346c9.678,1.29,6.625,1.362,15.585,0.572 c8.842-0.771,17.911-1.609,28.252-3.706l13.908,0.19c0.78,0.009,1.442-0.518,1.643-1.234c0.817-2.979,1.008-5.266,0.436-7.146 c-0.626-2.052-2.042-3.477-4.394-4.548l-0.2-0.091c-1.706-0.78-2.388-1.089-2.433-1.189c-0.036-0.072,0-0.518,0.055-1.244 c0.072-0.916,0.163-2.169,0.118-4.048c-0.187-7.545-0.494-14.298-1.591-21.734c-0.232-1.322-0.966-6.08-1.317-13.789 C89.439,59.37,89.509,58.199,89.725,53.69L89.725,53.69z"/></svg>`,
  pkg:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`,
};

// Patró de fons (repetit i inclinat) del modal de quantitat, generat a partir de
// la mateixa icona (ampolla/caixa/sac) que es mostra a les targetes del catàleg.
function _iconTileUrl(unit) {
  const key    = _iconType(unit);
  const svgStr = _ICON_SVG[key] || _ICON_SVG.pkg;
  const vbM    = svgStr.match(/viewBox="([^"]+)"/);
  const [, , vw, vh] = (vbM ? vbM[1] : '0 0 24 24').split(' ').map(Number);
  const innerM = svgStr.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  const inner  = innerM ? innerM[1] : '';

  const tile   = 64;
  const target = 30;
  const scale  = target / Math.max(vw, vh);
  const tx     = (tile - vw * scale) / 2;
  const ty     = (tile - vh * scale) / 2;
  const paint  = key === 'sack'
    ? 'fill="#221F1E" stroke="none"'
    : 'fill="none" stroke="#221F1E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}" viewBox="0 0 ${tile} ${tile}"><g transform="translate(${tx},${ty}) scale(${scale})" ${paint}>${inner}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function renderCatalogView() {
  const panel = document.getElementById('view-catalog');
  if (!panel) return;

  if (!state.catalogReady) {
    panel.innerHTML = `<div class="catalog-loading">${t('Carregant catàleg…')}</div>`;
    loadCatalog()
      .then(() => renderCatalogView())
      .catch(() => {
        panel.innerHTML = `<div class="catalog-empty">${t("No s'ha pogut carregar el catàleg.<br>Comprova la connexió a internet.")}</div>`;
      });
    return;
  }

  if (state.catalog.length === 0) {
    panel.innerHTML = `<div class="catalog-empty">${t('Cap producte al catàleg.')}</div>`;
    return;
  }

  const role     = document.body.dataset.role || 'comensal';
  const isEditor = role === 'admin' || role === 'coordinador';

  if (isEditor) {
    // ── Editor view: flat list grouped by category, in category order ──
    const sorted = sortByCategoryName(
      state.catalog.map((p, i) => ({ p, i })),
      ({ p }) => p.category,
      ({ p }) => p.name
    );

    const html = [`<div class="catalog-list"><div id="catalog-tag-search"></div>`];
    let lastCat = undefined;
    sorted.forEach(({ p, i }) => {
      const catName = p.category || t('Sense categoria');
      if (catName !== lastCat) {
        html.push(`<div class="catalog-section-title" data-section="${esc(catName)}">${esc(catName)}</div>`);
        lastCat = catName;
      }
      const searchVal = [p.name, p.category, p.supplier].filter(Boolean).join(' ').toLowerCase();
      html.push(`
        <button type="button" class="catalog-btn catalog-edit-row" data-search="${esc(searchVal)}" data-catalog-edit="${i}" aria-label="${t('Editar')} ${esc(p.name)}">
          <span class="catalog-btn-name">${esc(p.name)}</span>
          <div style="display:flex;align-items:center;gap:6px">
            ${p.supplier ? `<span class="catalog-btn-qty" style="font-size:11px">${esc(p.supplier)}</span>` : ''}
          </div>
        </button>
      `);
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
        ${t('Escaneja codi de barres')}
      </button>`;

    const catalogSorted = sortByCategoryName(
      state.catalog.map((p, i) => ({ p, i })),
      ({ p }) => p.category,
      ({ p }) => p.name
    );

    const cards = catalogSorted.map(({ p, i }) => {
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
        <input class="catalog-simple-search" id="catalog-simple-search" type="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="${t('Cerca producte…')}" value="${esc(_catalogText)}">
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
    t('Nom, categoria, proveïdor… (Enter per text)'),
    () => {
      const cats2 = [...new Set(state.catalog.map(p => p.category).filter(Boolean))].sort()
        .map(c => ({ value: c.toLowerCase(), label: c, type: t('Categoria') }));
      const supps = [...new Set(state.catalog.map(p => p.supplier).filter(Boolean))].sort()
        .map(s => ({ value: s.toLowerCase(), label: s, type: t('Proveïdor') }));
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

// Nom (singular/plural) de la unitat de comptatge segons la unitat del producte.
function _unitWord(unit) {
  const type = _iconType(unit);
  if (type === 'bottle') return { ca: 'ampolla', es: ['Botella', 'Botellas'] };
  if (type === 'sack')   return { ca: 'sac',     es: ['Saco', 'Sacos'] };
  return { ca: 'caixa', es: ['Caja', 'Cajas'] };
}

function _updateQtyLabels() {
  const boxesInput = document.getElementById('f-qty-boxes');
  const boxesLabel = document.getElementById('qty-boxes-label');
  const boxesVal   = boxesInput.value === '' ? 1 : boxesInput.value;
  const product    = state.catalog[state.editingCatalogIdx];
  const word       = _unitWord(product?.unit);
  const label = getLang() === 'es'
    ? (Math.abs(parseFloat(boxesVal)) === 1 ? word.es[0] : word.es[1])
    : _cap(_pluralCa(word.ca, boxesVal));
  boxesLabel.textContent = label;
}

document.addEventListener('input', e => {
  if (e.target.id === 'f-qty-boxes') _updateQtyLabels();
});

let _qtyNavList = [];

function _visibleCatalogIndices() {
  return Array.from(document.querySelectorAll('#view-catalog [data-catalog]'))
    .filter(el => !el.hidden)
    .map(el => parseInt(el.dataset.catalog, 10));
}

function _updateQtyNavButtons() {
  const pos = _qtyNavList.indexOf(state.editingCatalogIdx);
  document.getElementById('btn-qty-prev').disabled = pos <= 0;
  document.getElementById('btn-qty-next').disabled = pos === -1 || pos >= _qtyNavList.length - 1;
}

function _loadQtyModal(idx) {
  const product = state.catalog[idx];
  if (!product) return;
  state.editingCatalogIdx = idx;

  const existing = state.items.find(i => i.name.toLowerCase() === product.name.toLowerCase());

  document.getElementById('modal-qty-title').textContent = product.name;

  const bgEl = document.getElementById('modal-qty-bg');
  if (bgEl) bgEl.style.backgroundImage = _iconTileUrl(product.unit);

  const catBadge = document.getElementById('modal-qty-cat');
  if (product.category) {
    const color = _catColor(product.category);
    catBadge.textContent = product.category;
    catBadge.style.color = color;
    catBadge.style.borderColor = `${color}55`;
    catBadge.hidden = false;
  } else {
    catBadge.hidden = true;
  }

  const boxesInput = document.getElementById('f-qty-boxes');
  boxesInput.value = existing?.boxes != null ? existing.boxes : '';
  _updateQtyLabels();

  document.getElementById('btn-remove-qty').hidden = !existing;
  _updateQtyNavButtons();
}

export function openQtyModal(idx) {
  if (!state.catalog[idx]) return;
  _qtyNavList = _visibleCatalogIndices();
  _loadQtyModal(idx);

  document.getElementById('modal-qty').classList.add('open');
  const boxesInput = document.getElementById('f-qty-boxes');
  setTimeout(() => { boxesInput.focus(); boxesInput.select(); }, 350);
}

export function closeQtyModal() {
  document.getElementById('modal-qty').classList.remove('open');
  state.editingCatalogIdx = null;
  _qtyNavList = [];
}

export function removeQtyItem() {
  const product = state.catalog[state.editingCatalogIdx];
  if (!product) return;
  state.items = state.items.filter(i => i.name.toLowerCase() !== product.name.toLowerCase());
  saveItems();
  closeQtyModal();
  toast(t('{name} desmarcat', { name: product.name }));
  renderCatalogView();
}

function _persistQty() {
  const product = state.catalog[state.editingCatalogIdx];
  if (!product) return;

  const boxesVal = document.getElementById('f-qty-boxes').value;
  if (boxesVal === '') return;

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
  toast(`${product.name}: ${fmtQtyDisplay({ boxes, unit: product.unit || 'u' })}`);
}

export function saveQty() {
  const product = state.catalog[state.editingCatalogIdx];
  if (!product) return;

  if (document.getElementById('f-qty-boxes').value === '') {
    document.getElementById('f-qty-boxes').focus();
    return;
  }

  _persistQty();
  closeQtyModal();
  renderCatalogView();
}

export function submitQtyModal() {
  const pos = _qtyNavList.indexOf(state.editingCatalogIdx);
  if (pos !== -1 && pos < _qtyNavList.length - 1) {
    navQtyModal(1);
  } else {
    saveQty();
  }
}

export function navQtyModal(delta) {
  const pos = _qtyNavList.indexOf(state.editingCatalogIdx);
  const nextPos = pos + delta;
  if (pos === -1 || nextPos < 0 || nextPos >= _qtyNavList.length) return;

  _persistQty();
  _loadQtyModal(_qtyNavList[nextPos]);
  renderCatalogView();

  const boxesInput = document.getElementById('f-qty-boxes');
  boxesInput.focus();
  boxesInput.select();
}

// ── GAS CONFIG (Admin) ───────────────────────────────────────────────

export function openGasModal() {
  const saved = localStorage.getItem(STORAGE_GAS_URL) || '';
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
    localStorage.setItem(STORAGE_GAS_URL, url);
    toast(t('URL desada correctament'));
  } else {
    localStorage.removeItem(STORAGE_GAS_URL);
    toast(t('URL eliminada'));
  }
  closeGasModal();
}

export function testGasUrl() {
  const url = document.getElementById('f-gas-url').value.trim()
           || localStorage.getItem(STORAGE_GAS_URL) || '';
  if (!url) { toast(t('Enganxa primer la URL')); return; }
  const params = new URLSearchParams({
    id: 0, producte: 'TEST_CONNEXIO', proveidor: '', categoria: 'TEST', codi: '',
  });
  window.open(`${url}?${params}`, '_blank');
  toast(t('Comprova si ha aparegut una fila TEST al full'));
}

// ── NOU PRODUCTE (Comensal) ──────────────────────────────────────────

const UNIT_OPTIONS = ['Ampolla', 'Caixa', 'Sac'];

function _fillProductDataLists() {
  const categories = [...new Set(state.catalog.map(p => p.category).filter(Boolean))].sort();
  const suppliers  = [...new Set(state.catalog.map(p => p.supplier).filter(Boolean))].sort();
  const units      = [...new Set([...UNIT_OPTIONS, ...state.catalog.map(p => p.unit).filter(Boolean)])].sort();
  document.getElementById('dl-np-categories').innerHTML = categories.map(c => `<option value="${esc(c)}">`).join('');
  document.getElementById('dl-np-suppliers').innerHTML  = suppliers.map(s => `<option value="${esc(s)}">`).join('');
  document.getElementById('dl-np-units').innerHTML      = units.map(u => `<option value="${esc(u)}">`).join('');
}

export function openNewProductModal(prefill = {}) {
  state.editingCatalogProductIdx = null;
  document.getElementById('modal-np-title').textContent = t('Nou producte');
  document.getElementById('btn-save-new-product').textContent = t('Afegir al catàleg');
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

  document.getElementById('modal-np-title').textContent = t('Editar producte');
  document.getElementById('btn-save-new-product').textContent = t('Desar canvis');

  _fillProductDataLists();
  document.getElementById('f-np-name').value        = product.name        || '';
  document.getElementById('f-np-category').value    = product.category    || '';
  document.getElementById('f-np-supplier').value    = product.supplier    || '';
  document.getElementById('f-np-unit').value        = product.unit        || '';
  document.getElementById('f-np-minstock').value    = product.minStock    || '';
  document.getElementById('f-np-code').value        = product.code        || '';

  const delBtn = document.getElementById('btn-delete-product');
  if (delBtn) delBtn.hidden = false;

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

  if (category) ensureCategory(category);

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
  toast(t('"{name}" actualitzat', { name }));
}

export function deleteEditProduct() {
  const idx = state.editingCatalogProductIdx;
  if (idx === null) return;
  const product = state.catalog[idx];
  if (!product) return;

  if (!confirm(t('Eliminar "{name}" del catàleg?', { name: product.name }))) return;

  const extraIdx = state.catalogExtra.findIndex(p => p.id === product.id);
  if (extraIdx >= 0) {
    state.catalogExtra.splice(extraIdx, 1);
    localStorage.setItem(STORAGE_CAT_EXTRA, JSON.stringify(state.catalogExtra));
  } else {
    const deletedIds = new Set(JSON.parse(localStorage.getItem(STORAGE_CAT_DELETED) || '[]'));
    deletedIds.add(product.id);
    localStorage.setItem(STORAGE_CAT_DELETED, JSON.stringify([...deletedIds]));
  }

  // Els productes "extra" també s'han enviat al full amb add-producte en crear-los,
  // així que sempre cal demanar l'esborrat al Sheet, sigui o no "extra".
  const gasUrl = getGasUrl();
  if (gasUrl) {
    sendToSheet(gasUrl, new URLSearchParams({ action: 'delete-producte', id: product.id }));
  }
  state.catalog.splice(idx, 1);

  closeNewProductModal();
  renderCatalogView();
  toast(t('"{name}" eliminat del catàleg', { name: product.name }));
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

    if (category) ensureCategory(category);

    state.maxCatalogId++;
    const newId   = state.maxCatalogId;
    const product = { id: newId, code, name, category, supplier, unit, minStock };

    state.catalog.push(product);
    state.catalogExtra.push(product);
    state.catalogReady = true;
    localStorage.setItem(STORAGE_CAT_EXTRA, JSON.stringify(state.catalogExtra));

    const gasUrl = getGasUrl();
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
      sendToSheet(gasUrl, histParams.toString());

      toast(t('"{name}" afegit i enviat al full', { name }));
    } else {
      toast(t('"{name}" desat localment', { name }));
    }

    closeNewProductModal();
    renderCatalogView();
  } catch (err) {
    toast(t('Error al desar: {msg}', { msg: err.message }));
  }
}
