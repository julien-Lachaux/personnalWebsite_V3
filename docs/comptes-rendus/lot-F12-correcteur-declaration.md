# Lot F12, correcteur : déclaration d'accessibilité et CV anglais (F12-DECLA, D47)

| Finding | Commit | Ce qui change | Preuve |
| --- | --- | --- | --- |
| F12-DECLA | `fix(web): déclaration d'accessibilité, langue du CV selon les CV présents (D47)` | `domain/cv-link.ts` : `hasEnglishCv(available)`. `pages/accessibilite.vue` : la liste des contenus non accessibles passe `{language}` aux libellés (`rt(item, { language })`), valeur `declaration.issues.cvLanguage.frenchOnly` ou `.both` selon `useRuntimeConfig().public.cvFiles`. `common.json` fr et en : « bouton » devient « menu » (D44), `{language}` dans l'item, deux clés `cvLanguage`. Constat « non balisé » (D33) inchangé. | Avant : `accessibilite-issues-list.spec.ts` réécrit échouait (4 échecs : désignation « menu » et phrase de langue). Après : 127 fichiers, 1143 tests verts, couverture 100 % (`test:coverage`) ; Stryker sur `cv-link.ts` : 100 % (11 tués, 0 survivant) ; lint, typecheck verts ; `pages.e2e.ts` et `csp.e2e.ts` : 161 passés sur les sept projets. |

## Textes proposés (cas « CV anglais présent »)

- fr : « Il existe en français et en anglais, et les deux versions sont dans ce cas. »
- en : « It is available in French and in English, and both versions are in this state. »

Cas « CV anglais absent » : textes d'aujourd'hui inchangés.

## Tests modifiés (autorisation F12-DECLA)

- `app/pages/accessibilite-issues-list.spec.ts` : attendus mis à jour (« menu ») et deux cas ajoutés (`cvFiles` posé par `useRuntimeConfig()`).
- Ajouté : `app/domain/cv-link-english.spec.ts`.
- Non touchés car toujours valides : `accessibilite-declaration.spec.ts`, `accessibilite.spec.ts`, `i18n-common.spec.ts`, `test/pages.e2e.ts`.

## Non fait, décisions, points ouverts

- Rien en « Non fait ». Le menu du CV et les composants d'Expérience ne sont pas touchés.
- Décision : les libellés gardent un seul item avec le paramètre `{language}` (la liste vide reste le repli « aucun défaut » de D34).
- Ouvert : quand `cv-en.pdf` sera déposé, la formulation « les deux versions sont dans ce cas » suppose que le CV anglais est lui aussi non balisé ; à revoir si Julien fournit un PDF balisé.
