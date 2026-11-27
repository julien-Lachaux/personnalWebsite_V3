# Lot 45 : authorize.mjs déduit le dépôt sans CLAUDE_PROJECT_DIR (lead-architecte)

Branche `lot/45-authorize-projectdir`, base `develop` (aab3f9f), 27 nov. 2026. Ticket L45-01 (carte #78).

## Fait

- `037e25b fix(hooks)` : nouvelle fonction `cliStateRoot(cwd)` dans `.claude/hooks/lib/state.mjs`, utilisée par
  `authorize.mjs` (seule commande de `.claude/hooks/` lancée hors hook qui lit ou écrit l'état) :
  - `CLAUDE_PROJECT_DIR` posé et non vide : son état, même s'il désigne un autre dépôt ou un autre worktree que
    le dossier courant (usage documenté : `CLAUDE_PROJECT_DIR=<worktree>` depuis le checkout principal) ;
  - variable absente ou vide : état du dépôt du dossier courant (`git rev-parse --show-toplevel`, worktree et
    sous-dossier compris), plus le checkout principal d'office ;
  - variable sur un dossier absent : refus explicite (code 2), plus de repli silencieux ;
  - dossier courant hors de tout dépôt sans variable : refus explicite (code 2), avec la commande à utiliser ;
  - chaque appel annonce sur la sortie d'erreur l'état visé et sa source
    (`authorize : état des garde-fous de <dossier> (CLAUDE_PROJECT_DIR|dossier courant)`).
  `README.md` des hooks à jour (section « Exception contrôlée »). Commit avec
  `Justification-test: L45-01`.
- `14d5f2f docs(herdr)` : `docs/agents-herdr.md`, section « Garde-fous », alignée sur la nouvelle règle.

## Vérifications

- `CLAUDE_PROJECT_DIR=/home/jlachaux/Projets/personnalWebsite_V3-lot45 pnpm hooks:test` : 1285 tests, 1285
  passés, 0 échec (avant l'ajout de tout nouveau test, voir Points ouverts).
- `pnpm integrity develop` : « Intégrité des tests : OK ».
- `pnpm exec prettier --check` sur les fichiers touchés : OK ; hook pre-commit (lint, typecheck, test) vert aux
  deux commits.
- Aucun conteneur lancé.

## Décisions

- **Les hooks gardent `stateRoot`** (variable, sinon checkout principal) : `.claude/settings.json` lance chaque
  hook par `"$CLAUDE_PROJECT_DIR/.claude/hooks/run.sh"`, donc un hook de session a toujours la variable ; le
  repli ne sert qu'au rejeu manuel, et `tests/state-root.test.mjs` (test existant, non modifiable ici) exige
  qu'un hook rejoué dans un worktree sans variable ne crée rien dans le worktree. Alternative écartée : appliquer
  la règle du dossier courant aussi à `guard.mjs`, qui casserait ce test.
- **Variable sur un autre dépôt : acceptée et annoncée, pas refusée.** Alternative écartée : refuser quand la
  variable et le dossier courant n'ont pas le même dépôt ; elle casse l'usage documenté (session principale
  dans le checkout principal, `CLAUDE_PROJECT_DIR=<worktree>`) quand on le généralise, et les tests existants
  (`other-agent-authorized`, `state-prune`, `test-widening`) lancent `authorize.mjs` avec un projet qui n'est
  pas le dépôt courant. L'annonce sur la sortie d'erreur rend visible une variable héritée erronée.

## Non fait / points ouverts

1. **Nouveau test non versionné.** `.claude/hooks/tests/authorize-project-dir.test.mjs` (9 cas : worktree sans
   la variable, sous-dossier, checkout principal, variable vers le worktree, vers un autre dépôt, variable vide,
   dossier absent, hors dépôt avec et sans variable) est refusé à l'écriture :
   « configuration de test, de CI ou garde-fou : .claude/hooks/tests/authorize-project-dir.test.mjs. Aucune
   autorisation « config » de l'orchestrateur pour l'agent lead-architecte ». Le fichier prêt est dans
   `/tmp/claude-1000/-home-jlachaux-Projets-personnalWebsite-V3-lot45/fa5c6174-0d2c-47d7-9a15-1b53fdbb540c/scratchpad/l45/authorize-project-dir.test.mjs`
   (sa ligne `AUTHORIZE` lit `L45_AUTHORIZE` pour tourner hors du dépôt : à ramener à
   `join(dirname(dirname(fileURLToPath(import.meta.url))), 'authorize.mjs')` en le versionnant). Le lancer
   depuis le scratchpad a été refusé aussi (« écriture opaque (node) qui mentionne un oracle (l'état des
   garde-fous) ») ; il n'a donc pas été exécuté. À faire : autorisation `config` sur ce chemin, puis copie,
   `pnpm hooks:test`, commit `test(hooks)` avec `Justification-test: L45-01`.
2. `CLAUDE_PROJECT_DIR=… node .claude/hooks/authorize.mjs list` (vérification demandée par le brief) est
   refusé aux agents (« les scripts des garde-fous ne se lancent que depuis la session principale ») :
   autorisation non relue de mon côté, mais les écritures autorisées ont été acceptées.
3. L'en-tête de `tests/state-root.test.mjs` parle encore d'« authorize.mjs lancé depuis un terminal dans un
   worktree » comme cas du repli sur le checkout principal : commentaire devenu inexact, test intouchable ici.
4. Une variable `CLAUDE_PROJECT_DIR` héritée qui désigne le checkout principal l'emporte encore sur le dossier
   courant d'un worktree : seule l'annonce sur la sortie d'erreur le signale. La recette d'herdr garde donc le
   `CLAUDE_PROJECT_DIR=<worktree>` explicite.
