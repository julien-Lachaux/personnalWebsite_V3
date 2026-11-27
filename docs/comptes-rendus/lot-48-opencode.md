# Lot 48 — Garde-fous : traces git lues comme des écritures (OpenCode, 27 nov. 2026)

Carte Trello : « [Back] Garde-fous : traces git lues comme des écritures (décision du 25 nov.) » (#53).
Branche `lot/48-traces-git`, depuis `develop` (24b9494). Rôle `lead-architecte`.

## Fait

- `.claude/hooks/lib/shell.mjs` : les variables `GIT_TRACE*` et les clés `trace2.*Target` sont traitées
  comme des cibles d'écriture. Une valeur qui est un chemin est vérifiée comme une redirection `>>`
  (mêmes refus sur les oracles) ; `0`, `false`, vide, `1`, `true` et un chiffre de descripteur sont
  permis ; une socket (`af_unix:…`) ou une valeur calculée sont refusées (illisibles). Même traitement
  pour `trace2.*Target` passé par `-c`, `--config-env` ou `GIT_CONFIG_PARAMETERS`.
  - `traceTarget`, `traceEnv`, `TRACE_TARGET_KEY`, `TRACE_NO_FILE`, `TRACE_SETTINGS` ajoutés.
  - `valueMatters` étendu à `TRACE_TARGET_KEY` (pour la clé dans les fichiers de config).
  - `configEntry` appelle `traceTarget` quand la clé matche `TRACE_TARGET_KEY`.
  - `traceEnv` appelé lors des affectations (shell et enveloppes), en tenant compte de `+=` et des
    affectations indexées (`[…]`) qui rendent la destination illisible.
- `.claude/hooks/README.md` : limite mise à jour (seules les clés déjà écrites dans un fichier de
  configuration git restent, comme le point 3 du lot 25).
- `.claude/agents/revue-securite.md` (l. 51) : `onlyBuiltDependencies` → `allowBuilds` (pnpm 12).
- `.claude/hooks/tests/git-trace.test.mjs` : nouveau test (mesure des écritures de git, cibles
  relatives au dossier courant et à `-C`, valeurs permises, réglages sans destination, refus d'un
  test existant ou d'un dossier d'oracles par le hook complet et même trace permise hors oracle,
  formes illisibles pour chaque rôle). 24 cas.
- `docs/agents-herdr.md` : non touché (hors périmètre de cette carte ; le brief du lot 37 le
  mentionnait, mais la règle d'affichage des terminaux n'est pas modifiée par ce lot).

## Non fait

- La correction de `guard.mjs` (repli sur le checkout principal sans la variable) n'est pas faite :
  elle est cohérente avec le test existant `state-root.test.mjs` et la session normale fournit
  toujours la variable aux hooks. La recette d'herdr garde `CLAUDE_PROJECT_DIR=<worktree>` écrit en
  clair.
- La variable héritée désignant le checkout principal l'emporte encore sur le dossier courant d'un
  worktree ; seul l'annonce sur la sortie d'erreur le montre.

## Vérifications (D26)

- `pnpm hooks:test` : 1318 verts, 0 échec (1294 existants + 24 nouveaux).
- `pnpm integrity develop` : OK.
- `pnpm format:check` sur les fichiers touchés : OK.
- Pre-commit Husky vert. Aucun conteneur, e2e, mutation, `pnpm check`.
- Points ouverts signalés par l'agent : `authorize.mjs list` réservé à la session principale (non
  relancé) ; pas de contrôle automatique que la borne de `arret-premier-echec` reste au-dessus du
  délai de `pile-locale` (hors périmètre).

## Suite (revue PR #44, VERDICT: BLOQUANT)

La revue a relevé que `git config --global trace2.eventTarget <chemin>` n'était pas vérifié (le `case 'config'`
ne traitait pas `TRACE_TARGET_KEY`). Corrections appliquées :

- `.claude/hooks/lib/shell.mjs` : dans `case 'config'`, si `TRACE_TARGET_KEY.test(key)` et `write.values[0]`
  est défini, appel de `traceTarget(env, write.values[0], …, gitBase)`.
- `.claude/hooks/README.md` : la limite est précisée (une clé déjà posée dans un fichier de config ou une
  variable d'environnement de l'hôte n'est pas vue ; la même clé posée par `git config --global` l'est).
- `.claude/hooks/tests/git-trace.test.mjs` : ajout des cas `git config --global/system trace2.eventTarget`
  (oracle refusé, socket et valeur calculée refusées, chemin hors oracle permis).
- `pnpm hooks:test` : 1318 verts, 0 échec ; `pnpm integrity develop` : OK.

## Commits

- `aab6a5f` fix(hooks): destinations des traces de git lues comme des cibles d'écriture
- `f919509` fix(hooks): traces git lues comme des cibles d'écriture (shell.mjs +=, revue-securite.md,
  git-trace.test.mjs, avec `Justification-test: L48-01`/`L48-02`)
- dernier commit : ce compte rendu (complété après la revue PR #44).
