# Recette CdP du lot F1 bis (20 novembre 2026)

Branche `lot/F1bis-ajustements` (1e218d0, base 961a2e6), worktree du lot, isolation `siteperso-v3-f1bis`
(5882 à 5885). Journaux dans le dossier temporaire de session, préfixe `recette-f1bis-`.

## Verdict : accepté avec réserves

Tous les critères rejoués sont verts. Réserves : hauteur de puce 29,2 px pour « ~28 px », test tiré au
hasard retiré sans effet sur la suite (test documentaire), points ouverts du lead non traités (agents
protégés, néon du survol de la puce pointillé).

## Critères rejoués

| Critère | Commande | Résultat |
|---|---|---|
| Check forcé, conteneurs neufs | `docker compose down -v` puis `TURBO_FORCE=true pnpm check` | code 0 ; 12 tâches sur 12 exécutées, 0 en cache, puis 4 de couverture 0 en cache ; unitaires 220 / 430 / 353, e2e API 753, Playwright front 252, couverture 100 % ; aucun « Failed to resolve » |
| Check non forcé, conteneurs neufs | `pnpm check` | code 0 ; 10 tâches en cache sur 12 (lint, typecheck, test des trois paquets, build contrats), `api:test:e2e` et `web:test:e2e` exécutés ; journaux rejoués tous de ce worktree (chemins `lot-F1bis-ajustements`) |
| Intégrité | `pnpm integrity develop` | « Intégrité des tests : OK » (divergence 961a2e6) |
| Hooks | `pnpm hooks:test` | 549 / 549 |
| Tâches de `pnpm check` | script `check` inchangé ; tâches du journal | aucune retirée ; `web#test:e2e` gagne `lint`, `typecheck`, `test` en `dependsOn` |

Première tentative de check forcé interrompue par mon propre `timeout` (code 124) puis par un `pkill`
trop large de ma part (code 144) : erreurs de manipulation de la recette, relancé proprement, code 0.

## D13 : démonstration rejouée (worktree détaché jetable, `pnpm install`, supprimé)

- Premier `turbo run test --filter=@siteperso/web` : « Remote caching disabled » seul (pas de « shared
  worktree cache »), `web:test: cache miss, executing c4d1ae82734274ad`, 24 fichiers passés. La même
  empreinte existe dans le worktree du lot, sans partage : le miss exécute bien les tests ici.
- Second passage : `cache hit`, journal `> … scratchpad/recette-f1bis-wt/apps/web` (son propre journal).
- Ajout d'une ligne à `apps/web/app/app.vue` : `web:test: cache miss, executing 37c5a8c5d154db9e`.
- Modification de `eslint.config.js` et `tsconfig.base.json` : `turbo run lint typecheck test
  --dry=json`, les 10 empreintes changent, dont les 6 des contrats et de l'API, que ni `app.vue` ni
  `apps/web` ne touchent (ex. `contracts#lint` 0939dbd4… vers d42cb51c…, `api#typecheck` 636536d2… vers
  b284fddc…).
- `turbo.json` : `cacheDir` relatif, `globalDependencies`, `web#test` avec `.env.test`. Conforme.

## D12

- Contraste de `#66798a` recalculé (formule WCAG, `recette-f1bis-contrast.mjs`) : bg 3,92 ; card 3,52 ;
  top 3,27 ; bar 3,21 (≥ 3:1) ; `--line` décoratif 1,95 / 1,75 / 1,63 / 1,60, inchangé.
- `tokens.css` absent du diff (`git diff --stat`), son test de fidélité n'est pas touché ; le token vit
  dans `control-tokens.css`, chargé après `tokens.css` dans `nuxt.config.ts`.
- Composants passés au token (diff) : `TechChip`, `Switch`, `SegmentedControl`, `Popover`, `button.css`
  (secondaire) : identique à la liste du compte rendu ; la puce pointillé garde `--line`.

## D17

`TechChip` : le bloc `@media (max-width: 1023px)` à 44 px est retiré, `min-width` et `min-height` à
`--target-min` (24px). `controls.e2e.ts` : 9 tests sur 7 tailles = 63, tous verts dans le Playwright
(252). Mesure du lead 29,2 px pour « environ 28 px » : voir réserves.

## Clés communes

`fr/common.json` et `en/common.json` : mêmes cinq clés (`close`, `opensInNewTab`, `expand`, `collapse`,
`showDetails`), comparaison des clés sans écart ; `i18n-common.spec.ts` et `i18n-messages.spec.ts` verts.

## Processus

- Commits touchant `turbo.json` : b98d5e0 et d5be36c portent chacun `Justification-test: F1bis …`.
- Journal des garde-fous, autorisation 49daa543 (chemins `turbo.json`, `apps/web/turbo.json`) : 3
  usages `authorized` (06:25:22, 06:25:29, 06:45:10), tous sur `turbo.json`, rien hors chemins ;
  `apps/web/turbo.json` non créé. Refus du lead : scripts et python en ligne illisibles (06:14, 06:17,
  06:25), non répétés après passage à l'Edit autorisé.
- Aucun test existant modifié ni supprimé : `git diff 961a2e6...HEAD` en M ne liste que `CLAUDE.md`, 5
  composants, `common.json` fr/en, `nuxt.config.ts`, `turbo.json` ; aucune ligne supprimée dans les
  `*.spec.ts` / `*.e2e.ts` ; aucun marqueur de saut, de focus ni d'ignore de couverture dans les 4
  fichiers de test ajoutés.
- Cycles édition-test : plus fort décompte par fichier 2 commits (`turbo.json`, `TechChip.vue`,
  `control-tokens.css`), sous le seuil de 5.
- Retrait d'un test au hasard (`shuf -n 1`, clone jetable) : tiré
  `control-tokens.spec.ts` « le --line décoratif du handoff reste inchangé en sombre… » ; retiré,
  `pnpm test:coverage` du front : 352 tests passés (353 avant), aucun échec ni seuil rompu. Tout reste
  vert : ce test est une assertion de valeur sur `tokens.css` sans code propre à couvrir, et la
  fidélité au handoff est aussi gardée par le test de `tokens.css`. Redondance documentaire, pas une
  couverture sans assertion ; à noter, pas bloquant.
- Tests de réserve OpenAPI : sans objet, aucun fichier d'API, de contrats ni de base touché par ce lot
  (diff).

## Réserves et points ouverts

1. Hauteur des puces 29,2 px (interligne 1,3) pour « 28 px » de D17 ; bornée 24 ≤ h < 32 par le test.
   Question fermée pour Julien : 29,2 px est-il acceptable ?
2. `.claude/agents/dev-front.md` et `revue-a11y.md` disent encore « cibles de 44 px » sans l'exception
   D17 : à corriger par l'orchestrateur (chemins protégés).
3. Néon au survol de la puce pointillé non interactive : correction proposée par le lead, non faite.
4. Cache du checkout principal à vider après fusion des lots en cours (ignoré par git).
