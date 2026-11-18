# Organisation du développement multi-agent (back-end V3)

Proposition du 18 novembre 2026, à valider par Julien avant lancement.

## Rôles

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
