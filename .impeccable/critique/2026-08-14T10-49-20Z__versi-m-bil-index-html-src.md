---
target: versió mòbil (index.html + src/)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-08-14T10-49-20Z
slug: versi-m-bil-index-html-src
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector/evidence)

## Design Health Score (Nielsen, mode: Operate)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Toast, offline-sync badge i banner de canvis pendents funcionen bé; l'estat de càrrega de l'historial és només un text |
| 2 | Match System / Real World | 3 | Terminologia "Rebut"/"Incidència" i xifres monospace tipus tiquet encaixen amb la metàfora de magatzem |
| 3 | User Control and Freedom | 2 | El menú Rebut/Incidència no té una opció explícita "Pendent" per netejar l'estat — cal saber que tornar a tocar el mateix ítem el desmarca |
| 4 | Consistency and Standards | 3 | Tokens aplicats de forma consistent al llarg del sistema |
| 5 | Error Prevention | 2 | Diversos controls tàctils per sota de 44×44px (28-30px) en zones on és fàcil errar el toc estant apurat |
| 6 | Recognition Rather Than Recall | 3 | Nav amb icona+etiqueta, agrupació per categoria i colors d'estat reconeixibles |
| 7 | Flexibility and Efficiency | 3 | Stepper + input numèric directe serveix tant per toc ràpid com per precisió |
| 8 | Aesthetic and Minimalist Design | 3 | Superfícies planes, sense gradients, minimalisme real al codi (no només declarat) |
| 9 | Error Recovery | 2 | No s'ha pogut confirmar un mòdul centralitzat de missatges d'error traduïts (regla del CLAUDE.md del projecte) |
| 10 | Help and Documentation | 3 | Existeix un modal d'ajuda amb passos específics per rol |
| **Total** | | **27/40** | **Acceptable, al límit de Good** |

## Verdicte d'especificitat de disseny

**Valoració LLM**: El sistema es llegeix com a genuïnament autorat per al "Manifest de Càrrega" — fons paper-carbó fred, Oswald condensat majúscul reservat estrictament als títols, xifres monospace tabulars, motiu de cantonada tallada repetit al FAB. Les anti-referències (crema/terracota/pastilles) s'eviten consistentment. Difícilment es confondria amb una plantilla genèrica.

**Escaneig determinista**: 278 troballes del detector (269 advisory, 9 warning). El 96% són `design-system-font-size`/`design-system-color` (266 troballes) — **però `.impeccable/design.json` és d'un mes abans que `DESIGN.md`** (14/07 vs 14/08), així que aquest gruix s'ha de tractar amb escepticisme fins refer `/impeccable document`; no són 266 defectes reals confirmats.

De les 9 troballes `warning` (les rellevants):
- **Fals positiu confirmat**: `font-family: Georgia`/`Arial` a `stats.css:892,934` — són del document imprès (`.print-comanda`, el PDF de comanda per al proveïdor), no de la UI mòbil. No cal tocar-ho.
- **Real, menor**: 5 troballes `side-tab` (`border-left` de color per masia/categoria a `orders.js:164`, `stats.js:454,643,659,1078`) — patró intencionat de codificació per color, però no documentat explícitament a `DESIGN.md` com a component; val la pena afegir-lo al Do's/Don'ts si es manté.

**Evidència visual**: cap dels dos agents ha pogut verificar visualment amb navegador dins d'aquesta execució (Assessment A ha fet revisió de codi font únicament; Assessment B no ha intentat navegador). No hi ha overlay visible per a l'usuari en aquesta passada — els fixos ja aplicats aquesta sessió (menú `position:fixed`, FAB a 57px) sí que s'han verificat per codi font.

## Impressió general
El sistema visual és sòlid i específic del producte — no és el problema. El problema real són els **objectius tàctils per sota del mínim** en diversos controls d'acció freqüent (el mateix menú Rebut/Incidència que s'acaba de construir aquesta sessió), que xoca directament amb la persona principal (Encarregat, mòbil, apurat) i amb la pròpia regla d'accessibilitat de `PRODUCT.md` ("ja s'han corregit... mida d'objectius tàctils").

## Què funciona bé
1. `_positionHistMenu` (orders.js/stats.js): posicionament defensiu ben pensat — `position:fixed` per escapar `overflow:hidden` de les targetes, clamp de 8px a l'esquerra, tancament en scroll. No és accidental.
2. Jerarquia tipogràfica de dos tipus de lletra amb rols estrictes, real al CSS, no només documentada.
3. Gating per rol centralitzat via `body[data-role]` en lloc de condicionals JS escampats.

## Problemes prioritaris

