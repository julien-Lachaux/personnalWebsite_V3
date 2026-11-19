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
- Jamais de commit ni de push par un agent sans autorisation explicite. Proposition : Julien
  autorise un commit par lot sur une branche `v3/backend`, l'orchestrateur ne pousse jamais.
- Aucun e-mail ni téléphone nulle part dans le repo.
- Traductions EN du contenu : produites par l'agent base de données, marquées « à relire » pour Julien.
- Chaque agent livre un compte rendu court : fait, non fait, décisions prises, points ouverts.

## Volume

Environ 10 agents, 2 points de contrôle. Coût de référence attendu : de l'ordre de plusieurs
millions de tokens au total ; le lot 3 et le lot 6 sont les plus coûteux.

## Flux Git (validé le 18 novembre 2026)

- `master` : commit initial des documents. `v3/backend` : branche d'intégration, seule branche
  que l'orchestrateur fait avancer.
- Une branche et un worktree par lot (`lot/0-fondations`, `lot/1-sql`, `lot/2-contrats`,
  `lot/3-api-a`, `lot/3-api-b`, `lot/4-qa`, `lot/5-devops`, `lot/6-corrections`).
- Commits atomiques, un par micro-tâche, Conventional Commits en français :
  `feat(db): migration 0001 tables profil et traductions`. Aucun commit si lint et tests ne
  passent pas (hook pre-commit posé au lot 0).
- Fusion dans `v3/backend` par l'orchestrateur avec `--no-ff` après recette du chef de projet :
  commits atomiques conservés, un commit de merge par lot.
- Jamais de push par un agent. Les conflits sont résolus par l'orchestrateur avant fusion.
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

| Agent | Mission | Écrit | Modèle, effort |
|---|---|---|---|
| lead-architecte | Fondations, fichiers partagés, outillage de test, de CI et garde-fous, arbitrage | tout le dépôt (oracles sous autorisation) | Opus, high |
| chef-de-projet | Backlog, recette d'un lot (critères et processus), recette finale depuis un clone, synthèses, points de contrôle | backlog et comptes rendus seulement | Sonnet, medium (Opus à l'appel pour la recette finale) |
| dev-sql | Migrations, seeds, runner, traductions EN « à relire » | `db/`, runner et CLI, nouveaux tests | Sonnet, medium |
| dev-contrats | Schémas Zod, OpenAPI 3.2.0, nullabilité alignée sur le SQL | `packages/contracts/src/<resource>/` | Sonnet, medium |
| dev-api | Une ressource hexagonale, règle « modules isolés », tests à 100 % | dossiers de sa ressource | Sonnet, high |
| dev-devops | Docker, compose prod, Caddy, CI, déploiement, durcissement | `docker/`, `scripts/deploy/`, CI sous autorisation | Sonnet, low |
| qa | Matrices, conformité OpenAPI, sécurité HTTP, couverture, tests en échec attendu des défauts | tests seulement | Sonnet, medium |
| revue-code | Revue adversariale en lecture seule, chaque finding reproduit, quatre contournements par le code | `docs/revues/code-<date>.md` | Opus, high |
| revue-securite | Même méthode, grille sécurité, constats sans charge utile | `docs/revues/securite-<date>.md` | Opus, high |
| triage | Rejoue, rejette les faux positifs, fusionne, ordonne, établit si un test est faux | `docs/revues/triage-<date>.md` | Sonnet, medium |
| correcteur | Corrige une liste de findings, un commit par finding, deux `pnpm check` verts sur base neuve ; seul à modifier un test établi faux | fichiers des findings | Sonnet, medium |

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
