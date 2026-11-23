# Recette des lots F8b et F8c (PR #16), chef de projet, 23 nov. 2026

Tête examinée : a508644 (branche `lot/F8b-ia-vide`, base `origin/develop`).

## Preuves

- CI, run 45176332385 (pull_request, sur a508644) : tous les jobs verts, dont les sept `Front parcours Playwright + axe`
  (mobile-390 à ultra-3440). Le parcours `ai-placeholder.e2e.ts` tourne dans chaque taille (desktop-1280 : 241 passed).
  Surcoût de `generate:without-ai` : un `nuxt generate` de plus par job ; durées des jobs de taille comparées au run
  de F8 (45167681567) : mobile 4m45 / 3m25, tablette 3m34 / 4m25, 1024 5m46 / 5m37, 1280 6m15 / 6m07, 1440 6m30 / 5m22,
  1920 5m17 / 5m24, 3440 5m24 / 6m09 : dans le bruit, sauf 1440 (+1m08) et mobile (+1m20), à confirmer.
- Revue PR : `VERDICT: OK` (job « Revue PR (Claude) » vert).
- `pnpm integrity origin/develop` : OK (code 0).
- Fixtures existantes : `git diff --stat` ne touche aucune fixture ni `apps/web/app` ; le script dérive les CV des
  fixtures du dépôt avec `aiOverview: null`, adresse placeholder `contact@example.org`, aucune donnée réelle.
- `ai-placeholder.e2e.ts` : comportements (texte lu, décor `aria-hidden`, absence d'élément interactif, tuile réduite
  et agrandie, mouvement réduit, curseur) ; contraste : axe dans 4 palettes, `color-contrast` passé et mesuré,
  `contrastRatio >= 4.5` exigé sur les nœuds du placeholder, `incomplete` interdit. Aucun marqueur de saut ou de focus.
- F8C-1 : le diff de `experience.e2e.ts` = 5 lignes ajoutées (attente de `filter-drawer--open`, `aria-expanded="true"`
  sur « Masquer les autres »), aucune assertion retirée.
- Autorisations (`audit.log`) : 59a99964 utilisée deux fois par le correcteur, sur `experience.e2e.ts` uniquement.
  ed4b3889 (lead) : aucun usage journalisé, ni sur `playwright.config.ts` ni sur `turbo.json`.
  Refus relevés : écritures opaques python3/node (lead, correcteur, triage) et un Write du triage hors périmètre ;
  chacun suivi d'une autre voie légitime, pas de tentative répétée.
- Cycles édition-test : aucun fichier modifié plus d'une fois sur la branche. Test retiré au hasard et tests de réserve
  OpenAPI : non applicables (lot de parcours front, aucun code de production ni route modifiés).

## Écart de procédure

Le lead a modifié `apps/web/package.json` (script `test:e2e`, ajout de `generate:without-ai`) avec
`Justification-test: F8b ... (autorisation ed4b3889)`, alors que ed4b3889 ne nomme que `playwright.config.ts` et
`turbo.json`. Aucun `authorized` pour ce chemin dans le journal : le hook n'a pas bloqué et le contrôle d'intégrité passe.
La modification est demandée par l'orchestrateur, ne retire ni n'affaiblit aucun parcours (elle ajoute une génération).
Qualification : écart formel (autorisation nommée trop étroite), sans effet sur l'oracle.

## Réserves

- `generate:without-ai` réécrit aussi `.output/nitro.json` voisin (noté par la revue, sans lecteur aujourd'hui).
- Dans `tabsMode`, le parcours « tuile » ne vérifie que l'absence de grille : acceptable.

## Verdict : accepté avec réserves

Réserves : régulariser l'autorisation (nommer `apps/web/package.json`) ; surveiller le temps des jobs 1440 et mobile.
