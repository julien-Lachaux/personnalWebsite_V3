# Lot F12, correcteur : menu du CV (F12-CV, D44)

Date : 25 nov. 2026. Branche : `worktree-agent-a5550ed721d179674` (basée sur `lot/F12-retours-installation`, e79fcb0).

## Fait

| Finding | Commit | Ce qui change | Preuve |
| ------- | ------ | ------------- | ------ |
| F12-CV | voir `git log` (un commit, sujet `fix(web): … F12-CV`) | Le bouton « CV PDF » devient un menu (disclosure de liens) : deux entrées toujours affichées, « Version française » / « Version anglaise » (« French version » / « English version »). Entrée dont le fichier manque dans `runtimeConfig.public.cvFiles` : `<a role="link" aria-disabled="true">` sans `href`, mention « (bientôt) » / « (coming soon) ». Mention de repli supprimée (clé `shell.actions.cvInFrench` retirée, clés `shell.actions.cvMenu.{fr,en,soon}` ajoutées). | voir « Vérifications » |

Détail technique :

- `app/domain/cv-link.ts` : `resolveCvLink` (repli D22) remplacé par `cvVersions(href, available)` (pur) : une entrée par langue de `CV_LANGUAGES` (`fr`, `en`), adresse = dossier de l'adresse reçue de l'API/fixtures + `cv-<langue>.pdf`, `available` selon la liste des fichiers.
- `app/composables/shell/useCvLink.ts` : renvoie les entrées traduites (`label`, `href` ou `undefined`, `soon`).
- `app/components/shell/CvButton.vue` : racine `.cv-menu`, bouton (`BaseButton`, variante contour) `aria-expanded` / `aria-controls`, liste `<ul hidden>`, Échap (focus rendu au bouton), fermeture à la sortie du focus (même logique que `Popover`), prop `placement` (`down` barre du haut, `up` barre d'actions). Liens `download`, `type="application/pdf"`, `hreflang`. Cibles 44 px sous 1024 px, bordure `--border-control`, aucune couleur ni taille en dur, aucun style ni script injecté.
- `ActionBar.vue` : `placement="up"`, la bande rognée (`overflow: hidden` du repli animé) passe en `visible` tant que le menu est ouvert (`:has([aria-expanded='true'])`) ; styles du bouton adaptés.
- `Popover` non réutilisé : c'est une fenêtre `role="dialog"` avec barre de titre, inadaptée à une liste de liens ; la logique Échap / sortie du focus est reprise à l'identique.

Tests modifiés (autorisation F12-CV, `Justification-test: F12-CV D44`) : `domain/cv-link.spec.ts`, `composables/shell/useCvLink.spec.ts`, `CvButton.spec.ts`, `CvButton-type.spec.ts`, `CvButton-repli.spec.ts`, `ActionBar.spec.ts`, `TopBar.spec.ts`, `HomePage.spec.ts` (le CV n'est plus un `<a>` unique ni ne porte « (in French) »), `test/cv.e2e.ts` (réécrit pour le menu), `test/action-bar-keyboard.e2e.ts` (le CV est un bouton, repéré par `aria-controls` et son nom), commentaires de `test/top-bar-height.e2e.ts` et `test/title-overflow.e2e.ts` (mention « (in French) » disparue). Non modifiés : `MobileHeader.spec.ts`, `axe.spec.ts` (shell), `shell.e2e.ts`, `csp.e2e.ts`, `pages.e2e.ts` (verts tels quels).

Tests ajoutés : `CvButton-menu.spec.ts` (ouverture, Échap, sortie du focus, cas limites), et dans `cv.e2e.ts` : menu complet, PDF servis, entrée inactive, entrée dans l'écran (7 projets), axe WCAG 2.2 AA menu ouvert, Échap au clavier.

## Vérifications (apps/web, base et navigateurs Podman `siteperso-f12-f`)

- `lint` : vert (zéro avertissement). `typecheck` : vert.
- `test:coverage` : 126 fichiers, 1136 tests verts, 100 % (instructions, branches, fonctions, lignes).
- Mutation `stryker run --mutate app/domain/cv-link.ts` : 100,00 % (9 tués, 0 survivant).
- Parcours Playwright sur les sept projets : cv, top-bar-height, action-bar-keyboard, title-overflow (161 verts), shell, csp, pages (308 verts), cv avec axe (42 verts) ; suite Playwright complète (tous les parcours, sept projets) : 2142 verts, aucune capture de référence touchée.

## Non fait

Rien.

## Points ouverts

- **Texte devenu inexact (non modifié, consigné)** : la déclaration d'accessibilité (`pages/accessibilite*`, test `accessibilite-issues-list.spec.ts`) dit du CV PDF « Il est rédigé en français, y compris depuis la version anglaise du site » / « It is written in French, including from the English version of the site ». Avec D44 la version anglaise du site propose une entrée « English version » (inactive tant que `cv-en.pdf` manque). Le texte reste vrai tant que le CV anglais n'existe pas ; à revoir quand il sera déposé (il devra aussi dire s'il est balisé).
- L'entrée inactive est un `<a role="link" aria-disabled="true">` sans `href` : non focalisable au clavier (comme un lien désactivé), mais lue par les lecteurs d'écran avec sa mention.
