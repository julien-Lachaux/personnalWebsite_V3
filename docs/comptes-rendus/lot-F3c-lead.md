# Lot F3c : CV PDF du site (D22), compte rendu du lead-architecte

Date : 20 novembre 2026. Branche `lot/F3c-cv` depuis `develop` (b3ca884). Isolation Docker :
`siteperso-v3-f3c`, ports 5922 à 5925.

## Fait

| Commit | Contenu |
|---|---|
| 3593c99 | `apps/web/public/cv/cv-fr.pdf` (PDF de Julien, métadonnées nettoyées), `apps/web/scripts/clean-cv-pdf.sh`, `apps/web/app/cv-pdf.spec.ts` |
| 4721193 | `app/domain/cv-link.ts` : `resolveCvLink(href, locale, available)`, fonction pure du repli, et ses tests |
| a652ae7 | `nuxt.config.ts` : liste des PDF de `public/cv/` relevée à chaque build, `runtimeConfig.public.cvFiles` |
| 55c2918 | `composables/shell/useCvLink.ts` (adresse, `hreflang` et mention en cas de repli) ; `shell.actions.cvInFrench` (fr « (en français) », en « (in French) ») |
| 0220456 | `CvButton` : `type="application/pdf"` ; parcours `test/cv.e2e.ts` qui suit le lien (200, `application/pdf`, `%PDF-`) |
| eb6157a | `CLAUDE.md` : l'exception D22 dans « Front » et dans « Flux git et interdictions », avec le chemin exact |

### Nettoyage des métadonnées

Commande : `bash apps/web/scripts/clean-cv-pdf.sh ../front-assets/cv-fr.pdf apps/web/public/cv/cv-fr.pdf`.
Elle tourne dans Docker (`alpine:3.24.4` épinglée par digest, `qpdf=12.3.2-r0`, `jq=1.8.2-r0`,
`exiftool=13.55-r0`) ; rien n'est installé sur l'hôte. Les étapes :

