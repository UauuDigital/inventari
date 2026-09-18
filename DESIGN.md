---
name: Inventari Uauu
description: PWA d'inventari — el manifest de càrrega d'una sala de material, no una llibreta de casaments
colors:
  paper-carbo: "#E3E6E7"
  paper: "#ffffff"
  ink: "#1B1A1F"
  danger-red: "#C23B33"
  success-green: "#3C8F5E"
  warning-amber: "#A9790A"
typography:
  display:
    fontFamily: "'Oswald', 'Inter', sans-serif"
    fontSize: "clamp(38px, 7.2vw, 64px)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "0.005em"
    textTransform: uppercase
  title:
    fontFamily: "'Oswald', 'Inter', sans-serif"
    fontSize: "21px"
    fontWeight: 500
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Ogg', 'Inter', sans-serif"
    fontSize: "14px"
    fontWeight: 400
  numeric:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', monospace"
    fontWeight: 600
    fontVariantNumeric: tabular-nums
  label:
    fontFamily: "'Ogg', 'Inter', sans-serif"
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
    textColor: "{colors.paper}"
    clipPath: "cut-corner-12"
    padding: "13px 22px 13px 20px"
  card-user:
    backgroundColor: "rgba(27,26,31,0.05)"
    rounded: "{rounded.lg}"
    padding: "24px"
  input-search:
    backgroundColor: "rgba(27,26,31,0.07)"
    rounded: "{rounded.sm}"
    padding: "0 16px"
---

# Design System: Inventari Uauu

## 1. Overview

**Creative North Star: "El Manifest de Càrrega"**

Substitueix l'anterior "Full de Pull" només en el motiu (sala de material en lloc de full d'estilista); manté el mateix fons paper-carbó fred original (`#E3E6E7`, mai crema càlid). Títols grans en Oswald condensat majúscul —com el text estergit d'una caixa de transport— i xifres en monospace tabular com un tiquet imprès. Cap accent de color decoratiu: l'acció primària (FAB) es marca en negre/ink sòlid, amb pes i contrast, no amb un color cridaner. Sense gradients, sense ombres apilades, sense decoració gratuïta.

