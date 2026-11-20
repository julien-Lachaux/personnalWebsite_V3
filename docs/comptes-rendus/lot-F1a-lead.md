# Lot F1a : fondations visuelles du front (lead-architecte)

Date : 20 novembre 2026. Branche `lot/F1-design-system` (worktree
`.claude/worktrees/lot-F1-design-system`), créée depuis `develop` (b5bf2e4, F0 fusionné).
Isolation : `.env` racine `COMPOSE_PROJECT_NAME=siteperso-v3-f1`, ports 5852/5853,
`PLAYWRIGHT_PORT=5854`, `WEB_E2E_PORT=5855`. Aucune autorisation de configuration protégée utilisée
ni nécessaire. Rien de modifié dans `apps/api/`, `db/`, `packages/contracts/`, `app/domain/`.

## Fait

| Ticket | Livré | Preuve |
|---|---|---|
| F1-01 | `app/assets/css/tokens.css` : couleurs du handoff à l'identique (sombre, clair, contraste renforcé), polices, graisses, tailles du texte en rem (`--font-size-*` = px du handoff / 16), rayons, bordures, espacements, tailles, courbes et durées ; repli sur `prefers-color-scheme` sans `data-theme` ; `color-scheme` par thème. `app/assets/css/base.css` : reset minimal, taille racine `calc(100% * var(--text-scale))` (100 % du navigateur, jamais de px ni de `zoom`), fond et texte sur `<html>`, liens (accent, soulignement gardé), `:focus-visible` 2 px accent décalé de 2 px, `.skip-link` (hors écran, visible au focus, `--on` sur `--accent`), `.visually-hidden`, espacement du texte (interligne 1,5, lettres 0,12 em, mots 0,16 em, sur chaque élément), soulignement forcé des liens. Interface des attributs racine documentée en tête de `tokens.css` et dans CLAUDE.md (section Front) | `tokens.spec.ts` (21 tests) ; `design-system.e2e.ts` (voir plus bas) |
| F1-02 | Space Grotesk (variable 300–700), JetBrains Mono (variable 100–800, romain), Atkinson Hyperlegible (400 et 700, romain et italique), sous-ensembles `latin` et `latin-ext` découpés par `unicode-range`, `font-display: swap`, dans `public/fonts/<police>/` avec `OFL.txt` ; `app/assets/css/fonts.css`. Seul le sous-ensemble latin de Space Grotesk est préchargé (`nuxt.config.ts`, `crossorigin`, même URL que le `@font-face`) ; Atkinson n'est jamais préchargée et ne se télécharge que sous `data-font="lisible"` | e2e : sur la page par défaut, une seule requête de police (`space-grotesk-latin-wght-normal.woff2`, préchargement réutilisé), 8 faces Atkinson `unloaded`, aucune requête JetBrains Mono ; après `data-font="lisible"`, requête `atkinson-hyperlegible-latin-400-normal.woff2`, `font-family` du corps = Atkinson ; `document.fonts.load('1rem "JetBrains Mono"')` télécharge le seul sous-ensemble latin ; aucune réponse ≥ 400, aucune requête hors de l'origine du site |
| F1-06 (global) | Durées `--dur-tile` 550 ms, `--dur-accordion` 320, `--dur-drawer` 280, `--dur-cta-bar` 260, `--dur-press` 160, courbes `--ease-tile`, `--ease-ui`, `--ease-press`, `--slide-distance` 64 px ; ramenées à 0,01 ms sous `data-motion="reduit"` ou `prefers-reduced-motion: reduce` (sauf `data-motion="normal"`) ; filet global (`transition-duration`, `animation-duration` 0,01 ms, `transition-delay` 0, `animation-iteration-count` 1, `scroll-behavior: auto`) pour ce qui n'utiliserait pas les variables | `tokens.spec.ts` : chaque `--dur-*` de `:root` vaut 0,01 ms dans les deux blocs réduits ; e2e : `--dur-tile` 550 ms puis 0,01 ms sous `data-motion="reduit"`, une transition de 2 s posée en ligne tombe à 0,01 ms ; système réduit : 0,01 ms par défaut, 550 ms et 2 s sous `data-motion="normal"` |
| Contrastes | Test unitaire `tokens.spec.ts` : rapport WCAG 2.2 (luminance relative, seuil 0,04045, composition alpha des fonds translucides, sans arrondi) calculé depuis `tokens.css` dans les quatre palettes : 39 couples texte/fond ≥ 4,5:1 (chaque couleur de texte `text`, `muted`, `accent`, `violet`, `neon`, `li` sur chaque fond opaque `bg`, `card`, `top`, `bar`, `field`, plus `on`/`accent`, pastille senior `sen-fg`/`sen-bg`, néon, onglet actif `accent-bg`, `violet-bg`, `li-bg`) et 7 indicateurs d'interface ≥ 3:1 (`accent` sur chaque fond : contour de focus et état actif ; bordures `neon` et `li` sur `card`). Tous passent : aucun couple texte du handoff n'échoue. Témoins : 21:1 noir/blanc, #767676 sur blanc 4,54, #777777 < 4,5, détection d'un couple sous le seuil | `pnpm --filter @siteperso/web test` |
| Page provisoire | `pages/index.vue` : mise en page minimale à partir des tokens (largeur `--content-max`, gouttière, titre `--font-size-h1-portable`) ; fond, police et focus globaux | smoke F0 + `design-system.e2e.ts` |

