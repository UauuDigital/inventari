# Inventari Uauu

PWA d'inventari per a masies. Funciona offline i sincronitza amb Google Sheets i Supabase.

## Rols

| Rol | Accés |
|---|---|
| **Comensal** | Catàleg de productes amb cerca, escàner de codi de barres, enviament d'inventari |
| **Coordinador** | Historial d'inventaris, generació de comandes, gestió de comandes, casaments |
| **Admin** | Tot l'anterior + articles, categories, importació Excel, gestió d'usuaris |

## Funcionalitats principals

### Comensal
- Catàleg de productes organitzat per categories amb cerca integrada
- Escàner de codi de barres per trobar productes ràpidament
- Enviament d'inventari amb selecció de masia i comentari opcional

### Coordinador
- **Historial d'inventaris**: llista paginada dels inventaris enviats pels comensals, filtrables per masia
- **Generació de comandes**: a partir d'un inventari, genera una comanda suggerida (mínim 100 u. per producte), amb quantitats editables; en acceptar navega directament a la pestanya de comandes
- **Comandes**: llista de totes les comandes amb filtres (Totes / Pendent / En curs / Rebuda / Cancel·lada); botons per editar, imprimir i eliminar des de cada targeta
- **Casaments**: calendari d'esdeveniments per masia

### Admin
- Tot el del coordinador
- CRUD d'articles i categories
- Importació massiva des d'Excel / CSV
- Gestió d'usuaris (crear, editar, eliminar) via Edge Function de Supabase

## Estructura de fitxers

```
src/
  config.js      — Constants, estat global i funcions de localStorage
  helpers.js     — Utilitats pures (uid, esc, fmtNum, toast, parseCSV…)
  auth.js        — Autenticació Supabase, gestió de sessió i pantalles de login
  items.js       — CRUD d'articles i categories, botons de quantitat
  catalog.js     — Catàleg (càrrega, cerca, autocomplete, escàner, modal quantitat, GAS)
  casaments.js   — Vista de casaments: càrrega des de Sheets, filtres, cerca
  orders.js      — CRUD de comandes; detecció de format estructurat per a taula editable
  import.js      — Importació d'Excel / CSV
  users.js       — Gestió d'usuaris (Admin), via Edge Function de Supabase
  stats.js       — Historial, generació de comandes del coordinador
  estadistiques.js — Gràfics (donut) de comandes per estat i adults per masia
  main.js        — Render principal, navegació, delegació d'events, init
  assets/
    css/
      app.css        — Índex d'imports (punt d'entrada)
      base.css       — Variables, fonts, reset, html/body
      layout.css     — Header, barra de cerca, main, FAB, nav, toast, visibilitat per rol
      items.css      — Stats strip, filtres, graella d'articles, targetes, quantitats
      modal.css      — Modal overlay, formularis, botons (.btn-primary, .btn-secondary, .modal-body…)
      stats.css      — Estadístiques, historial, vista d'edició de comanda (coordinador)
      orders.css     — Llista de comandes, targetes, botons d'acció, taula d'articles
      casaments.css  — Targetes de casaments, filtres, cerca
      screens.css    — Pantalles de login, selector de masia/usuari, gestió d'usuaris admin
      catalog.css    — Autocomplete, vista de catàleg, cerca, escàner, modal quantitat, GAS
      estadistiques.css — Targetes de gràfics donut, llegendes, tooltips

supabase/
  functions/
    manage-users/index.ts  — Edge Function per crear/editar/eliminar usuaris
```

## Vistes (view panels)

| ID | Rol | Descripció |
|---|---|---|
| `view-list` | Admin | Graella d'articles amb filtres i cerca |
| `view-cats` | Admin | Gestió de categories |
| `view-catalog` | Comensal / Coord / Admin | Catàleg per enviar inventari |
| `view-reports` | Coord / Admin | Historial d'inventaris enviats |
| `view-comanda-edit` | Coord | Edició de quantitats per a una comanda nova |
| `view-orders` | Coord / Admin | Llista de comandes |
| `view-casaments` | Coord / Admin | Calendari de casaments |
| `view-users` | Admin | Gestió d'usuaris |
| `view-stats` | Admin | Estadístiques d'estoc |
| `view-estadistiques` | Admin | Gràfics donut (comandes per estat, adults per masia) |

## Format de comandes generades per coordinador

El camp `desc` d'una comanda generada des de l'historial segueix el format:
```
Producte A: 40 u | Producte B: 20 u | Producte C: 5 u
```
`orders.js` detecta automàticament aquest format i mostra una taula editable en lloc del textarea lliure.

## Configuració inicial

### 1. Supabase

1. Crea un projecte a [supabase.com](https://supabase.com).
2. A **Authentication → Users**, crea el primer usuari admin amb `user_metadata`:
   ```json
   { "nom": "El teu nom", "rol": "admin" }
   ```
3. Desplega la Edge Function:
   ```bash
   supabase functions deploy manage-users
   ```
   O enganxa el contingut de `supabase/functions/manage-users/index.ts` al Dashboard → Edge Functions → New function → `manage-users`.
4. Actualitza `SUPABASE_URL` i `SUPABASE_KEY` a `src/config.js`.

### 2. Google Sheets + Apps Script (GAS)

El full de càlcul té les pestanyes següents:
- **Catàleg** (`gid=0`): llista de productes (id, producte, codi, categoria, preu, proveïdor).
- **Inventari** (`gid=1640722155`): registre d'enviaments dels comensals (columnes: id, data, hora, comensal, masia, inventari, comentari).
- **Casaments**: registre d'esdeveniments (actualitza `CASAMENTS_GID` a `src/config.js` amb el gid real).

Per habilitar l'enviament automàtic d'inventaris i nous productes:
1. Al full, ves a **Extensions → Apps Script** i crea un script que accepti peticions GET/POST.
2. Publica'l com a *Web App* i copia la URL.
3. Des de l'app (Admin → icona d'engranatge), enganxa la URL i fes clic a **Provar connexió**.

## Service Worker i caché offline

`sw.js` fa caché de tots els fitxers JS i CSS. Cada cop que es modifica un fitxer cal incrementar la versió:
```js
const CACHE = 'uauu-inv-vXX';  // incrementa XX
```

## Desplegament

L'app és estàtica — serveix `index.html` des de qualsevol hosting (GitHub Pages, Netlify, Vercel…).

```bash
git push origin main
```
