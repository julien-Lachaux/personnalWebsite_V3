# Lot 17 : recette (BF-12, brief back-004)

Date : 20 novembre 2026. Branche `lot/17-lieu-openclassrooms`, tête 477165d, base 55d93d2. Recette allégée
(un seed et un test ajouté), dans un clone jetable, isolation `siteperso-v3-recette17` (ports 5782-5785).

## Verdict : acceptée

## Critères du brief (rejoués)

| Critère | Preuve | Résultat |
| --- | --- | --- |
| Seed : `location` nul pour `openclassrooms-mentor`, fr et en | `git diff 55d93d2...HEAD -- db/seeds` : `'À distance'` et `'Remote'` remplacés par `null` (commentaire « EN : à relire » du lieu retiré) ; API démarrée sur base reseedée : `location === null` en fr et en, `workMode = remote` | OK |
| `docs/traductions-a-relire.md` : ligne retirée | diff : une seule ligne supprimée (`openclassrooms-mentor / location`) | OK |
| Test e2e `location: null` dans les deux langues | `apps/api/test/db/front-openclassrooms-location.e2e-spec.ts`, 5 cas (/experiences et /cv, fr et en, stockage + double rejeu du seed) | OK |
| Aucun test existant affaibli | 4 fichiers touchés, 1 seul test (nouveau) ; aucun test existant modifié | OK |

## Étapes

1. `TURBO_FORCE=true pnpm check` : code 0, 4 tâches sur 4 sans cache, couverture 100 % (lignes 745/745, fonctions 276/276).
2. Diff des tests : un fichier ajouté, aucun modifié ni supprimé, aucun `skip`, `only`, `todo`, `fails`, ignore de couverture. `pnpm integrity 55d93d2` : « Intégrité des tests : OK ». Aucune `Justification-test` requise.
3. Journal des garde-fous : aucune entrée d'autorisation ni refus pour le rôle `dev-sql` sur ce lot (dernières entrées `dev-sql` : BF-1, autre lot). Aucune violation.
4. Cycles édition-test : chaque fichier touché par un seul commit ; transcription non fournie. RAS.
5. Retrait ciblé : seed remis à `'À distance'` / `'Remote'` dans le clone, nouveau test relancé : 5 cas sur 5 rouges (`expected 'À distance' to be null`, `expected 'Remote' to be null`, écart de lecture en base). Le test est discriminant. Seed restauré, clone non modifié.
6. Scénarios de réserve (17 vérifications, 0 échec) contre l'API du clone (build, base reseedée, port 3790) : `/experiences` et `/cv` en fr et en validés par `ExperienceSchema` et `CvSchema`, en-tête JSON ; OpenClassrooms à `location` nul ; `/cv` `experiences` identique à `/experiences` ; les 6 autres expériences (hors pause) gardent un lieu non vide en fr et en ; `lang=de` : 400 ; paramètre inconnu : 200 (toléré) ; `/experiences/inexistant` : 404. Scripts dans le scratchpad, non commités. Pas de mutation (aucun code de production modifié).

## Non fait
Rien (mutation exclue par la consigne).

## Décisions
Aucune.

## Points ouverts
- Le compte rendu de dev-sql signale le défaut connu du cache Turborepo partagé entre worktrees ; contourné ici par `TURBO_FORCE=true`.
- `apps/api/.env` copié du modèle contient aussi `POSTGRES_PORT=5432`, sans effet (le `.env` racine fait foi).
