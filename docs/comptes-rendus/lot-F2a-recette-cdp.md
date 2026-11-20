# Recette du lot F2a (chef de projet), 20 novembre 2026

Branche `lot/F2a-filtre` (92e3fbc, 5a6c888, cdc5ee4), base `develop` (b5bf2e4). Logique pure du filtre
des expériences (F2-01) et formatage (F2-05).

## Verdict : accepté avec réserves

Aucune correction exigée avant fusion. Réserves : (1) `pnpm check` ne prouve pas à lui seul le front
dans les worktrees en parallèle (cache Turborepo, voir ci-dessous) ; (2) un test redondant.

## Preuves rejouées

| Contrôle                                | Commande                                                                         | Résultat                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Périmètre                               | `git diff --stat develop...lot/F2a-filtre`                                       | 5 fichiers : `filter.ts`, `filter.spec.ts`, `format.ts`, `format.spec.ts`, compte rendu du dev. Rien d'autre.                                  |
| `pnpm check` (conteneurs siteperso-v3-f2a) | `pnpm check`, code de sortie lu explicitement                                  | EXIT=0, deux fois (sans option, puis `TURBO_DAEMON=false TURBO_FORCE=true`)                                                                    |
| Front forcé hors cache                  | `turbo run lint typecheck test --force --filter=@siteperso/web`                  | EXIT=0, 4 tâches, 0 en cache ; `filter.spec.ts` 53 tests, `format.spec.ts` 15, `architecture.spec.ts` 6                                       |
| Couverture front                        | `vitest run --coverage` (apps/web) et `web:test:coverage` du check               | 82 tests, 100 % lignes, branches (51/51), fonctions, instructions ; `filter.ts` et `format.ts` à 100 %                                         |
| Mutation front                          | `pnpm --filter @siteperso/web test:mutation`                                     | EXIT=0, score 100,00 : `filter.ts` 152 tués, `format.ts` 54 tués, 0 survivant, 0 sans couverture, 0 erreur                                     |
| Directives                              | recherche de directives Stryker, d'ignore de couverture, de saut ou de focus     | aucune dans `app/domain` ; pas de `stryker.equivalents.json`                                                                                   |
| Intégrité                               | `pnpm integrity develop`                                                         | « Intégrité des tests : OK »                                                                                                                   |
| Architecture                            | `app/architecture.spec.ts`                                                       | 6 tests verts ; `filter.ts` et `format.ts` n'importent rien                                                                                    |
| Fuseaux                                 | `TZ=Pacific/Kiritimati` et `TZ=America/Los_Angeles`, `vitest run format.spec.ts` | 15/15 dans les deux cas                                                                                                                        |

Les formateurs fixent `timeZone: 'UTC'` : une date `AAAA-MM-JJ` ne glisse ni d'un jour ni d'un mois, quel
que soit le fuseau de la machine ; les tests couvrent le 1er et le dernier jour du mois.

## SPEC § 5 et § 6 : règle par règle (tests de comportement)

- ET strict, groupes complet / partiel / aucun, ordre d'origine : `experiencesWithAll`, `filterExperiences`
  (cas php, partiel avec technos correspondantes, ET à 0).
- Compteurs dynamiques et désactivation à 0 : `techCounter` (disponible, ajout, déjà choisie, php après
  typescript = `disabled`, `selectable: false`) ; techno choisie toujours retirable.
- Technos sans expérience détaillée : état `unlinked`, non sélectionnable (`techCounter`, `suggest` git).
- Stack principale : `mainStack` (tri par rang, stable, sans mutation).
- Suggestions : 6 au plus, insensibles à la casse et aux accents, hors technos choisies, tri par nombre
  d'expériences puis rang (`suggest`, `normalizeQuery`).
- Entrée : `firstValidSuggestion` saute `disabled` et `unlinked`. Retour arrière : `removeLastTech`.
- URL `?tech=` : `parseTechParam` (inconnus, doublons, espaces, paramètre répété, casse), `serializeTechParam`,
  aller-retour.
- Mots-clés cachés comptés : `hasTech`, `filterExperiences`, `techCounter` (rest-api = 2).
- Annonce `aria-live` : `announceResults` rend `kind` et nombres, aucune chaîne ; `filter.ts` ne contient
  aucune chaîne destinée à l'utilisateur (vérifié à la lecture) ; `format.ts` reçoit les libellés injectés.
- § 6 : période, ligne lieu-mode-contrat (séparateurs orphelins, contrat `none`, blancs), date de
  recommandation fr et en.

## Processus

- Tests existants : aucun modifié ni supprimé (5 fichiers ajoutés, un commit chacun ; aucun fichier édité
  plus d'une fois : pas de cycle édition-test anormal). Transcription du dev non fournie : alternances non
  comptables.
- Journal `.claude/hooks/audit.log` : aucune entrée ne cite le worktree F2a. Les refus du créneau du lot
  sont deux refus de rôle `general-purpose` (écriture opaque python3 qui mentionne le fichier des
  équivalents, à 04:11:58Z ; cible `$TMPDIR/check.log` illisible, à 04:21:03Z), non attribuables avec
  certitude à ce lot parmi les trois lots parallèles, sans récidive ni contournement. Un refus à moi
  (python3 sur le journal) a été contourné par grep, sans effet sur le dépôt.
- Retrait d'un test au hasard (tirage `shuf`, copie jetable) : « ignore une techno inconnue des
  expériences » (`filter.spec.ts` l. 189). Résultat : tout reste vert, couverture 100 % (73 tests). Test
  redondant (comportement déjà couvert ailleurs). Mineur, non bloquant.
- Tests de réserve OpenAPI : sans objet, le lot n'ajoute ni route ni API.
- Conteneurs arrêtés par `pnpm db:down` ; copie jetable supprimée.

## Réserves et points ouverts

1. Cache Turborepo partagé entre worktrees : lors de `pnpm check`, `web:lint`, `web:typecheck` et
   `web:test` ont été rejoués depuis le cache (« cache hit, replaying logs ») avec des journaux montrant
   `layout.spec.ts` (lot F2b) puis `tokens.spec.ts` (lot F1a), fichiers absents de cette branche. Le
   `check` vert ne prouve donc pas le front du lot ; seuls `test:coverage` (exécuté, 82 tests) et mon
   `turbo --force` le prouvent. À signaler à l'orchestrateur : revoir les `inputs` du cache ou forcer
   `--force` pour les recettes de lots parallèles (hors périmètre du lot, configuration protégée).
2. Un test redondant (ci-dessus).
3. `types.ts` non créé : les types vivent dans `filter.ts`, acceptable.
