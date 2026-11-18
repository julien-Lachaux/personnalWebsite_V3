# Base de données : migrations et seeds SQL

Le SQL est la source de vérité du schéma (docs/01). Drizzle ne génère rien : ses types sont
dérivés de ces fichiers. Tout le contenu du site vit ici, versionné, relisible depuis n'importe
quel langage (le portage Rust reprendra ces fichiers tels quels).

## `migrations/` : schéma

- Nommage : `NNNN_description.sql`, numéro sur quatre chiffres, croissant, sans trou
  (`0001_enums.sql`, `0002_profile.sql`…). La description est en anglais, en snake_case.
- Un fichier = une évolution de schéma cohérente, appliquée dans une transaction.
- Une migration appliquée ne se modifie plus jamais : on en ajoute une nouvelle.
- Conventions SQL : snake_case, `text` plutôt que `varchar(n)`, `not null` par défaut,
  clés étrangères explicites avec `on delete`, tables de traduction `<table>_translations`
  à clé primaire composite `(<table>_id, locale)`.
- `pnpm db:migrate` (`apps/api/src/infrastructure/db/migrations-runner.ts`) applique les fichiers
  dans l'ordre. Chaque fichier non encore appliqué passe dans une transaction (`begin`, exécution,
  insertion dans `schema_migrations`, `commit` ; `rollback` au moindre échec). Un verrou
  `pg_advisory_lock` sérialise les runners concurrents. Deux fichiers de même préfixe sont refusés.
- Table `schema_migrations` : `version` (préfixe `NNNN`, clé primaire), `name` (nom du fichier sans
  `.sql`), `checksum` (SHA-256 du contenu), `applied_at`. Le checksum est comparé à chaque
  exécution : un fichier appliqué puis modifié fait échouer le runner (erreur « checksum »).

## `seeds/` : contenu

- Nommage : `NNNN_description.sql` également (`0001_cv_2026_11.sql`).
- Idempotence obligatoire : chaque seed peut être rejoué sans erreur ni doublon.
  Clé naturelle : le `slug` ; écriture en `insert … on conflict (slug) do update set …`.
  Les tables de traduction utilisent `on conflict (<table>_id, locale) do update`.
- Les seeds référencent les lignes par `slug` (sous-requêtes), jamais par id numérique.
- Aucune donnée personnelle de contact (e-mail, téléphone) : le contact est géré par le front.
- Traductions `fr` obligatoires, `en` fournies et marquées « à relire » dans un commentaire SQL
  si elles n'ont pas été validées.

## Exécution

Les bases de dev et de test sont fournies par `docker-compose.yml` (`pnpm db:up`,
`pnpm db:test:up`).

- `pnpm db:migrate` applique les migrations sur la base de `DATABASE_URL`.
- `pnpm db:seed` exécute tous les seeds dans l'ordre, chacun dans une transaction, à chaque appel
  (idempotents, pas de table de suivi) ; il échoue si une migration est en attente.
- `pnpm db:reset` : `drop schema public cascade; create schema public`, puis migrate et seed.
  Refusé quand `NODE_ENV=production`.
- Les e2e appellent `resetTestDatabase()` (`apps/api/test/support/database.ts`), même séquence
  sur la base de test.
