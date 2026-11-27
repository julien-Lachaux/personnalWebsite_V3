# Lot 38 — compte rendu (opencode)

Carte Trello : « [DevOps] csp-smoke.mjs : détection du point d'entrée par fileURLToPath » (lot 38, `lot/38-csp-smoke`).

## Fait

- `scripts/deploy/csp-smoke.mjs` (dernière ligne) : point d'entrée détecté par
  `process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))`
  (`fileURLToPath`, `node:url` ; `resolve`, `node:path`), au lieu de `process.argv[1] === new URL(import.meta.url).pathname`
  (chemin encodé `%20`/accents). Un script importé (`process.argv[1]` absent, ex. `node -e` + `import(...)`) n'exécute pas `main`.
- Nouveau test shell `scripts/ci/tests/csp-smoke.test.sh` (style `is`/`has`, `set -euo pipefail`, `mktemp -d`, nettoyage `trap`),
  ramassé automatiquement par `pnpm integrity:test`, sans pnpm ni node_modules. Trois vérifications demandées :
  copie `csp-smoke.mjs` dans un dossier temporaire `dossier avec espace`, `node "<chemin copié>"` sans argument depuis la racine,
  message d'usage `Usage : csp-smoke.mjs …` + code de sortie ; cas nominal (script du dépôt sans argument, même message) ;
  script importé (`node -e "import('./scripts/deploy/csp-smoke.mjs')"`) sans exécution de `main`, aucune sortie, code 0.
- Deux commits Conventional Commits (français), `Co-Authored-By: OpenCode <noreply@opencode.ai>` :
  - `ce3830a` `fix(deploy): détecte le point d'entrée de csp-smoke.mjs par fileURLToPath`
  - `31e4a3f` `test(deploy): csp-smoke.mjs s'exécute depuis un chemin avec espace et pas à l'import`
    (ligne `Justification-test: L38-1 …` : `scripts/ci/` est une configuration protégée, test ajouté, aucun test existant modifié)

## Non fait

- Rien d'autre n'a été touché. Aucun test existant modifié, aucun marqueur de saut/focus, aucun commentaire d'ignore de couverture,
  aucune directive `Stryker disable`. Aucun conteneur, aucune pile, aucun e2e, aucune mutation, pas de `pnpm check`.
- Pas de `git push`, pas de commande `gh` d'écriture, pas de création de branche/worktree, pas de fusion.
- `pnpm install --frozen-lockfile` lancé **une seule fois** dans le worktree pour obtenir Prettier/ESLint + turbo
  (hook pre-commit `pnpm format:staged` + `pnpm turbo run lint typecheck test`), jamais commité. Aucune erreur d'installation.
- Vérification complète = CI de la pull request (règle D26), à lancer par l'orchestrateur.

## Décisions

- **Code de sortie usage = 2, pas 1.** Le brief (proposition à adapter) suggérait « message d'usage + code de sortie 1 »,
  mais `csp-smoke.mjs` documente « Codes de sortie : 0 … ; 1 violation ou page incorrecte ; 2 usage » et renvoie `2`
  (vérifié : `node scripts/deploy/csp-smoke.mjs` → `Usage : …`, `exit=2`). Le contrat du script n'est pas modifié
  (le correctif demandé ne touche que la dernière ligne) ; le test prouve que `main` est appelé depuis un chemin encodé
  en vérifiant le message d'usage + code de sortie **2** (non nul, vs `exit=0` silencieux avant correctif, reproduit
  sur la version `HEAD`). Point signalé à l'orchestrateur : décider si le brief voulait aligner le code d'usage sur 1.
- Garde `process.argv[1] !== undefined` : `path.resolve(undefined)` lèverait ; couvre `node -e`, import, REPL.
- `path.resolve` des deux côtés (no-op sur `fileURLToPath` déjà absolu), conforme au brief ; pas de `realpathSync`
  (symlinks hors périmètre de la carte).
- `Justification-test: L38-1` (carte lot 38) sur le commit de test, format `^Justification-test: [^ ]+ [^ ]` de `check-tests-integrity.sh`.
- `node -e "import('./scripts/deploy/csp-smoke.mjs')"` dans le test : forme suggérée par le brief (« ou équivalent »),
  inside le fichier de test (pas une commande d'outil shell).
- Prettier : `csp-smoke.mjs` conforme ; `.sh` sans analyseur Prettier, ignoré. shellcheck indisponible sur le poste ;
  `pnpm lint:shell` non lancé (pas dans les vérifications ciblées du brief) ; lint global vert via hook pre-commit.
- Ports/`.env`, `TEST_MAX_WORKERS=2` du worktree : rien à changer (aucun conteneur).

## Points ouverts

- Divergence brief vs script sur le code de sortie d'usage (1 vs 2), voir « Décisions » ; `main` renvoie déjà `2`
  (`Usage`), documenté ligne d'en-tête. Aucun changement demandé à l'orchestrateur au-delà de la note.
- La « CI verte » se vérifie sur la pull request ; non lancée localement (interdit `pnpm check`, pas de `pnpm check` ici).

## Commandes de vérification et résultat

- `bash scripts/ci/tests/csp-smoke.test.sh` → **vert**, 6 `ok` (espace : message d'usage + code 2 ; nominal : message + code 2 ;
  importé : pas de `main`, sortie vide, code 0).
- `node --check scripts/deploy/csp-smoke.mjs` → **0** (syntaxe). `node -e "import('./scripts/deploy/csp-smoke.mjs')"` → import sans effet.
- Chemin avec espace manuel : `node "/tmp/…/dossier avec espace/csp-smoke.mjs"` → usage + `exit=2` (avant correctif, version `HEAD` : `exit=0` silencieux).
- `pnpm integrity:test` → **vert** (toutes les `scripts/ci/tests/*.test.sh`, dont `csp-smoke.test.sh`).
- `pnpm integrity develop` (`check-tests-integrity.sh`) → **OK**, aucun test existant modifié, aucun marqueur interdit, justification présente.
- `pnpm exec prettier --check scripts/deploy/csp-smoke.mjs` → **conforme**.
- Hook pre-commit à chaque commit (`pnpm format:staged` + `pnpm turbo run lint typecheck test`, turbo) → **10/10 successful** (dernier commit `FULL TURBO`).
- `pnpm install --frozen-lockfile` → ok (une fois, non commité).
- Non lancés : `pnpm check`, `pnpm test:mutation`, e2e, conteneurs, `pnpm lint:shell` (shellcheck absent), CI PR.
