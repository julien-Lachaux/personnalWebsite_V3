# Lot 47 : borne de 45 min du job « Arrêt au premier échec » (lead-architecte)

Date : 27 nov. 2026. Branche `lot/47-ci-borne-45min`, base `develop` (24b9494). Ticket L47-01, carte
Trello #73.

## Fait

- `.github/workflows/ci.yml`, job `arret-premier-echec` : borne `timeout-minutes: 45` justifiée en
  commentaire (commit `5a7765c`, `Justification-test: L47-01`). Valeur inchangée.

## Décision

- **Garder 45 min, justifiée.** La boucle sort déjà d'elle-même quand tous les jobs surveillés sont
  conclus (`pending -eq 0`, avec `total -gt 0`) ou au premier échec : sur un run normal, le job
  n'occupe pas d'exécuteur au-delà du dernier job surveillé. La borne n'est qu'un filet.
- Calcul : le plus long job surveillé est `pile-locale` (35 min ; les autres font 10 à 20 min) ; aucun
  job surveillé n'a de `needs`, ils partent tous au début du run. La borne doit dépasser 35 min : sinon
  ce job s'arrête avant `pile-locale` et un dépassement de celle-ci (`timed_out`) n'annulerait plus la
  mutation de l'API (150 min). 10 min de marge couvrent l'attente d'un exécuteur et la latence de la
  boucle (15 s, plus 3 lectures de l'API espacées de 5 s). 35 + 10 = 45.
- Alternative écartée : réduire la borne à 36 ou 40 min. La marge serait trop faible si
  `pile-locale` attend son exécuteur, et ça n'apporterait rien puisque la boucle sort déjà dès la fin
  du run. Le commentaire demande de relever la borne avec le délai de `pile-locale`.

## Vérifications

- `pnpm lint:workflows` (actionlint) : code de sortie 0.
- `pnpm exec prettier --check .github/workflows/ci.yml` : « All matched files use Prettier code style! ».
- `pnpm integrity develop` : « Intégrité des tests : OK ».
- Hook pre-commit passé (lint, typecheck, tests).
- Je n'ai lancé ni conteneur, ni e2e, ni mutation, ni `pnpm check` (D26).

## Non fait / points ouverts

- `node .claude/hooks/authorize.mjs list` (vérification de l'autorisation demandée par le brief) a été
  refusé par les garde-fous : « les scripts des garde-fous ne se lancent que depuis la session
  principale ». Je ne l'ai pas contourné. L'orchestrateur a confirmé que l'autorisation L47-01 existe.
- Le lien entre la borne et le délai de `pile-locale` n'est vérifié par aucun contrôle automatique. Il
  ne tient qu'au commentaire. Un contrôle dans `scripts/ci/` (borne > plus long job surveillé) est
  possible, mais il demande une autorisation : c'est à l'orchestrateur de décider.
- CI de la PR et revue `revue-pr` : après le push par l'orchestrateur.
