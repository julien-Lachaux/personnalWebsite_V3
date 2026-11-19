# Décisions du 19 novembre 2026 à implémenter (lot 9)

Document de l'orchestrateur, tenant lieu de triage pour le correcteur. Chaque entrée est une décision de
Julien déjà tranchée et inscrite dans `docs/01` ou `docs/02` : elle ne se rediscute pas. Les tests
existants cités sous « Tests établis faux par décision » encodent l'ancien comportement : leur
modification est autorisée (portée `tests`, ticket `DEC-2026-11-19`) et chaque commit qui les touche
porte `Justification-test: DEC-<n> <raison>`. Tout autre test existant reste intouchable.

Règle transverse (docs/02, « Parité développement / production ») : ce que l'API répond en production,
elle le répond en développement. Les protections de Caddy ne font que doubler celles de l'API.

## DEC-1 : repli de langue par ligne (ex RC-7)

- **Décision** (docs/01) : si la traduction `en` d'une entité existe, elle est servie entière ; sinon la
  ligne `fr` est servie entière. Jamais de mélange de langues dans une même entité. Une traduction `en`
  d'une entité publiée doit être complète (mêmes colonnes non nulles que la `fr`, tableaux non vides si le
  `fr` en a) : le seed échoue sinon, comme pour le contrôle `fr` du lot 6 (RC-11).
- **Reproduction du comportement actuel** : `translated.ts` fait `coalesce(en.col, fr.col)` champ par
  champ ; sur l'expérience Contentsquare, `/experiences?lang=en` donne `logo.alt` en français et
  `achievements: []` alors que le `fr` en a trois.
- **Fichiers** : `apps/api/src/infrastructure/db/translated.ts` et les onze dépôts Drizzle qui l'utilisent,
  `seeds-runner.ts` (contrôle de complétude `en`), seeds `db/seeds/*.sql` si une traduction `en` est
  incomplète (compléter ou retirer la ligne `en`, traduction marquée « à relire » dans
  `docs/traductions-a-relire.md`).
- **Tests établis faux par décision** : ceux qui attendent un mélange de langues ou un repli champ par
  champ, dans `apps/api/src/infrastructure/db/translated.spec.ts` et les e2e de ressources
  (`apps/api/test/*.e2e-spec.ts`, `apps/api/test/db/seeds.e2e-spec.ts`). Ajouter les tests du nouveau
  comportement : ligne `en` entière, repli `fr` entier, seed refusé sur `en` incomplet.

## DEC-2 : 405 avec `Allow` sur une méthode non déclarée

- **Décision** (docs/01) : une méthode non déclarée sur une route existante répond `405` problem+json avec
  l'en-tête `Allow: GET, HEAD, OPTIONS`, produit par l'API elle-même. Une route inconnue reste `404`.
- **Reproduction** : `POST /api/v1/profile` répond `404` problem+json « Cannot POST … » (défaut NestJS) ;
  derrière Caddy, `405`. Écart dev/prod.
- **Fichiers** : `apps/api/src/infrastructure/http/create-app.ts` et `problem/*` ; `docker/Caddyfile`
  (Caddy garde son 405 en première ligne, mais la réponse doit être identique : problem+json et `Allow`,
  ou laisser passer vers l'API) ; contrat OpenAPI si une réponse 405 doit y figurer
  (`packages/contracts/src/openapi/document.ts`, fichier partagé : modification autorisée par cette entrée).
- **Tests établis faux par décision** : `apps/api/test/errors.e2e-spec.ts` (bloc « méthodes autres que
  GET »), `apps/api/test/prod-compose.e2e-spec.ts` si le format Caddy change.

## DEC-3 : `X-Frame-Options: DENY` et CSP posée par l'API

- **Décision** (docs/01, docs/02) : `X-Frame-Options: DENY` côté API ; la politique de sécurité de contenu
  aujourd'hui posée par Caddy seulement (`default-src 'none'; frame-ancestors 'none'` sous `/api/*`) est
  posée par l'API (helmet), Caddy ne faisant que la doubler sans la contredire (pas de double en-tête
  divergent).
- **Reproduction** : `curl -sI` sur l'API seule : `x-frame-options: SAMEORIGIN`, aucun
  `content-security-policy`.
- **Fichiers** : `create-app.ts` (helmet), `docker/Caddyfile`, `docs/deploiement.md` si la procédure cite
  les en-têtes.
- **Tests établis faux par décision** : `apps/api/test/security.e2e-spec.ts` (SAMEORIGIN, CSP absente),
  `apps/api/test/errors.e2e-spec.ts` (SAMEORIGIN sur BUG-1), `apps/api/test/prod-compose.e2e-spec.ts` si
  les en-têtes y sont comparés.

## DEC-4 : soft delete partout

- **Décision** (docs/01) : chaque table d'entité porte `deleted_at timestamptz null`, distinct de
  `published`. Le seed marque `deleted_at = now()` quand une entité écrite par les seeds disparaît des
  fichiers (à la place de l'avertissement « ATTENTION … conservée » du lot 6, RC-4), et remet `deleted_at`
  à `null` si elle réapparaît. L'API ne sert jamais une ligne marquée ; les traductions et liaisons suivent
  leur entité (non servies). Le nettoyage physique est manuel : commandes `db:deleted:list` (lister les
  entités marquées, par table, avec la date) et `db:deleted:purge --older-than <jours>` (supprimer
  physiquement, avec confirmation explicite, refusé en production sans variable d'acquittement), dans
  `apps/api/src/cli/` et `apps/api/src/infrastructure/db/`, testées à 100 %.
- **Fichiers** : nouvelle migration `db/migrations/0010_soft_delete.sql`, schéma Drizzle, dépôts
  (`where deleted_at is null`), `seeds-convergence.ts`, `seeds-runner.ts`, `package.json` racine et
  `apps/api/package.json` (scripts `db:deleted:*`, fichiers partagés : autorisés par cette entrée),
  `db/README.md`, `docs/01` déjà à jour.
- **Tests établis faux par décision** : dans `apps/api/test/db/seeds.e2e-spec.ts`, le cas « entité retirée
  signalée et conservée » (RC-4) ; dans `apps/api/test/db/schema-constraints.e2e-spec.ts` ou
  `published-and-order.e2e-spec.ts` si les colonnes y sont énumérées. Ajouter : entité retirée → marquée,
  non servie par toutes les routes et par `/cv`, réapparue → démarquée ; commandes list et purge.

## Écart résiduel documenté (ne pas corriger)

Une URL mal encodée (`/api/%zz`) est rejetée par Caddy avant l'API, en `400 text/plain`, alors que l'API
seule répond en problem+json. Aucun réglage de Caddy ne produit du problem+json : à consigner dans
`docs/deploiement.md` comme seul écart dev/prod connu.
