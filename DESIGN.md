---
name: Inventari Uauu
description: PWA d'inventari — el full de pull d'un estilista d'esdeveniments, no una llibreta de casaments
colors:
  ink: "#1B1A1F"
  paper: "#E3E6E7"
  low-brass: "#A6763A"
  danger-brick: "#A6392C"
  success-forest: "#4B8A5E"
  warning-ochre: "#C2A542"
typography:
  display:
    fontFamily: "'Inter', sans-serif"
    fontSize: "clamp(34px, 6.4vw, 58px)"
    fontWeight: 800
    lineHeight: 0.96
    letterSpacing: "-0.02em"
    textTransform: uppercase
  title:
    fontFamily: "'Inter', sans-serif"
    fontSize: "21px"
    fontWeight: 500
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'Inter', sans-serif"
    fontSize: "14px"
    fontWeight: 400
  numeric:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', monospace"
    fontWeight: 600
    fontVariantNumeric: tabular-nums
  label:
    fontFamily: "'Inter', sans-serif"
    fontSize: "9px"
    fontWeight: 400
    letterSpacing: "0.09em"
rounded:
  sm: "3px"
  md: "6px"
  lg: "6px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-fab:
    backgroundColor: "{colors.ink}"
    textColor: "#fff"
    clipPath: "cut-corner-12"
    padding: "13px 22px 13px 20px"
  card-user:
    backgroundColor: "rgba(27,26,31,0.04)"
    rounded: "{rounded.lg}"
    padding: "24px"
  input-search:
    backgroundColor: "rgba(27,26,31,0.07)"
    rounded: "{rounded.sm}"
    padding: "0 16px"
---

# Design System: Inventari Uauu

## 1. Overview

**Creative North Star: "El Full de Pull"**

Substitueix l'anterior "Quadern de Sala" (crema + serif + terracota, massa a prop del clúster genèric d'interfícies fetes per IA). El nou sistema funciona com el full de pull que un estilista d'esdeveniments porta el matí de la càrrega: un tiquet de treball per comptar i moure estoc, no una pàgina de record. Continua sense soroll visual — sense gradients, sense ombres apilades, sense decoració — però ara ho diu amb un altre vocabulari: fons paper-carbó fred (no crema càlida), un únic accent de llautó/coure (no terracota), xifres en monospace tabular com un tiquet imprès, i cantonades gairebé rectes (no pastilles).

**Key Characteristics:**
- Inter com a única família tipogràfica: pes 800 i majúscules per als títols de pantalla completa, pes normal per a la resta — la jerarquia ve del pes i el tracking, no d'una serif afegida.
- Xifres (quantitats, totals) sempre en monospace tabular — l'única desviació respecte a Inter, i deliberada: fa que els números es llegeixin com un tiquet, no com a prosa.
- Radi de cantonada gairebé nul (3-6px) a tot arreu; cap element "pastilla". El FAB porta el motiu signatura: una cantonada tallada en diagonal, com el tros arrencat d'un tiquet.
- Superfícies planes per defecte; l'ombra és l'excepció reservada a accions flotants.
- Un únic accent decoratiu (llautó `#A6763A`, el rol "low/pendent") mai dominant.

## 2. Colors

Paleta contenta: neutres freds que es capgiren per tema, més un únic accent de metall càlid i tres colors semàntics d'estat (èxit/avís/error), reservats exclusivament per indicar estoc i estat de comandes, mai decoratius.

### Primary
- **Ink** (`#1B1A1F`): text principal; fons de qualsevol superfície "paper" fixa (modals). És el color "de marca" de facto — no hi ha cap accent saturat que el substitueixi.

### Neutral
- **Paper** (`#E3E6E7`): fons de l'app — gris-blau pàl·lid de paper carbó, explícitament no crema.
- **Text Dim** (`rgba(ink,0.55)`): text secundari (metadades, subtítols curts).
- **Text Dimmer** (`rgba(ink,0.34)`): text terciari (placeholders, labels molt discretes).

### Semantic (estat, no decoratiu)
- **Low/Pendent Brass** (`#A6763A`): únic accent del sistema; estoc baix pendent i indicadors "encara no enviat". Llautó/coure, no terracota-rosat.
- **Success Forest** (`#4B8A5E`): estoc ok, inventari rebut recentment.
- **Warning Ochre** (`#C2A542`): inventari una mica desactualitzat.
- **Danger Brick** (`#A6392C`): estoc crític, eliminació, error.

### Named Rules
**The One Accent Rule.** El llautó (`#A6763A`) és l'únic color "càlid" no-semàntic de tot el sistema. Cap altre accent decoratiu s'hi afegeix; si cal cridar l'atenció sobre alguna cosa que no és un estat d'estoc, es fa amb pes tipogràfic o contrast, no amb color nou.

**The No-Cream Rule.** El fons de l'app és fred (gris-blau paper-carbó), mai crema/marfil. Si un component nou necessita un fons "paper", parteix de `--paper` (`#E3E6E7`), no d'un blanc/crema afegit.

## 3. Typography

**Font:** 'Inter' (variable, 100–900) arreu — display, títols i cos. Cap segona família per a text.
**Numeric font:** pila monospace del sistema (`ui-monospace, SF Mono, Cascadia Mono, Roboto Mono, monospace`) — reservada exclusivament a xifres de quantitat/total.

**Character:** Una sola família portant tot el pes, diferenciada per pes i tracking en lloc d'un aparellament serif+sans; les xifres es desmarquen amb monospace tabular, evocant un tiquet imprès més que una llibreta.

