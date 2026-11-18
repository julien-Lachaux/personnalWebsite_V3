# Base de données : migrations et seeds SQL

Le SQL est la source de vérité du schéma (docs/01). Drizzle ne génère rien : ses types sont
dérivés de ces fichiers. Tout le contenu du site vit ici, versionné, relisible depuis n'importe
quel langage (le portage Rust reprendra ces fichiers tels quels).

## `migrations/` : schéma

- Nommage : `NNNN_description.sql`, numéro sur quatre chiffres, croissant, sans trou
  (`0001_profile.sql`, `0002_skills.sql`…). La description est en anglais, en snake_case.
- Un fichier = une évolution de schéma cohérente, appliquée dans une transaction.
- Une migration appliquée ne se modifie plus jamais : on en ajoute une nouvelle.
- Conventions SQL : snake_case, `text` plutôt que `varchar(n)`, `not null` par défaut,
  clés étrangères explicites avec `on delete`, tables de traduction `<table>_translations`
  à clé primaire composite `(<table>_id, locale)`.
- Le runner (lot 1) applique les fichiers dans l'ordre et mémorise ceux déjà passés dans la
  table `schema_migrations (version, applied_at)`.

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

Le runner de migrations et de seeds arrive au lot 1 (`pnpm db:migrate`, `pnpm db:seed`).
En attendant, les bases de dev et de test sont fournies par `docker-compose.yml`.
