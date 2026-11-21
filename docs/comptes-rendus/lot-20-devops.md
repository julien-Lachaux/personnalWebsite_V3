# Lot 20, partie CI : compte rendu dev-devops (21 nov. 2026)

## Fait

### L20-04 : mutation en CI

- Constat vérifié (`gh run view 44906497662 --log`, job mutation du run de `develop`) : contrats « Done in 12 seconds »
  (12:59:24), front « Done in 9 seconds » (12:59:35), puis l'API tourne seule jusqu'à `The operation was canceled` à 13:43:50
  (45 min). `gh cache list` : les caches `stryker-incremental-*` pèsent 138 à 158 Kio : ceux des contrats et du front,
  jamais celui de l'API (Stryker n'écrit l'incrément qu'en fin de run).
- `ci.yml`, job `mutation` : matrice par paquet (contrats, API, front), `fail-fast: false`, délai propre à chaque paquet (30,
  150, 30 min), cache d'incrément par paquet (`stryker-incremental-<paquet>-<run_id>`, repli `stryker-incremental-<paquet>-`),
  rapport HTML par paquet (`mutation-html-<paquet>`), concurrence de Stryker = cœurs de l'exécuteur moins un
  (`--concurrency`), `turbo run test:mutation --filter=<paquet>`. Run complet sans incrément sur les étiquettes `v*`
  conservé. Déclencheur `workflow_dispatch` ajouté pour amorcer le cache. Le job reste hors des contrôles requis.
- Aucune configuration Stryker ni de seuil modifiée.

### L20-05 : revue automatisée des PR

- `.github/workflows/revue-pr.yml`, job `Revue PR (Claude)` : `pull_request` vers `develop` (opened, synchronize,
  reopened, ready_for_review), ni `pull_request_target`, ni forks (garde `review-guard.sh` qui ÉCHOUE, plus `allow_fork_prs: 'false'`),
  ni brouillons. `permissions: {}` au niveau du workflow, puis `contents: read` et `pull-requests: write` au job.
  Délai 20 min, concurrence par PR avec annulation.
