# Lot 10 : pile locale complète (dev-devops)

Date : 2026-11-19. Branche `lot/10-pile-locale`. Décision de Julien : pouvoir reproduire sur le poste les
problèmes de production avec Caddy.

## Fait

- `pnpm stack:up | stack:ps | stack:logs | stack:down [--volumes]` (`scripts/deploy/local-stack.sh`) : la pile
  locale est la pile de production, avec `docker/compose.prod.yml`, `docker/Caddyfile` et l'image
  `siteperso-api:prod` tels quels. Aucun override compose : tout passe par `docker/.env.local`
  (modèle `docker/.env.local.example`, copie ignorée par git, créée au premier `stack:up` avec des mots de
  passe générés, droits 600).
- `stack:up` construit l'image, démarre, attend `/api/v1/health` via Caddy (180 s max, sinon affiche l'état
  et échoue). `stack:down` ne supprime les volumes qu'avec `--volumes` explicite.
- Le nom de projet est passé par `-p` : une `COMPOSE_PROJECT_NAME` du shell ou du `.env` racine primerait
  sinon sur celle du fichier d'environnement (bug rencontré, voir décisions).
- `apps/api/test/local-stack.e2e-spec.ts` : 10 scénarios rejoués contre la pile (profil, 405, 413, 404,
  400 mal encodée, 301 HTTP vers HTTPS, rôle PostgreSQL en lecture seule, réseaux internes, 429, 502).
  Détection explicite ; sans pile un test unique le consigne et réussit ; `STACK_REQUIRED=1` le fait échouer.
  `apps/api/test/local-stack-script.e2e-spec.ts` : refus des commandes inconnues et de `down -v`, simulation,
  génération du `.env.local` (mots de passe hexadécimaux uniques, droits 600).
- Documentation : `docs/deploiement.md` (section « Pile locale complète » remplaçant « Essai local » : commandes,
  tableau des différences, certificat, 10 scénarios curl), README (un paragraphe), CLAUDE.md (commandes).
- `.gitignore` : `!.env.local.example` ajouté ; `docker/.env.local` reste ignoré (vérifié avec `git check-ignore`).

## Non fait : job CI (refusé par les garde-fous)

L'écriture de `.github/workflows/ci.yml` est refusée par le hook (« Aucune autorisation `config` de
l'orchestrateur pour l'agent dev-devops »). Je n'ai pas contourné. Job à ajouter par l'orchestrateur (actions
épinglées par SHA comme les autres jobs ; `Justification-test` à mettre dans le commit) :

```yaml
  pile-locale:
    name: Pile locale complète (Caddy, API, PostgreSQL) et scénarios de production
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres: # base de test exigée par le setup global du projet e2e, indépendante de la pile
        image: postgres:16-alpine
        env: { POSTGRES_DB: siteperso_test, POSTGRES_USER: siteperso, POSTGRES_PASSWORD: siteperso }
        ports: ['5433:5432']
        options: >-
          --health-cmd "pg_isready -U siteperso -d siteperso_test" --health-interval 2s
          --health-timeout 3s --health-retries 15
    env:
      DATABASE_URL: postgres://siteperso:siteperso@localhost:5433/siteperso_test
      CORS_ORIGIN: http://localhost:3001
      STACK_REQUIRED: '1'
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
      - uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with: { node-version: '${{ env.NODE_VERSION }}', cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm stack:up
      - run: pnpm --filter @siteperso/api exec vitest run --project e2e local-stack
      - name: Journaux (échec)
        if: failure()
        run: pnpm stack:ps && docker compose -f docker/compose.prod.yml --env-file docker/.env.local logs --no-color --tail 200
      - name: Arrêt et nettoyage
        if: always()
        run: pnpm stack:down --volumes
```

Durée : build de l'image sans cache de couches, mesuré 56 s en local (stack:up complet, caches Docker
chauds en partie) ; à attendre 2 à 4 min sur un runner. Acceptable ; si besoin, `docker/build-push-action`
avec cache GHA. Le test existant `prod-compose.e2e-spec.ts` (épinglage SHA des actions) couvrira le nouveau
job tel quel.

## Écarts local / production (aussi dans docs/deploiement.md)

| Élément               | Production        | Local                       | Raison                                       |
| --------------------- | ----------------- | --------------------------- | -------------------------------------------- |
| Projet compose        | siteperso-v3-prod | siteperso-v3-local          | isoler conteneurs, réseaux, volumes          |
| Ports hôte            | 80 / 443          | 8080 / 8443                 | ports privilégiés, souvent occupés           |
| Domaine / certificat  | public, Let's Encrypt | `localhost`, autorité interne Caddy | pas de DNS ni d'ACME                  |
| CORS_ORIGIN           | https://domaine   | https://localhost:8443      | suit domaine et port                         |
| Mots de passe         | secrets serveur   | générés au poste            | aucun secret réel hors serveur               |
| `alt-svc`             | `h3=":443"`       | `h3=":443"` alors que 8443  | Caddy annonce son port interne, sans effet HTTP/1.1 et 2 |
| Quota, image, réseaux, durcissement, en-têtes | identiques | identiques | volontaire |

