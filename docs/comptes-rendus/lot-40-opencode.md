# Lot 40 — `docs/backlog.md`, ajouter la section du lot 26 (OpenCode, 27 nov. 2026)

Documentation seule. Branche `lot/40-doc-backlog`. Brief `/tmp/opencode/briefs/lot40.md`. Sources de
vérité : `docs/comptes-rendus/lot-26-lead.md`, `docs/comptes-rendus/lot-26-devops.md`,
`docs/comptes-rendus/lot-26-recette.md`, `git log`/`git show` du dépôt, carte Trello « [Back]
docs/backlog.md : ajouter la section du lot 26 ». Rien d'inventé.

## Fait

- Section `## 7 septies novies. Lot 26 — Suites des revues (PR #14 fusionnée le 23 nov. 2026)`
  ajoutée à `docs/backlog.md`, après « 7 septies octies. Lot 25 … » et avant « 7 septies. Lot 15 … »,
  au format des sections voisines : titre numéroté, branche `lot/26-suites-revues`, tête `cf8716d`,
  PR #14 fusionnée le 23 nov. 2026 (`5599c48`), sous-branche `lot/26-hooks` (`origin/develop`
  612b57a, PR #9) fusionnée (`b9873ed`), renvoi aux trois comptes rendus, verdict de recette, CI
  (run 45154790264, `VERDICT: OK`).
- Tickets avec leur agent et leur état réel :
  - **L26-01** (dev-devops, `8a96500`) : `persist-credentials: false`, fait, recette OK ;
  - **L26-02** (dev-devops, `8a96500`) : `arret-premier-echec`, fait, recette OK, réserve 2, points
    ouverts du compte rendu ;
  - **L26-03** (dev-devops, `868a5c4`, `8a96500`) : `check-front-matrix.mjs`, fait, recette OK ;
  - **L26-04** (dev-devops, `86ac85b`) : **partiel** — `prepare --commit` refusé sur `main` fait ;
    `check` qui régénère le CHANGELOG retiré, **renvoyé à la carte Julien « [Julien] Décider : check
    de release qui régénère le CHANGELOG (L26-04) »** ; détails (cas `release.test.sh`,
    `Justification-test`, esquisse, sortie honorable) repris ; recette : ticket partiel + décision 1 ;
  - **L26-05** (lead-architecte, `2957658`, `d880615`, `1090c64`, `390a899`, `b9873ed`) : élagage
    de l'état des garde-fous, **fait** ; preuves (1285 hooks verts, intégrité, contre-épreuve), non
    fait, points ouverts du compte rendu (dont `CARRY_MAX_AGE_MS`, instantanés orphelins,
    `findAuthorization`) repris ; recette OK ;
  - **L26-06** (dev-devops, `75dc827`, `3600666`) : `review-usage.mjs`, fait, recette OK ;
  - **L26-revue** (dev-devops, `cf8716d`) : tolérance à l'API, `timed_out`, `release.mjs`, fait,
    recette OK, réserve 2.
- Réserves de preuve de la recette (1)(2)(3) et trois décisions à demander à Julien (carte L26-04,
  `CARRY_MAX_AGE_MS`, test instable `experience.e2e.ts:680`) reproduites.
- Commit `c0874d1` `docs(backlog): ajouter la section du lot 26 au backlog`.

## Vérifications ciblées (D26 ; pas de `pnpm check` ; `docs/` exclu de Prettier)

- Relecture de la nouvelle section contre les trois comptes rendus, ticket par ticket, son agent,
  son état ; relecture croisée avec `git log --all`, `git show`, `git log origin/lot/26-suites-revues`
  et `git branch -a --contains`, noms de commits et identifiants vérifiés. Corrections appliquées
  pendant la relecture : journal des écritures autorisées *relu* (non réécrit) à chaque fin de
  tâche ; `prune(ctx)` ; « tolérante aux erreurs d'API » ; `pnpm lint:shell` ; `pnpm lint:workflows`
  conservé.
- `git diff --stat` : **un seul fichier modifié** (`docs/backlog.md`, +95), aucune réécriture ni
  reformatage des sections existantes ; compte rendu en second commit (`docs/comptes-rendus/lot-40-opencode.md`).
- Carte Trello relue (`trelloSearch`), lecture seule, aucune écriture Trello.
- Aucun test touché ; aucun conteneur lancé ; pas de `pnpm install` ; pas de `pnpm check` ; pas de
  `pnpm format:check` ; pas de `git push` ; aucune commande `gh` d'écriture ; rien touché d'autre
  que `docs/backlog.md` et ce compte rendu. Pas de `--no-verify`.
- Fichier `docs/` exclu de Prettier ; `docs/` « ne pas reformater ».

## Décisions

- Numérotation de la série existante : « 7 septies novies » (suivant « 7 septies octies »).
- Titre : « Suites des revues » (branche `lot/26-suites-revues`, carte Trello, réserve 3 de la
  recette) ; renvoi aux trois comptes rendus avec leur agent.
- Statuts : fait / **partiel** (L26-04) / **renvoyé à une carte Julien** (L26-04) ; « fait » pour
  L26-05 repris du compte rendu lead.
- Trailer de commit `Co-Authored-By: OpenCode <noreply@opencode.ai>` (exigé par le brief, prime sur
  `Co-Authored-By: Claude Fable 5.1` de CLAUDE.md pour cette tâche).
- Conventional Commits en français : `docs(backlog): …`.

## Points ouverts

- **L26-04** renvoyé à Julien (carte Trello « [Julien] Décider : check de release qui régénère le
  CHANGELOG (L26-04) » ; recette, décision 1 ; sortie honorable du dev-devops ; détails dans la
  section).
- Réserves de preuve non rejouées localement (garde-fous, scripts `scripts/ci/` non lançables par
  agent) ; suggestions d'orchestrateur : `pnpm integrity:test`, `pnpm hooks:test`.
- Décisions de la recette à soumettre à Julien : `CARRY_MAX_AGE_MS` = 7 jours ; test instable
  `experience.e2e.ts:680` (écran 3440) → ticket du front.
- Numérotation « novies » non présente ailleurs dans `docs/backlog.md` : à valider par Julien si la
  série s'arrête à « octies ».