- Action : `anthropics/claude-code-action` v1.0.286 (stable, publiée le 20 nov. 2026), SHA de commit
  `acfe7992852970efb4fee683d63d628e3e52df67` ; `git ls-remote` : `refs/tags/v1.0.286` (objet d'étiquette `cb5e7061…`) pointe
  par `^{}` sur ce SHA. Le tag mobile `v1` (`5342e104…`) n'est pas utilisé.
- Secret : **`ANTHROPIC_API_KEY`** (clé d'API, facturation à l'usage), plutôt que `CLAUDE_CODE_OAUTH_TOKEN` : c'est la
  voie des exemples de l'action pour la CI, elle ne lie pas la CI à l'abonnement personnel de Julien et se plafonne par
  Workspace. À poser par Julien : secret de dépôt GitHub, nom exact `ANTHROPIC_API_KEY` (procédure dans
  `docs/deploiement.md`, « Protection de develop »).
- `github_token: ${{ secrets.GITHUB_TOKEN }}` fourni : pas besoin de l'application GitHub Claude ni de `id-token: write`
  (l'exemple officiel le demande pour l'échange OIDC de l'application).
- Outils : `--allowedTools Read,Glob,Grep,Bash(gh pr diff|view|comment:*),Bash(git diff|log:*),
  mcp__github_inline_comment__create_inline_comment` et `--permission-mode default` (sans lui, un workflow à prompt tourne
  en mode automatique) : aucune écriture dans le dépôt, pas de push. Modèle `claude-opus-5-5`, `--max-turns 40`.
- Prompt : cite `.claude/agents/revue-pr.md` et `CLAUDE.md` comme instructions, impose la ligne finale `VERDICT: BLOQUANT`
  ou `VERDICT: OK`.
- `scripts/ci/review-verdict.sh` (étape finale) : lit le dernier message `result` du `execution_file` (tableau JSON de
  l'action, lu par node), cherche la dernière ligne de verdict ; code 0 sur OK, 1 sur BLOQUANT ou verdict absent ou fichier
  illisible, 2 sur paramètre invalide. Le chemin passe par `env`, jamais par une expression dans le script.
  Test : `scripts/ci/tests/review-verdict.test.sh` (10 cas : OK, BLOQUANT, absent, verdict noyé dans une phrase, plusieurs
  verdicts, aucun message `result`, JSON invalide, paramètres invalides).
- Protection de develop : marche à suivre dans `docs/deploiement.md` (secret, règles, ruleset `gh api`, interface,
  question sur les administrateurs).

### Vérifications

`pnpm lint:workflows` et `pnpm lint:shell` verts, `pnpm integrity:test` vert (dont le nouveau test), Prettier vert sur
`.github` et `scripts/ci`. Pas de `pnpm check`, pas de mutation locale (règle D26).

## Non fait

- Aucune vérification en CI (pas de push possible pour moi).
- Pas d'installation du secret ni de pose du ruleset (écritures `gh api` refusées aux agents).

## Décisions

- La « revue requise » de la protection est le contrôle `Revue PR (Claude)`, avec 0 approbation humaine (l'auteur ne peut
  pas approuver sa PR). Les sept jobs non-mutation de `ci.yml` et `revue-pr.yml` sont les contrôles requis ; « e2e » de la
  demande est couvert par `Front` (Playwright) et `Pile locale complète` (scénarios de production).
- Délai de l'API à 150 min : large à dessein pour que le premier run (cache vide) finisse ; à resserrer (par exemple 60 min)
  quand le premier incrément existera.
- Lecture de l agent depuis la branche cible (hardening demandé) : voir « Points ouverts ».
- `execution_file` : format (tableau JSON de messages SDK avec un message `type: "result"` final portant `result`) lu dans le
  code de l'action v1.0.286, non détaillé par sa documentation : à confirmer au premier run (voir plus bas).

## Points ouverts

### Ce que le premier run doit montrer (à relever par la session principale après push)

1. **Mutation** : trois jobs « Test par mutation (contrats | API | front) ». Contrats et front finissent en moins de 2 min,
   avec le cache restauré par repli de clé. Le job API, cache vide, doit finir avant 150 min (attendu : 30 à 60 min à
   3 processus) et son score total doit rester au moins égal à `thresholds.break` (41 %) : sinon c'est un résultat à
   consigner, pas un correctif de CI. Vérifier ensuite : `gh cache list` montre `stryker-incremental-api-<run_id>` (de
   l'ordre de 140 Kio ou plus) ; un second run sans changement de l'API doit finir en quelques minutes (« 0 files changed »).
   Si l'API dépasse 150 min : mesurer la durée par mutant, puis décider (plus de cœurs, `ubuntu-latest` plus grand).
   Si le timeout survient quand même, l'incrément n'est pas écrit : c'est la limite connue de Stryker.
2. **Revue** : sur une PR de test vers `develop`, le job `Revue PR (Claude)` doit (a) démarrer sans l'application GitHub Claude
   avec `github_token` seul (point non vérifié : la documentation dit que le jeton remplace l'application, aucun essai
   possible depuis ici ; sinon ajouter `id-token: write`), (b) poster un commentaire et des commentaires en ligne,
   (c) exposer un `execution_file` dont `review-verdict.sh` extrait le verdict (le journal de l'étape « Verdict de la revue »
   affiche `Revue : VERDICT: OK`, ou l'erreur « aucun verdict » si le format diffère), (d) passer ou échouer selon le verdict.
   Tant que `.claude/agents/revue-pr.md` n'est pas sur la branche de la PR, l'action cite un fichier absent : fusionner la
   branche du lead-architecte avant d'activer le contrôle requis.
3. Le nom du contrôle `Revue PR (Claude)` n'apparaît dans la liste des contrôles requis qu'après un premier passage sur une PR.

### Décisions à prendre par Julien

- La règle s'applique-t-elle aussi aux administrateurs ? (recommandation : oui, détail dans `docs/deploiement.md`).
- Pose du secret `ANTHROPIC_API_KEY` et du ruleset.
- Dépôt public : la revue d'une PR de fork est volontairement désactivée ; une contribution externe se relit à la main.
- (traité) Les consignes de revue sont lues sur la branche cible : second checkout de `base.sha` dans `consignes-base/` (agent et CLAUDE.md seuls), le prompt s y réfère ; une PR ne peut plus affaiblir ses propres consignes. Prérequis : `.claude/agents/revue-pr.md` doit exister sur `develop`.

## Suite de la recette (R1 à R6, décisions de Julien)

- Dependabot : `.github/dependabot.yml` supprimé, commentaire de `docker/api.Dockerfile` corrigé, marche à suivre pour
  Julien (désactiver les « security updates », fermer les PR, supprimer les branches `dependabot/…`) dans
  `docs/deploiement.md`. Reste `.claude/agents/dev-devops.md` (ligne 22) qui cite le fichier : hors de mon périmètre.
- Fork ou brouillon : le job « Revue PR (Claude) » ne saute plus, sa garde `scripts/ci/review-guard.sh` échoue avec un
  message clair avant l'action et le secret ; test `scripts/ci/tests/review-guard.test.sh` (7 cas). La garde est lue dans la
  PR (le workflow l'est de toute façon) ; un fork n'a pas le secret.
- Contexte : `fetch-depth: 0`, `Bash(git show:*)` permis (avec `git log` et `git diff`), prompt mis à jour, plus aucune
  mention du dépôt (pas de `-R`, `--repo`).
- Alignement de `revue-pr.md` et docs/03 : Claude publie sa revue par `gh pr comment`, le verdict est lu par l'étape finale.
