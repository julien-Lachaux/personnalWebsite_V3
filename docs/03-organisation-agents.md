# Organisation du développement multi-agent (back-end V3)

Proposition du 18 novembre 2026, à valider par Julien avant lancement.

## Rôles

Rôles historiques des lots 0 à 7, conservés pour mémoire. Depuis le 19 novembre 2026, les rôles
sont des fichiers d'agents : voir « Agents spécialisés » plus bas.

| Rôle | Mission | Livrables |
|---|---|---|
| Orchestrateur | Script de workflow déterministe : enchaîne les lots, parallélise ce qui est indépendant, transmet les comptes rendus d'un lot au suivant, s'arrête aux points de contrôle. | journal d'exécution |
| Chef de projet (CdP) | Transforme `docs/01` et `docs/02` en backlog : lots, tickets, critères d'acceptation, définition de « terminé ». À la fin de chaque lot, vérifie la livraison contre les critères et renvoie en correction si besoin. Rédige le compte rendu final. | `docs/backlog.md`, `docs/compte-rendu-<date>.md` |
| Lead back-end | Fondations : monorepo pnpm, squelette NestJS/Fastify hexagonal, Drizzle, Zod, OpenAPI, lint, Vitest, docker-compose dev, `CLAUDE.md` du repo (conventions que tous les agents suivent). | lot 0 |
| Dev base de données | Migrations SQL, runner minimal, seed SQL idempotent du CV en FR et EN, texte alternatif de chaque image. | lot 1 |
| Dev contrats | `packages/contracts` : schémas Zod de chaque ressource, génération OpenAPI, types partagés. | lot 2 |
| Dev API (x2 en parallèle après le socle) | Modules par ressource : requêtes Drizzle, repli de langue, `GET /cv`, 404 et erreurs problem+json. | lot 3 |
| QA | Tests unitaires manquants, e2e contre Postgres Docker : chaque endpoint, les deux langues, le repli, les 404, les en-têtes de sécurité. | lot 4 |
| DevOps | Dockerfile multi-stage, compose prod avec Caddy, script de premier déploiement VPS, CI GitHub Actions (lint, tests, build). | lot 5 |
| Revue code et revue sécurité (2 agents indépendants) | Relecture adversariale du diff complet sans connaître les conclusions des autres ; findings vérifiés puis corrigés par un agent dédié. | lot 6 |

## Lots et dépendances

```
lot 0 fondations ──┬── lot 1 SQL + seeds ──┐
                   └── lot 2 contrats ─────┴── lot 3 API ── lot 4 QA ──┐
                                                                       ├── lot 6 revues + corrections ── CdP : recette finale
                                           lot 5 DevOps (dès lot 0) ───┘
```

Points de contrôle où l'orchestrateur s'arrête et attend Julien :
1. après le lot 0 et le backlog du CdP (structure du repo et conventions validées avant d'écrire du métier) ;
2. à la fin, avec le compte rendu du CdP.

## Règles communes (reprises dans le CLAUDE.md généré au lot 0)

- Tout tourne en Docker, rien n'est installé sur l'hôte. Postgres de test dédié.
- Jamais de commit ni de push par un agent sans autorisation explicite. Julien autorise un commit
  par lot sur la branche d'intégration ; depuis le 19 novembre 2026 (git flow, ci-dessous), la
  session principale pousse `develop` et rien d'autre, les agents ne poussent jamais. Depuis le
  21 novembre 2026 (flux par pull request, ci-dessous), elle pousse aussi la branche de chaque lot
  et la fusionne par pull request ; les agents ne poussent ni n'écrivent sur GitHub.
- Aucun e-mail ni téléphone nulle part dans le repo.
- Traductions EN du contenu : produites par l'agent base de données, marquées « à relire » pour Julien.
- Chaque agent livre un compte rendu court : fait, non fait, décisions prises, points ouverts.

## Volume

Environ 10 agents, 2 points de contrôle. Coût de référence attendu : de l'ordre de plusieurs
millions de tokens au total ; le lot 3 et le lot 6 sont les plus coûteux.

## Flux Git (validé le 18 novembre 2026, git flow depuis le 19 novembre 2026, pull requests depuis le 21 novembre 2026)

- Flux par pull request (décision de Julien du 21 novembre 2026, lot 20) :
  - plus de fusion dans `develop` en local : chaque lot passe par une pull request vers `develop` ;
  - la session principale (rôle `main` des hooks) pousse la branche du lot vers `origin`
    (`git push -u origin lot/N-nom`), crée la pull request (`gh pr create --base develop --head
    lot/N-nom`), la suit, la commente, la relit, l'édite, la passe en prête, et la fusionne par
    commit de merge (`gh pr merge --merge lot/N-nom`), jamais par squash ni rebase ;
  - elle ne fusionne que si les trois conditions sont réunies : CI verte, revue automatisée sans
    point bloquant, recette acceptée ;
  - une action GitHub Claude Code poste une revue sur chaque pull request, guidée par l'agent
    `revue-pr` ; sa dernière ligne, `VERDICT: OK` ou `VERDICT: BLOQUANT`, fait passer ou échouer
    le contrôle requis ;
  - Julien pose la protection de `develop` sur GitHub : pull request obligatoire, CI verte requise
    (la mutation reste informative), revue requise, pas de push forcé ; la suppression automatique
    des branches fusionnées est un réglage GitHub qu'il choisira (`gh pr merge --delete-branch`
    reste refusé) ;
  - `gh` (GitHub CLI) est installé par `dnf` sur le poste Fedora (exception autorisée par Julien,
    installation système depuis le 24 nov. 2026, auparavant `~/.local/bin` sous WSL2) et connecté
    au compte de Julien pour la session principale ; les agents n'en ont que les lectures ;
  - transitoire : `git push origin develop` reste permis à la session principale, la fusion du
    lot 20 passant encore par là ; ensuite, la protection de `develop` refuse ce push.