Fidélité au handoff (`tokens.spec.ts`) : les palettes de `tokens.css` sont comparées sous forme
canonique (couleurs en rgba, nombres réécrits) aux rôles de `design-tokens.json` (thèmes et
`highContrast`), les constantes du `:root` du `tokens.css` du handoff, les tailles du texte, graisses,
rayons, espacements, tailles et animations du JSON ; le bloc de repli système sombre est comparé au
bloc `data-theme="sombre"` ; aucune taille de texte en px dans les `.css` et `.vue` d'`app/`.

Parcours Playwright `test/design-system.e2e.ts` (nouveau fichier, 22 tests × 7 tailles d'écran = 154) :
repli sur le schéma du système (fond, texte, accent du handoff, police Space Grotesk) en clair et en
sombre ; `data-theme` l'emporte sur le système, `data-contrast="renforce"` donne les couleurs
`highContrast`, `color-scheme` suit ; axe WCAG 2.2 AA sans violation sur `/` et `/en` dans les quatre
palettes (`color-contrast` dans les règles passées) ; focus au clavier `solid 2px`, décalage `2px`,
couleur accent (deux schémas) ; lien d'évitement hors de l'écran puis entièrement visible au focus ;
`.visually-hidden` (1 × 1 px, `clip-path: inset(50%)`, toujours trouvé par rôle) ; taille racine 16,
18,4, 20,8 px et titre 40, 46, 52 px ; espacement ; soulignement forcé ; polices ; mouvement.

Sondes (retirées) : `--muted` clair altéré et une durée réduite à 1 ms → 3 tests unitaires en échec
(fidélité, durées, 5 couples sous 4,5:1) ; `outline-offset: 0` et `font-family` du corps sur
Atkinson → 5 parcours en échec (repli de thème ×2, focus ×2, polices).

## Interface des attributs racine (pour F2b `preferences` et F3)

Seuls ces attributs de `<html>` relient les préférences à la CSS ; aucun composant ne calcule une
couleur, une taille ou une durée en JS.

| Attribut | Valeurs | Absent (ou autre valeur) |
|---|---|---|
| `data-theme` | `sombre`, `clair` | suit `prefers-color-scheme` (repli sans JS) |
| `data-contrast` | `renforce` | contraste normal ; n'agit qu'avec `data-theme` posé |
| `data-text-size` | `100`, `115`, `130` | 100 % de la taille du navigateur |
| `data-font` | `lisible` | Space Grotesk et JetBrains Mono ; `lisible` remplace `--font-sans` et `--font-mono` par Atkinson Hyperlegible (seul cas où elle est téléchargée) |
| `data-spacing` | `augmente` | espacement normal |
| `data-links` | `soulignes` | soulignement propre à chaque composant |
| `data-motion` | `reduit`, `normal` | suit `prefers-reduced-motion` ; `normal` garde les animations même si le système demande de les réduire |

Conséquences pour F2b et F3 :
- le script de thème (D5) pose toujours `data-theme` (valeur mémorisée, sinon celle du système) ;
- « Réduire les animations » activé par défaut si `prefers-reduced-motion` (SPEC § 10.1) : le
  composable lit le système pour l'état initial de l'interrupteur ; s'il pose `reduit` ou rien, la CSS
  réduit ; il ne pose `normal` que si l'utilisateur désactive explicitement le réglage ;
- facteur S du Profil (F6) : désactivé dès que `data-text-size` vaut 115 ou 130 (SPEC § 4.1) ;
- composants (F1b et suivants) : couleurs, polices, tailles, durées et courbes par les variables ;
  toute transition sur une durée `--dur-*` (0,01 ms et non 0 quand réduit, pour que
  `transitionend` arrive) ; lien d'évitement avec la classe `skip-link`, titres masqués avec
  `visually-hidden` ; un nœud ajouté hors de Vue dans `#__nuxt` est retiré à l'hydratation.

## Décisions

- **Valeurs françaises des attributs, `data-contrast="renforce"`** (et non `"on"` du handoff) :
  même langue que `data-theme="sombre|clair"` et `data-motion="reduit"` du ticket ; `data-ts`
  du handoff devient `data-text-size="100|115|130"` (valeurs lisibles, celles du réglage).
- **Polices : paquets npm Fontsource 5.3.0** (`@fontsource-variable/space-grotesk`,
  `@fontsource-variable/jetbrains-mono`, `@fontsource/atkinson-hyperlegible`, publiés le 19 juil.
  2026, dernière version), téléchargés depuis le registre, intégrité sha512 comparée à `dist.integrity`
  (identique), non ajoutés en dépendance : seuls les fichiers retenus sont copiés. Source amont
  indiquée par leur `metadata.json` : github.com/google/fonts ; Space Grotesk v22 (2025-09-05),
  JetBrains Mono v24 (2025-09-11), Atkinson Hyperlegible v12 (2025-09-05). Motifs : woff2 déjà
  découpés en sous-ensembles avec leurs `unicode-range`, versions variables, licence OFL jointe,
  version épinglée et vérifiable. Alternative écartée : dépôts officiels (floriankarsten,
  JetBrains, Braille Institute), qui livrent des TTF ou des woff2 complets (toutes écritures),
  à découper soi-même.
- **Atkinson Hyperlegible d'origine, pas « Next »** : le handoff nomme `'Atkinson Hyperlegible'`
  (maquettes chargées en 400, 700, 400 italique) ; 700 italique ajouté pour ne pas synthétiser
  le gras italique.
- **Sous-ensembles `latin` + `latin-ext`** : le second n'est téléchargé que si un caractère de sa
  plage s'affiche (noms propres des recommandations) ; pas de cyrillique, grec ni vietnamien.
  Les flèches U+2197 « ↗ » des maquettes sont des SVG ; un caractère hors plage tombe sur la police
  de repli.
- **Préchargement du seul Space Grotesk latin** : police du texte courant, sur toute page ;
  JetBrains Mono et Atkinson se chargent à l'usage (CSS Fonts 4, § 4.8.1 : « user agents must only
  download those fonts that are referred to within the style rules applicable to a given page »).
