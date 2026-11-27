# Lot 46 — BF-16 motif de cvPath (brief back-006, RS-1) — compte rendu (OpenCode, dev-contrats)

## Fait

- **Motif contrat** `packages/contracts/src/profile/profile.ts` : `SITE_PATH_PATTERN` passe de
  `/^\/[^/\s]\S*$/` à `/^\/[^/\s\\]\S*$/` — refuse désormais l'antislash `\`, notamment en 2e position
  (`/\h.example/x.pdf`, que le navigateur résout en `//h.example`, hôte externe) ; commentaire FR mis à jour.
  Rien d'autre changé : description contrat intacte, règle générique de chemin statique conservée (`/cv.pdf`
  reste valide au contrat), `javascript:…`, URL absolue, `//hôte`, espaces restent refusés.
- **Test contrat** `packages/contracts/src/profile/profile.cv-path.spec.ts` (nouveau fichier, aucun test
  existant modifié) : `/cv/cv-fr.pdf` accepté ; `/\h.example/x.pdf`, `/\cv.pdf`, `//host/x.pdf`, `/\\host/x.pdf`,
  `javascript:alert(1)`, `https://host/x.pdf` refusés ; `/cv.pdf` accepté au contrat (contrainte `/cv/%`
  appliquée côté base). Couverture : `packages/contracts` 100 % exigée et atteinte.
- **Migration** `db/migrations/0017_cv_path_prefix.sql` (nouvelle, idempotente) : sur `profile_translations`
  (la colonne `cv_path` y est, pas sur `profile`), `drop constraint if exists profile_translations_cv_path_prefix_check`
  puis `add constraint profile_translations_cv_path_prefix_check check (cv_path like '/cv/%')`.
  Cohérente avec les seeds `db/seeds/0001_profile.sql` (`/cv/cv-fr.pdf`, `/cv/cv-en.pdf`) et s'ajoute à la
  contrainte `cv_path <> ''` (0016). Style SQL FR, source de vérité.
- **Instantané OpenAPI** `packages/contracts/src/openapi/__snapshots__/openapi.json` régénéré via
  `vitest run -u src/openapi/document.snapshot.spec.ts` : seul changement, `pattern` de `cvPath`
  `^\/[^/\s]\S*$` → `^\/[^/\s\\]\S*$`. Sous autorisation `tests` BF16-01 (dev-contrats).

## Non fait

- Rien d'autre : pas de front, pas d'autre contrat, pas de seeds, pas de `docs/`, pas de `.claude/`.
- Migration **non appliquée** à une base : pas de conteneur autorisé (`pnpm db:migrate` à lancer en
  environnement avec base ; rejouable sans erreur grâce à `if exists`, et les seeds restent conformes).
- Pas d'e2e, pas de mutation, pas de `pnpm check` (interdit D26 brief).

## Décisions

- `Justification-test: BF16-1 …` sur le commit de l'instantané (finding BF16-1, brief lot 46), aucun test
  existant modifié, aucun `skip`/`fixme`/`only`, aucun commentaire d'ignore.
- Scope `fix(db)` pour la migration (`fix(contracts)` pour le motif + test), Conventional Commits FR,
  trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Nom de contrainte `profile_translations_cv_path_prefix_check`, séparée de `profile_translations_cv_path_check`.
- Pattern exactement `/^\/[^/\s\\]\S*$/` (motif suggéré du brief) ; `\` n'est refusé qu'en 2e position
  (un `\` plus loin dans le chemin ne peut pas déplacer l'hôte ; `new URL` le résout en `/`, même origine).

## Vérifications (ciblées D26)

- `pnpm --filter @siteperso/contracts build` ✅ (tsc + `openapi:export`)
- `pnpm --filter @siteperso/contracts test` ✅ (30 fichiers, 228 tests, dont `profile.cv-path.spec.ts` 8 et
  instantané OpenAPI)
- `pnpm integrity develop` ✅ (intégrité des tests, `Justification-test` vérifiée)
- `pnpm format:check` ✅ (Prettier tout dépôt, `docs/` exclu ; SQL sans parser ignoré)
- hook pre-commit Husky à chaque commit : `format:staged` + lint + typecheck + test des 3 paquets ✅
- sanity `node` : `new URL('/\\h.example/x.pdf', 'https://site.example')` → `https://h.example/x.pdf` et le
  nouveau motif refuse `/\h.example/x.pdf`, accepte `/cv/cv-fr.pdf`, `/cv.pdf`, refuse `//host/x.pdf`,
  `javascript:alert(1)`.
- `pnpm install` ré-exécuté : `apps/web`/`apps/api` n'avaient pas de `node_modules` dans le worktree
  (le hook pre-commit lançait tous les paquets).

## Points ouverts

- Aucun. Migration à faire appliquer par l'orchestrateur (`pnpm db:migrate`, puis `pnpm db:seed`) en
  environnement avec base ; carte Trello #72 (exemple `docs/01` `/cv.pdf`) déjà séparée, hors périmètre.

## Commits

Voir `git log --oneline develop..HEAD`. Le dernier commit est ce compte rendu.
