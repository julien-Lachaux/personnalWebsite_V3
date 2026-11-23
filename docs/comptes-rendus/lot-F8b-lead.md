# Lot F8b : parcours de la section IA vide (D27/D28), lead-architecte

Date : 23 novembre 2026. Branche `lot/F8b-ia-vide` (depuis `develop` 31d6110). Ni `turbo.json`, ni
`playwright.config.ts`, ni la CI ne sont touchés : le job `front-parcours` appelle déjà
`pnpm --filter @siteperso/web run test:e2e --project=<écran>` et reprend donc la nouvelle chaîne
telle quelle, et `check-front-matrix.mjs` n'est pas concerné.

## Fait

- `apps/web/test/support/generate-without-ai.mjs` (repris de la qa-front, réécrit) : une API locale
  (port libre) sert `GET /api/v1/cv?lang=fr|en` = fixtures du dépôt avec `aiOverview: null` (fixtures
  non modifiées), `nuxt generate` en source `api`, puis le site est déplacé dans
  `node_modules/.cache/site-sans-ia/` (ignoré par git, ESLint et Prettier). Le site des fixtures
  présent dans `.output/public` est mis de côté puis remis, même en cas d'échec : le script ne
  détruit rien et l'ordre des générations ne compte pas (la version qa-front régénérait les
  fixtures, soit deux `generate` au lieu d'un).
- `apps/web/package.json` : script `generate:without-ai`, et
  `test:e2e` = `generate:fixtures && generate:without-ai && playwright test`. Les arguments passés
  à `test:e2e` (`--project=…` en CI) restent à Playwright.
- `apps/web/test/ai-placeholder.e2e.ts` (repris de la qa-front) : sert lui-même le site sans IA sur
  un port libre (`listen(0)`), donc aucun port à ajouter au `.env` des worktrees ni second
  `webServer`. 18 cas par écran (9 par langue), 7 écrans, fr et en : 126 verts.

## Coût en temps (local, WSL)

`generate:fixtures` 14 s, `generate:without-ai` 14 s : **+14 s par job** `front-parcours` (en
parallèle dans la matrice, donc +14 s de durée murale). Parcours seul : 107 s pour les 7 écrans avec
2 travailleurs, soit environ 15 s par écran.

## Contrastes mesurés du placeholder (axe, texte « placeholder », identiques fr et en)

| Palette | Onglet (390) | Tuile (1280) |
|---|---|---|
| clair | #14262b sur #dadee1 = 11,56:1 | #14262b sur #f1f0f9 = 13,84:1 |
| sombre | #e9eee8 sur #1e2632 = 12,95:1 | #e9eee8 sur #242f3d = 11,52:1 |
| clair renforcé | #000000 sur #f1f0f9 = 18,57:1 | 18,57:1 |
| sombre renforcé | #ffffff sur #181e28 = 16,73:1 | #ffffff sur #1c2430 = 15,62:1 |

Le parcours les exige désormais (texte dans les contrastes passés d'axe, ≥ 4,5:1) et les note en
annotation du rapport Playwright.

## Captures (hors dépôt)

`/tmp/claude-1000/-home-jlachaux-IA-PROJECTS-site-perso-personnalWebsite-V3/adc7d6bb-d6ca-4961-bd2a-09cd85b57ef1/scratchpad/f8b-captures/` :
`mobile-390-fr-clair.png`, `mobile-390-fr-sombre.png`, `tuile-ia-1280-fr-sombre.png`,
`mosaique-1280-fr-sombre.png` (sur la tuile 1280, le curseur est saisi dans sa phase éteinte du
clignotement).

## Écarts au brouillon de la qa-front

- Le `h2` de la section attendu « IA » dans les deux langues était faux : la coquille affiche le
  libellé de section de la langue (`en/shell.json` : « AI »), D28 ne fige que le texte du
  placeholder. Démonstration : 7 échecs en `/en`, `Received: "AI"` sur
  `<h2 id="titre-ai" class="visually-hidden">AI</h2>`. Attendu remplacé par `locale.aiTab`
  (fichier jamais commité, donc pas un test existant).
- Contraste : la vérification « non incomplet » est complétée par « passé, ≥ 4,5:1 » (ci-dessus).

## Vérifications

- `pnpm format` ; `pnpm --filter @siteperso/web lint` et `typecheck` : verts. Aucun code d'`app/`
  changé : pas de `test:coverage` ni de mutation à rejouer.
- `pnpm exec playwright test test/ai-placeholder.e2e.ts --workers=2` : 126/126.
- `pnpm --filter @siteperso/web run test:e2e --project=mobile-390 --project=desktop-1280 --workers=2` :
  chaîne complète (2 générations puis Playwright), 482 verts, 528 s.
- `pnpm integrity origin/develop` : vert après ajout de la `Justification-test: F8b` au commit du
  script (`package.json` : script de test, autorisation ed4b3889).

## Décisions

- Génération dans le script `test:e2e` plutôt qu'en `globalSetup` : un `globalSetup` régénérerait à
  chaque lancement ciblé de Playwright (ou servirait un site périmé s'il ne régénère que l'absent).
- Serveur dans le parcours plutôt que second `webServer` de `playwright.config.ts` : un port fixe de
  plus aurait pu entrer en collision avec la plage d'un autre worktree ; `listen(0)` n'en a pas.

## Points ouverts

- Sonde de contraste hors dépôt (`node <scratchpad>/f8b-contrast-probe.mjs …` contre le site sans
  IA) refusée par les garde-fous (« écriture opaque (node) qui mentionne un oracle (apps/web) »), de
  même qu'un dépouillement en `python3` du rapport JSON : non contourné, les contrastes viennent des
  annotations du parcours lui-même (`--reporter=json`, lu par `grep`).
- Le panneau de réglages ouvert dans l'onglet ou la tuile IA vide n'est exercé que par le cas
  « réduire les animations ».