- **Repli sans `data-theme` sur `prefers-color-scheme`** : sans lui, une page sans JavaScript (ou
  avant le script D5) n'aurait aucune couleur ; c'est aussi ce qui fait exercer les deux palettes par
  le smoke F0 (`colorScheme` light/dark). Le bloc sombre est dupliqué dans la requête média (la CSS
  ne sait pas appliquer un bloc sous un sélecteur et sous une requête média à la fois) ; la copie est
  vérifiée identique par le test. Alternative écartée : `light-dark()`, qui ne couvre que les
  couleurs (ombres, filtres `--hov`, `--sen-sh` diffèrent aussi) et éloigne le fichier du handoff.
- **Sélecteurs `:root[data-…]`** : interface limitée à la racine, spécificité constante (le
  contraste renforcé, `:root[a][b]`, l'emporte toujours sur le thème).
- **`data-font="lisible"` par les variables** (`--font-sans`, `--font-mono`) plutôt que le
  `* { font-family … !important }` des maquettes : les composants doivent utiliser les variables
  (règle écrite dans CLAUDE.md).
- **Soulignement des liens gardé par défaut** (`a` du navigateur) : un lien dans un texte se
  distingue autrement que par la couleur (WCAG 1.4.1, règle axe `link-in-text-block`) ; un
  composant en forme de bouton le retire, `data-links="soulignes"` le rétablit partout.
- **Couleurs des tokens en minuscules** dans `tokens.css` (même valeurs, comparées sous forme
  canonique au handoff).
- **`postcss` 8.5.33** (dernière, déjà au lockfile via Nuxt) en dépendance de développement du
  front, épinglée : lecture fiable de la CSS par le test au lieu d'un analyseur à expressions
  régulières.
- **Test de contraste dans `app/assets/css/tokens.spec.ts`** (projet Vitest `nuxt`, celui de tout
  `app/` hors `domain`, `data` et architecture) : à côté du code testé, sans toucher la
  configuration protégée ; aucun fichier de production ajouté pour le calcul (tout est dans le test,
  avec ses témoins), donc rien à couvrir en plus (couverture 100 % inchangée : 12/12 instructions).

## Non fait

- Composant de lien d'évitement et sa cible : la classe est livrée, le balisage vient avec la
  coquille (F3-01). La page provisoire n'en a pas : `index.spec.ts` (test existant) prend le premier
  lien de la page pour le lien de langue.
- Script de thème sans flash (D5) et composable `preferences` : F3 et F2b.
- Éléments de base (F1b, dev-front).

## Points ouverts

1. **Bordures `line` sous 3:1 en thème sombre (contraste normal)** — sortie honorable, valeurs du
   handoff non modifiées. Mesures (même calcul que le test) :

   | Palette | `line` sur bg | card | top | bar | field |
   |---|---|---|---|---|---|
   | sombre (#3A4B57) | 1,95 | 1,75 | 1,63 | 1,60 | 1,95 |
   | sombre renforcé (#A9BCC7) | 9,69 | 9,16 | 8,36 | 6,94 | 8,98 |
   | clair (#14262B) | 12,95 | 15,65 | 14,36 | 10,76 | 15,65 |
   | clair renforcé (#000000) | 21 | 21 | 21 | 14,43 | 21 |

   Rôle du handoff : « bordures et traits forts ». Dans les maquettes, `line` borde les boutons
   secondaires (identifiés par leur texte : sans effet sur 1.4.11), mais aussi le champ du filtre XP
   (`field` #101A21 sur `card` #17242D : 1,11, la bordure 1,75 est alors la seule limite visible du
   champ) et la piste des interrupteurs (dont l'état reste lisible par la pastille `muted`, 7,6+).
   Si la bordure est jugée nécessaire pour identifier un champ, WCAG 1.4.11 (3:1) échoue en sombre.
   Non inclus dans le test pour ne pas le rendre rouge ; à trancher (Julien) : accepter (le champ est
   identifié par son étiquette et ses puces), ou une valeur `line` sombre ≥ 3:1 sur `card` (par
   exemple #66798A : 3,92 sur bg, 3,52 sur card, 3,27 sur top, 3,21 sur bar, calculé, à valider visuellement), ou une bordure propre aux champs. La
   revue-a11y (F10) le constatera de toute façon. `hair` (séparateurs fins, décoratifs) est sous 3:1
   en sombre et en clair normaux (1,08 à 1,37), sans exigence tant qu'il reste décoratif.
2. **Espacement des paragraphes de WCAG 1.4.12** (2 × la taille du texte après un paragraphe) :
   absent de SPEC § 10.1 (trois propriétés), donc non appliqué par `data-spacing="augmente"`. Les
   composants doivent supporter cet espacement posé par l'utilisateur (critère 1.4.12) ; à ajouter
   au réglage si Julien le souhaite.
3. **`prefers-contrast: more`** n'active pas le contraste renforcé (rien dans SPEC) : le composable
   `preferences` pourrait le lire pour l'état initial, comme `prefers-reduced-motion`.
4. **CSP (F9)** : le CSS global part en fichier (`/_nuxt/entry.*.css`, `<link rel="stylesheet">`) ;
   les `<style scoped>` des composants sont intégrés en ligne par Nuxt au prérendu (constaté :
   `.output/public/index.html` contient un `<style>` avec `main[data-v-…]` de la page provisoire,
   en plus de `/_nuxt/pages.*.css`) : la CSP de F9 devra en tenir compte dans `style-src`
   (empreintes ou `features.inlineStyles: false`). `font-src 'self'` suffit (aucune police tierce).
5. **Tailles d'interface en px** (`--mobile-header` 52,5 px, `--touch-target` 44 px…) : valeurs du
   handoff gardées en px (hors texte) ; à 130 %, un en-tête de hauteur fixe peut couper son texte :
   à surveiller en F3 (hauteur minimale plutôt que fixe).
6. **`dev-front.md`** (configuration protégée `.claude/agents/`) ne cite pas encore l'interface des
   attributs ni l'usage obligatoire des variables : CLAUDE.md fait foi, mise à jour de l'agent à
   prévoir sous autorisation si l'orchestrateur le juge utile.

## Vérifications

- Aucune requête tierce dans la page générée : `grep -r -o -h -E "https?://[a-zA-Z0-9.-]+"
  .output/public` ne donne que `localhost` (hreflang, canonical), des espaces de noms
  (`www.w3.org` SVG/MathML/XLink), des liens de documentation d'erreur (`nuxt.com`, `vuejs.org`), la
  sonde d'analyse d'URL de Nuxt (`https://a.invalid/probe/`, `new URL` sans requête,
  `nuxt/dist/app/utils.js`) et les licences OFL ; aucune mention de Google. Le parcours des polices
  vérifie en navigateur qu'aucune requête ne sort de l'origine du site.
- `pnpm format` ; `pnpm integrity develop` : `Intégrité des tests : OK`.
- `pnpm check`, deux passes, `docker compose down -v` avant chacune, code 0 les deux fois : hooks
  549/549, intégrité 19 + 3 + 8 + 8 cas, `Intégrité des tests : OK` ; 12 tâches lint, typecheck,
  unitaires (API 430, contrats 220, front 35), e2e (API 753, front 189 Playwright = 35 du smoke F0
  + 154 du design system) ; couverture 100 % sur les quatre métriques : API 765/765 instructions,
  232/232 branches ; contrats 59/59, 2/2 ; front 12/12, 2/2, 4/4 fonctions, 9/9 lignes.
- `pnpm db:down` en fin de lot ; arbre de travail propre.
