# Lot F3c : correcteur (F3c-OBS), 21 novembre 2026

Décision en cause : en anglais, le bouton « CV PDF » mène au CV français, avec « (in French) » et
`hreflang="fr"` (D22, D23 : pas de triage). Autorisation 10e117b0.

| Test | Avant | Après | Pourquoi |
| --- | --- | --- | --- |
| `HomePage.spec.ts` « relie le CV PDF… » | Échec : `expected '/cv/cv-fr.pdf' to be '/cv/cv-en.pdf'` | href `/cv/cv-fr.pdf`, `hreflang="fr"`, texte contient « (in French) » ; assertion de la déclaration inchangée | Le lien anglais ne pointe plus vers un PDF absent |
| `pages/index.spec.ts` « version française depuis l'anglais » | Échec : `expected [..] to have a length of 1 but got 2` (le lien CV porte `hreflang`) | sélecteur `.language-switch a[hreflang]` ; mêmes assertions (href, lang, hreflang, texte « FR ») | Deux `a[hreflang]` sur `/en` |
| `pages/index.spec.ts` (version FR) | Passait | Même restriction du sélecteur, par symétrie | Sélecteur unique dans le fichier |
| `test/smoke.e2e.ts` | Aurait échoué sur `/en` (`toHaveCount(1)` sur `a[hreflang]`, deux liens) : non rejoué avant, déduit du cas unitaire identique | `.language-switch` : un seul `a[hreflang]`, clic sur la langue cible, URL et `lang` vérifiés | Idem |
| `test/cv.e2e.ts` | Patch du lead : `/en` ajouté (200, `application/pdf`, `%PDF-`, nom « CV PDF (in French) ») | + `hreflang="fr"` vérifié en cas de repli, absent sinon | Le repli est signalé aussi par la langue du lien |

Patch `lot-F3c-lead-repli.patch` appliqué tel quel (CvButton.vue, CvButton-repli.spec.ts, cv.e2e.ts).

Preuves : vitest ciblé (HomePage, index, CvButton-repli) 9/9 ; Playwright `cv.e2e.ts` + `smoke.e2e.ts`
49/49 (`f3c-obs-e2e.log`) ; lint, typecheck et couverture : `f3c-obs-verif.log`.

Décisions : `pnpm check` et mutation complets non lancés (consigne). Une écriture par script python
sur les specs a été refusée par le hook (écriture opaque) ; refaite avec l'outil Edit.