**[P1] Objectius tàctils per sota de 44×44px en controls d'ús freqüent**
- **On**: `.hist-status-trigger` 28×28 (`orders.css:224`), `.order-edit-btn`/`.order-icon-btn` 30×30 (`orders.css:212,338`), `.icon-btn` 38×38 (`layout.css:83`, i encongit igual a 38×38 sota 420px a `layout.css:68`)
- **Per què importa**: és exactament el control que un Encarregat apurat toca repetidament (marcar Rebut/Incidència a cada producte). Sota 44px, en un dit real (no un cursor de ratolí), el risc de tocar el veí és alt — i el propi `PRODUCT.md` afirma que això "ja s'ha corregit" aquesta sessió, cosa que aquest control desmenteix.
- **Fix**: pujar `.hist-status-trigger` i els icon-btn d'acció (edit/delete) a mínim 40px, idealment 44px, amb prou espai entre ells.
- **Comanda suggerida**: `/impeccable adapt` o `/impeccable audit` de seguiment després del fix

**[P2] El menú Rebut/Incidència no té una opció visible per netejar l'estat**
- **On**: `orders.js`/`stats.js`, marcat de `.hist-status-menu-item`
- **Per què importa**: tocar l'opció ja activa la desmarca (inferit de `_toggleHistItemReceived`), però no hi ha cap pista textual/visual d'això. Un usuari apurat (Casey) pot pensar que no ha funcionat; un usuari nou (Jordan) no ho descobrirà mai sense ajuda.
- **Fix**: afegir una tercera opció "Pendent" explícita, o un check/etiqueta que digui "toca per desmarcar".
- **Comanda suggerida**: `/impeccable clarify`

**[P2] `_positionHistMenu` no fa clamp vertical**
- **On**: `stats.js`, funció `_positionHistMenu`
- **Per què importa**: fa clamp horitzontal (mínim 8px esquerra) però no vertical — un producte prop del final d'una llista llarga pot obrir un menú tallat per sota del plec, sota el FAB o el nav.
- **Fix**: si `rect.bottom + 4 + menuHeight > innerHeight`, obrir cap amunt del botó en lloc de cap avall.
- **Comanda suggerida**: `/impeccable harden`

**[P3] Color hex directe fora de tokens**
- **On**: `report-order-badge` amb `#f2b544` (segons Assessment A)
- **Per què importa**: viola la regla pròpia de `DESIGN.md` ("Don't... hex directes"); és cosmètic però és exactament el tipus de drift que `DESIGN.md` vol evitar.
- **Fix**: substituir per `var(--low)` o `var(--warning)`.
- **Comanda suggerida**: `/impeccable polish`

**[P3] `@font-face` d'Inter trencat (petició 404 a cada càrrega)**
- **On**: `base.css:1-6`, `src: url('../../../../catalegs-web/fonts/...')` apunta fora del projecte
- **Per què importa**: Inter només és fallback darrere d'Ogg/Oswald, així que no és visible, però és una petició de xarxa fallida en cada càrrega — soroll i pes innecessari, especialment rellevant en mòbil/xarxa lenta.
- **Fix**: eliminar el `@font-face` (Inter ja existeix com a font de sistema als navegadors moderns, no cal carregar-la) o corregir la ruta.
- **Comanda suggerida**: `/impeccable optimize`

## Banderes vermelles per persona

**Casey (mòbil, apurat, interrupcions constants)**: els objectius tàctils de 28-30px són el risc més concret — cada mis-tap li costa refer la marca. També: si el menú s'obre a prop del final de la llista i queda tallat (P2 clamp vertical), és exactament el moment on abandonaria la tasca a mitges.

**Jordan (primer cop)**: el comportament de "tocar per desmarcar" al menú d'estat és indescobrible sense ajuda explícita — caldria confirmar que el modal d'ajuda ho cobreix.

## Observacions menors
- `.toast` fa servir `bottom: calc(66px + safe-bot + 12px)` mentre el FAB ja s'ha corregit a `57px` — no és un bug (el toast ha de quedar per sobre del FAB), però és un parell de números màgics que convindria revisar junts perquè no se separin amb futurs canvis.
- Els 5 `side-tab` (border-left de color) són un patró intencionat però no documentat explícitament com a component a `DESIGN.md`.

## Preguntes a considerar
- Els controls de 28-30px van ser una decisió deliberada per encabir més accions per fila, o és deute visual acumulat? Si cal mantenir la densitat, es pot compensar amb més espai entre controls en lloc de mida.
- Té sentit que el menú Rebut/Incidència tingui una tercera opció "Pendent", o el disseny prefereix mantenir-lo a només 2 opcions i confiar en la formació de l'usuari?