**Key Characteristics:**
- Dues famílies tipogràfiques amb rols estrictes: **Oswald** (condensat, majúscules) només per a títols de pantalla i de modal; **Ogg** (font corporativa de l'empresa) per a tota la resta del text.
- Xifres (quantitats, totals) sempre en monospace tabular.
- Radi de cantonada gairebé nul (3-6px) a tot arreu. El motiu signatura —cantonada tallada en diagonal, com el tros arrencat d'una etiqueta de magatzem— apareix al FAB i, en miniatura, com a marca d'estoc pendent a les targetes.
- Superfícies planes per defecte; l'ombra és l'excepció reservada a accions flotants.
- Cap accent de color decoratiu: el FAB és negre/ink sòlid, no un color saturat.

## 2. Colors

Kraft clar constant + etiquetes de paper una mica més clares, negre/ink com a únic "accent" (per pes i contrast, no per color), més tres colors semàntics d'estat (èxit/avís/error), reservats exclusivament per indicar estoc i estat de comandes, mai decoratius.

### Primary
- **Paper-carbó** (`#E3E6E7`, token `--dark`/`--cream`): fons de l'app i de les superfícies "paper" (modals) — gris-blau pàl·lid, explícitament no crema.
- **Ink** (`#1B1A1F`, token `--ink`/`--white`): text principal i únic "accent" del sistema — el FAB és ink sòlid, no un color saturat.

### Neutral
- **Text** (`#1B1A1F`): text principal, l'ink de tot el sistema.
- **Text Dim** (`rgba(ink,0.58)`): text secundari (metadades, subtítols curts).
- **Text Dimmer** (`rgba(ink,0.36)`): text terciari (placeholders, labels molt discretes).

### Semantic (estat, no decoratiu)
- **Low/Pendent Amber** (`#A9790A`, token `--low`): estoc baix pendent — reutilitza el mateix to que Warning per no afegir un color nou.
- **Success Green** (`#3C8F5E`): estoc ok, inventari rebut recentment.
- **Warning Amber** (`#A9790A`): inventari una mica desactualitzat.
- **Danger Red** (`#C23B33`): estoc crític, eliminació, error.

### Named Rules
**The No-Accent Rule.** El sistema no té cap color d'accent decoratiu. El FAB i qualsevol èmfasi d'acció primària es marquen en negre/ink sòlid (pes i contrast), no amb un color saturat nou. Els únics colors fora de l'escala neutra són els tres semàntics d'estat.

**The No-Cream Rule.** El fons de l'app és fred (gris-blau paper-carbó, `#E3E6E7`), mai crema/marfil càlid.

## 3. Typography

**Display/Title font:** 'Oswald' (condensat, variable, 200–700) — reservada exclusivament a títols de pantalla completa i capçaleres de modal. És l'única desviació respecte a Ogg en tot el sistema, i deliberada: dona a les capçaleres un aire d'etiqueta de magatzem estergida.
**Body font:** 'Ogg' (Medium, 500) — font corporativa d'UAUU, per a tota la resta de text (cos, labels, botons, navegació).
**Numeric font:** pila monospace del sistema — reservada exclusivament a xifres de quantitat/total.

### Hierarchy
- **Display** (Oswald 700, `clamp(38px, 7.2vw, 64px)`, majúscules, line-height 0.92): títols de pantalla completa ("Qui ets?", "Quina masia?").
- **Title** (Oswald 500, 21px): títol de l'app al header, títols de modal.
- **Body** (Ogg 400, 14px): text funcional general, noms de producte a llistes denses.
- **Numeric** (600, monospace, tabular-nums): qualsevol xifra de quantitat, total o comptador.
- **Label** (Ogg 400, 9-11px, letter-spacing 0.06-0.1em, uppercase): etiquetes curtes de navegació i badges — mai frases senceres.

### Named Rules
**The Two-Font Rule.** Oswald només s'usa allà on la CSS ja fa servir `var(--font-serif)` (títols de pantalla i de modal). Cap altre lloc del sistema hi recorre; tot el text funcional és Ogg.

**The Sentence-Case Rule.** `text-transform: uppercase` només s'aplica a etiquetes d'una o dues paraules (nav, badges, pills) i al Display. Qualsevol subtítol que sigui una frase completa va en minúscules/frase normal.

**The Tabular-Numerals Rule.** Qualsevol xifra que representi una quantitat comptada porta `font-family: var(--font-mono)` i `font-variant-numeric: tabular-nums`.

## 4. Elevation

Sistema pla per defecte: targetes, botons i inputs no tenen `box-shadow` en repòs — la separació visual ve de vores (`border: 1px solid rgba(ink,X)`) i lleugers canvis d'opacitat de fons. L'ombra és l'excepció reservada a elements que realment "floten": el FAB i els modals.

### Named Rules
**The Float-Only Rule.** Si un element no es mou (scroll, drag) ni interromp el flux (FAB, modal, toast), no porta `box-shadow`.

## 5. Components

### Buttons
- **Shape:** gairebé recta arreu (`--r-pill: 3px`); el FAB porta el motiu signatura de cantonada tallada.
- **Primary (FAB):** fons sòlid `--ink`, text `--paper`, ombra neutra, cantonada superior-esquerra tallada en diagonal 12px.
- **Secondary/Ghost:** transparent amb vora `rgba(fg,0.1-0.14)`, fons que guanya opacitat al hover.

### Cards
- **Corner Style:** `--r-card: 6px` arreu.
- **Background:** `rgba(fg,0.04-0.07)`, mai blanc/negre sòlid.
- **Signature accent:** targetes en estat "estoc baix" porten una petita etiqueta triangular ambre tallada a la cantonada superior-dreta (mateix motiu que el FAB, en miniatura).

### Inputs / Fields
- **Style:** fons `rgba(fg,0.06-0.1)`, vora `1-1.5px solid rgba(fg,0.1-0.14)`, radi `--r-pill` (3px).
- **Focus:** vora que puja a `rgba(fg,0.5)` + anell de focus.
- **Error:** vora i text en Danger Red, sempre acompanyat de missatge o icona.

### Navigation (bottom nav)
- **Style:** barra inferior amb `backdrop-filter: blur(16px)`, pestanyes en Label typography, estat actiu marcat només amb `color: var(--white)`.

### FAB (Signature Component)
Element flotant `position: fixed` a baix a la dreta. Porta el motiu signatura de tot el sistema: `clip-path: polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)`, fons ink sòlid amb text paper — l'únic element amb ombra real del sistema fora dels modals.

## 6. Do's and Don'ts

### Do:
- **Do** fer servir monospace tabular per a qualsevol xifra de quantitat/total nova.
- **Do** reservar Oswald exclusivament a `var(--font-serif)` (títols de pantalla/modal); Ogg a tota la resta.
- **Do** fer servir els tokens semàntics (`--success`/`--warning`/`--danger`/`--low`) per a qualsevol color d'estat nou; mai hex directes.
- **Do** incloure sempre un `:focus-within`/`:focus` visible en qualsevol camp editable nou.

### Don't:
- **Don't** afegir gradients decoratius, glassmorphism com a norma, o ombres múltiples apilades.
- **Don't** introduir una tercera família tipogràfica ni tornar a un fons crema/marfil càlid.
- **Don't** fer servir `border-radius` per sobre de 6px en cap component nou.
- **Don't** introduir cap accent de color decoratiu; l'èmfasi es fa amb negre/ink, pes tipogràfic o contrast.
- **Don't** posar `text-transform: uppercase` a frases senceres.
- **Don't** animar `max-height`, `padding`, `width` o `height` per a transicions; usar `opacity`/`transform`.