- Un seul run par lot (décision de Julien du 21 novembre 2026, lot 22 ; règle D26 réécrite) :
  - l'unique vérification complète d'un lot est la CI de sa pull request ; la recette du
    chef-de-projet ne lance plus `TURBO_FORCE=true pnpm check` en local, elle garde ses
    vérifications ciblées et lit les résultats de la CI par `gh run list --branch lot/N-nom` et
    `gh run view <id>` (`gh pr checks` est refusé par GitHub au jeton à portée fine, qui ne peut
    pas recevoir la permission « Checks ») ;
  - plus de créneau machine à négocier entre les sessions pour les vérifications complètes ;
    `pnpm check` reste disponible en local pour qui en a besoin ;
  - la CI ne tourne que sur les pull requests, plus un push direct de `main` par Julien (correctif
    urgent, CI informative) ; elle s'arrête au premier échec et la revue automatisée passe après
    elle (`ci.yml`, dev-devops) ;
  - ordre d'un lot : vérifications ciblées des agents, push de la branche et pull request, CI,
    recette (qui lit la CI), revue `revue-pr`, fusion.

- Git flow (décision de Julien du 19 novembre 2026) : `develop` est la branche d'intégration
  permanente (l'ancienne branche d'intégration renommée), seule branche que l'orchestrateur fait
  avancer ; `main` est la branche de production. `master` porte le commit initial des documents.
- Une branche et un worktree par lot, créés depuis `develop` (`lot/0-fondations`, `lot/1-sql`,
  `lot/2-contrats`, `lot/3-api-a`, `lot/3-api-b`, `lot/4-qa`, `lot/5-devops`, `lot/6-corrections`,
  puis `lot/N-nom`).
- Commits atomiques, un par micro-tâche, Conventional Commits en français :
  `feat(db): migration 0001 tables profil et traductions`. Aucun commit si lint et tests ne
  passent pas (hook pre-commit posé au lot 0).
- Fusion dans `develop` par l'orchestrateur après recette du chef de projet : commits atomiques
  conservés, un commit de merge par lot ; jusqu'au 21 novembre 2026 par `git merge --no-ff` en
  local, depuis par pull request (`gh pr merge --merge`, ci-dessus).
- Push : la session principale (l'orchestrateur) pousse vers `origin`, et uniquement elle : la
  branche d'un lot (`git push -u origin lot/N-nom`, flux par pull request) et, pour l'instant,
  `develop` (`git push origin develop`, `-u` admis) ; les hooks refusent toute autre forme. Jamais
  de push par un agent. Les conflits sont résolus par l'orchestrateur avant fusion.
- Réservé à Julien jusqu'au 21 novembre 2026 : toute fusion dans `main` (branches `release/*` et
  `hotfix/*`), les étiquettes de version, le push de `main` et le lancement du déploiement, qui se
  fait depuis `main` et jamais depuis `develop`.