### Hierarchy
- **Display** (800, `clamp(34px, 6.4vw, 58px)`, majúscules, line-height 0.96): títols de pantalla completa ("Qui ets?", "Quina masia?").
- **Title** (500, 21px, letter-spacing -0.02em): títol de l'app al header, títols de modal.
- **Body** (400, 14px): text funcional general, noms de producte a llistes denses.
- **Numeric** (600, monospace, tabular-nums): qualsevol xifra de quantitat, total o comptador (`.stat-value`, `.qty-value`, `.coord-order-qty`, `.stats-total-val`).
- **Label** (400, 9-11px, letter-spacing 0.06-0.1em, uppercase): etiquetes curtes de navegació i badges — mai frases senceres.

### Named Rules
**The Sentence-Case Rule.** `text-transform: uppercase` només s'aplica a etiquetes d'una o dues paraules (nav, badges, pills) i al Display. Qualsevol subtítol que sigui una frase completa va en minúscules/frase normal — mai majúscules com a bloc de text llarg.

**The Tabular-Numerals Rule.** Qualsevol xifra que representi una quantitat comptada (no un preu de catàleg en prosa) porta `font-family: var(--font-mono)` i `font-variant-numeric: tabular-nums`.

## 4. Elevation

Sistema pla per defecte: targetes, botons i inputs no tenen `box-shadow` en repòs — la separació visual ve de vores (`border: 1px solid rgba(ink,X)`) i lleugers canvis d'opacitat de fons. L'ombra és l'excepció reservada a elements que realment "floten" per sobre del contingut: el FAB i els modals.

### Shadow Vocabulary
- **fab-float** (`box-shadow: 0 3px 12px rgba(0,0,0,0.35)`): únic ús d'ombra fora de modals; el botó d'acció flotant.
- **focus-ring** (`box-shadow: 0 0 0 3px rgba(ink,0.12)`): anell de focus per teclat en tots els camps de formulari.

### Named Rules
**The Float-Only Rule.** Si un element no es mou (scroll, drag) ni interromp el flux (FAB, modal, toast), no porta `box-shadow`. La resta de jerarquia visual és tipogràfica o d'opacitat.

## 5. Components

### Buttons
- **Shape:** gairebé recta arreu (`--r-pill: 3px`); el FAB porta el motiu signatura de cantonada tallada (`clip-path`, vegeu més avall) en lloc d'un radi.
- **Primary (FAB):** fons `--dark`, vora `1.5px solid rgba(fg,0.4)`, ombra `fab-float`, cantonada superior-esquerra tallada en diagonal 12px. Al hover, la vora s'enfosqueix i el gap intern creix (`transition: gap .35s`).
- **Secondary/Ghost:** transparent amb vora `rgba(fg,0.1-0.14)`, fons que guanya opacitat al hover.

### Cards
- **Corner Style:** `--r-card: 6px` arreu — cantonada de "cartolina tallada", no de targeta de software genèrica.
- **Background:** `rgba(fg,0.04-0.07)`, mai blanc/negre sòlid.
- **Shadow Strategy:** cap (regla Float-Only).
- **Border:** `1px solid rgba(fg,0.1-0.14)`.

### Inputs / Fields
- **Style:** fons `rgba(fg,0.06-0.1)`, vora `1-1.5px solid rgba(fg,0.1-0.14)`, radi `--r-pill` (3px) — mai forma de pastilla.
- **Focus:** vora que puja a `rgba(fg,0.5)` + `focus-ring`.
- **Error:** vora i text en Danger Brick, mai només color (sempre acompanyat de missatge o icona).

### Navigation (bottom nav)
- **Style:** barra inferior amb `backdrop-filter: blur(16px)`, pestanyes en Label typography (9px, uppercase), estat actiu marcat només amb `color: var(--white)` (sense fons ni indicador extra).

### FAB (Signature Component)
Element flotant `position: fixed` a baix a la dreta, amb icona `+` i etiqueta curta ("Nou producte", "Nova comanda"...). Porta el motiu signatura de tot el sistema: `clip-path: polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)`, una cantonada tallada en diagonal que evoca el tros que s'arrenca d'un tiquet de comanda. És l'únic element amb ombra real del sistema fora de modals i l'únic amb la cantonada tallada — la doble singularitat reforça que és l'acció primària de cada pantalla.

## 6. Do's and Don'ts

### Do:
- **Do** fer servir monospace tabular per a qualsevol xifra de quantitat/total nova; mai Inter per a números que l'usuari ha de comptar ràpid.
- **Do** mantenir el FAB com a únic element amb ombra real i amb la cantonada tallada (regles Float-Only + signatura).
- **Do** fer servir els tokens semàntics (`--success`/`--warning`/`--danger`/`--low`) per a qualsevol color d'estat nou; mai hex directes.
- **Do** incloure sempre un `:focus-within`/`:focus` visible (vora + `focus-ring`) en qualsevol camp editable nou.

### Don't:
- **Don't** afegir gradients decoratius, glassmorphism com a norma, o ombres múltiples apilades — trenca la discreció que defineix el sistema.
- **Don't** tornar a introduir una segona família tipogràfica (serif o altra) ni un fons crema/marfil — és exactament el que aquest redisseny substitueix.
- **Don't** fer servir `border-radius` per sobre de 6px en cap component nou; si cal distingir un element, fes-ho amb el motiu de cantonada tallada (només al FAB) o amb pes tipogràfic/color, no amb més radi.
- **Don't** introduir un segon accent càlid/saturat; el llautó (`#A6763A`) és l'únic.
- **Don't** posar `text-transform: uppercase` a frases senceres (subtítols, descripcions); només a etiquetes curtes d'una-dues paraules i al Display.
- **Don't** animar `max-height`, `padding`, `width` o `height` per a transicions d'entrada/sortida; usar `opacity`/`transform`.
