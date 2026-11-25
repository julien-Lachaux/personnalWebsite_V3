# Lot F12, correcteur, mosaïque (F12-XP, D41 partie mosaïque, D42)

Date : 25 nov. 2026. Branche : `worktree-agent-a6190cf28f9597bcc` (avancée en fast-forward sur `d5e6ec9`, tête de `lot/F12-retours-installation`).

## Fait

| Finding | Commit | Ce qui change | Preuve |
| --- | --- | --- | --- |
| F12-XP (D42) | voir `git log` (fix(web): tuiles repliées…) | `computeLayout` : quand une tuile est agrandie avec colonne latérale, XP (si non agrandie) prend toute la hauteur libérée ; les autres tuiles de la colonne passent en placement `folded` (49 px = `FOLDED_HEIGHT`, en bas, gouttière 12 px, ordre de lecture) ; hauteur d'XP bornée à 0. `Tile.vue` : prop `folded` (corps `inert`, `aria-hidden`, sans `tabindex` ni défilement ; barre et bouton agrandir actifs). Cause du constat : XP n'avait qu'une part égale (~247 px) de la colonne. | layout.spec (XP agrandie 1280×788 : profil y 605, recos 666, ia 727, hauteur 49 ; XP 642 px quand IA agrandie), TileGrid.spec et Tile.spec (corps inerte, bouton opérable), mosaic.e2e « XP défile dans la colonne latérale » (liste d'XP dépasse sa tuile, scrollTop > 0, tuiles repliées < 50 px, corps inerte) à toutes les tailles ≥ 1244 px, fr et en |
| F12-XP (D41, mosaïque) | idem | Suppression de `domain/fit.ts` (+ spec), de `textEnlarged`, `ProfileMode`, `ProfileFit`, `MosaicLayout.profile`, du paramètre de `useMosaic`, de `fit`, `profileStyle`, `scale()` et de l'enveloppe `tile-grid__fit` dans `TileGrid.vue`. Le Profil garde sa taille de texte et défile (tabindex 0, fondu) comme IA et Recos. Constante `CONTENT_MAX_WIDTH` (820) déplacée dans `useMosaic.ts`. | useMosaic.spec « Profil sans réduction », TileGrid.spec « Profil », mosaic.e2e « Profil : taille de texte normale… » |

## Vérifications ciblées

