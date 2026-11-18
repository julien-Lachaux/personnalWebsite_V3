# Lot 4 : QA

Branche `lot/4-qa` (dérivée de `v3/backend`, lots 0 à 3, 3 bis et 5 fusionnés). Périmètre tenu :
`apps/api/test/**`, `apps/api/src/**/*.spec.ts`, `apps/api/vitest.config.ts`, `apps/api/package.json`
(dépendances de test), ce compte rendu. Aucun code de production modifié. Un fichier hors liste
change mécaniquement : `pnpm-lock.yaml` (ajout des trois dépendances de développement).

## Fait (un commit par ticket, au minimum)

| Ticket | Livrable | Résultat |
| --- | --- | --- |
| L4-01 | `test/support/{fixtures,problem,validate,endpoints}.ts` + `harness.e2e-spec.ts` (le harnais se teste lui-même) | `test:e2e` passe deux fois de suite sans intervention |
| L4-02 | `matrix.e2e-spec.ts` : 12 routes x (sans lang, fr, en, EN, Fr, de, vide) + repli | 99 cas (12 x 6 = 72 exigés), assertion `ENDPOINTS.toHaveLength(12)` |
| L4-03 | `published-and-order.e2e-spec.ts` | 10 ressources en liste : non publié absent de la route et de `/cv`, `sort_order` modifié change l'ordre, expériences en `dateStart desc` (tie-break `sort_order`), compétence d'un groupe non publié masquée, compétence non publiée absente des listes imbriquées |
| L4-04 | `errors.e2e-spec.ts` (aucune occurrence de `501`) | 404, méthodes, HEAD/OPTIONS, 500 simulés sur les 11 dépôts + `/cv`, 503, réponse hors contrat |
| L4-05 | `security.e2e-spec.ts` (les cas helmet/CORS de `health.e2e-spec.ts` y sont déplacés ; `rate-limit.e2e-spec.ts` du lot 0 conservé, il couvre `/health`) | en-têtes sur 14 routes, CORS (dont multi-origines), préflight, 429 sur route de contenu, `TRUST_PROXY` |
| L4-06 | `openapi-conformance.e2e-spec.ts` (Ajv 8.20.0 + ajv-formats 3.0.1, 2020-12, `additionalProperties: false` forcé) | 12 routes x 2 langues, 400/404/429/500 déclarés, `docs.json` strictement égal à `dist/openapi.json`, tests négatifs |
| L4-07 | `controllers.spec.ts`, `to-problem-details.spec.ts`, `pending-migrations.spec.ts`, coverage v8 (`@vitest/coverage-v8` 5.1.1 = version de vitest) | lignes 88 %, branches 94,8 % (seuils 85 / 75) |
| hors ticket | `empty-database.e2e-spec.ts` : base migrée mais vide | voir « Base vide » |
| L4-08 | ce document | |

Total `pnpm check` : contrats 75, unitaires API 207, e2e API 412 (409 verts + 3 `it.fails` voulus).

## Anomalies (pour le lot 6)

Chaque anomalie est un test `it.fails` nommé `BUG-<n>` : il passe tant que le défaut existe et
devient rouge quand il est corrigé (il faut alors retirer `.fails`). Aucune anomalie n'est
bloquante ni de gravité haute.

### BUG-1 (faible) : URL à pourcentage invalide hors problem+json

