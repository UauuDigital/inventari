import { state, saveItems, saveCats } from './config.js';
import { uid, esc, toast, parseCSV, findCol } from './helpers.js';
import { ensureCategory } from './items.js';

let _xlsxLoaded = false;

function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement('script');
    s.src     = 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js';
    s.onload  = () => { _xlsxLoaded = true; resolve(window.XLSX); };
    s.onerror = () => reject(new Error("No s'ha pogut carregar la llibreria Excel.\nConnecta't a internet i torna a intentar-ho."));
    document.head.appendChild(s);
  });
}

function rowsToItems(rows) {
  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  const iName  = findCol(headers, ['nom', 'name', 'article', 'producte']);
  const iCat   = findCol(headers, ['categoria', 'category', 'cat']);
  const iQty   = findCol(headers, ['quantitat', 'quantity', 'qty', 'estoc', 'stock']);
  const iUnit  = findCol(headers, ['unitat', 'unit']);
  const iMin   = findCol(headers, ['mínim', 'minim', 'min stock', 'estoc mínim']);

  if (iName === -1) throw new Error('Columna "Nom" no trobada. Comprova les capçaleres.');

  return rows.slice(1)
    .filter(r => String(r[iName] || '').trim())
    .map(r => ({
      name:     String(r[iName] || '').trim(),
      category: String(r[iCat]  || '').trim(),
      quantity: parseFloat(String(r[iQty]   || '0').replace(',', '.')) || 0,
      unit:     String(r[iUnit] || '').trim(),
      minStock: parseFloat(String(r[iMin]   || '0').replace(',', '.')) || 0,
    }));
}

export async function processImportFile(file) {
  let rows;
  if (file.name.toLowerCase().endsWith('.csv')) {
    rows = parseCSV(await file.text());
  } else {
    const XLSX = await loadSheetJS();
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf);
    const ws   = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  }

  state.importRows = rowsToItems(rows);

  const preview    = document.getElementById('import-preview');
  const confirmBtn = document.getElementById('btn-confirm-import');

  if (state.importRows.length === 0) {
    preview.innerHTML = '<p style="padding:12px;font-size:13px;color:rgba(34,31,30,0.5)">Cap fila vàlida trobada.</p>';
    preview.hidden    = false;
    confirmBtn.hidden = true;
    return;
  }

  const cols   = [
    { k: 'name',     l: 'Nom' },
    { k: 'category', l: 'Categoria' },
    { k: 'quantity', l: 'Quantitat' },
    { k: 'unit',     l: 'Unitat' },
  ];
  const sample = state.importRows.slice(0, 5);

  preview.innerHTML = `
    <table class="import-preview-table">
      <thead><tr>${cols.map(c => `<th>${c.l}</th>`).join('')}</tr></thead>
      <tbody>
        ${sample.map(row =>
          `<tr>${cols.map(c => `<td>${esc(String(row[c.k] ?? ''))}</td>`).join('')}</tr>`
        ).join('')}
      </tbody>
    </table>
    <p class="import-count">${state.importRows.length} articles detectats${state.importRows.length > 5 ? ' (mostrant 5)' : ''}</p>
  `;
  preview.hidden        = false;
  confirmBtn.textContent = `Importar ${state.importRows.length} article${state.importRows.length !== 1 ? 's' : ''}`;
  confirmBtn.hidden      = false;
}

export function confirmImport() {
  if (!state.importRows.length) return;
  let created = 0;
  let updated = 0;

  state.importRows.forEach(row => {
    const catId    = ensureCategory(row.category);
    const existing = state.items.find(i => i.name.toLowerCase() === row.name.toLowerCase());
    if (existing) {
      existing.quantity  = row.quantity;
      existing.unit      = row.unit     || existing.unit;
      existing.minStock  = row.minStock || existing.minStock;
      existing.category  = catId;
      existing.updatedAt = new Date().toISOString();
      updated++;
    } else {
      state.items.unshift({
        id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        name: row.name, category: catId,
        quantity: row.quantity, unit: row.unit,
        minStock: row.minStock, notes: '',
      });
      created++;
    }
  });

  saveCats();
  saveItems();
  state.importRows = [];
  closeImportModal();
  toast(`Importació completada: ${created} nous, ${updated} actualitzats`);
}

export function openImportModal() {
  document.getElementById('import-preview').hidden    = true;
  document.getElementById('btn-confirm-import').hidden = true;
  document.getElementById('f-import-file').value      = '';
  document.getElementById('modal-import').classList.add('open');
}

export function closeImportModal() {
  document.getElementById('modal-import').classList.remove('open');
  state.importRows = [];
}
