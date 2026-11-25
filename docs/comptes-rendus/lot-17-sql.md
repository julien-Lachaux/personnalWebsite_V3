# Lot 17 : dev-sql (BF-12, brief back-004)

## Fait

- `db/seeds/0004_experiences.sql` : `location` à `null` pour `openclassrooms-mentor`, en `fr` et en `en`
  (la colonne était déjà nullable : base, schéma Drizzle, contrat). Aucune migration.
- `docs/traductions-a-relire.md` : ligne `openclassrooms-mentor | location` retirée (plus de texte à relire).
- Nouveau test `apps/api/test/db/front-openclassrooms-location.e2e-spec.ts` : `GET /experiences` et `GET /cv`
  servent l'expérience avec `location: null` en `fr` et en `en` ; seules elle et la pause ont un lieu nul ;
  deux rejeux du seed laissent `experiences_translations` identique (md5) et le lieu nul.
- `TURBO_FORCE=true pnpm check` : vert, couverture 100 % (765/765, 232/232, 276/276, 745/745).
  `pnpm integrity develop` : OK. Conteneurs arrêtés par `pnpm db:down`.

## Non fait

Rien. Aucun test existant modifié.

## Décisions

- Le contrôle `assertEnglishTranslations` n'exige un champ `en` que si le `fr` a une valeur : `null` des deux
  côtés passe, comme pour la pause professionnelle. Aucun changement du runner.
- Commits : `feat(db)` pour le seed et la liste, `test(api)` pour le test.

## Points ouverts

- Le hook pre-commit a rejoué des journaux Turborepo issus du cache d'un autre worktree (`lot-F3b-coquille`) :
  défaut de cache partagé déjà connu. La preuve reste le `TURBO_FORCE=true pnpm check` ci-dessus.
- Aucun changement de contrat à transmettre à dev-contrats.