- Reproduction : `curl -si 'http://localhost:3000/api/v1/%zz'`
- Attendu : 400 `application/problem+json` (CLAUDE.md : « le filtre global traduit tout en RFC 9457 »).
- Obtenu : 400 `application/json` `{"statusCode":400,"code":"FST_ERR_BAD_URL","error":"Bad Request","message":"'/api/v1/%zz' is not a valid url component"}`,
  sans aucun en-tête de sécurité (helmet n'est pas appliqué). Pas de fuite de pile ni de chemin.
- Cause : Fastify rejette l'URL avant le routage, donc avant le filtre Nest.
- Fichier soupçonné : `apps/api/src/infrastructure/http/create-app.ts` (option `frameworkErrors` du `FastifyAdapter`).
- Test : `errors.e2e-spec.ts`, `BUG-1`.

### BUG-2 (faible) : OPTIONS sans en-têtes de préflight

- Reproduction : `curl -si -X OPTIONS http://localhost:3000/api/v1/cv`
- Attendu : 204 ou un problem+json.
- Obtenu : 400 `text/plain` « Invalid Preflight Request », sans en-têtes de sécurité. Identique sur une
  route inconnue. Un vrai préflight (avec `Origin` et `Access-Control-Request-Method`) répond bien 204.
- Cause : `@fastify/cors` en `strictPreflight` (défaut), répond avant le routage.
- Fichier soupçonné : `create-app.ts` (`enableCors`, option `strictPreflight: false`) ou accepter l'écart.
- Test : `errors.e2e-spec.ts`, `BUG-2`.

### BUG-3 (faible) : les 404 échappent au rate limiting

- Reproduction : `for i in $(seq 1 105); do curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/v1/inconnu; done | sort | uniq -c`
  donne 105 x 404, jamais de 429 (quota par défaut : 100 par minute). Mesuré aussi sur l'API réelle.
- Attendu : le quota par IP est « global » (docs/02) et compte aussi les routes inconnues.
- Obtenu : seules les routes déclarées sont comptées (les 400 de `?lang=de` le sont, vérifié).
  Impact faible : réponse minuscule, aucun accès base.
- Cause : `@fastify/rate-limit` s'accroche aux routes via `onRoute` ; le gestionnaire 404 n'est pas limité.
- Fichier soupçonné : `create-app.ts` (`setNotFoundHandler` avec `rateLimit`, ou `global` + hook `onRequest`).
- Test : `security.e2e-spec.ts`, `BUG-3`.

## Base vide (migrée, sans seed)

Aucune route ne répond 5xx, en `fr`, `en` ou sans `lang` (`empty-database.e2e-spec.ts`).

- `GET /profile` : 404 problem+json (« Profil … introuvable »), `instance` = chemin demandé.
- Les 10 listes : 200 `[]`.
- `GET /cv` : **404 problem+json** (le profil manque, aucun CV partiel). Comportement cohérent avec
  `/profile` ; si l'on préfère un CV partiel, c'est une décision produit (profil nullable dans `Cv`).
- `/health` : 200, `/docs.json` : 200.

## Décisions et comportements livrés testés

1. **405 vs 404** : une méthode non déclarée (`POST`, `PUT`, `PATCH`, `DELETE`) sur une route existante
   répond **404** problem+json (« Cannot POST /api/v1/profile »), sans en-tête `Allow`. Testé tel quel. Le
   405 demanderait un contrôleur ou un hook dédié ; décision ouverte pour Julien (aucun impact de sécurité).
2. **`x-frame-options`** : `SAMEORIGIN` (défaut helmet) testé sur 14 routes. Si P9 tranche `DENY`, changer
   une ligne de `security.e2e-spec.ts` (commentaire en place).
3. **CSP** : aucune `content-security-policy` (choix du lot 0, API JSON). Assertion `toBeUndefined()` à
   inverser si P9 impose une CSP.
4. **`lang`** : strict `fr|en` minuscule. `EN`, `Fr`, `de`, vide et `lang` répété donnent 400 (P8 tranché dans le sens du contrat).
   Un paramètre inconnu (`?autre=1`) est ignoré (200).
5. **HEAD** : 200 avec les en-têtes du GET et corps vide ; 404 problem+json sur route inconnue.
6. **Préflight** : `GET, HEAD, OPTIONS` annoncés, `max-age` 600 ; les méthodes d'écriture ne sont jamais
   listées. Pas de `access-control-allow-credentials`.
7. **Pas de fuite** : `expectNoLeak` (chemins `/apps/api/`, `/home/`, `node_modules`, `x.ts:12:34`, « at fn (… ) »,
   clé `stack`) appliqué à chaque `expectProblem`. Les 500 simulés (dépôt qui lève un message piégé,
   réponse avec clé en trop) renvoient le détail générique.
8. **Couverture** : le seuil (lines 85, branches 75) porte sur le code testable sans PostgreSQL. Sont exclus
   en plus du schéma Drizzle, de `cli/` et de `main.ts` : dépôts Drizzle, client de base, `reset-database`,
   `seeds-runner`, modules Nest, `create-app.ts` et les fichiers de ports (interfaces et jetons). Ils sont
   exercés par les e2e. Sans ces exclusions les tests unitaires (sans base) ne dépasseraient pas ~50 %.
9. **Fixtures** : slugs préfixés `qa-`, supprimés par `withFixture` même en cas d'échec ; `restoreSeed: true`
   recrée la base seedée quand un test modifie des lignes seedées. L'ordre des suppressions respecte les clés
   étrangères.
10. **Rate limit des tests** : les fichiers qui dépassent 100 requêtes (matrice, filtrage, conformité,
    sécurité) posent `RATE_LIMIT_MAX=100000` avant `startTestApp()` et le restaurent.

## Non fait / cas non couverts

- Les e2e de ressource des lots 3 sont conservés tels quels (pas de doublon supprimé).
- Aucun test de charge ni de concurrence ; aucun test sur `NODE_ENV=production` (CORS, logs).
- Les contrôles de plage du contrat plus stricts que le SQL (`Project.year`, `Education.year*`, chaînes non
  vides) ne sont pas testés en e2e : insérer une valeur hors plage donnerait un 500 générique (point ouvert
  du lot 3 bis) ; l'insérer rendrait la base de test incohérente avec les seeds.
- `SkillGroup.description` reste `''` quand la base a `null` (point ouvert du lot 3 bis, non testé comme défaut).
- Pas de test de la durée de `/cv` (le lot 3 bis en a un).

## Points ouverts

- Décisions à trancher : 405 vs 404 (1), `DENY` vs `SAMEORIGIN` (2), CSP (3), `/cv` sur base vide : 404 ou CV partiel.
- Les e2e codent les effectifs du seed en dur (`ENDPOINTS.seededCount` : 1, 7, 34, 8, 0, 0, 0, 3, 3, 2 ;
  `skills[0].groupSlug`, slugs `typescript`, `languages-frameworks`) : tout changement de seed est à répercuter
  dans `test/support/endpoints.ts`.
- Un autre agent écoutait déjà sur le port 3092 (API de l'époque du lot 0, routes en 501) pendant cette
  recette : les vérifications sur API réelle ont été faites sur le port 3492 (`apps/api/.env` local).
- `helmet` envoie `cross-origin-resource-policy: same-origin` : sans effet pour un `fetch` CORS, mais un
  `<img>` ou `no-cors` cross-origin serait bloqué ; à garder en tête si des images sont servies par l'API.
- La réponse 404 reflète le chemin demandé dans `detail` et `instance` (JSON, pas de risque XSS) ; noté, pas un défaut.