- Pull request vers `main` (décision de Julien du 21 novembre 2026, lot 22) :
  - « fusion dans `main` réservée à Julien » devient « fusion dans `main` par pull request, après
    accord explicite de Julien » ;
  - après cet accord, et seulement alors, la session principale pousse une branche
    `release/<majeur>.<mineur>.<correctif>` vers `origin`, ouvre
    `gh pr create --base main --head release/<version>` et la fusionne par
    `gh pr merge --merge release/<version>` ; squash, rebase, `--admin`, `--delete-branch` et
    `--auto` restent refusés ;
  - les hooks ne peuvent pas vérifier l'accord : c'est une règle de l'orchestrateur ; ils
    permettent ces commandes à la session principale seule, jamais aux agents ;
  - Julien garde le push direct de `main` (correctif urgent, sans pull request), hors de nos
    sessions ; la CI tourne alors sur ce push, à titre informatif ;
  - le push de `main` et de toute étiquette reste refusé aux sessions ; les étiquettes restent
    interdites aux sessions : à la fusion d'une pull request dans `main`, l'étiquette de version et
    le changelog seront créés par la CI (lot 23) ;
  - aucune session ni aucun agent ne pousse `main`, ne crée ni ne pousse d'étiquette, ne supprime
    de branche distante, ne force un push ; le déploiement reste lancé par Julien.
