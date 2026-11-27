# Lot 41 : docs/01, exemple de cv_path aligné sur /cv/ (OpenCode)

Date : 27 novembre 2026. Branche `lot/41-doc-cvpath`, depuis `develop` (fe94d39).
Carte Trello « [Back] docs/01 : exemple de cv_path aligné sur /cv/ ». Documentation seule, `docs/` exclu de Prettier.
Aucun conteneur, aucun `pnpm install`, aucun test touché, aucun `pnpm check`, pas de `git push` ni de `gh`.

## Fait

- `docs/01-modele-de-donnees.md` l.46 : exemple de `cv_path` remplacé, `ex. \`/cv.pdf\`` → `ex. \`/cv/cv-fr.pdf\``.
  Paragraphe relu : aucune mention voisine à corriger (reste de la phrase : colonnes `headline`, `bio`,
  `availability` supprimées, migration 0016, sans lien). Rien d'autre modifié.
- Commit 1 : `docs(modele): aligner l'exemple cv_path sur /cv/cv-fr.pdf`.
- Commit 2 : ce compte rendu.

## Non fait

- Aucune autre correction (hors périmètre de la carte).

## Vérifications ciblées (D26)

- `grep -n "cv.pdf" docs/01-modele-de-donnees.md` (et `grep -nF "/cv.pdf"`) : plus aucun `/cv.pdf` isolé ;
  seul `/cv/cv-fr.pdf` subsiste (vérification aussi en forme littérale `grep -nF`).
- `git diff --stat` : un seul fichier modifié (+ ce compte rendu, deuxième commit).
- Contexte relu : `apps/web/public/cv/` (`cv-fr.pdf`, CV servi sous `/cv/`, D22 ; `cv-en.pdf` indiqué dans le
  brief, affiché « (bientôt) » si absent du disque), décision D22 du `CLAUDE.md`, carte Trello.
- `docs/` est exclu de Prettier : pas de `pnpm format:check` nécessaire.

## Décisions

Aucune. Exemple remplacé tel que prescrit (`/cv/cv-fr.pdf`).

## Points ouverts

Aucun. Note : sur le disque, `apps/web/public/cv/` ne contient que `cv-fr.pdf` (pas `cv-en.pdf`) ;
le brief impose `/cv/cv-fr.pdf` comme exemple, rien d'autre à changer hors périmètre.
