# Lot F1 : recette du chef de projet (design system du front)

Date : 20 novembre 2026. Branche `lot/F1-design-system` (HEAD bf10499), base de comparaison b5bf2e4
(point de divergence avec `develop`). Isolation : `.env` racine `siteperso-v3-f1`, ports 5852 à 5855.
Journaux dans le dossier temporaire de session (`recette-f1-check1.log`, `recette-f1-removal*.log`).

## Verdict : acceptée avec réserves

Aucune correction bloquante. Les réserves sont des points à faire trancher ou à planifier (section
« Points ouverts »), plus un test partiellement redondant repéré par le retrait au hasard.

## Critères rejoués

| Critère | Commande | Résultat |
|---|---|---|
| Vérification complète | `TURBO_FORCE=true pnpm check` (conteneurs neufs) | code 0 ; hooks, intégrité, lint, typecheck, unitaires (contrats 220, API 430, front 167), e2e (API 753, Playwright front 189), couverture |
| Couverture 100 % | `test:coverage` dans le même `check` | front 156/156, 128/128, 37/37, 141/141 ; API 765/232/276/745 ; contrats 59/2/9/56 : 100 % partout |
| Intégrité | `pnpm integrity develop` | « Intégrité des tests : OK » |
| Aucun test existant modifié ou supprimé | `git diff b5bf2e4...HEAD --diff-filter=MD --name-status` | seuls CLAUDE.md, `index.vue`, `nuxt.config.ts`, `apps/web/package.json`, `pnpm-lock.yaml` (aucun test) ; aucune ligne `Justification-test` nécessaire |
| Marqueurs interdits | recherche des marqueurs de saut, de focus et d'ignore de couverture dans les lignes ajoutées de `apps/web/**/*.ts` | aucun (seul résultat : le sélecteur `.skip-link`) |
| Périmètre | `git diff --stat b5bf2e4...HEAD` | rien dans `apps/api`, `db`, `packages/contracts`, `app/domain` ; F1a : `assets/css/`, `public/fonts/`, `nuxt.config.ts`, `pages/index.vue`, CLAUDE.md, `tokens.spec.ts`, `test/design-system.e2e.ts`, `package.json` (postcss) ; F1b : `app/components/base/` seul |
| Aucune requête tierce | `nuxt generate` (fait par `test:e2e`) puis recherche des domaines dans `.output/public` | polices servies en local, seule Space Grotesk préchargée ; les URL trouvées sont des espaces de noms (w3.org), des liens de contenu ou des textes de licence, aucune ressource tierce chargée |
| Licences OFL | `OFL.txt` dans chaque dossier de police | présentes pour les trois polices |

## Fond

- **Tokens fidèles** : comparaison automatique des quatre blocs du handoff (sombre, clair, et les deux
  contrastes renforcés) avec `tokens.css` : 75 variables, 0 écart de valeur (5 différences d'écriture
  seulement, `.14` contre `0.14`).
- **Contrastes recalculés** (formule WCAG) : bordure `line` en sombre 1,95:1 sur `bg` et 1,75:1 sur `card`
  (sous 3:1, écart annoncé confirmé) ; sombre renforcé 9,69:1 ; clair 12,95:1 ; clair renforcé 21:1 ; texte
  sombre 14,99:1 ; `muted` sur `card` 7,63:1 ; accent clair sur `bg` 6,45:1.
- **Éléments de base** (code et tests lus) : `Window` en `role="dialog"` `aria-modal="true"`, piège de focus
  Tab/Maj+Tab, Échap, retour du focus à l'ouvreur ou à `returnFocusTo`, verrou de défilement ; `Popover`
  `aria-modal="false"`, déclencheur `aria-expanded`/`aria-controls`/`aria-haspopup` ; `Accordion` bouton 44×44
  (`--touch-target`), `aria-expanded`, `aria-controls`, panneau replié `inert` ; `Switch` en
  `button role="switch"` `aria-checked` ; `TechChip` `aria-pressed`, `aria-disabled` sans attribut `disabled`
  (le focus reste), puce pointillée en `<span>` ; liens externes `rel="noopener noreferrer"`.
- **Aucune valeur en dur** : aucune couleur littérale ni durée en `ms`/`s` dans les composants ; tout passe par
  `--dur-*`, `--ease-*` et les variables de couleur. Restent en px des longueurs et les points de rupture
  (valeurs de la SPEC) ; aucun `font-size` en px.
- **Mouvement réduit** : les `--dur-*` valent 0,01 ms sous `data-motion="reduit"` et sous
  `prefers-reduced-motion` hors `data-motion="normal"` ; `button.css` retire en plus le déplacement au survol.
  Constaté dans le code et par `tokens.spec.ts`. Les mesures en navigateur du compte rendu F1b (application
  d'essai hors dépôt) ne sont pas rejouables : non rejouées.

## Retrait d'un test au hasard (clone jetable, `shuf`)

1. Tirage : `TechChip.spec.ts`, premier test (rendu par défaut d'un `<button type="button">` sans `aria-*`).
   `test:coverage` du front : code 0, 166 tests verts, couverture 100 %. **La suite ne le détecte pas** : ses
   assertions sont reprises ou atteintes par d'autres tests. Test partiellement redondant, à signaler.
2. Deuxième tirage : `Window.spec.ts`, « deux fenêtres ouvertes : la page reste bloquée jusqu'à la fermeture
   de la dernière ». `test:coverage` : code 1, `Window.vue` 96,96 % de lignes, seuil 100 % non tenu (lignes
   72-73). **Détecté.**

## Processus

- **Journal des garde-fous** (`.claude/hooks/audit.log`, jour du lot) : lead-architecte 3 refus (script écrit et
  lancé dans la même commande, code en ligne calculé, écriture shell dans un dossier d'oracles ; chaque fois
  reformulé en clair), dev-front 3 refus (cible d'écriture calculée, deux scripts écrits puis lancés dans la
  même commande). Aucune autorisation utilisée par F1a ni F1b, aucune tentative répétée du même refus, aucune
  violation de fin de tâche pour ces deux rôles (les violations du jour concernent `main`, hors lot).
- **Cycles édition-test** : `git log --name-only b5bf2e4..HEAD` : aucun fichier de code touché plus d'une fois
  (paires `feat` puis `test`, un fichier par composant) ; rien à signaler au seuil de cinq. Transcriptions non
  fournies : alternances non comptées.
- **Tests de réserve contre l'API** (étape 6) : sans objet, le lot ne touche ni `apps/api` ni le contrat
  OpenAPI ; aucun scénario généré.

## Points ouverts (déjà remontés à Julien, non bloquants)

1. Bordures `line` du sombre à 1,75-1,95:1 (< 3:1).
2. Puces cliquables à 44 px sous 1024 px contre 28 px sur la maquette mobile.
3. Nom accessible des fenêtres (nom de fichier plutôt que titre du corps).
4. Pas de page réservée aux tests navigateur des éléments de base : clavier, contraste et durées mesurés hors
   dépôt par F1b, non reproductibles dans la suite.

Points propres à cette recette : le premier test de `TechChip.spec.ts` est partiellement redondant ;
`TILE_CHROME.height` de F2b (48) correspond au décor total de `Tile` (48,5 réels selon F1b) : à confirmer au
lot F6.