1. `qpdf --remove-info --remove-metadata` retire le flux XMP et le dictionnaire d'information, sauf
   sa date de modification (`--remove-info` garde `ModDate` ; une première passe l'a montré).
2. La référence `/Info` est ôtée de la fin de fichier (trailer) dans la forme JSON de qpdf.
3. qpdf réécrit le fichier sans flux d'objets (`--object-streams=disable`), avec un identifiant
   déterministe. Le fichier est réécrit en entier, pas en mise à jour incrémentale : contrairement à
   `exiftool -all=`, les anciennes valeurs ne restent pas dans le fichier.

Sortie d'exiftool, avant (groupes `PDF` ; nom propre remplacé ici par `[prénom nom]`) :

```
[PDF]           PDFVersion                      : 1.3
[PDF]           Linearized                      : false
[PDF]           PageCount                       : 2
[PDF]           Title                           : CV — [prénom nom]
[PDF]           Creator                         : Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36
[PDF]           Producer                        : Skia/PDF m153
[PDF]           CreateDate                      : 2026:11:17 12:12:42+00:00
[PDF]           ModifyDate                      : 2026:11:17 12:12:42+00:00
[PDF]           Author                          : [prénom nom]
[PDF]           Subject                         : Développeur full-stack TypeScript senior
```

Après :

```
[PDF]           PDFVersion                      : 1.3
[PDF]           Linearized                      : false
[PDF]           PageCount                       : 2
```

Autres vérifications :

- `pdfinfo` : `Custom Metadata: no`, `Metadata Stream: no`. La fin de fichier ne contient plus que
  `<< /Root 1 0 R /Size 601 /ID [...] >>`.
- Contenu visible inchangé : `pdftoppm -r 100` (pages 1 et 2) et `pdftotext` donnent les mêmes
  empreintes sha256 pour la source et le fichier nettoyé (e535adaf…, 657517ed…, aebb3744…).
- Le nettoyage est reproductible : deux exécutions donnent le même fichier
  (sha256 194fed81440aba0e6b333489d229ace660e077dbd4ae852845b9cfc2203c36fe).
- `app/cv-pdf.spec.ts` relit les octets de chaque PDF de `public/cv/`. Il échoue s'il trouve une clé
  `/Info`, `/Metadata`, `/Author`, `/Creator`, `/Producer`, `/CreationDate`, `/ModDate`, `/Title`,
  `/Subject`, `/Keywords`, `/Trapped` ou `/PieceInfo`, un paquet XMP, un flux d'objets, une table de
  références en flux ou une mise à jour incrémentale. Un témoin vérifie qu'il signale bien un PDF non
  nettoyé. Le futur `cv-en.pdf` sera contrôlé de la même façon.

### Repli du CV anglais

- `resolveCvLink` ne remplace que le CV propre à la langue de la page (`/cv/cv-<locale>.pdf`), et
  seulement s'il manque dans la liste et que `cv-fr.pdf` y est. Toute autre adresse reste telle
  quelle : `/cv/exemple.pdf` des tests existants, une adresse externe, une requête, un CV d'une autre
  langue.
- La liste est lue dans `public/cv/` au moment du build (`nuxt.config.ts`). Déposer `cv-en.pdf` met
  donc fin au repli sans changer le code. Le parcours e2e déduit lui aussi ce qu'il attend du contenu
  de `public/cv/`.

## Non fait : le branchement du repli dans `CvButton` (sortie honorable)

Le repli n'est pas branché. Le brief demande que la page anglaise mène à `/cv/cv-fr.pdf` tant que
`cv-en.pdf` manque, avec `hreflang="fr"` sur le lien. Deux tests existants exigent le contraire :

1. **`apps/web/app/components/home/HomePage.spec.ts:111-115`** (« relie le CV PDF de la langue… »).
   Sur `/en` avec les fixtures, il attend `a[download]` → `href` = `/cv/cv-en.pdf`. Or c'est
   précisément le fichier absent que D22 demande de remplacer. Sortie avec le branchement :
   `AssertionError: expected '/cv/cv-fr.pdf' to be '/cv/cv-en.pdf'` (HomePage.spec.ts:114:59).
2. **`apps/web/app/pages/index.spec.ts:55-63`** (« propose la version française depuis l'anglais »)
   attend un seul `a[hreflang]` sur `/en`. Avec `hreflang="fr"` sur le lien du CV :
   `expected [ DOMWrapper…, …(1) ] to have a length of 1 but got 2` (index.spec.ts:59:19).
3. **`apps/web/test/smoke.e2e.ts:52-53`**, même hypothèse : un seul `a[hreflang]`, puis un clic sur
   `a[hreflang="fr"]`. Avec `hreflang` sur le lien du CV, les 14 cas `/en` échouent (7 tailles
   d'écran × 2 schémas) : `locator('a[hreflang]') Expected: 1 Received: 2`.

Ces tests ont été écrits avant D22. Pour 2 et 3, le sélecteur visait le sélecteur de langue, seul
lien à porter `hreflang` à l'époque. Je ne les ai pas modifiés : c'est le rôle du correcteur, et
l'orchestrateur décide.

Le branchement est prêt et vérifié. Il est dans **`docs/comptes-rendus/lot-F3c-lead-repli.patch`**
(`git apply --check` OK sur eb6157a) :

- `CvButton.vue` utilise `useCvLink` : `href`, `hreflang`, et la mention dans le libellé, donc dans
  le nom accessible (« CV PDF (in French) ») ;
- nouveau test `CvButton-repli.spec.ts`, qui pose la liste des CV lui-même ;
- `test/cv.e2e.ts` couvre aussi `en`.

Résultats mesurés avec le patch appliqué :

- **avec `hreflang`** : `vitest run` donne 2 échecs, les tests 1 et 2 ci-dessus (773 réussis) ;
  `playwright test test/cv.e2e.ts test/smoke.e2e.ts` donne 14 échecs, tous dans smoke `/en`. Les 14
  cas de `cv.e2e.ts` passent (fr et en, 7 tailles), dont `/en` → `/cv/cv-fr.pdf` : 200,
  `application/pdf`, nom accessible « CV PDF (in French) ».
- **sans `hreflang`** (ligne `:hreflang` retirée) : un seul échec Vitest, le test 1 ; cv et smoke
  passent en entier (49 réussis).

Ce qu'il reste à décider :

- (a) le correcteur adapte le test 1. Il le faut dans tous les cas : sur `/en`, il doit attendre le
  CV du contenu de `public/cv/`, ou poser `cvFiles` lui-même comme le fait `useCvLink.spec.ts`. On
  applique ensuite le patch, sans la ligne `:hreflang`.
- (b) on veut aussi `hreflang="fr"`, comme le brief le demande : le correcteur limite en plus les
  sélecteurs des tests 2 et 3 au sélecteur de langue (ex. `.language-switch a[hreflang]` ou
  `a[hreflang]:not([download])`), puis on applique le patch tel quel.

Sans branchement, `resolveCvLink`, `useCvLink`, `cvFiles` et `shell.actions.cvInFrench` sont testés
mais l'application ne les exécute pas encore. Aujourd'hui, le lien anglais mène toujours à
`/cv/cv-en.pdf`, en 404. Le parcours `cv.e2e.ts` ne couvre que `fr`, l'ajout de `en` est dans le
patch.

## Décisions

- **Nettoyage par qpdf en Docker, pas par exiftool ni pdf-lib.** `exiftool -all=` sur un PDF ajoute
  une mise à jour incrémentale : il est réversible et les anciennes valeurs restent dans le fichier.
  pdf-lib (paquet npm) n'a plus de version depuis 2021. qpdf réécrit le fichier entier ; le rendu
  vérifié est identique.
- **Liste des CV relevée au build, dans `runtimeConfig.public`.** Écarté : une constante dans le
  code, qu'il faudrait modifier à l'arrivée de `cv-en.pdf`, ce que le brief exclut. Écarté aussi :
  `import.meta.glob` sur `public/`, que Vite ne prend pas en charge pour ce dossier (le fichier
  serait recopié sous un nom avec empreinte).
- **Écarté : copier `cv-fr.pdf` sous le nom `cv-en.pdf` au moment de la génération.** Cette variante
  passerait tous les tests existants, mais le lien « anglais » servirait un document français, à
  l'opposé de « la version anglaise pointe vers le PDF français ». La retenir pour garder le test 1
  vert reviendrait à le contourner.
- `hreflang` n'est posé qu'en cas de repli, quand la langue du document diffère de celle de la page.
  Le nom accessible porte la mention, et `type="application/pdf"` est posé dans tous les cas.

## Points ouverts

1. La sortie honorable ci-dessus : correction de `HomePage.spec.ts:111-115`, et si l'option (b) est
   retenue de `index.spec.ts:55-63` et `smoke.e2e.ts:52-53`, puis application du patch.
2. L'exception de CLAUDE.md couvre seulement `apps/web/public/cv/cv-fr.pdf`, comme D22 le dit. Quand
   Julien fournira `cv-en.pdf`, il faudra étendre l'exception à ce fichier, et le nettoyer avec le
   même script.
3. Le prérendu ne signale pas un lien vers un PDF absent : `nuxt generate` réussit alors que `/en`
   mène à `/cv/cv-en.pdf`, qui n'existe pas. Seul `cv.e2e.ts` empêche un 404.

## Preuves

- `pnpm format` : aucun fichier modifié.
- `TURBO_FORCE=true pnpm check` lancé deux fois, avec `docker compose down -v` entre les deux :
  code 0 les deux fois. Front : 455 parcours Playwright réussis, dont `cv.e2e.ts` fr sur les
  7 tailles. Couverture `All files` à 100 / 100 / 100 / 100 pour contracts, api et web. Journaux :
  `f3c-check-1.log`, `f3c-check-2.log` (scratchpad de la session).
- `pnpm --filter @siteperso/web test:mutation` : code 0, score final 100,00, seuil de rupture 100.
  944 mutants, dont 3 en délai dépassé (comptés comme détectés), 0 survivant, 0 sans couverture.
  `cv-link.ts` : 15 tués et 2 délais.
- `pnpm integrity develop` : « Intégrité des tests : OK », aucun test existant modifié.
- `git apply --check docs/comptes-rendus/lot-F3c-lead-repli.patch` : le patch s'applique sur la tête
  de la branche.
