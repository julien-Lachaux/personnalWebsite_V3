# Lot 9 : décisions de Julien du 19 novembre 2026 (agent correcteur)

Branche `lot/9-decisions`, dérivée de `v3/backend` (7fa5e83). Source : `docs/revues/decisions-2026-11-19.md`
(DEC-1 à DEC-4 et un écart résiduel documenté). Un commit par entrée, test écrit avant la correction,
`pnpm check` vert avant chaque commit. Isolation Docker `siteperso-v3-lot9` (ports 5672 et 5673).

Chiffres finaux (base de test neuve, `pnpm check` deux fois de suite verts) : contrats 104, unitaires API 315
(base : 296), e2e API 544 (base : 480), couverture fusionnée 859 tests, **100 %** sur les quatre métriques
(instructions 711/711, branches 236/236, fonctions 246/246, lignes 692/692). `pnpm integrity v3/backend` : OK.

## Fait, par entrée

| Finding | Commit | Ce qui change | Preuve |
| --- | --- | --- | --- |
| DEC-1 | `bcc4e43` | `translated(en, fr, 'champ')` sert la ligne `en` entière si elle existe (`case when en.locale is null then fr.col else en.col end`), sinon la ligne `fr` entière : plus de `coalesce` champ par champ. Onze dépôts adaptés (la liste des colonnes `select` ne change pas, les doublures unitaires restent valides). Contrôle de fin de seed `assertEnglishTranslations` : une `en` d'entité publiée avec une colonne nulle ou un tableau vide là où la `fr` a une valeur fait échouer le seed, avec la liste des champs. | Nouveaux e2e `language-fallback` (3 cas rouges sur 4 avant : `location`, `stackLabel`, `achievements`, `logo` de Contentsquare servis en `fr` dans une ligne `en`) et `db/seeds-english-completeness` (3 cas rouges sur 6 avant). Les seeds du dépôt sont déjà complets (requête SQL sur toutes les paires fr/en : aucune lacune) : aucune traduction ajoutée à `docs/traductions-a-relire.md`. |
| DEC-2 | `be913fa` | Hook Fastify `preHandler` (`create-app.ts`) : méthode hors `GET`, `HEAD`, `OPTIONS` sur une route existante (`fastify.findRoute`) donne 405 problem+json avec `Allow: GET, HEAD, OPTIONS` ; route inconnue : 404 inchangé. Posé après l'analyse du corps : 413 et 400 de corps restent prioritaires (tests existants intacts). `docker/Caddyfile` : Caddy ne répond plus lui-même aux écritures, il laisse passer vers l'API (réponse identique en dev et en prod ; `request_body` 1 Kio conservé). | e2e `errors` : 9 cas rouges avant (405 attendu, 404 reçu), verts après. Essai réel : API sur l'hôte derrière `caddy:2` en conteneur, `POST /api/v1/profile` donne 405 + `Allow` en direct et via Caddy, `POST /api/v1/inconnu` 404 des deux côtés. |
| DEC-3 | `6beceee` | helmet : `X-Frame-Options: DENY` et `Content-Security-Policy: default-src 'none';frame-ancestors 'none'` ; mêmes en-têtes dans `FRAMEWORK_ERROR_HEADERS` (erreurs avant routage). `Caddyfile` : sous `/api/*`, `?Content-Security-Policy` et `?X-Frame-Options "DENY"` (posés seulement si l'API ne l'a pas fait : jamais de double divergent) ; l'ancien `X-Frame-Options "SAMEORIGIN"` global, qui aurait écrasé le DENY de l'API, est replacé sur la page statique seule ; `docs/deploiement.md` à jour. | Nouveau e2e `security-headers` (8 cas : 200, HEAD, 400, 404, 405, OPTIONS, URL mal encodée, en-tête unique) et assertions de `security` et `errors` (BUG-1) inversées. Essai Caddy réel : un seul `x-frame-options` et une seule CSP, valeurs identiques en direct et via Caddy. `caddy validate` : configuration valide. |
| DEC-4 | `4ccf346` | Migration `0010_soft_delete.sql` : `deleted_at timestamptz null` sur les 11 tables d'entité (profil compris). Schéma Drizzle et dépôts : `deleted_at is null` partout (compétences et groupes, `groupSlug` des ressources, liaisons, `/cv`). `seeds-convergence.ts` : entité écrite par les seeds puis retirée des fichiers marquée `deleted_at = now()` (fin de l'avertissement « ATTENTION … conservée », RC-4), remise à `null` si elle réapparaît, traductions et liaisons conservées ; contrôles `fr` et `en` ignorent les marquées. `db:deleted:list` et `db:deleted:purge --older-than <jours>` (`cli/deleted-*.ts`, `infrastructure/db/deleted-entities.ts`) : simulation sans `--confirm`, une transaction, groupes de compétences supprimés en dernier, annulation complète si une clé étrangère refuse, refus en production sans `ALLOW_PRODUCTION_PURGE=yes`. Scripts dans `package.json` racine et `apps/api/package.json`, `db/README.md`, `docs/deploiement.md` (commandes Docker de production). | Nouveaux e2e `soft-delete` (16 cas : 10 tables servies puis absentes de leur route et de `/cv` en fr et en, liaisons, groupe, profil 404), `db/soft-delete-seeds` (8 cas), `db/deleted-entities` (16 cas), unitaires `deleted-purge-arguments`, `deleted-list`, `deleted-purge`. Essai réel en dev : `pnpm db:deleted:list`, `purge --older-than 30` (simulation), sans argument (code 1), `--confirm`. |
| Écart résiduel | `3cbc514` | `docs/deploiement.md` : section « Écart connu entre développement et production » (URL mal encodée, `400 text/plain` de Caddy). Documentation seule. | Relu contre le comportement mesuré : l'API seule répond 400 problem+json sur `/api/%zz`. |

