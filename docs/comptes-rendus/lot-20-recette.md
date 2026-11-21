# Recette du lot 20 (flux par pull requests, revue automatisée, mutation par paquet)

Date : 21 nov. 2026. Branche `lot/20-flux-pr`, HEAD `0c03055`, base `develop` `44bf925` (`origin/develop` `f408999`
est un ancêtre de HEAD). Recette par le chef de projet, lecture seule hors ce document.

## Verdict : ACCEPTÉE, avec réserves (aucune ne bloque la fusion locale du lot)

Tous les critères vérifiables hors GitHub sont prouvés. Ce qui dépend de GitHub (premier run de `revue-pr.yml`, de la
matrice de mutation, protection) ne peut pas l'être d'ici : liste en « À vérifier au premier run ». Une réserve est
à trancher par Julien avant d'activer le contrôle requis : les PR Dependabot (R1).

## Preuves

### Vérification complète (D26)

- `pnpm db:down` puis `TURBO_FORCE=true pnpm check` : **code 0, 830 s au mur** (Turbo : 12 min 21 s), journal
  `/tmp/claude-1000/check-lot20-recette.log`. Couverture 100 % sur les trois paquets (contrats 29 fichiers de test,
  API 117, front 96, `All files | 100 | 100 | 100 | 100`). Hooks : 1013 tests sur 1013 verts ; intégrité : 13 sur 13.
  Puis `pnpm db:down` : réseau et conteneurs du projet `siteperso-v3-lot20` supprimés, aucun processus restant.
- `pnpm integrity develop` : « Intégrité des tests : OK » (point de divergence `44bf9257f8c2`).
- `pnpm integrity:test` : code 0, dont les 10 cas de `review-verdict.test.sh` (OK, BLOQUANT, absent, noyé dans une phrase,
  dernier verdict, sans `result`, JSON invalide, sans paramètre, fichier inexistant).
- `pnpm lint:workflows` : code 0. `pnpm lint:shell` : code 0.

### 1. L20-01, hooks et `settings.json`

- Rejeu par le hook réel : **non fait de mon côté**. Mon script de rejeu (une table de commandes `git push` / `gh pr …`
  envoyées à `guard.mjs`) a été refusé deux fois par les garde-fous : « script matrix.mjs écrit par la même commande »
  (illisible), puis « git push dans du code opaque (node) » (le code mentionne `git push`). Je n'ai pas reformulé. J'ai
  utilisé à la place : (a) `pnpm hooks:test` dans le check (1013 verts) et (b) la lecture des tests `pr-flow.test.mjs` et
  `push-lot.test.mjs`, qui rejouent justement par le hook complet (`spawnSync(guard.mjs pre-tool-use)`, entrée JSON de
  PreToolUse, projet temporaire donc journal intact). Ils couvrent la demande : main permis pour `git push origin lot/x`,
  `-u`, `gh pr create --base develop --head lot/x`, `gh pr merge --merge lot/x`, `gh pr comment`, `review`, `edit`,
  `ready` ; refusés `--squash`, `-s`, `--rebase`, `-r`, `--admin`, `--delete-branch`, `-d`, `--auto`,
  `--disable-auto`, `--base main`, sans `--merge`, PR nommée par numéro, `GH_REPO=`, `$BR`, xargs, `git push --force`,
  `:lot/x`, `main`, `refs/tags`, `gh api -X`, `gh release create`, `gh auth token` ; pour chacun des quinze rôles, toutes ces
  écritures et tout push refusés avec « interdit aux agents (rôle X) », lectures (`gh pr view|diff|list|checks`,
  `gh run view`, `gh api` GET) permises. Un oracle indépendant de leur contenu : leur assertion `denyOf(...) === null`
  pour main sur les écritures permises est exécutée pour de vrai dans le check, pas seulement lue.
