# Inventari Uauu

PWA d'inventari per a masies. Funciona offline i sincronitza amb Google Sheets i Supabase.

## Rols

| Rol | Accés |
|---|---|
| **Comensal** | Catàleg de productes, escàner, resum d'inventari |
| **Coordinador** | Comandes, informes dels comensals |
| **Admin** | Tot l'anterior + importació Excel, gestió d'usuaris |

## Estructura de fitxers

```
src/
  config.js    — Constants, estat global i funcions de localStorage
  helpers.js   — Utilitats pures (uid, esc, fmtNum, toast, parseCSV…)
  auth.js      — Autenticació Supabase, gestió de sessió i pantalles de login
  items.js     — CRUD d'articles i categories, botons de quantitat
  catalog.js   — Catàleg (càrrega, autocomplete, escàner, modal quantitat, GAS)
  orders.js    — CRUD de comandes
  import.js    — Importació d'Excel / CSV
  users.js     — Gestió d'usuaris (Admin), via Edge Function de Supabase
  stats.js     — Vista d'estadístiques, informes del coordinador, enviament d'inventari
  main.js      — Render principal, navegació, delegació d'events, init
  assets/
    css/
      app.css      — Índex d'imports (punt d'entrada)
      base.css     — Variables, fonts, reset, html/body
      layout.css   — Header, barra de cerca, main, FAB, nav, toast, visibilitat per rol
      items.css    — Stats strip, filtres, graella d'articles, targetes, quantitats, estat buit
      modal.css    — Modal overlay, formularis, botons, selector de color
      stats.css    — Vista de categories, stats, enviament d'inventari, informes
      orders.css   — Llista de comandes, targetes, modal d'importació
      screens.css  — Pantalles de login, selector de masia/usuari, pill, breadcrumb, gestió usuaris admin
      catalog.css  — Autocomplete, vista de catàleg, escàner, modal quantitat, configuració GAS
    icons/

supabase/
  functions/
    manage-users/index.ts  — Edge Function per crear/editar/eliminar usuaris
```

## Configuració inicial

### 1. Supabase

1. Crea un projecte a [supabase.com](https://supabase.com).
2. A **Authentication → Users**, crea el primer usuari admin amb `user_metadata`:
   ```json
   { "nom": "El teu nom", "rol": "admin" }
   ```
3. Desplegau la Edge Function:
   ```bash
   supabase functions deploy manage-users
   ```
   O enganxa el contingut de `supabase/functions/manage-users/index.ts` al Dashboard → Edge Functions → New function → `manage-users`.
4. Actualitza `SUPABASE_URL` i `SUPABASE_KEY` a `src/config.js`.

### 2. Google Sheets + Apps Script (GAS)

El full de càlcul té dues pestanyes:
- **Catàleg** (`gid=0`): llista de productes (id, producte, codi, categoria, preu, proveïdor).
- **Inventari** (`gid=1640722155`): registre d'enviaments dels comensals.

Per habilitar l'enviament automàtic d'inventaris i nous productes:
1. Al full, ves a **Extensions → Apps Script** i crea un script que accepti peticions GET/POST.
2. Publica'l com a *Web App* i copia la URL.
3. Des de l'app (Admin → icona d'engranatge), enganxa la URL i fes clic a **Provar connexió**.

## Desplegament

L'app és estàtica — serveix `index.html` des de qualsevol hosting (GitHub Pages, Netlify, Vercel…). No necessita servidor propi.

```bash
# Exemple amb GitHub Pages
git push origin main
```

El service worker (`sw.js`) fa caché de tots els fitxers JS i CSS per a ús offline.