## Tests existants modifiés (autorisation 65b59b8c, ticket DEC-2026-11-19)

Chaque commit porte `Justification-test: DEC-<n> <raison>`. Sortie des anciennes versions des quatre fichiers
rejouées contre le code final : 27 échecs sur 130 tests, tous des assertions de l'ancien comportement ; les 103
autres passent (aucun autre test touché).

| Fichier | Modification | Avant (ancienne version, code final) | Après |
| --- | --- | --- | --- |
| `src/infrastructure/db/translated.spec.ts` (DEC-1) | Réécrit pour `translated(en, fr, 'champ')` : SQL `case when … else … end`, pas de `coalesce`, types conservés | 2 échecs (`produit coalesce(en, fr)…`, alias) | 4 verts |
| `test/errors.e2e-spec.ts` (DEC-2, DEC-3) | Bloc « méthodes autres que GET » : 405 + `Allow` au lieu de 404 ; BUG-1 : `DENY` au lieu de `SAMEORIGIN`. Le test « corps JSON invalide : 400 » est inchangé | 9 échecs (404 reçu pour 405 attendu, `SAMEORIGIN`) | 55 verts |
| `test/security.e2e-spec.ts` (DEC-3) | `DENY` et CSP présente au lieu de `SAMEORIGIN` et CSP absente | 15 échecs (14 routes + erreur applicative) | verts |
| `test/db/seeds.e2e-spec.ts` (DEC-4) | Le cas RC-4 « signale sans la supprimer » attend désormais le marquage `deleted_at` et l'absence d'`ATTENTION` | 1 échec (`expected false to be true`) | 16 verts |

Aucun test e2e de ressource (`apps/api/test/*.e2e-spec.ts`) n'attendait de mélange de langues : aucun n'a eu
à changer pour DEC-1 (leurs lignes `en` fixtures sont complètes ou lacunaires des deux côtés).

## Non fait

Rien de l'ordre du jour n'est resté en suspens. Deux fichiers partagés, non cités par le document, n'ont pas
été touchés (voir Points ouverts) : `CLAUDE.md` et `docs/02-stack-technique.md`.

## Décisions

- **405 produit par un hook `preHandler`**, pas par le filtre ni un hook `onRequest` : un `onRequest` aurait
  masqué le 413 et le 400 de corps que des tests existants, non cités comme faux, exigent encore. La détection
  de « route existante » passe par `fastify.findRoute({ method: 'GET', url })` : le routeur décide (décodage,
  barre finale, query string), pas une liste de chemins écrite à la main.
- **Caddy laisse passer les écritures** (au lieu de garder un 405 de première ligne) : son corps JSON fixe ne
  peut pas porter `detail` ni `instance`, ni distinguer route connue et inconnue ; seul le passage à l'API
  rend la réponse identique. Les protections qui subsistent chez Caddy (plafond de corps 1 Kio, en-têtes)
  doublent celles de l'API.
- **Contrat OpenAPI inchangé** : un 405 concerne les méthodes non déclarées, pas les opérations `GET`
  documentées ; l'ajouter à chaque route casserait les tests de forme du document (`['400','404','429','500']`)
  sans décrire d'opération réelle.
- **CSP identique des deux côtés** (`default-src 'none';frame-ancestors 'none'`, sans espace, forme émise par
  helmet) et préfixe `?` de Caddy : l'API fait foi, Caddy ne pose sa valeur qu'en son absence.
- **Profil inclus dans le soft delete** (« chaque table d'entité ») : la colonne et le filtre existent, mais le
  seed ne marque jamais le profil (ligne unique, sans slug) ; un profil marqué à la main donne 404 sur
  `/profile` et `/cv`.
- **Confirmation de purge par `--confirm`** (déterministe et scriptable, y compris via `docker compose run`),
  simulation par défaut ; acquittement de production par `ALLOW_PRODUCTION_PURGE=yes`. La simulation reste
  permise en production.
- **`--older-than`** : entier de jours, `0` = tout ce qui est marqué.
- Convergence : une entité marquée garde ses traductions et liaisons (elles « suivent » l'entité) ; la purge
  les emporte par `on delete cascade`.

## Points ouverts

1. **`CLAUDE.md`** (fichier partagé non cité par le document) : la liste des commandes devrait mentionner
   `pnpm db:deleted:list` et `pnpm db:deleted:purge --older-than <jours> [--confirm]`, et le paragraphe « Règles
   hexagonales » le soft delete. À appliquer par l'orchestrateur.
2. **`docs/02-stack-technique.md`**, section « Parité développement / production » : la phrase « Les protections
   posées par Caddy (405 sur les écritures, …) » n'est plus exacte, Caddy ne répond plus de 405. Le document est
   une décision validée : à reformuler par l'orchestrateur.
3. **`413` et `502` de Caddy** : mesurés pendant l'essai, ils sont en `text/plain` derrière Caddy (le `413` de
   l'API seule est en problem+json). Consigné dans `docs/deploiement.md` ; à confirmer comme acceptable avec
   l'écart `/api/%zz` (le document de décisions parle d'un « seul écart »).
4. **Déploiement** : la migration `0010` s'applique au prochain `compose run --rm migrate` ; le service `migrate`
   ne lance pas les commandes `db:deleted:*`, qui se lancent à la main (commandes dans `docs/deploiement.md`).
5. Les commandes `db:deleted:*` supposent le rôle propriétaire (`DATABASE_URL` de `migrate`) ; le rôle de
   lecture seule de l'API ne peut pas supprimer.
