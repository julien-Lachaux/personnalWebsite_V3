# Recette du lot 25 (garde-fous), 22 nov. 2026

Branche `lot/25-garde-fous`, tête d627fd5, PR #9. Recette selon D26 révisée : lecture de la CI, pas de
`pnpm check`.

## Verdict : acceptée, avec trois réserves non bloquantes

## Preuves

- **CI** : run 45026812596, tête d627fd5, conclusion success, les 21 jobs verts (garde-fous, qualité,
  e2e et couverture, mutation, pile locale, parcours Playwright, analyse statique, revue PR).
- **Run précédent** 45025051529 : annulé (« Annuler le run (premier échec) ») après l'échec d'un seul
  test, `config-env-commands.test.mjs`. Cause, au compte rendu et au message de d6bb386 : git 2.56.1 de
  l'exécuteur ne lit plus `GIT_CONFIG_PARAMETERS="' diff.external =…'"`, que 2.30.2 et 2.43.0 lisent.
  Le test exigeait l'effet de git sur toute version. Défaut du test (oracle de comportement de git),
  pas du garde-fou. Je n'ai pas pu relire le journal du run annulé (sortie vide de `--log-failed`) :
  cause établie par le compte rendu et par la cohérence du correctif, non par le journal.
- **`pnpm integrity develop`** : code 0, « Intégrité des tests : OK ».
- **`pnpm hooks:test`** : 1264 tests, 1264 verts, 0 échec, 0 saut, 0 todo.
- **Marqueurs** (`only`, `skip`, `todo`, `skipIf`, `runIf`, `fails`, ignores de couverture) dans le diff
  des tests : aucun.

## Tickets

| Ticket | Preuve | Résultat |
|---|---|---|
| L25-01 clés de configuration par l'environnement | `shell.mjs` (+475), `config-env-commands.test.mjs` (41 cas, rejeu réel de git), 2.30.2 hôte et 2.43.0 vérifiés par le lead, CI sous 2.56.1 verte | OK |
| L25-02 commit justifié après réécriture | `state.mjs`, `rewritten-history.test.mjs`, verts | OK |
| L25-03 reprise d'un agent | `resumed-agent.test.mjs`, verts | OK |
| L25-04 écriture autorisée d'un autre agent | `other-agent-authorized.test.mjs`, verts | OK |
| L25-05 `gh run rerun` à la session principale | `run-rerun-main.test.mjs`, `run-rerun-refusals.test.mjs`, verts | OK |

## Oracles

Tests existants modifiés : uniquement `run-download.test.mjs:139` et `pr-flow.test.mjs:201`, dans f82e224
avec `Justification-test: L25-05`. Chaque cas passe d'un `gh run rerun` désormais permis à un cas toujours
refusé (`--debug`, `-R`) : l'oracle garde un refus, rien n'est affaibli. Seuls ces deux fichiers
apparaissent en `M` parmi les tests. d6bb386 modifie un test créé dans ce lot, avec
`Justification-test: L25-01` ; le refus par les hooks reste exigé pour chaque forme et chaque version, seul
l'effet de git est borné par la version, avec nom de toutes les formes en cas d'échec.

## Journal des garde-fous

Autorisations feabeb02, a6b064a4, c6372bc4 (lead) et 3dd21b9d (main) : chacune a son événement `revoke`.
Aucune tentative répétée de contournement relevée pour le lot. Les refus récents du journal concernent
d'autres rôles.

## Constats de la revue, priorité proposée

1. `state/authorized-writes.jsonl` jamais purgé, relu en entier à chaque vérification : basse, suivi
   à planifier (croissance lente, dossier ignoré par git).
2. `docs/comptes-rendus/lot-25-lead-l25-05.patch` duplique du code appliqué par 80fdaf5 : moyenne, à
   retirer par un commit de docs avant ou après fusion (il dérivera).
3. `check-tests-integrity.sh` et état de la CI non vérifiés par la revue : sans objet, levé ici (integrity
   code 0, CI verte sur la tête).

## Réserves

- Comportement sous git 2.56.1 des formes `GIT_CONFIG_COUNT` et `--config-env` : validé par la CI du
  runner, non rejoué localement par moi.
- Limites documentées par le lead, non traitées : fichiers `GIT_TRACE*`/`trace2.*Target` (décision de
  Julien à prendre), clés déjà présentes dans un fichier de configuration, écriture shell autorisée
  (`sed -i`, `cp`) hors L25-04.
- Étape 5 (retrait d'un test au hasard), étape 6 (tests de réserve OpenAPI) et étape 4 (cycles) : sans
  objet pour ce lot, qui ne touche que les garde-fous et des documents (aucune route, aucun code
  applicatif, couverture applicative inchangée).
