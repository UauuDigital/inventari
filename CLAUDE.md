rec

# CLAUDE.md

## Versionat

Cada vegada que facis un canvi de codi en aquest projecte, incrementa la versió del service worker a `sw.js`:

```js
const CACHE = 'uauu-inv-v0.99';
```

Puja el número decimal (p. ex. `v0.99` → `v0.100` → `v0.101`...) en cada canvi, encara que sigui petit. El prefix `0.` es manté fix — NO es passa a `v1` llevat que se t'indiqui explícitament que facis aquest canvi. Aquest número és el que es mostra a l'usuari a dalt a la dreta de la PWA (veure `showAppVersion()` a `src/main.js`) i el que força la neteja de la cache del service worker, així que ha de reflectir sempre l'última versió desplegada.
