rec

# CLAUDE.md

## Versionat

Cada vegada que facis un canvi de codi en aquest projecte, incrementa la versió del service worker a `sw.js`:

```js
const CACHE = 'uauu-inv-v77';
```

Puja el número (p. ex. `v77` → `v78`) en cada canvi, encara que sigui petit. Aquest número és el que es mostra a l'usuari a dalt a la dreta de la PWA (veure `showAppVersion()` a `src/main.js`) i el que força la neteja de la cache del service worker, així que ha de reflectir sempre l'última versió desplegada.
