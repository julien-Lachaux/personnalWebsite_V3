# Recette du lot F6b (placeholder de la section IA vide, D27) : chef de projet, 22 nov. 2026

PR #11 `lot/F6b-ia-vide` -> develop, tête `1e7b6c6`.

## Verdict : renvoyée en correction (un bloquant, durée en dur)

## Preuves

- CI `pull_request` run 45025926811 sur `1e7b6c6` : tous les jobs verts (Front lint/typecheck/couverture 100 %, Playwright + axe sur les 6 tailles, Qualité, e2e API, mutation contrats/API/front, Garde-fous, pile locale, Docker, analyse statique). Seul le job « Revue PR (Claude) » est en échec.
- Revue : `VERDICT: BLOQUANT` (commentaire de github-actions sur la PR, commit relu `1e7b6c6`). Constat confirmé par lecture : `AiPlaceholder.vue:103` `animation: ai-placeholder-blink 1.1s steps(1) infinite` ; `motion.css` ne porte que `--dur-slide`, `--dur-egg-line`, `--dur-egg-bar`. CLAUDE.md : « jamais une durée écrite en dur ». Correction attendue : `--dur-cursor-blink` ajouté dans `motion.css` (lead-architecte, fichier partagé, avec ses variantes à 0,01 ms), puis usage dans le composant.
- `pnpm integrity origin/develop` : OK (divergence c4ed6bf). Base de comparaison : `origin/develop` (le `develop` local est en retard et gonfle le diff).
- Périmètre (`git diff --stat origin/develop...HEAD`, 8 fichiers) : `ai/AiPlaceholder.vue`, `ai/AiPlaceholder.spec.ts`, `ai/axe-placeholder.spec.ts`, `home/HomePage-ai-placeholder.spec.ts`, `HomePage.vue` (+ `<AiPlaceholder v-else />` et commentaire), `ai.json` fr/en, compte rendu. Conforme. Aucun test existant modifié (trois specs nouveaux, `HomePage.spec.ts` intact).
- Accessibilité par lecture du code et des tests : texte réel lu (3 lignes, fr et en testées) ; invite `$`, curseur et picto `aria-hidden` (picto `focusable=false`) ; non interactif (test : ni bouton, lien, champ, tabindex, p, titre, role, aria-label) ; mouvement réduit assuré par `base.css` (animation-duration 0,01 ms et 1 itération, réglage et `prefers-reduced-motion`) ; tokens existants tous présents (`--violet`, `--violet-bg`, `--border-thin`, `--radius-window`, `--content-max`, `--font-size-*`, `--muted`, `--accent`) ; aucune taille en px (seul `1024px` de media query, comme les autres composants). Seule entorse : la durée du clignotement.
- Étapes 3 à 6 du processus (journal des garde-fous, cycles, retrait au hasard, tests de réserve OpenAPI) : non faites ; lot front sans changement d'API ni de contrat, et la recette se limite aux contrôles demandés.

## À lister (non corrigé, non bloquant)

- `apps/web/app/components/home/HomePage.spec.ts:139` : le titre « sans section IA, rien n'est affiché dans la section » est devenu inexact (le test reste vert car il ne cherche que des `<p>`). Passage du correcteur avec `Justification-test`.
- D27 absent de `docs/05-front-organisation.md` : à consigner par l'orchestrateur.

## Réserves

- Captures et contraste mesuré en navigateur (`--muted` sur `--violet-bg`, deux thèmes, contraste renforcé) reportés à F8 (accepté par l'orchestrateur, génération sans IA refusée par les garde-fous hors dépôt).

## Points ouverts

- Après correction : nouvelle CI sur la tête et nouveau `VERDICT:` à relire.

## Recette de contrôle (23 nov.)

Tête examinée : db4fdee. Contrôles ciblés, sans `pnpm check` ni mutation (D26).

- CI : run 45150874512 vert sur la tête (jobs front, couverture, 7 parcours Playwright + axe, mutation contrats/API/front, garde-fous, pile Docker). Dernière revue de la PR : `VERDICT: OK`.
- Bloquant levé : `--dur-cursor-blink: 1100ms` dans `motion.css`, avec `0.01ms` sous mouvement réduit (variantes `prefers-reduced-motion` et `data-motion`). `AiPlaceholder.vue` l'utilise (`animation: … var(--dur-cursor-blink)`). Test `cursor-tokens.spec.ts` ajouté.
- D28 : `ai.json` fr et en portent `ai.placeholder.text` = « placeholder ». Seules modifications de tests existants : `HomePage.spec.ts` (titre du cas renommé, assertions inchangées) et `i18n-hardcoded.spec.ts` (une ligne ajoutée à `SAME_IN_BOTH`). Rien d'affaibli. Commit d423071 porte `Justification-test: F6b-D28`. `audit.log` : les autorisations 3d751685 et d520207c ne servent que sur `AiPlaceholder.spec.ts`, `HomePage-ai-placeholder.spec.ts`, `HomePage.spec.ts` et `i18n-hardcoded.spec.ts`.
- `pnpm integrity origin/develop` : OK.
- Docs : D27 et D28 présentes dans `docs/05` (D26 précisée) ; clôture de F5D-1 ajoutée au triage.
- Non rejoué : étapes 4 à 6 de la recette complète (cycles, retrait de test, tests de réserve), hors périmètre de cette recette courte.

Verdict : **accepté**.