## Décisions

- Pas de `compose.local.yml` : les variables d'environnement suffisent (ports, domaine, projet), l'exigence
  « override minimal si indispensable » n'est donc pas déclenchée. Pas de montage de `dist/` : l'image est
  reconstruite (cache de couches), c'est plus fidèle à la production.
- Image nommée `siteperso-api:prod` (nom du compose de prod, `migrate` l'utilise avec `pull_policy: never`),
  gardée sur le poste après `stack:down`.
- 429 : quota identique à la production (100 par 60 s), reproduit par 101 requêtes ; le fichier d'essai
  attend la fin de la fenêtre avant de commencer et le scénario 502, en redémarrant l'API, remet le quota à
  zéro.
- Les tests utilisent HTTP/1.1 via `node:https` : en HTTP/2, curl signale une erreur de flux (code 92) sur
  `/api/%zz` ; avec `--http1.1` on lit bien le 400 de Caddy.
- Détection sans marqueur de saut : la pile absente enregistre un autre test (`if`/`else` à l'enregistrement),
  pas de `skip`.
- Redirection HTTP vers HTTPS : 301 (`redir … permanent` du Caddyfile).
- Couverture : seul du code de test et des scripts shell ajoutés, `apps/api/src` inchangé : 100 % maintenu
  (`pnpm check` vert).

## Vérification

- `docker compose down -v` puis `pnpm check` : vert deux fois (pile démarrée : 561 tests e2e dont les 10
  scénarios ; pile absente : 552). Premier essai en échec, cause trouvée et corrigée : la
  `COMPOSE_PROJECT_NAME` du `.env` racine (chargé par vitest) primait sur celle de la pile, d'où
  « service postgres is not running » et un 429 au lieu du 502 ; correction par `-p` explicite.
- Scénarios à la main (pile `siteperso-v3-lot10-stack`, HTTPS 8713, HTTP 8712) :
  - 1 : `200`, `content-type: application/json`, un seul `x-frame-options: DENY`, un seul
    `content-security-policy: default-src 'none';frame-ancestors 'none'`, ni `server` ni `via`.
  - 2 : `405`, `allow: GET, HEAD, OPTIONS`, `application/problem+json`, corps `{"type":"about:blank","title":"Method Not Allowed","status":405,…}`.
  - 3 : `413`, `text/plain`, `x-frame-options: DENY`, corps `413 Request Entity Too Large`, pas de `server`.
  - 4 : `404 application/problem+json`, `"detail":"Cannot GET /api/v1/inconnue"`.
  - 5 : `curl --http1.1 --path-as-is` : `400 Bad Request`, `text/plain`, `Connection: close` ; sans `--http1.1`,
    curl sort en code 92.
  - 6 : `301 Moved Permanently`, `Location: https://localhost:8713/api/v1/profile?a=1`, sans `server`.
  - 7 : 105 requêtes : `100 × 200`, `5 × 429`, `application/problem+json`, `retry-after: 58`.
  - 8 : API arrêtée : `502`, `text/plain`, `x-frame-options: DENY`, corps `502 Bad Gateway`, pas de `server`.
  - 9 : `ERROR: permission denied for schema public`.
  - 10 : `nc: bad address 'postgres'` (Caddy) ; `ENETUNREACH` vers 1.1.1.1:443 (API).
  - Confiance dans l'autorité : `docker compose … cp caddy:/data/caddy/pki/authorities/local/root.crt`
    puis `curl --cacert` sans `-k` : réponse reçue (429 de l'API, donc TLS validé).
- `pnpm stack:down --volumes` : plus aucun conteneur, réseau ni volume des projets `siteperso-v3-lot10*`
  (le réseau `siteperso-v3-fix-prod_internal` visible sur l'hôte appartient à un autre travail, non touché).
  Reste l'image `siteperso-api:prod` (volontaire).

## Points ouverts

- Job CI à ajouter par l'orchestrateur (voir plus haut).
- `alt-svc: h3=":443"` en local : si un client HTTP/3 est un jour utilisé en local, publier le même port côté
  hôte et conteneur (non traité : sans effet aujourd'hui).
- La base locale garde ses mots de passe dans le volume : supprimer `docker/.env.local` sans `stack:down
  --volumes` désynchronise le rôle ; documenté.
- Sur le serveur réel : rien de nouveau à relever, la pile locale n'y est pas déployée.
