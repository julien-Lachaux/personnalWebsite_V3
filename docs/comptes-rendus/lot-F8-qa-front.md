# Lot F8 : QA front (F8-01, F8-02, F8-04), qa-front

Date : 23 novembre 2026. Branche `lot/F8-qa`. Aucun code de production, aucun test existant, aucune capture modifiés.

## Fait

| Ticket | Fichier | Cas |
|---|---|---|
| F8-01 | `apps/web/test/journeys.e2e.ts` | 4 par projet et par langue (56 passes) : filtre `?tech=` à deux technos bâti par clics, rouvert à stockage vide et suivi au changement de langue ; agrandir/réduire chaque tuile à la souris (URL et filtre intacts) ; onglets du bas à la souris ; réglages posés à la souris (taille 130, 5 interrupteurs), enregistrés, appliqués après rechargement, remis à zéro |
| F8-02 | `apps/web/test/matrix.e2e.ts` | 112 cas (7 projets x 2 langues x 4 palettes x texte 100/130 %) : axe WCAG 2.2 AA après fin des animations, sur chaque onglet (< 1024 px, à 130 %) ou sur la mosaïque et chaque tuile agrandie (bureau, 100 et 130 %), contraste mesuré (`color-contrast` dans les règles passées). Vert, 112/112 |
| F8-02 | `apps/web/test/overflow.e2e.ts` | 14 cas : à 130 %, la page ne déborde pas horizontalement (`scrollWidth`) à chaque onglet / tuile. Vert |

Déjà couverts par les parcours existants, non dupliqués : filtre au clavier, rechargement, changement de langue (experience, sections), agrandir/réduire au clavier (mosaic), thème et panneau au clavier (shell), easter egg (experience), CV PDF (cv), 404 (pages).

Vérifications : `pnpm format`, lint (zéro avertissement), typecheck verts ; Playwright borné `--workers=2`, passe répétée `--repeat-each=2` sur journeys + overflow (140/140 verts), matrice en une passe (112/112). Pas de `pnpm check`.

## Anomalies (tests écrits, non commités : en attente de l'autorisation « fails »)

Fichier `apps/web/test/defects-f8.e2e.ts` (non suivi par git), préparé sans marqueur `fails` (échec attendu à poser après autorisation). Condition commune : texte à 130 % (panneau d'accessibilité), thème clair, `/` et `/en`. Mesure : `scrollWidth` du conteneur qui rogne, ou bord du contrôle contre la fenêtre.

- **BUG-F1** : le lien « Recommandations publiées sur LinkedIn » (icône comprise) ne passe pas à la ligne et est rogné par le corps de la tuile Recos (mosaïque 1024, 1280, 1440, 1920, 3440, fr et en : contenu 416/422 px pour 378/306 visibles) et par `main` de l'onglet Recos à 390 (418 > 390 en, 412 > 390 fr). Test : `BUG-F1 : le lien « publiées sur LinkedIn » des recommandations n'est pas rogné`, en échec sur mobile-390, portable-1024, desktop-1280, grand-1440, fullhd-1920, ultra-3440 (fr, en) ; vert à 834. Capture : `scratchpad/f8-captures/probe/desktop-1280.png`, `portable-1024.png`, `en-390-recs.png`.
- **BUG-F2** : mobile 390, titre de l'en-tête mobile tronqué par une ellipse (« julien-lachaux/pr… », 243 px pour 194 visibles ; 207 à 324 selon l'onglet). Test `BUG-F2` : en échec sur mobile-390 (fr, en), vert ailleurs. Capture : `probe/mobile-390.png`.
- **BUG-F3** : mobile 390, en anglais seulement : le bouton « CV PDF (in French) » de la barre d'actions est coupé par le bord de la fenêtre (rangée de 494 px pour 390). Test `BUG-F3` : en échec sur mobile-390 en ; vert en fr. Capture : `probe/en-390-recs.png`.

Captures : `/tmp/claude-1000/-home-jlachaux-IA-PROJECTS-site-perso-personnalWebsite-V3/adc7d6bb-d6ca-4961-bd2a-09cd85b57ef1/scratchpad/f8-captures/probe/`.

## Non fait, avec la raison

- **F8-03 (D27/D28, section IA vide) : écrit, jamais exécuté.** Fichiers non commités : `apps/web/test/ai-placeholder.e2e.ts` (placeholder en onglet et en tuile réduite/agrandie, `aria-hidden` du décor, rien d'interactif, axe + contraste dans les 4 palettes en fr et en, mouvement réduit par le système et par le réglage, captures mobile 390 clair/sombre et tuile IA 1280 sombre dans `F8_CAPTURES_DIR`) et `apps/web/test/support/generate-without-ai.mjs` (« API » locale servant les fixtures avec `aiOverview: null`, `nuxt generate` en source `api`, puis régénération du site habituel). Blocages, chacun refusé par les garde-fous, donc consigné sans contournement :
  1. `pnpm --filter @siteperso/web exec node …/generate-without-ai.mjs` : « écriture opaque (node) qui mentionne un oracle (apps/web) » (3 formes, dont le chemin absolu) ; 2. `cp -r .output/public apps/web/node_modules/.cache/site-sans-ia` : « le rôle qa-front n'écrit pas ce chemin ».
  Besoin : l'orchestrateur lance le script (ou me donne le droit de le lancer et d'écrire `node_modules/.cache/site-sans-ia`), puis câble la génération dans `test:e2e` avant Playwright (`package.json`/CI, hors de mon périmètre). Sans cela le parcours échoue à `beforeAll` (site absent) : d'où l'absence de commit. Commande : `cd apps/web && pnpm exec node test/support/generate-without-ai.mjs`, puis `F8_CAPTURES_DIR=<dossier> pnpm exec playwright test test/ai-placeholder.e2e.ts --workers=2`.
- Captures demandées : non produites (dépendent du point précédent).
- Régression visuelle (F8-03 du plan) : hors périmètre, décision de Julien.
- Contraste réel du placeholder dans les 4 palettes : non vérifié en navigateur (même cause).

## Décisions

- Le débordement à 130 % est en deux niveaux : page entière (vert, commité) et conteneurs rognant du contenu (tests ciblés par défaut, en attente). Le balayage générique (tout élément à `overflow-x` non visible dont `scrollWidth > clientWidth`) a servi à les trouver, pas à garder : il signale aussi le `tile-grid` quand une tuile est poussée hors zone (conception, SPEC § 3.3) et le contenu du Profil mis à l'échelle (S), faux positifs écartés.
- Matrice : à 100 % sous 1024 px, les onglets sont déjà couverts dans les quatre palettes par shell.e2e.ts ; le cas est un retour immédiat (comme les parcours existants) pour garder la grille complète.
- Durée : la matrice dure environ 10 min avec 2 travailleurs (le bureau mesure chaque tuile deux fois par langue et palette).

## Points ouverts

- Tuile Profil, 1280 à 130 % quand une autre tuile est agrandie : contenu mesuré à 406 px pour 374 de colonne ; la mise à l'échelle S de la maquette est probablement la raison. À confirmer par la conception ; aucun défaut posé.
- Le panneau de réglages dans la tuile IA ou l'onglet IA vide n'a pas été exercé (voir ci-dessus).
