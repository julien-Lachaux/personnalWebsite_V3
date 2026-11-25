# Lot F9a-MERGE : correcteur

Autorisation 417c0ce4 (tests : `apps/web/app/error.spec.ts`, `apps/web/test/csp.e2e.ts`), règle D23.

| Fichier | Avant | Après |
| --- | --- | --- |
| `apps/web/app/error.spec.ts` | conflit add/add | version de develop (F7), `git checkout --theirs` puis `git add` ; 0 marqueur |
| `apps/web/test/csp.e2e.ts` | `csp.e2e.ts` seul, 7 tailles : 14 échecs (`/en/accessibilite` en 404, `/en/route-inconnue` en erreur d'hydratation car `404.html` servi au lieu de `en/404.html`) | `documentFor` sert `en/404.html` sous `/en` et `/en/…`, `404.html` ailleurs ; `/en/accessibilite` devient `/en/accessibility` ; 0 échec |

Aucune violation CSP dans les deux cas : les échecs venaient de l'émulation du proxy et du chemin, pas de la CSP.

## Vérifications (état fusionné)

- Playwright `csp.e2e.ts` + `pages.e2e.ts`, `--workers=2` : 161 passed.
- `@siteperso/web` lint, typecheck : OK. `test:coverage` : 1046 tests passés, 100 %.
- `pnpm integrity develop` : voir le commit (résultat consigné ci-dessous par l'orchestrateur si besoin).

Journaux : `scratchpad/f9a-merge-*.log`.
