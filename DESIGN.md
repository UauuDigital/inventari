---
name: Inventari Uauu
description: PWA d'inventari discreta i elegant per a les masies d'Uauu Weddings & Events
colors:
  ink-dark: "#221F1E"
  cream-light: "#F2EFEE"
  low-terracotta: "#D4956A"
  danger-red: "#C83030"
  success-green: "#5DBE78"
  warning-amber: "#D4A843"
typography:
  display:
    fontFamily: "'Ogg', Georgia, serif"
    fontSize: "clamp(36px, 7vw, 64px)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "'Ogg', Georgia, serif"
    fontSize: "21px"
    fontWeight: 500
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'Inter', sans-serif"
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: "'Inter', sans-serif"
    fontSize: "9px"
    fontWeight: 400
    letterSpacing: "0.09em"
rounded:
  sm: "10px"
  md: "18px"
  lg: "24px"
  pill: "100px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-fab:
    backgroundColor: "{colors.ink-dark}"
    textColor: "#fff"
    rounded: "{rounded.pill}"
    padding: "13px 22px 13px 18px"
  card-user:
    backgroundColor: "rgba(255,255,255,0.04)"
    rounded: "{rounded.lg}"
    padding: "24px"
  input-search:
    backgroundColor: "rgba(255,255,255,0.07)"
    rounded: "{rounded.pill}"
    padding: "0 16px"
---

# Design System: Inventari Uauu

## 1. Overview

**Creative North Star: "El Quadern de Sala"**

