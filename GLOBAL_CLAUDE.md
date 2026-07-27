\# REGLES GLOBALS - UAUU Weddings \& Events



\## 1. Instruccions de comportament

\- \*\*Llengua:\*\* Parla sempre en català.

\- \*\*Actitud:\*\* Sigues crític i objectiu. No siguis "pilota"; si creus que una idea meva és dolenta o pot causar errors, digues-ho clarament i proposa una alternativa millor.

\- \*\*Seguretat:\*\* Mai inventis dades o implementacions. Si no saps alguna cosa amb certesa, pregunta abans d'actuar.

\- \*\*Execució:\*\* Prohibit fer `git commit` o `git push` automàticament. Sempre has d'esperar a que jo t'ho demani.



\## 2. Gestió de canvis i commits

\- Si fas un canvi rellevant al codi, pregunta: \*"Vols que generi un missatge de commit?"\*.

\- Si la resposta és afirmativa, utilitza obligatòriament aquesta lògica:

&#x20; - \*\*Millora:\*\* \[Descripció breu] — per a noves implementacions o optimitzacions.

&#x20; - \*\*Correcció:\*\* \[Descripció breu] — per a bugs o refactoritzacions de codi erroni.



\## 3. Estàndards tècnics i estructura

\- \*\*Execució:\*\* Tots els projectes han de ser executables mitjançant `npx serve`.

\- \*\*Git:\*\* El fitxer `GLOBAL\_CLAUDE.md` s'ha d'afegir al `.gitignore` de tots els projectes per evitar duplicats innecessaris.

\- \*\*Estructura de carpetes:\*\*

/project-name

&#x20; ├── /assets           # Tot el que no és codi (imatges, logos, vídeos)

&#x20; ├── /css              # Fulls d'estil (main.css, variables.css)

&#x20; ├── /js               # Scripts (app.js, mòduls)

&#x20; ├── /components       # Fragments d'HTML reutilitzables o components JS

&#x20; ├── index.html        # Pàgina d'entrada obligatòria

&#x20; ├── 404.html          # Bona pràctica

&#x20; ├── .gitignore        # Inclou: GLOBAL\_CLAUDE.md, .env, node\_modules/

&#x20; └── README.md



\## 4. Regles de Modularitat (Obligatori)

\- \*\*Prohibit el codi monolític:\*\* Queda prohibit posar tot el codi en un sol fitxer (ex: no facis mai `index.html` amb 2000 línies de CSS i JS).

\- \*\*Criteri de divisió:\*\*

&#x20;   - \*\*HTML:\*\* Divideix per seccions de pàgina (`header.html`, `footer.html`, `main-content.html`).

&#x20;   - \*\*CSS:\*\* Divideix per components (`buttons.css`, `layout.css`, `theme.css`). El `main.css` només ha de servir per importar els altres.

&#x20;   - \*\*JS:\*\* Divideix per funcionalitat (`api-fetch.js`, `ui-handlers.js`, `main.js`).

\- \*\*Arquitectura:\*\* Si un fitxer supera les 200 línies, el teu deure és proposar-me dividir-lo en mòduls més petits abans de seguir escrivint.

\- \*\*Enllaços:\*\* Assegura't sempre que els enllaços entre fitxers siguin relatius i mantinguin l'estructura definida (/assets, /css, /js).



\## 5. Control de Costos i Tokens

\- \*\*Estimació:\*\* Si la tasca implica processar més de 3 fitxers grans o un fitxer de dades superior a 500 línies, has de dir-me: \*"Aquesta tasca és costosa en tokens. Vols continuar?"\* abans de procedir.

\- \*\*Optimització:\*\* Si la resposta pot ser massa extensa, resumeix les dades i ofereix-me la possibilitat d'expandir-les per seccions.

