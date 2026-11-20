# Stack technique V3

Décisions du 18 novembre 2026. Objectif : back-end TypeScript simple, testable, dont le contrat
d'API et le schéma SQL pourront être portés en Rust sans réécriture du modèle.

## Back-end (périmètre immédiat)
| Brique | Choix | Pourquoi |
|---|---|---|
| Runtime | Node.js dernière ligne stable (26 au 18 nov. 2026), pnpm | décision : toujours la version la plus récente ; en cas de problème, on en discute ensemble |
| Framework | NestJS sur adaptateur Fastify | expertise de Julien, structure en modules qui se transpose en crates/modules Rust |
| Base | PostgreSQL 16 | |
| Accès données | Drizzle ORM + driver `postgres` | requêtes proches du SQL, schéma explicite, zéro magie |
| Migrations | SQL manuel, runner maison minimal | décision : tout le contenu est géré en SQL |
| Validation | Zod (DTO et query params) | schémas réutilisables par le front via `packages/contracts` |
| Contrat API | OpenAPI **3.2.0** généré depuis Zod par `@asteasolutions/zod-to-openapi` (générateur V32), servi en JSON, `info.version` 1.0.0 | 3.2.0 = plus haute version émise par utoipa 6 côté Rust (spec courante 3.2.1, pas encore outillée des deux côtés) |
| Tests | Vitest : deux projets `unit` et `e2e` (`app.inject` contre un Postgres Docker) dans une seule configuration, couverture v8 fusionnée avec seuil 100 % sur lignes, branches, fonctions et instructions (décision du 19 nov. 2026 : aucun code non testé, aucune exclusion de production, aucun commentaire d'ignore) ; test par mutation Stryker Mutator (`pnpm test:mutation`, lanceur Vitest, vérificateur TypeScript), décidé le 19 nov. 2026 en trois phases : phase 1 livrée (lot 11, mesure de référence sur les unitaires, sans seuil, hors `pnpm check`), phase 2 livrée (lot 12, cadrage validé le 19 nov. 2026) : aucun mutant survivant non justifié sur le code atteignable par les unitaires ; seuil `thresholds.break` de chaque paquet relevé au score obtenu, jamais abaissé (lot 12 : contrats 100, API 40) ; équivalents déclarés nominativement dans `stryker.equivalents.json` sous autorisation et Justification-test ; deux motifs d'exclusion seulement (métadonnées déclaratives du schéma Drizzle, contexte des messages de journal) ; libellés du document OpenAPI protégés par un instantané ; job CI dédié, hors `pnpm check` ; phase 3 (e2e : survivants et mutants sans couverture unitaire mis en réserve) selon la durée mesurée | |
| Qualité | TypeScript strict, ESLint + Prettier, husky facultatif | |
| Conteneurs | Docker multi-stage, docker-compose dev (api + postgres) et prod (Caddy + api + web + postgres) | VPS Docker, même topologie que la V2 |

### Politique de versions
Toujours les versions majeures les plus récentes de chaque brique (vérifiées sur le registre au moment de l'ajout, épinglées exactement). Si une incompatibilité apparaît, on en discute avec Julien avant de rétrograder.


### Parité développement / production
Aucun écart fonctionnel entre dev et prod (décision du 19 nov. 2026) : ce que l'API répond en production,
elle le répond en développement, pour faciliter le débogage et éviter les bugs non reproductibles.
Les protections posées par Caddy (limite de taille de corps, en-têtes de sécurité, CSP) sont d'abord
implémentées dans l'API ; Caddy ne fait que les doubler en première ligne (en-têtes posés seulement si
l'API ne l'a pas fait, écritures transmises à l'API qui répond elle-même 405). Écarts résiduels connus,
consignés dans `docs/deploiement.md` : les réponses produites par Caddy lui-même avant l'API (URL mal
encodée 400, corps trop grand 413, API injoignable 502) sortent en `text/plain`, pas en problem+json.
## Règles « Rust-friendly »
- Architecture hexagonale : `domain` (types, règles, aucune dépendance Nest), `application`
  (cas d'usage), `infrastructure` (Drizzle, HTTP). Nest n'apparaît que dans `infrastructure/http`.
- Pas de décorateurs métier, pas de pipes magiques : les DTO sont des schémas Zod, la validation
  est un appel explicite.
- Le SQL est la source de vérité du schéma ; les types Drizzle en découlent.
- Réponses JSON stables et documentées, erreurs au format RFC 9457 (problem+json).
- Sécurité dès le départ : en-têtes HTTP (helmet), CORS restreint au domaine du front,
  rate limiting global léger, 404 propres, aucune donnée personnelle dans les réponses.

## Front (stack validée ; décisions D1 à D8 de `docs/05`, validées par Julien le 19 nov. 2026)
| Brique | Choix |
|---|---|
| Framework | Nuxt 4 (Vue 3, TypeScript strict), dernière majeure (D1 : Nuxt 4.6.4 et `@nuxtjs/i18n` 10.6.0 au 19 nov. 2026) ; génération statique (`nuxt generate`) à partir de `GET /cv` pour fr et en, aucun serveur Node du front en production (D2) |
| i18n | `@nuxtjs/i18n`, FR par défaut sans préfixe, EN, URLs préfixées (`/en/...`), `lang` et `hreflang` |
| Styles | CSS natif et variables (`tokens.css` du handoff v6), base en `rem` ; polices auto-hébergées (D6) ; pas de framework utilitaire |
| Accessibilité | WCAG **2.2** AA (inclut le 2.1 AA initial, D4) : sémantique, `<h1>` par vue, focus visible, `prefers-reduced-motion`, contrastes vérifiés, axe dans les e2e sur chaque section, deux thèmes et contraste renforcé |
| Tests | Vitest (unitaires et composants avec `@nuxt/test-utils` et Vue Test Utils), couverture 100 % sur `apps/web/app` sans exclusion (D3) ; mutation Stryker sur `app/domain` et `app/data` ; Playwright + axe pour les parcours, navigateurs dans l'image Docker officielle de Playwright (rien d'installé sur l'hôte) |
| Statistiques | aucune pour l'instant (D8) |

## Hébergement
VPS, Docker Compose, Caddy en frontal (TLS automatique), aucun port base de données exposé.

## Monorepo
```
personnalWebsite_V3/
  apps/api/            NestJS
  apps/web/            Nuxt 4 (génération statique)
  packages/contracts/  schémas Zod + types partagés + OpenAPI exporté
  db/migrations/       SQL manuel
  db/seeds/            contenu SQL idempotent
  docker/              Dockerfiles, Caddyfile
  docs/                décisions et état des lieux
```
pnpm workspaces + Turborepo pour les tâches (`build`, `test`, `lint`).

## Hors périmètre V3
Comptes, authentification, admin, CRUD, upload de fichiers, formulaire de contact et envoi
d'e-mail (le contact est un `mailto:` et un lien LinkedIn dans le front).
