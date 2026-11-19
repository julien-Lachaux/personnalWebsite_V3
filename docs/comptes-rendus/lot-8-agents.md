# Lot 8 : agents spécialisés et garde-fous anti-contournement (compte rendu du lead-architecte)

Branche `lot/8-agents-garde-fous` depuis `v3/backend` (HEAD `071e66e`). Décisions de Julien du
19 novembre 2026 (onze agents, règles de publication, quatre couches contre le contournement des
tests), appliquées sans les rediscuter.

## Ce que la plateforme permet (documentation officielle relue le 19 novembre 2026)

Sources : `code.claude.com/docs/en/hooks`, `/sub-agents`, `/permissions`. Les choix de conception
du lot en découlent.

### Fichiers d'agents (`.claude/agents/<nom>.md`)

- Markdown avec frontmatter YAML ; seuls `name` et `description` sont obligatoires, un champ
  inconnu est ignoré sans erreur. Le corps est le prompt système de l'agent.
- Champs utiles ici : `tools` (liste blanche ; sans elle l'agent hérite de tous les outils),
  `disallowedTools`, `model` (`sonnet`, `opus`, `haiku`, `fable`, identifiant complet ou
  `inherit`), `effort` (`low` à `max`), `permissionMode`, `isolation: worktree`, `maxTurns`,
  `skills`, `memory`, `hooks`, `color`.
- Résolution du modèle : paramètre `model` de l'appel, puis frontmatter, puis
  `CLAUDE_CODE_SUBAGENT_MODEL`, puis modèle de la session. L'orchestrateur peut donc lancer le
  chef-de-projet en Opus pour la recette finale sans second fichier.
- Un sous-agent ne peut lancer d'autres sous-agents que si l'outil `Agent` figure dans ses
  `tools` : aucun des onze ne l'a.
- Rechargement à chaud de `.claude/agents/` (sauf création du tout premier fichier du dossier :
  redémarrage de la session nécessaire).

### Hooks par agent (frontmatter `hooks`)

- Existent : même format que `settings.json`, actifs seulement pendant la vie du sous-agent, un
  `Stop` y est converti en `SubagentStop`.
- **Limite décisive** : pour un agent du dépôt (`.claude/agents/`), ces hooks ne sont utilisés que
  si le dossier a été approuvé dans la boîte de dialogue de confiance. En `claude -p` et via le
  SDK (donc dans les workflows d'orchestration), ils ne sont **jamais** utilisés. Les hooks de
  `.claude/settings.json`, eux, sont utilisés dans les deux cas.
- Conséquence : aucun garde-fou ne repose sur les hooks de frontmatter. Tout passe par
  `.claude/settings.json`, qui distingue les rôles grâce au champ `agent_type` de l'entrée.

### Événements et schéma d'entrée

- Événements retenus : `SessionStart` (matcher `startup|resume|clear|compact|fork`),
  `SubagentStart` et `SubagentStop` (matcher = `name` de l'agent), `PreToolUse` et `PostToolUse`
  (matcher = nom d'outil), `Stop` (pas de matcher).
- Champs communs : `session_id`, `transcript_path`, `cwd` (suit l'agent dans les worktrees et après
  `cd`), `permission_mode`, `hook_event_name`, `scratchpad_dir` (récent), et **`agent_id` et
  `agent_type` présents dans tout hook déclenché depuis un sous-agent** (absents dans la session
  principale). `agent_type` vaut le `name` du frontmatter : il est fourni par la plateforme,
  l'agent ne peut pas le choisir.
- `PreToolUse` : `tool_name`, `tool_input`, `tool_use_id`. `Write` : `file_path` (toujours absolu),
  `content` ; `Edit` : `file_path`, `old_string`, `new_string`, `replace_all` ; `Bash` : `command`,
  `description`, `timeout`, `run_in_background`.
- `SubagentStart` : `agent_id`, `agent_type` ; ne peut pas bloquer ; peut injecter
  `hookSpecificOutput.additionalContext` dans le contexte du sous-agent.
- `SubagentStop` : `stop_hook_active`, `agent_id`, `agent_type`, `agent_transcript_path`,
  `last_assistant_message`. `Stop` : `stop_hook_active`, `last_assistant_message`.
- Variable `CLAUDE_PROJECT_DIR` : racine du projet où la session a démarré (pas le worktree).
  `.claude/settings.json` est lu dans le dossier de démarrage de la session, sans remonter : les
  hooks des sous-agents en worktree sont ceux du checkout principal.

### Codes de sortie et décisions

- `PreToolUse` : 0 = suite normale (JSON lu sur stdout) ; **2 = appel bloqué, stderr renvoyé à
  l'agent comme raison** ; autre code = erreur non bloquante, l'appel passe, sauf
  `"onFailure": "block"` sur le handler (versions récentes) : c'est ce qui rend un garde-fou
  fail-closed même si le script plante ou expire.
- `Stop` / `SubagentStop` : 2 (ou `decision: "block"`) empêche l'arrêt et renvoie la raison à
  l'agent ; la plateforme plafonne à 8 relances consécutives. `onFailure` n'y a pas d'effet : le
  script attrape lui-même toutes ses erreurs et sort en 2.
- `SessionStart` / `SubagentStart` : 2 ne bloque pas (message à l'utilisateur seulement).
- Un hook qui sort en 2 l'emporte sur une règle `allow` ; une règle `deny` de `permissions`
  l'emporte sur un hook qui autorise. Les règles `deny` sur `Edit(...)` couvrent tous les outils
  d'édition et les commandes shell reconnues (`sed`, `tee`, redirections), pas un script Python ou
  Node qui ouvre lui-même le fichier.
- Les règles `Bash(...)` portent sur le texte de la commande : `git -C . push` échappe à
  `Bash(git push *)`. Elles sont un filet de confort, pas une frontière.

## Fait

| Étape | Commit | Contenu |
| --- | --- | --- |
| 1 | `7906bbe` | Section « Ce que la plateforme permet » ci-dessus. |
| 2 | `f059e37` | Onze fichiers `.claude/agents/*.md` : frontmatter (`name`, `description` qui dit quand utiliser et quand ne pas utiliser, `model` et `effort` selon docs/03, `tools` sans `Agent`), corps commun (rôle, ce que l'orchestrateur fournit, fichiers, méthode, livrable, intégrité des tests, sortie honorable, critères de fin). Recette processus du chef-de-projet (couche 4) ; grille des quatre contournements par le code dans revue-code et revue-securite. |
| 3 | `08929fe` | `.claude/settings.json` (hooks et `permissions.deny`), `.claude/hooks/` : `run.sh`, `guard.mjs`, `lib/{policy,shell,state}.mjs`, `authorize.mjs`, `README.md`, 30 tests `node:test` (`pnpm hooks:test`). `.gitignore` : état, journal, `settings.local.json`. |
| 3 bis | `275610f` | Motif des marqueurs : parenthèse exigée (« it.fails » cité en prose n'est plus compté). |
| 4 | `99d008f` | `scripts/ci/check-tests-integrity.sh` et 19 cas sur dépôts temporaires (`pnpm integrity:test`), job CI `garde-fous`, `pnpm integrity` et appel dans `pnpm check`. |
| 5 | `d893035` | CLAUDE.md (section « Agents et garde-fous », arborescence, commandes), docs/03 (tableau des onze agents, quatre couches, flux), README (renvoi). |

Vérification (étape 6) :

- Grille de publication sur les onze fichiers : aucun `/home/`, aucun port, aucun nom de projet
  compose, aucun `lot/`, aucune adresse e-mail, aucun nom de famille, aucune date, aucun domaine ;
  les seuls nombres sont des codes HTTP, « 100 % » et `docs/01`. Frontmatter des onze fichiers
  analysé sans erreur par un parseur YAML.
- `pnpm format` sans changement, `pnpm integrity v3/backend` : OK.
- `docker compose down -v` puis `pnpm check` deux fois de suite sur base de test neuve (projet
  compose isolé) : les deux verts (hooks 30/30, script d'intégrité 19/19, intégrité OK, lint,
  typecheck, unitaires 34 + 17 fichiers, e2e 33 fichiers, couverture 100 % sur les quatre
  métriques des deux paquets).
- Épreuve réelle : dans cette session, une édition d'un spec existant
  (`get-health.use-case.spec.ts`) **est passée** : les hooks du worktree ne sont pas chargés,
  Claude Code lit `.claude/settings.json` dans le dossier de démarrage de la session (le checkout
  principal, qui n'a pas encore le lot 8). Fichier restauré aussitôt. Rejeu à la main des
  commandes exactes de `settings.json` sur le worktree, avec l'identité d'un sous-agent
  `dev-api` : `SubagentStart` 0 avec le rappel des règles ; `PreToolUse` Edit du même spec : 2,
  « modification d'un test existant … aucune autorisation » ; `PreToolUse` Bash `sed -i` : 2 ;
  modification faite hors hooks puis `SubagentStop` : 2, « oracle modifié » ; fichier restauré
  puis `SubagentStop` : 0.

## Non fait

- Épreuve en conditions réelles avec des hooks chargés par la plateforme : impossible depuis ce
  worktree (voir ci-dessus). À faire après fusion (points ouverts).
- `docs/backlog.md` non touché (document du chef-de-projet).
- Pas de `dev-front` ni de `revue-accessibilite` (hors périmètre, décision A).

## Décisions

1. **Tout dans `.claude/settings.json`, rien dans le frontmatter des agents** : les hooks de
   frontmatter d'un agent du dépôt sont ignorés en `-p` et via le SDK, donc dans les workflows.
   Le rôle est lu dans `agent_type` (fourni par la plateforme, non falsifiable par l'agent) ; la
   session principale a le rôle `main`. Les restrictions d'écriture par rôle (qa : tests ; revues
   et triage : `docs/revues/` ; chef-de-projet : ses documents ; `.env` permis pour l'isolation)
   sont appliquées par ce même hook.
2. **Exception par autorisation nominative journalisée** plutôt que variable d'environnement ou
   hook de frontmatter : `authorize.mjs` (exécutable par la seule session principale, le hook le
   refuse à tout `agent_type`) écrit une autorisation (rôle, portée, ticket, raison, chemins,
   expiration de 4 h par défaut) ; elle se lie au premier `agent_id` qui l'utilise (l'identifiant
   n'est pas connu avant le lancement). Création, usages, refus, révocations et violations vont
   dans `.claude/hooks/audit.log`.
3. **Portées** : `tests` (correcteur, qa), `fails` (qa, correcteur), `config` (lead-architecte,
   dev-devops). L'exception de configuration pour lead-architecte et dev-devops n'était pas dans
   la décision C (qui nomme correcteur et qa) : sans elle, `.github/workflows/` et les
   configurations de test deviendraient immodifiables par les rôles qui en ont la charge. Les
   marqueurs `skip`, `only`, `todo`, `skipIf`, `runIf` et les commentaires d'ignore ne sont
   autorisables par personne.
4. **Marqueur `fails`** : la qa a pour mission les « tests en échec attendu » ; le hook l'admet
   sous autorisation `fails`, le script de CI avec une ligne `Justification-test` dans un commit qui
   touche le fichier. Lecture retenue de C.2 (« marqueur de saut ») ; les autres marqueurs restent
   refusés sans exception.
5. **Instantané** : pris à `SessionStart` et `SubagentStart` pour le dépôt courant, et
   paresseusement au premier outil qui vise un autre dépôt (le `cwd` de `SubagentStart` n'est pas
   forcément le worktree du sous-agent). Un instantané n'est jamais écrasé. En fin de tâche, un
   oracle changé est admis s'il est couvert par une autorisation de l'agent ou commité avec
   `Justification-test` (cas des fusions de l'orchestrateur) ; sinon la fin est refusée **une
   fois** (`stop_hook_active` faux), puis acceptée pour ne pas épuiser les 8 relances : la
   violation reste consignée et le hook `PostToolUse` sur `Agent` la signale à l'orchestrateur.
6. **Shell analysé au mieux** (`lib/shell.mjs`) : redirections, `rm`, `mv`, `cp`, `tee`,
   `truncate`, `dd`, `sed -i`, `perl -i`, `awk -i inplace`, `find -delete/-exec`, `xargs` d'un
   écrivain, `git checkout/restore/rm/mv/reset --hard <réf>/apply/am`, `patch`, interpréteurs
   (code en ligne, script ou here-document) qui contiennent une primitive d'écriture et nomment un
   oracle. Toujours refusés : `git push` (y compris `git -C . push`), `--no-verify`, `commit -n`,
   `core.hooksPath`, `HUSKY=0`, `update-index --assume-unchanged/--skip-worktree`, réécriture
   d'historique, `git stash` nu, `vitest -u`. Dossier qui contient des oracles (`.`, `apps`,
   `test/`) : refusé comme cible.
7. **Dossier temporaire de session libre** (`scratchpad_dir` de l'entrée) : le chef-de-projet y
   clone le dépôt pour retirer un test au hasard et y garde ses tests de réserve.
8. **Fail-closed** : `onFailure: "block"` sur `PreToolUse`, `run.sh` sort en 2 si Node manque,
   `guard.mjs` sort en 2 sur toute entrée illisible ou erreur interne.
9. **Script d'intégrité** : tests et configurations jugés sur les commits de la branche (base
   `merge-base`) ; marqueurs jugés sur l'arbre de travail et les fichiers non suivis ; tout
   l'arbre de code suivi est balayé pour les marqueurs interdits. Configurations protégées : Vitest
   et couverture, `turbo.json`, `pnpm-workspace.yaml`, `.husky/`, `.github/workflows/`,
   `scripts/ci/`, `.claude/settings.json`, `.claude/hooks/`, scripts de test des `package.json`.
   `.claude/agents/` est protégé par les hooks mais pas par la CI (des prompts, pas des oracles).
   Les commits de ce lot qui touchent ces fichiers portent leur `Justification-test` (L8-03,
   L8-04).
10. **Aucun marqueur littéral** dans les scripts, tests et documents du lot : motifs écrits en
    alternatives, marqueurs de test construits par concaténation, prose sans parenthèse.
11. **Trailer des commits** : `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`, celui
    que CLAUDE.md impose au dépôt.

## Limites de la plateforme et alternatives retenues

| Limite | Alternative |
| --- | --- |
| Hooks de frontmatter ignorés en `-p`, via le SDK et sans approbation du dossier | Hooks de `settings.json` + rôle lu dans `agent_type` |
| `SubagentStart` ne peut pas bloquer ; son `cwd` n'est pas forcément le worktree de l'agent | Instantané au démarrage puis instantané paresseux au premier outil, avant toute écriture |
| `agent_id` inconnu avant le lancement de l'agent | Autorisation liée au premier `agent_id` qui l'utilise |
| `Stop`/`SubagentStop` plafonnés à 8 relances, `onFailure` sans effet | Refus une seule fois, puis signalement à l'orchestrateur ; erreurs attrapées par le script |
| `onFailure: "block"` récent ; ancien Claude Code : un hook qui plante ne bloque pas | `guard.mjs` et `run.sh` sortent eux-mêmes en 2 |
| `.claude/settings.json` lu au dossier de démarrage de la session, sans remontée | Scripts résolus par `CLAUDE_PROJECT_DIR`, état sous le checkout principal, règles relatives à la racine git de chaque fichier (worktrees compris) |
| Règles `permissions.deny` textuelles (`git -C . push` passe), `Edit(...)` aveugle aux scripts | Gardées comme filet de confort ; le hook analyse la commande |
| Les hooks ne sont pas un bac à sable : un programme qui écrit sans nommer le fichier leur échappe, l'état local est inscriptible par un agent déterminé | Hook de fin (empreintes) et script d'intégrité de la CI, indépendant de l'état local ; le bac à sable de la plateforme (contrôle au niveau système) reste une option |
| Forme de `tool_response` de l'outil `Agent` non documentée en détail | Le mode `report` signale toutes les violations non encore signalées |

## Points ouverts

- **Activation** : les hooks ne s'appliquent qu'une fois le lot fusionné dans la branche du
  checkout principal (celui où démarre la session). En session interactive, ils attendent
  l'approbation du dossier ; le premier fichier de `.claude/agents/` demande un redémarrage.
  Première vraie épreuve à faire après fusion : lancer `dev-api` sur une tâche jouet et vérifier
  le refus, le rappel injecté, `agent_type` dans l'entrée de `PreToolUse` et le journal.
- **Version de Claude Code** : `onFailure` exige une version récente ; à vérifier sur le poste.
- **Session de Julien** : s'il modifie un test à la main pendant une session, le `Stop` de la
  session refusera une fois la fin de tour ; solution : commit avec `Justification-test` ou
  `node .claude/hooks/authorize.mjs grant --agent main …`.
- **À valider par Julien** : l'extension de la portée `config` à lead-architecte et dev-devops
  (décision 3) et l'admission du marqueur `fails` justifié par la CI (décision 4).
- **Faux positifs connus du shell** : `find . -delete` à la racine, `git checkout .`,
  `git restore .`, un interpréteur qui écrit ailleurs mais cite un test ; le message est clair, le
  chemin légitime est de viser un fichier précis ou de passer par l'outil d'édition.
- `docs/backlog.md` : ajouter le lot 8 clos et la règle `Justification-test` (chef-de-projet).
- Le journal `.claude/hooks/audit.log` n'est pas tourné ; il est local au checkout principal.