El sistema visual funciona com el quadern discret d'un maître de sala: elegant perquè representa una marca de casaments de luxe, però pensat per usar-se ràpid i sense fricció entre tasques. No hi ha res que cridi l'atenció per si sol — ni gradients, ni ombres apilades, ni decoració. La jerarquia es transmet per tipografia (la serif Ogg reservada per a títols i noms d'entitat) i per contrast tonal (opacitats sobre un fons fosc o clar), mai per ornament afegit.

El sistema rebutja explícitament qualsevol soroll visual que trenqui aquesta discreció: gradients decoratius, ombres múltiples apilades, glassmorphism com a norma, o qualsevol element que faci "shouting" en lloc de "designing".

**Key Characteristics:**
- Serif (Ogg) per a títols i noms d'entitat; sans (Inter) per a tot el text funcional/UI
- Superfícies planes per defecte; l'ombra és l'excepció reservada a accions flotants
- Tema fosc i clar simètrics via tokens (`--dark`, `--white`, `--text-dim`... es capgiren, no es dupliquen)
- Un únic accent decoratiu (terracota `#D4956A`, el rol "low/pendent") mai dominant

## 2. Colors

Paleta contenta: neutres foscos/clars que es capgiren per tema, més un únic accent càlid i tres colors semàntics d'estat (èxit/avís/error) reservats exclusivament per a indicar estoc i estat de comandes, mai decoratius.

### Primary
- **Ink Dark** (`#221F1E`): fons de l'app en tema fosc (per defecte); text principal en tema clar. És el color "de marca" de facto — no hi ha cap accent saturat que el substitueixi.

### Neutral
- **Cream Light** (`#F2EFEE`): fons de l'app en tema clar; text principal en tema fosc.
- **Text Dim** (`rgba(fg,0.45)`): text secundari (metadades, subtítols curts).
- **Text Dimmer** (`rgba(fg,0.32)`): text terciari (placeholders, labels molt discretes) — pujat des de 0.2 aquesta sessió per complir contrast AA.

### Semantic (estat, no decoratiu)
- **Low/Pendent Terracotta** (`#D4956A`): únic accent càlid del sistema; estoc baix pendent i indicadors "encara no enviat".
- **Success Green** (`#5DBE78`): estoc ok, inventari rebut recentment.
- **Warning Amber** (`#D4A843`): inventari una mica desactualitzat.
- **Danger Red** (`#C83030`): estoc crític, eliminació, error.

### Named Rules
**The One Accent Rule.** El terracota (`#D4956A`) és l'únic color "càlid" no-semàntic de tot el sistema. Cap altre accent decoratiu s'hi afegeix; si cal cridar l'atenció sobre alguna cosa que no és un estat d'estoc, es fa amb pes tipogràfic o contrast, no amb color nou.

## 3. Typography

**Display/Title Font:** 'Ogg' (weight 500), amb Georgia i serif com a fallback
**Body Font:** 'Inter' (variable, 100–900), amb sans-serif com a fallback

**Character:** Un aparellament clàssic serif+sans: la Ogg aporta el toc editorial/casaments a títols i noms de producte; la Inter porta tot el pes funcional (formularis, xifres, botons) sense competir per atenció.

### Hierarchy
- **Display** (500, `clamp(36px, 7vw, 64px)`, line-height 1): títols de pantalla completa ("Qui ets?", "Quina masia?").
- **Title** (500, 21px, letter-spacing -0.02em): títol de l'app al header, títols de modal.
- **Body** (400, 14px): text funcional general, noms de producte a llistes denses.
- **Label** (400, 9-11px, letter-spacing 0.06-0.1em, uppercase): etiquetes curtes de navegació i badges — mai frases senceres.

### Named Rules
**The Sentence-Case Rule.** `text-transform: uppercase` només s'aplica a etiquetes d'una o dues paraules (nav, badges, pills). Qualsevol subtítol que sigui una frase completa va en minúscules/frase normal — mai majúscules com a bloc de text llarg.

## 4. Elevation

Sistema pla per defecte: targetes, botons i inputs no tenen `box-shadow` en repòs — la separació visual ve de vores (`border: 1px solid rgba(fg,X)`) i lleugers canvis d'opacitat de fons. L'ombra és l'excepció reservada a elements que realment "floten" per sobre del contingut: el FAB i els modals.

### Shadow Vocabulary
- **fab-float** (`box-shadow: 0 3px 12px rgba(0,0,0,0.35)`): únic ús d'ombra fora de modals; el botó d'acció flotant. Ajustat aquesta sessió (abans `0 4px 28px rgba(0,0,0,0.55)`, massa ample per a la vora fina que l'acompanya).
- **focus-ring** (`box-shadow: 0 0 0 3px rgba(fg,0.12)`): anell de focus per teclat en tots els camps de formulari, afegit aquesta sessió per complir WCAG 2.4.7.

### Named Rules
**The Float-Only Rule.** Si un element no es mou (scroll, drag) ni interromp el flux (FAB, modal, toast), no porta `box-shadow`. La resta de jerarquia visual és tipogràfica o d'opacitat.

## 5. Components

### Buttons
- **Shape:** pill (`border-radius: 100px`) per al FAB i botons d'acció primària; `10-13px` per a botons de formulari secundaris.
- **Primary (FAB):** fons `--dark`, vora `1.5px solid rgba(fg,0.4)`, ombra `fab-float`. Al hover, la vora s'enfosqueix i el gap intern creix (`transition: gap .35s`).
- **Secondary/Ghost:** transparent amb vora `rgba(fg,0.1-0.14)`, fons que guanya opacitat al hover.

### Cards
- **Corner Style:** 18-24px segons context (targetes de catàleg vs. targetes de selecció de rol/masia).
- **Background:** `rgba(fg,0.04-0.07)`, mai blanc/negre sòlid.
- **Shadow Strategy:** cap (regla Float-Only).
- **Border:** `1px solid rgba(fg,0.1-0.14)`.

### Inputs / Fields
- **Style:** fons `rgba(fg,0.06-0.1)`, vora `1-1.5px solid rgba(fg,0.1-0.14)`, forma pill o `10-13px` de radi.
- **Focus:** vora que puja a `rgba(fg,0.5)` + `focus-ring` (afegit aquesta sessió; abans només canviava la vora lleugerament, insuficient per a WCAG).
- **Error:** vora i text en Danger Red, mai només color (sempre acompanyat de missatge o icona).

### Navigation (bottom nav)
- **Style:** barra inferior amb `backdrop-filter: blur(16px)`, pestanyes en Label typography (9px, uppercase), estat actiu marcat només amb `color: var(--white)` (sense fons ni indicador extra).

### FAB (Signature Component)
Element flotant `position: fixed` a baix a la dreta, pill-shaped, amb icona `+` i etiqueta curta ("Nou producte", "Nova comanda"...). És l'únic element amb ombra real del sistema fora de modals — la seva singularitat visual reforça que és l'acció primària de cada pantalla.

## 6. Do's and Don'ts

### Do:
- **Do** reservar la serif Ogg per a títols i noms d'entitat (producte, article, usuari, masia); mai per a llistes denses de dades on cal escaneig ràpid.
- **Do** mantenir el FAB com a únic element amb ombra real fora de modals (regla Float-Only).
- **Do** fer servir els tokens semàntics (`--success`/`--warning`/`--danger`/`--low`) per a qualsevol color d'estat nou; mai hex directes.
- **Do** incloure sempre un `:focus-within`/`:focus` visible (vora + `focus-ring`) en qualsevol camp editable nou.

### Don't:
- **Don't** afegir gradients decoratius, glassmorphism com a norma, o ombres múltiples apilades — trenca la discreció que defineix el sistema.
- **Don't** posar `text-transform: uppercase` a frases senceres (subtítols, descripcions); només a etiquetes curtes d'una-dues paraules.
- **Don't** introduir un segon accent càlid/saturat; el terracota (`#D4956A`) és l'únic.
- **Don't** animar `max-height`, `padding`, `width` o `height` per a transicions d'entrada/sortida; usar `opacity`/`transform` (regla apresa d'un bug real d'aquesta sessió al cercador del header).