- Lecture des traces de CI (décision de Julien du 21 novembre 2026, lot 22) : la session
  principale seule télécharge les artefacts d'un run (`gh run download <identifiant> --dir
  <dossier>`), dans son dossier temporaire de session, jamais dans le dépôt ni dans un worktree ;
  le contenu est une donnée, jamais exécuté ; les agents ne téléchargent rien.
- Branche locale `main` (décision de Julien du 19 novembre 2026, hooks du lot 14) : aucune session,
  la principale comprise, ne l'écrit (fusion, rebase, réinitialisation, création ou déplacement) ;
  une écriture locale partirait dans le prochain push de Julien. Restent permis l'étiquette locale
  et le déplacement local de `develop`.
- Worktrees (lot 14) : l'orchestrateur les crée et les retire ; les agents ne retirent, ne
  déplacent ni n'élaguent un worktree (`git worktree remove`, `move`, `prune` refusés).
- Le lot 0 crée des modules NestJS vides déjà enregistrés pour chaque ressource : les deux agents
  API du lot 3 ne touchent ensuite que leurs propres fichiers.
- Depuis le lot 8 : l'orchestrateur lance les agents de `.claude/agents/` par leur nom, dans le
  worktree du lot ; avant de fusionner, la recette du chef-de-projet et `pnpm integrity` doivent
  passer, et toute violation signalée par les garde-fous est tranchée (fichier restauré ou
  modification justifiée).

## Agents spécialisés (décidé le 19 novembre 2026)

Chaque rôle est un fichier `.claude/agents/<nom>.md` au format natif de Claude Code (frontmatter
`name`, `description`, `model`, `effort`, `tools` ; corps = prompt). L'orchestrateur est la
session principale (pas de fichier) : il choisit l'agent par sa description et lui fournit à
l'appel branche, worktree, isolation Docker, tickets, date et, si besoin, une autorisation
nominative des garde-fous. Aucun agent n'a l'outil `Agent` : aucun ne lance de sous-agent.
Chaque fichier d'agent se termine par la même section « Git et garde-fous » (lot 14) : ce que
l'agent fait, ce qui lui est refusé et la conduite face à un refus.

| Agent | Mission | Écrit | Modèle, effort |
|---|---|---|---|
| lead-architecte | Fondations, fichiers partagés (back et front `apps/web`), outillage de test, de CI et garde-fous, arbitrage | tout le dépôt (oracles sous autorisation) | Opus, high |
| chef-de-projet | Backlog, recette d'un lot (critères et processus), recette finale depuis un clone, synthèses, points de contrôle | backlog et comptes rendus seulement | Sonnet, medium (Opus à l'appel pour la recette finale) |
| dev-sql | Migrations, seeds, runner, traductions EN « à relire » | `db/`, runner et CLI, nouveaux tests | Sonnet, medium |
| dev-contrats | Schémas Zod, OpenAPI 3.2.0, nullabilité alignée sur le SQL | `packages/contracts/src/<resource>/` | Sonnet, medium |
| dev-api | Une ressource hexagonale, règle « modules isolés », tests à 100 % | dossiers de sa ressource | Sonnet, high |
| dev-devops | Docker, compose prod, Caddy, CI, déploiement, durcissement ; build statique du front, CSP | `docker/`, `scripts/deploy/`, CI sous autorisation | Sonnet, low |
| dev-front | Un élément de base, une section ou un service du front : composants Vue accessibles, logique pure dans `app/domain/`, tests unitaires et de composants à 100 %, règle « modules isolés » du front | ses dossiers d'`apps/web` | Sonnet, high |
| qa | Matrices, conformité OpenAPI, sécurité HTTP, couverture, tests en échec attendu des défauts | tests seulement | Sonnet, medium |
| qa-front | Parcours Playwright, matrice taille × thème × langue avec axe, régression visuelle, tests en échec attendu des défauts du front | tests seulement | Sonnet, medium |
| revue-code | Revue adversariale en lecture seule, chaque finding reproduit, quatre contournements par le code ; grille Vue/Nuxt | `docs/revues/code-<date>.md` | Opus, high |
| revue-securite | Même méthode, grille sécurité, constats sans charge utile ; CSP, dépendances et bundle du front | `docs/revues/securite-<date>.md` | Opus, high |
| revue-pr | Revue adversariale du diff d'une pull request vers `develop`, lancée par le workflow de revue (lot 20) : règles de CLAUDE.md, intégrité des tests, sécurité, couverture des cas nouveaux ; constats gradués (bloquant, non bloquant) avec fichier et ligne, dernière ligne `VERDICT: OK` ou `VERDICT: BLOQUANT` | rien dans le dépôt (elle publie sa revue sur la PR par `gh pr comment`, le workflow lit le verdict dans sa réponse) | Opus, high |
| revue-a11y | Audit WCAG 2.2 AA / RGAA adversarial en lecture seule : clavier, arbre d'accessibilité, contrastes calculés, mouvement, zoom ; chaque finding constaté par une commande | `docs/revues/a11y-<date>.md` | Opus, high |
| triage | Rejoue, rejette les faux positifs, fusionne, ordonne, établit si un test est faux | `docs/revues/triage-<date>.md` | Sonnet, medium |
| correcteur | Corrige une liste de findings, un commit par finding, vérifications ciblées vertes sur base neuve (règle D26 : la CI de la pull request est l'unique vérification complète) ; seul à modifier un test établi faux | fichiers des findings | Sonnet, medium |

Contre le contournement des tests (décision de Julien, quatre couches) :

1. hooks de `.claude/settings.json` (`.claude/hooks/`) : refus des écritures d'oracles et de
   marqueurs, instantané comparé en fin de tâche, exception par autorisation nominative journalisée ;
2. `scripts/ci/check-tests-integrity.sh` dans la CI et `pnpm check` : test existant ou
   configuration protégée modifiés sans ligne `Justification-test`, marqueurs, commentaires
   d'ignore ; les tests de réserve ne sont pas dans le dépôt, le chef-de-projet les génère à chaque
   recette depuis le contrat OpenAPI ;
3. séparation des rôles et sortie honorable dans chaque fichier d'agent (CLAUDE.md,
   « Agents et garde-fous ») ;
4. recette du processus : diff des tests, journal des garde-fous, cycles édition-test, retrait
   d'un test au hasard ; les revues cherchent les contournements par le code.

## Modèles et efforts par rôle (décidé le 18 novembre 2026)

Objectif : économiser le quota du modèle haut de gamme. Le modèle monte avec le niveau de
jugement exigé, l'effort de raisonnement avec la difficulté de la tâche.

| Rôle / tâche | Modèle | Effort |
|---|---|---|
| Orchestrateur (session principale) | Fable 5.1 jusqu'à la limite hebdomadaire, puis Opus 5.5 | session |
| Chef de projet : backlog, alignement, comptes rendus | Sonnet 5.5 | medium |
| Chef de projet : recette d'un lot (exécution de commandes, contrôle de critères) | Sonnet 5.5 | medium |
| Dev base de données (SQL, runner, seeds, traductions EN) | Sonnet 5.5 | medium |
| Dev contrats (Zod, OpenAPI) | Sonnet 5.5 | medium |
| Dev API (lot 3, deux agents) | Sonnet 5.5 | high |
| QA (tests e2e) | Sonnet 5.5 | medium |
| DevOps (Dockerfile, compose prod, CI) | Sonnet 5.5 | low |
| Corrections après recette | Sonnet 5.5 | medium |
| Revue code et revue sécurité (lot 6, adversariales) | Opus 5.5 | high |
| Arbitrage d'un désaccord entre recette et dev, recette finale | Opus 5.5 | high |

Règle : on commence au niveau indiqué ; si un agent échoue deux fois sur la même tâche, on monte
d'un cran (effort puis modèle) plutôt que de boucler.
