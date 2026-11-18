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
| Tests | Vitest (unitaires), Vitest + supertest/`app.inject` (e2e contre un Postgres Docker) | |
| Qualité | TypeScript strict, ESLint + Prettier, husky facultatif | |
| Conteneurs | Docker multi-stage, docker-compose dev (api + postgres) et prod (Caddy + api + web + postgres) | VPS Docker, même topologie que la V2 |

### Politique de versions
Toujours les versions majeures les plus récentes de chaque brique (vérifiées sur le registre au moment de l'ajout, épinglées exactement). Si une incompatibilité apparaît, on en discute avec Julien avant de rétrograder.

## Règles « Rust-friendly »
- Architecture hexagonale : `domain` (types, règles, aucune dépendance Nest), `application`
  (cas d'usage), `infrastructure` (Drizzle, HTTP). Nest n'apparaît que dans `infrastructure/http`.
- Pas de décorateurs métier, pas de pipes magiques : les DTO sont des schémas Zod, la validation
  est un appel explicite.
- Le SQL est la source de vérité du schéma ; les types Drizzle en découlent.
- Réponses JSON stables et documentées, erreurs au format RFC 9457 (problem+json).
- Sécurité dès le départ : en-têtes HTTP (helmet), CORS restreint au domaine du front,
  rate limiting global léger, 404 propres, aucune donnée personnelle dans les réponses.

## Front (stack validée, développement différé au design)
| Brique | Choix |
|---|---|
| Framework | Nuxt 3 (Vue 3, TypeScript) en rendu hybride : pages générées à partir de `GET /cv`, hydratation légère |
| i18n | `@nuxtjs/i18n`, FR par défaut, EN, URLs préfixées (`/en/...`) |
| Styles | à définir avec le design (CSS moderne avec tokens de design system ; pas de framework utilitaire imposé) |
| Accessibilité | WCAG 2.1 AA minimum : sémantique, `<h1>` par vue, focus visible, `prefers-reduced-motion`, contrastes vérifiés automatiquement, tests axe en CI |
| Tests | Vitest + Vue Test Utils, Playwright + axe pour l'e2e accessibilité |

## Hébergement
VPS, Docker Compose, Caddy en frontal (TLS automatique), aucun port base de données exposé.

## Monorepo
```
personnalWebsite_V3/
  apps/api/            NestJS
  apps/web/            Nuxt (plus tard)
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
