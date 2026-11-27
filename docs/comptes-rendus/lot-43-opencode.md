# Lot 43 : Playwright borné par TEST_MAX_WORKERS (lead-architecte)

Branche `lot/43-playwright-workers` depuis `develop` (aab3f9f), date : 27 nov. 2026. Carte Trello #54.
Autorisation `config` L43-01 sur `apps/web/playwright.config.ts`. Aucun conteneur lancé.

## Fait

| Commit    | Contenu                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `38afc35` | `playwright.config.ts` lit `TEST_MAX_WORKERS` (environnement, puis `.env` racine déjà chargé), même expression régulière et même message que `vitest.config.ts`, passée à `workers` ; nouveau test `app/playwright-workers.spec.ts` (13 cas). `Justification-test: L43-01` |
| `25310b4` | CLAUDE.md, « Charge machine » : les parcours Playwright suivent la même borne                                                                                                                              |

## Décisions

- **Valeur vide = absente**, comme dans `vitest.config.ts` (`?? ''`). Le test s'en sert : `process.loadEnvFile`
  ne remplace pas une variable déjà présente, même vide (vérifié : `TEST_MAX_WORKERS= node -e
  "process.loadEnvFile(…)"` donne `""`), donc le cas « sans valeur » ne dépend pas du `.env` du worktree.
- **Test par un processus Node séparé** qui importe la configuration (Node 26 exécute son TypeScript) :
  la configuration est évaluée au chargement, un import dans le processus de Vitest n'aurait vu qu'une valeur.
  Écarté : extraire la règle dans `app/domain/` (du code de production pour un outil de test) ou modifier
  `vitest.config.ts` pour un projet de plus (hors autorisation). Le fichier tombe dans le projet `nuxt`
  (tout `app/**/*.spec.ts` hors `unit`), comme `cv-pdf.spec.ts`.
- **`--workers` l'emporte** : Playwright 1.65.1, `lib/common/index.js` l. 555,
  `takeFirst(configCLIOverrides.debug ? 1 : void 0, configCLIOverrides.workers, userConfig.workers, "50%")`.

## Vérifications

| Vérification                       | Commande                                                                             | Résultat                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------- |
| Test de la règle                   | `pnpm exec vitest run app/playwright-workers.spec.ts` (apps/web)                      | 13/13                             |
| Chargement par Playwright          | `pnpm exec playwright test --list test/smoke.e2e.ts` ; idem avec `TEST_MAX_WORKERS=0` | 35 tests listés ; arrêt, message  |
| Typecheck, lint                    | `pnpm --filter @siteperso/web typecheck`, `… lint`                                    | verts                             |
| Formatage                          | `pnpm exec prettier --check` sur les fichiers touchés                                 | vert                              |
| Tests (hook pre-commit)            | `lint`, `typecheck`, `test` de Turborepo                                              | 10/10 tâches                      |
| Intégrité                          | `pnpm integrity develop`                                                              | OK                                |

Non lancés (brief, D26) : `pnpm check`, parcours complets, mutation (aucun fichier de `domain/` ni `data/` touché),
couverture (aucun code de production ajouté).

## Points ouverts

1. `docs/agents-herdr.md` (l. 120 et 140) demande encore `--workers=2` en ligne de commande : devenu inutile
   avec `TEST_MAX_WORKERS=2` dans le `.env` racine, non modifié (hors fichiers du brief).
2. `node .claude/hooks/authorize.mjs list` demandé par le brief est refusé aux agents (« les scripts des
   garde-fous ne se lancent que depuis la session principale ») ; l'autorisation a été constatée par l'écriture
   acceptée du fichier. Une première écriture par `python3` a été refusée (« écriture opaque … qui mentionne un
   oracle ») ; refaite par l'outil d'édition.
3. Worktree neuf : `pnpm install` et `pnpm --filter @siteperso/contracts build` ont été nécessaires avant le
   typecheck.
