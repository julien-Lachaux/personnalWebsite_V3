# Lot F3c : recette du chef de projet, 21 novembre 2026

Branche `lot/F3c-cv` (e25370c), base `develop`. Journaux : scratchpad, préfixe `recette-f3c-`.

## Verdict : accepté avec réserves

## Preuves rejouées

| Critère | Résultat |
| --- | --- |
| `docker compose down -v` puis `TURBO_FORCE=true pnpm check` (une seule fois) | code 0, 11 tâches sur 11, 0 en cache, 5 min 18 ; 462 parcours Playwright verts ; 14 lignes vertes de `cv.e2e.ts` |
| Couverture | 100 % (contrats, API, web : `All files 100/100/100/100`) |
| Mutation `pnpm --filter @siteperso/web test:mutation` (46 s) | score 100 (seuil 100), `cv-link.ts` : 17 mutants tués, 0 survivant |
| `pnpm integrity develop` | OK |
| Périmètre | rien dans `apps/api`, `db`, `packages/contracts` |
| Marqueurs de saut ou d'ignore ajoutés | aucun |
| Poste de travail propre après les commandes | `git status` vide, `db:down` fait, clone supprimé |

## Fond

- PDF : exiftool (Alpine épinglée, outil du script) sur `apps/web/public/cv/cv-fr.pdf` : plus aucune
  métadonnée de document (la source portait Title, Author, Creator HeadlessChrome, Producer Skia,
  dates, Subject) ; `grep` des clés `/Author /Creator /Producer /Title /CreationDate`, XMP : 0.
  Contenu : `pdftotext -layout` identique à la source `front-assets/cv-fr.pdf`, 2 pages, rendu des deux
  pages à 50 ppp identique octet à octet (`cmp`).
- `cv-pdf.spec.ts` : contient un cas témoin (PDF synthétique non nettoyé : les douze clés, XMP, flux
  d'objets, mise à jour incrémentale signalés). Je n'ai pas pu rejouer l'analyse sur la source réelle :
  voir réserve 2.
- D22 : exception écrite deux fois dans `CLAUDE.md` (arborescence et section « Aucun e-mail… »),
  limitée au chemin exact `apps/web/public/cv/cv-fr.pdf` ; recherche e-mail, téléphone et nom dans tout
  le diff hors PDF : aucune occurrence (seul l'identifiant d'image Docker ressemble à un motif).
- Bouton : `/` vers `/cv/cv-fr.pdf` ; `/en` vers `/cv/cv-fr.pdf`, nom « CV PDF (in French) »,
  `hreflang="fr"` ; `cv.e2e.ts` vérifie 200, `application/pdf`, `%PDF-` dans les deux langues et toutes
  les tailles ; `cv-link.spec.ts` couvre la fin du repli quand `cv-en.pdf` est présent.
- Tests modifiés par le correcteur (commit 4cf7ca5, `Justification-test: F3c-OBS` présente) :
  - `HomePage.spec.ts` : `href = cv-en.pdf` remplacé par `href = cv-fr.pdf` + `hreflang=fr` + « (in French) » ;
    renforcé, la déclaration d'accessibilité reste vérifiée.
  - `pages/index.spec.ts` (deux cas) : `a[hreflang]` devient `.language-switch a[hreflang]` ; mêmes
    assertions (href, lang, hreflang, texte) ; la portée est réduite au sélecteur de langue, ce que le
    cas vérifie réellement ; pas d'affaiblissement.
  - `smoke.e2e.ts` : même restriction au sélecteur de langue, `toHaveCount(1)`, clic, URL et `lang`
    conservés.
  - `cv.e2e.ts` : nouveau dans le lot (absent de `develop`), non un test modifié.
- Journal `.claude/hooks/audit.log`, grant 10e117b0 : uniquement les quatre chemins autorisés (7
  autorisations : cv.e2e.ts, index.spec.ts, HomePage.spec.ts, smoke.e2e.ts) ; un refus (écriture opaque
  python), refait par l'outil Edit : pas de tentative de contournement.
- Cycles édition-test : aucun fichier au-delà de deux modifications ; pas de transcription fournie.

## Réserves

1. Retrait d'un test au hasard : non fait en clone. Tiré : `cv-link.spec.ts` « mène au CV français… ».
   Pour installer le clone, mon `rm` du lien `node_modules` a été refusé par le garde-fou (« le rôle
   chef-de-projet n'écrit pas ce chemin : node_modules »), je me suis arrêté là ; `pnpm install` dans le
   clone n'a pas été relancé (risque de purge du `node_modules` du worktree via le lien). Compensation :
   mutation à 100 % sur `cv-link.ts`, qui prouve que chaque branche du fichier est contredite par une
   assertion. Le clone a été supprimé (`rm -rf` du dossier du scratchpad).
2. Un script node en ligne (rejeu de `metadataProblems` sur la source) a été refusé par le garde-fou
   (« écriture opaque (node) qui mentionne un oracle »). Non contourné. Preuve de remplacement : exiftool
   montre les métadonnées de la source et leur absence dans la copie, plus le cas témoin du test.
3. Étapes 5 et 6 « tests de réserve contre l'API » : sans objet pour ce lot (aucun changement
   d'API, de contrat ni de base) ; non lancés.
4. `pnpm check` ne rejoue pas `clean-cv-pdf.sh` : la propreté du PDF repose sur `cv-pdf.spec.ts`
   (clés et structure), pas sur une relecture exiftool ; relue ici une fois.

## Questions pour Julien

- Valides-tu que le CV anglais reste en repli (français, « in French ») jusqu'au dépôt de `cv-en.pdf` ?
- Confirmes-tu que le PDF versionné (e-mail et téléphone visibles) est bien celui que tu veux publier ?