- `pnpm --filter @siteperso/web lint` : 0 avertissement (après correction d'une variable inutilisée dans mon spec) ; hook pre-commit (lint, typecheck, test des trois paquets) vert au commit.
- `pnpm --filter @siteperso/web typecheck` : vert.
- `pnpm --filter @siteperso/web test:coverage` : 123 fichiers, 1119 tests, 100 % (Statements 1377/1377, Branches 744/744, Functions 449/449, Lines 1231/1231).
- Mutation `stryker run --mutate app/domain/layout.ts` : 100 % (253 tués, 0 survivant) ; un survivant (`visible: true` d'XP en colonne latérale) est tué par une assertion ajoutée. `fit.ts` supprimé : rien à muter ; `stryker.equivalents.json` ne cite ni `fit.ts` ni `layout.ts`.
- Playwright (mosaic, experience, overflow, short-height, 784 tests par projet d'écran, fr et en) : 781 passés au premier passage, 3 en échec : 2 de mon nouveau test e2e (IA empilée sous le Profil agrandi à 3440 px, donc non repliée ; test corrigé pour agrandir Recos), 1 `experience.e2e.ts:288` (panneau, 1024, en) qui est passé à la relance isolée (28/28 sur les fichiers ciblés, tous projets) : instabilité de charge, sans lien avec la mosaïque.
- `pnpm integrity d5e6ec9` : OK.

## Tests existants modifiés ou supprimés (autorisation F12-XP, `Justification-test` au commit)

- `domain/fit.spec.ts` : supprimé avec `fit.ts` (D41).
- `domain/layout.spec.ts` : retrait de `textEnlarged` et des assertions `layout.profile` (D41), suppression des tests « indique pour le Profil… fit », « désactive la réduction… », « garde le Profil poussé… S », « texte agrandi et tuile agrandie » ; attentes de la colonne latérale passées en tuiles repliées (D42). Ajouts : hauteur d'XP libérée, ordre des tuiles repliées, bornage à 0, constante `FOLDED_HEIGHT`.
- `composables/shell/useMosaic.spec.ts` : retrait de `fit`, `textEnlarged`, du bloc « facteur S » ; ajout du bloc « Profil sans réduction ».
- `components/shell/TileGrid.spec.ts` : bloc « Profil » réécrit (plus de scale), retrait de la gestion des préférences devenue inutile, ajout du bloc « tuiles repliées (D42) ».
- `components/base/Tile.spec.ts` : ajouts seulement (prop `folded`).
- `test/mosaic.e2e.ts` : cas de capture 1280 XP agrandie (rectangles repliés), test Profil réécrit (D41), `profileScale` retiré, animation sans `transform`, ajout du test D42.
- Non modifiés : `AppShell.spec.ts`, `AppShell-mosaic.spec.ts`, `experience.e2e.ts`, `overflow.e2e.ts`, `short-height.e2e.ts` (inchangés, verts).

## Non fait / décisions / points ouverts

- Aucune capture de référence visuelle n'a cassé ni n'a été régénérée (les parcours ciblés n'en contiennent pas ; la régression visuelle des captures n'a pas été lancée). Les captures `desktop-1280_xp-agrandi` et celles du Profil réduit (dossier `design/reference`, ou tests visuels éventuels) sont à revoir par l'orchestrateur : la colonne latérale et la taille du Profil ont changé par décision (écarts voulus D41, D42).
- `FOLDED_HEIGHT` = 49 px (décor réel de 48,5 px arrondi) ; le corps replié garde 0,5 px, rogné et inerte.
- Pile PodMan : `docker` absent de l'hôte et `docker-compose.yml` de cette branche sans `oom_score_adj` (présent sur `lot/podman`). J'ai lancé le service `playwright` avec `podman compose -f docker-compose.yml -f <surcharge hors dépôt posant oom_score_adj: 500>` (fichier du scratchpad, rien de commité). Conteneur arrêté en fin de tâche.
- Documentation partagée à mettre à jour par l'orchestrateur (fichiers que je n'ai pas le droit de toucher) : `CLAUDE.md` décrit encore, dans la section Front, `domain/` sans mention de `fit` (rien à retirer), mais `docs/05` (F2-03 `fit`) et SPEC § 4.1 décrivent S : écarts déjà consignés par D41.
- Le triage F12 précise D42 pour le cas « XP agrandie » : les trois autres tuiles repliées en bas, la zone au-dessus restant vide (aucun contenu à y mettre). À confirmer visuellement par Julien.
- Cas d'empilement Profil/IA (tuile sous la tuile agrandie quand les deux tiennent) conservé tel quel : la tuile empilée n'est pas repliée.

## F12-XP2 : Profil en colonne latérale quand `experience.log` est agrandie (D42 précisée, 21547c6)

Constat de la revue de la PR 20 : XP agrandie, Profil, Recos et IA se repliaient tous en bas de la colonne latérale, avec environ 580 px de vide au-dessus (1280×788 : y = 605, 666, 727).

Correction (`app/domain/layout.ts`) : la tuile ouverte en haut de la colonne latérale n'est plus toujours XP. `sideTop` vaut `profile` quand la tuile agrandie est `experience`, sinon `experience` ; elle prend la hauteur libérée (`sideTopHeight`, ex-`sideExperienceHeight`), placement `side`, et les autres se replient dessous dans l'ordre de lecture. Le Profil en `side` défile sans autre changement : `TileGrid.scrollable` ne retire le défilement qu'à XP. Résultat à 1280×788 : Profil r(892, 12, 376, 642), Recos y = 666, IA y = 727. Les autres cas (Profil, Recos ou IA agrandie : XP en haut, autres repliées) sont inchangés ; sans place latérale, tout est poussé hors zone comme avant. Commentaires de `layout-types.ts` et de `TileGrid.vue` alignés.

| Finding | Commit | Ce qui change | Preuve |
| --- | --- | --- | --- |
| F12-XP2 | voir `git log` (sujet `fix(web): … F12-XP2`) | Profil en haut de la colonne latérale (`side`, défilant) quand XP est agrandie ; Recos et IA repliées dessous | Constat reproduit par l'ancien comportement : y = 605, 666, 727 pour Profil, Recos, IA à 1280×788. Code corrigé et tests inchangés : 5 échecs, tous des attentes de l'ancien repli (`layout.spec.ts` x3, `useMosaic.spec.ts` x1, `TileGrid.spec.ts` x1) ; après mise à jour : 1126 tests verts, y = 12 / 666 / 727 |

Tests existants modifiés (autorisation F12-XP2, `Justification-test: F12-XP2 D42 précisée`) : `layout.spec.ts` (cas 1280×788, 340 px exact, ordre des tuiles repliées : Profil `side` au lieu de `folded`), `useMosaic.spec.ts` (le Profil est `side`, Recos et IA `folded`), `TileGrid.spec.ts` (Profil ouvert, défilant, non inerte ; Recos et IA repliées), `test/mosaic.e2e.ts` (Profil ouvert dans la colonne, `tabindex="0"`, non inerte ; Recos et IA repliées ; cas de capture 1280 XP agrandie : Profil r(892, 12, 376, 642), que le premier passage du parcours complet a signalé en échec avant mise à jour). Ajout : borne à 0 de la hauteur du Profil quand la zone est trop basse.

Vérifications ciblées (apps/web) : `lint` sans avertissement, `typecheck` vert, `test:coverage` 125 fichiers, 1126 tests, seuil 100 % tenu, `stryker run --mutate app/domain/layout.ts` score 100,00 (257 tués, 0 survivant), `pnpm integrity develop` OK. Parcours Playwright (service `playwright` lancé par `podman compose` avec surcharge `oom_score_adj: 500` hors dépôt, conteneur arrêté ensuite) : suite complète sans filtre par erreur de ma ligne de commande, 2084 réussis et 2 échecs (le cas de capture 1280 mis à jour ci-dessus) ; `mosaic.e2e.ts` seul sur le projet `desktop-1280` après mise à jour : 26 réussis. Aucun autre parcours n'a cassé.

### F12-XP2, suite : deux constats non bloquants de la revue de la PR 20

1. `test/mosaic.e2e.ts`, cas XP agrandie, Profil en colonne latérale : remis sur la tuile elle-même `not.toHaveAttribute('inert')` et `not.toHaveAttribute('aria-hidden')` (vrais d'après D42), en plus du corps non inerte. Commit avec `Justification-test: F12-XP2`.
2. Nouveau parcours `test/language-switch-d43.e2e.ts` (aucun test existant touché : `LanguageSwitch-d43.spec.ts` et `profile/text-sizes.spec.ts` inchangés) :
   - séparateur « | » : `boundingBox` (x, y, largeur) identique entre `/` et `/en`, dans chaque projet (1280 et 390 compris) ;
   - langue courante : couleur calculée égale à celle de `--accent` (sonde posée dans le DOM), distincte de la couleur du texte ordinaire (témoin) ;
   - tailles de police calculées (`getComputedStyle`) : `.profile__mission`, `.ai__text` et `.ai__list` égales à `.profile__intro`, à partir de 1024 px (une seule section visible en dessous, sortie anticipée comme dans `mosaic.e2e.ts`, aucun marqueur de saut).
   Résultat : `language-switch-d43.e2e.ts` et `mosaic.e2e.ts` sur `mobile-390`, `tablette-834` et `desktop-1280` : 87 réussis ; lint, typecheck verts ; conteneur Playwright arrêté.