- `.claude/settings.json` : `git diff develop...HEAD` ne montre qu'**un remplacement** : `Bash(gh pr merge*)` devient
  `--squash`, `--rebase`, `--admin`, `--delete-branch`, `--auto`, ` -s`, ` -r`, ` -d`. Rien d'autre (`gh release`, `gh repo`,
  `git push`, `Edit(...)` intacts). Conforme à l'accord de Julien (variantes interdites seulement). Les formes courtes
  sont couvertes aussi par le hook (`-dm`, `-md` refusés).

### 2. L20-02, `revue-pr.md`

- Lecture seule : rôle `revue-pr` porté par `ROLE_WRITE_SCOPES['revue-pr'] = []` (aucun chemin du dépôt), test
  `revue-pr-scope.test.mjs` ; le texte l'énonce (« tu ne crées, ne modifies ni ne supprimes aucun fichier »). `tools:
  Read, Grep, Glob, Bash` : Bash reste donc tenu par le hook et non par le frontmatter.
- Constats « bloquant » / « non bloquant » avec fichier:ligne et preuve ; dernière ligne `VERDICT: BLOQUANT|OK`, « aucune
  autre ligne ne commence par `VERDICT:` » : conforme.
- Section « Git et garde-fous » : `md5sum` identique sur **15 fichiers** (`cf5a016b131d` × 15, 15 fichiers dans
  `.claude/agents`), et le test `agents-git-section` (INTERNALS : « détect », « analyseur », « journal », etc.) est vert,
  donc aucun détail de détection.
- Incohérence mineure (R4) : l'agent et docs/03 disent que « le workflow publie la revue » et que `revue-pr` n'écrit
  pas sur GitHub ; le prompt du workflow demande à Claude de publier lui-même par `gh pr comment`.

### 3. L20-03, documentation, jeton

- CLAUDE.md, docs/03, backlog, README des hooks décrivent le flux (push `lot/*`, `gh pr create`, `gh pr merge --merge`
  après CI verte + revue sans bloquant + recette ; refus listés). `gh` dans `~/.local/bin` est noté comme exception aux
  installations (CLAUDE.md « Prérequis » et « Rien d'installé globalement », docs/03).
- Recherche d'un jeton dans tout le diff : `git diff develop...HEAD | grep '^+' | grep -iE
  'ghp_|github_pat|gho_|ghs_|sk-ant|\.config|keyring|hosts\.yml|~/|GH_TOKEN|[A-Za-z0-9_]{36,}'` : seules sorties
  utiles, le nom du secret `ANTHROPIC_API_KEY`, `${{ secrets.GITHUB_TOKEN }}`, la commande refusée `gh auth token`, et
  `~/.local/bin` (chemin d'installation de `gh`, pas de jeton). `git grep -iE 'config-siteperso|hosts\.yml|GH_TOKEN|ghp_|
  github_pat'` sur l'arbre : aucune ligne. Aucun jeton ni emplacement de jeton cité.

### 4. L20-04, mutation (`ci.yml`)

- Matrice `include` par paquet (contrats 30 min, API 150 min, front 30 min), `fail-fast: false`, cache
  `stryker-incremental-<paquet>-<run_id>` avec `restore-keys` propre (`api`, `contracts`, `web` : aucun préfixe commun),
  artefact `mutation-html-<paquet>`, `workflow_dispatch` ajouté (la branche par défaut est `develop`, donc le lancement
  manuel est possible : `git ls-remote --symref origin HEAD`), run complet sans incrément sur `refs/tags/v*` conservé,
  `--concurrency` = cœurs − 1. Le job n'est dans aucun contrôle requis. Aucun seuil touché (`stryker.config.mjs` absent du
  diff).
- Le premier run doit montrer (voir plus bas).

### 5. L20-05, `revue-pr.yml`

- Déclencheurs : `pull_request` vers `develop`, types `opened, synchronize, reopened, ready_for_review` ; ni
  `pull_request_target`, `if` exclut fork et brouillon, `allow_fork_prs: 'false'`.
- Permissions : `{}` au niveau workflow ; job : `contents: read`, `pull-requests: write` ; pas d'`id-token`.
- Épinglage par SHA : `git ls-remote https://github.com/anthropics/claude-code-action 'refs/tags/v1.0.286*'` donne
  `…^{}` = `acfe7992852970efb4fee683d63d628e3e52df67` (celui du workflow) ; `actions/checkout` `v7.0.1` =
  `3d3c42e5aac5ba805825da76410c181273ba90b1` (identique).
- Consignes de la base : second `checkout` à `github.event.pull_request.base.sha` dans `consignes-base/`
  (sparse : `revue-pr.md`, `CLAUDE.md`), prompt qui s'y réfère ; `persist-credentials: false` partout.
- Outils : `--allowedTools "Read,Glob,Grep,Bash(gh pr diff:*),Bash(gh pr view:*),Bash(gh pr comment:*),Bash(git diff:*),
  Bash(git log:*),mcp__github_inline_comment__create_inline_comment"` et `--permission-mode default` : lecture seule
  plus publication. Pas d'Edit ni Write.
- Verdict : l'étape finale appelle `review-verdict.sh "$EXECUTION_FILE"` (chemin par `env`, pas d'expression dans le
  script) ; absent, illisible ou BLOQUANT : code 1 ; 10 cas testés et verts.
- **Les garde-fous du dépôt face à la CI** (point demandé) :
  - Dans l'action il n'y a pas de sous-agent : `agent_type` est absent, le hook donne donc le rôle **`main`**, pas
    `revue-pr`. `gh pr comment <n> --body…` / `--body-file` y est permis (liste `GH_PR_WRITES.comment`), `gh pr view`,
    `gh pr diff`, `git diff`, `git log` aussi. L'étanchéité en CI repose donc sur `--allowedTools`, pas sur le rôle
    `revue-pr` : même `gh pr merge --merge lot/x` serait permis par le hook pour `main`, il n'est refusé que par
    `--allowedTools`. Acceptable, à savoir (R5).
  - Pas de bloquant au premier run côté hooks : `run.sh` a besoin de `node` (présent sur `ubuntu-latest`) et échoue
    fermé sinon ; Read, Glob, Grep et l'outil MCP ne passent pas par le hook (matcher Edit, Write, Bash…) ; l'état
    s'écrit dans `.claude/hooks/state` du workspace ; l'instantané de fin de tâche ne voit aucun changement.
  - À surveiller : (a) `gh pr comment … -R|--repo` est refusé à `main` (« vise un autre dépôt ») alors que le prompt
    donne « DÉPÔT : … » : le modèle peut l'ajouter, il perd un tour ; (b) la méthode de l'agent cite
    `git diff --stat origin/develop...HEAD`, `git log origin/develop..HEAD`, `git show`, `pnpm integrity` : le
    checkout est superficiel (pas de `origin/develop`), `git show` et `pnpm` ne sont pas dans `--allowedTools` ;
    `gh pr diff` et `gh pr view --json commits` (messages, donc lignes `Justification-test`) restent permis ;
    (c) un refus d'outil en mode non interactif est une réponse d'erreur, pas une fin de session.

## Constats et réserves

- **R1 (à trancher avant d'activer le contrôle) : PR Dependabot.** `origin` porte des branches
  `dependabot/github_actions/…`. Sous `pull_request`, une PR de Dependabot n'a pas accès aux secrets du dépôt
  (`ANTHROPIC_API_KEY` vide) et son `GITHUB_TOKEN` est en lecture seule : `revue-pr.yml` s'exécute (la tête est dans le
  dépôt), puis échoue. Le contrôle requis `Revue PR (Claude)` serait rouge sur toute PR Dependabot : non fusionnable sans
  décision (secret Dependabot de même nom, exclusion de l'acteur `dependabot[bot]`, ou revue manuelle).
- **R2 : contrôle sauté = contrôle réussi.** Pour un job ignoré par `if` (brouillon, fork), GitHub compte le contrôle
  requis comme réussi. Brouillon : pas de fusion tant qu'il n'est pas prêt, la revue se lance à `ready_for_review`. Fork :
  la revue est volontairement coupée, une PR de fork peut passer ce contrôle sans revue ; seul l'auteur du dépôt fusionne.
- **R3 : consignes de la base, hooks de la tête.** Les consignes viennent de `base.sha`, mais `.claude/settings.json`,
  les hooks et le workflow lui-même viennent du commit de merge de la PR. Une PR du même dépôt peut les modifier ; avec
  `pull_request` c'est déjà vrai du workflow (même risque que tout écrivain du dépôt). Pas de faille nouvelle, mais
  l'intégrité des consignes n'est pas de bout en bout.
- **R4 : incohérence de rédaction** entre l'agent / docs/03 (« le workflow publie la revue ») et le prompt (Claude publie
  par `gh pr comment`). Le verdict, lui, vient de la réponse finale : sans effet sur le contrôle.
- **R5 : en CI le rôle est `main`**, voir plus haut.
- **R6 : prérequis d'ordre.** La première PR (lot 20 lui-même) n'a pas `revue-pr.md` sur `develop` : le second checkout ne
  l'y trouve pas. Le lot 20 est fusionné en local puis `develop` poussée (transitoire, documenté) ; ne pas activer le
  contrôle requis avant que `develop` porte l'agent.
- Le modèle `claude-opus-5-5` et le format de `execution_file` ne peuvent pas être vérifiés d'ici.

## Diff des tests, oracles

- `git diff --name-status develop...HEAD` : fichiers de test modifiés = **huit**, tous sous `.claude/hooks/tests/` ; aucun
  autre test, fixture, snapshot, `vitest.config`, `stryker.config`, `turbo.json` touché ; trois tests ajoutés
  (`pr-flow`, `push-lot`, `revue-pr-scope`), un script de test ajouté (`review-verdict.test.sh`).
- `git-push.test.mjs` (commit `b572f9d`, `Justification-test: L20-01 … décision de Julien du 21 nov. 2026`) : avant,
  `ALLOWED` sans branche de lot et refus `['git push origin lot/13-git-flow', /branches de lot restent locales/]` ;
  après, `ALLOWED` gagne `git push -u origin lot/13-git-flow` et le refus devient
  `['git push origin lot/13-git-flow:lot/autre', /branche de lot se pousse sous son nom/]` (le refus de ce qui reste
  interdit est conservé et renforcé sur un cas voisin). Cohérent avec l'accord de Julien, aucune autre assertion
  affaiblie ; le comportement permis est couvert par `push-lot.test.mjs` (nouveau, 141 lignes).
- Sept tests de décompte (`agents-git-section`, `branch-tracking`, `branch-upstream`, `hookspath-env`,
  `main-glued-options`, `ordinary-commands`, `worktree`), commit `e1a2ebe`, `Justification-test: L20-02 décompte des
  rôles…` : chaque diff n'est que « quatorze » en « quinze », `14` en `15` (et un commentaire) ; aucune assertion
  supprimée ni assouplie.
- Chaque commit touchant un oracle porte sa ligne `Justification-test` ; `pnpm integrity develop` : OK.

## Journal des garde-fous (extrait de `.claude/hooks/audit.log`)

- Autorisations : `ba38d5d5` (lead, `.claude/hooks/**`, `.claude/agents/**`), `28fd51ee` (devops, workflows et
  `scripts/ci`), `2c00bdfb` (lead, `.claude/settings.json`, utilisée une fois à 14:37) et `130462dc` (main). Toutes
  les lignes `authorized` portent sur des chemins couverts par leur autorisation (aucun chemin hors zone) ;
  `ba38d5d5`, `2c00bdfb` et `130462dc` révoquées à 14:39:50, `28fd51ee` à 14:12:12.
- Refus (non fautifs, aucun répété pour le même effet) : devops, trois (écritures opaques python3 et bash, script écrit puis lancé) ;
  lead, scripts de garde-fous lancés depuis un agent (deux fois, 13:53 et 14:03), `gh pr merge` à 13:56 (avant le
  changement de règle), `git push` dans du python à 14:09, écriture de `settings.json` sans autorisation à 14:13
  (la règle `2c00bdfb` a été créée ensuite) ; moi, quatre refus (script écrit puis lancé, `git push` en code opaque,
  lancement direct d'un script de test et lecture du journal par python). Aucune récidive de contournement constatée.
- Aucun push : `git ls-remote --heads origin` ne montre pas `lot/20-flux-pr` ; `origin/develop` inchangé `f408999`.
- Cycles édition-test : `git log --name-only` : au plus 3 commits par fichier (`docs/backlog.md`), 2 par fichier de code
  (`shell.mjs`, `policy.mjs`) ; aucun tâtonnement visible. Transcription non fournie : alternances non comptées.

## Étapes 5 et 6 (retrait d'un test, tests de réserve)

Non applicables au lot : aucun code de l'API, des contrats ou du front n'est modifié (hooks, agents, CI, documentation) ;
la couverture à 100 % porte sur `apps/api/src`, `packages/contracts/src`, `apps/web/app`, aucune ligne du lot. Aucun scénario
OpenAPI n'a donc été généré. Le garde contre un test inopérant, pour ce lot, est le rejeu : les tests de hooks vérifient
les refus à travers le hook complet et le test d'intégrité rejoue un corpus ancien et nouveau.

## À vérifier au premier run et sur la première PR

1. Secret `ANTHROPIC_API_KEY` posé ; sans lui le contrôle est rouge (documenté).
2. Que l'action démarre avec `github_token` seul, sans l'application GitHub Claude ni `id-token: write` ; que
   `claude-opus-5-5` est accepté ; que l'outil `mcp__github_inline_comment__create_inline_comment` existe dans cette
   configuration.
3. Dans le journal de l'étape de revue : liste des outils de la session (aucun Edit ni Write), refus éventuels de `gh pr
   comment` avec `-R`, de `git diff origin/develop...HEAD`, de `pnpm integrity` ; commentaire de synthèse bien publié.
4. Que `execution_file` a le format attendu : l'étape « Verdict de la revue » affiche `Revue : VERDICT: OK` (sinon
   « aucun verdict » : voir le format de l'action).
5. Nom du contrôle : `Revue PR (Claude)` n'est proposé dans l'interface qu'après un premier passage (l'API de ruleset
   accepte les noms tels quels).
6. Mutation : trois jobs ; contrats et front courts (cache par repli de clé) ; API, cache vide, sous 150 min et au
   moins au seuil `thresholds.break` ; `gh cache list` montre `stryker-incremental-api-<run_id>` ; second run : « 0 files
   changed ». Un incrément n'existe que si le run finit, y compris après le délai (limite connue de Stryker).
7. Sur la première PR, tenter un test négatif : `gh pr merge --squash` doit rester refusé par les hooks et par la
   protection.

## Questions pour Julien (fermées)

1. Les PR Dependabot (déjà des branches `dependabot/…` sur `origin`) doivent-elles passer le contrôle `Revue PR
   (Claude)` : créer le secret côté Dependabot (et accepter un jeton en lecture seule, donc sans commentaire), ou les
   exclure du workflow ?
2. Acceptes-tu qu'une PR de brouillon ou de fork saute la revue en laissant le contrôle requis au vert ?
3. Veux-tu qu'`origin` `develop` soit protégée seulement après la fusion du lot 20 (agent `revue-pr` présent sur la base) ?
4. Faut-il aligner l'agent `revue-pr` et docs/03 sur le prompt du workflow (Claude publie lui-même la revue par
   `gh pr comment`) plutôt que « le workflow la publie » ?
5. Autorises-tu `Bash(git show:*)` et un `fetch-depth: 0` dans la revue pour que le diff contre `origin/develop` et
   les messages de commit soient lisibles par l'agent ?
