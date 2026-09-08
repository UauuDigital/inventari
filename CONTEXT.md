## Inventari Uauu (inventari-uauu)

**Propòsit**
PWA de gestió d'inventari per a les masies de UAUU Weddings & Events (control de stock, comandes i inventaris per casament), amb sincronització de dades mestres via Google Sheets i autenticació/gestió d'usuaris via Supabase.

**Estat**
Desenvolupament actiu. Branca actual `logicaComandes` (existeix també `coordinador`); desplegament de producció es fa des de `main` (`git push origin main`, README.md:125-131). Versió de Service Worker actual: `uauu-inv-v1.39` (sw.js:1).

**Stack tècnic**
- Llenguatge/framework: JavaScript pur (ES modules natius), sense build ni framework. HTML/CSS/JS estàtics + PWA (manifest.json, service worker).
- Base de dades: Cap BD pròpia. Persistència local via `localStorage` (esquema de claus a `src/config.js`); dades de negoci (catàleg, inventaris, casaments) en un Google Sheet extern; usuaris i sessions gestionats per Supabase Auth (no hi ha taules Postgres pròpies).
- Hosting/desplegament: Hosting estàtic genèric sobre subpath `/inventari/` (README suggereix GitHub Pages, Netlify o Vercel). L'Edge Function (`manage-users`) es desplega per separat a Supabase (`supabase functions deploy manage-users`).
- Gestor de paquets: npm (`package.json` sense dependències; únic script `start: npx serve .`).

**Punt d'entrada**
Servir `index.html` amb qualsevol servidor estàtic (`npx serve .` en local). No requereix build. L'Edge Function backend es desplega amb la CLI de Supabase.

**Interfícies que EXPOSA cap a fora**
- Cap API pròpia exposada pel frontend (és consumidor, no proveïdor).
- Únic backend propi: Edge Function Deno `manage-users` (supabase/functions/manage-users/index.ts), accions `list`/`create`/`update`/`delete` d'usuaris. Autenticació: header `Authorization: Bearer <access_token>` + `apikey: SUPABASE_KEY`; autorització restringida a usuaris amb `user_metadata.rol === 'admin'`. CORS obert (`*`).

**Dependències EXTERNES que aquest projecte CONSUMEIX**
- Supabase (projecte `oeriszeicvdnagohnqvq.supabase.co`): Auth (login, refresh token, canvi de contrasenya) i Edge Function pròpia `manage-users`.
- Google Sheets (full únic, id `1Vc3X0RI50pBOQpJUlLwSywAR9twlG4dSaoqONnRf2Ck`, exportat com a CSV): catàleg, inventari i casaments (3 pestanyes/gid diferents).
- Google Apps Script (`script.google.com/macros/.../exec`): escriptura (append) d'inventaris i nous productes cap al Sheet.
- Open Food Facts API (`world.openfoodfacts.org`): lookup de producte per codi de barres escanejat.
- SheetJS via CDN (`cdn.jsdelivr.net/npm/xlsx`): parseig d'importacions Excel/CSV, carregat dinàmicament.
- `tiquets.uauu.cat`: enllaç estàtic al sistema de tiquets de suport (un altre projecte UAUU), referenciat a `index.html:22` amb paràmetre `?repo=uauudigital-inventari`.

**Dades compartides**
- El Google Sheet de catàleg/inventari/casaments podria ser tocat o llegit per altres eines UAUU si hi tenen accés (és un full compartit, no exclusiu d'aquest repo).
- El projecte Supabase (`oeriszeicvdnagohnqvq`) gestiona autenticació i rols (`comensal`/`coordinador`/`admin`) — si altres projectes UAUU comparteixen el mateix projecte Supabase, comparteixen també la base d'usuaris i els seus rols/metadades.

**Variables d'entorn rellevants per integració**
- `SHEET_APPEND_URL` (`.env.example`) — Nota: no s'utilitza realment via variable d'entorn en temps d'execució (no hi ha build); l'URL real està hardcoded a `src/config.js` i també configurable des de la UI (localStorage `uauu_inv_gas_url`).
- No hi ha altres variables declarades a `.env.example`. La clau anon de Supabase (`SUPABASE_KEY`) i la resta d'URLs externes estan hardcoded a `src/config.js`, no gestionades com a variables d'entorn.
- `SUPABASE_SERVICE_ROLE_KEY` — variable d'entorn de la pròpia Edge Function `manage-users` (mai al client).

**Pendents/TODOs coneguts relacionats amb integració**
No determinat (cap `TODO`/`FIXME`/`XXX`/`HACK` trobat al codi ni al README relacionat amb integracions pendents).
