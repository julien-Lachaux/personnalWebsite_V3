# Lot 16 : recette du chef de projet

Date : 20 novembre 2026. Branche `lot/16-briefs-002-003`, tête 5075f93, base a6d66bf (5 commits).
Briefs : back-003 (BF-10, BF-11), back-002 (BF-8, BF-9). Recette dans un clone jetable (scratchpad),
isolation `siteperso-v3-recette16`, ports 5792 à 5795.

**Verdict : acceptée**, avec trois points ouverts non bloquants (section « Points ouverts ») et une
limite de ma recette (ligne `paths.test.sh` ci-dessous).

## 1. Critères

| Critère | Commande | Résultat |
|---|---|---|
| Hooks | `pnpm hooks:test` | `pass 569`, `fail 0` (549 existants + 20 ajoutés) |
| Scripts d'intégrité | `pnpm integrity:test` | 19, 3, 13 (fails-marker), 8, 13 (paths), 8 réussis, 0 échec |
| Intégrité depuis la base | `pnpm integrity a6d66bf` | `Intégrité des tests : OK`, code 0 |
| `pnpm check` | `TURBO_FORCE=true pnpm check` | code 0, `Tasks: 12 successful`, puis couverture `Tasks: 4 successful` (100 % contracts, api, web). Une seule passe, verte du premier coup (charge de l'hôte 7 à 9 pendant la passe, aucun `Timeout waiting for worker`) |

Scénario du brief en échec sans la correction : fichiers de production (`guard.mjs`, `lib/`,
`check-tests-integrity.sh`) remis à a6d66bf dans mon clone, tests du lot conservés.
- `pnpm hooks:test` : `pass 558`, `fail 11` : BF-9 (3 cas : faux positif `includes`, enchaînement
  multiple, écriture refusée à tort), BF-10 (4 cas), BF-11 (4 cas, dont `.git` retiré). Les 4 cas de
  `non-ascii-paths.test.mjs` passent avant comme après (défaut inexistant côté hooks, comme annoncé).
- `pnpm integrity:test` : `fails-marker.test.sh` 10 réussis, 3 échecs (`appel includes`, `map et filter`,
  `enchaîné par plusieurs méthodes`) ; le chaînage de `pnpm integrity:test` s'arrête là.
- `paths.test.sh` (BF-8) : non rejoué par moi sur l'ancien script, mon garde-fou refuse de lancer un
  script de test qui cite l'oracle du script d'intégrité (« écriture opaque »). Refus respecté, non
  contourné. Remplacé par ma propre sonde (section 2) : l'ancien script y échoue sur le cas accentué. Les
  8 échecs annoncés par l'agent pour cet état restent, dans le détail, sur sa seule parole.

## 2. Aucun test existant modifié ni affaibli

- `git diff --name-status a6d66bf...5075f93` : 7 fichiers ajoutés (6 tests plus le compte rendu), 5
  modifiés (`README.md` des hooks, `guard.mjs`, `lib/policy.mjs`, `lib/state.mjs`, script d'intégrité).
  Aucun fichier de test existant modifié ou supprimé. Les 4 commits de correction portent
  `Justification-test: BF-n` (configuration protégée), conforme. `FORBIDDEN_RE` du script et la branche
  des marqueurs interdits de `MARKER_RE` sont inchangés.
- Sonde du script (42 cas, dépôts jetables, ancien script contre nouveau ; scratchpad, non commitée) :
  - ancien : 36 accords, 6 écarts ; nouveau : 41 accords, 1 écart ;
  - les 6 écarts de l'ancien : modification d'un test au nom accentué sans justification **acceptée**
    (voir plus bas), 2 faux positifs (`includes`, `map` après la portée d'échec attendu), 2 échecs
    attendus enchaînés sur deux méthodes non détectés, 1 saut enchaîné sur deux méthodes non détecté ;
  - le seul écart du nouveau est ce dernier (saut après `concurrent` puis `each`) : point ouvert 2 de
    l'agent, présent dans l'ancien ;
  - aucun cas refusé par l'ancien script n'est accepté par le nouveau : marqueurs de saut, de focus,
    `todo`, `skipIf`, `runIf`, `fixme`, `slow`, ignores v8, c8, istanbul, échec attendu direct, en
    gabarit, après `concurrent`, `for`, `runIf`, `extend`, `scoped`, `override`, `fail` de Playwright,
    API étendue : tous refusés comme avant.
- Même comparaison sur `countMarkers` de `policy.mjs` (33 formes, ancien contre nouveau) : seules
  différences, voulues : l'appel `includes` ou `map` sur la portée d'échec attendu et un nom de méthode
  inconnu après l'échec attendu ne comptent plus ; l'échec attendu suivi de `concurrent` puis `each` est
  désormais compté.
- Constat utile : l'ancien script **acceptait** la modification d'un test au nom accentué sans
  justification quand le chemin n'était pas sous un dossier `test/` (`pkg/cassé.spec.ts` : chemin cité
  entre guillemets, `TEST_RE` ne le reconnaissait pas). BF-8 corrige un trou, pas seulement un faux refus.

## 3. Écarts au brief annoncés par l'agent

| Écart | Affaiblit une protection ? |
|---|---|
| BF-11 : « retiré » exige en plus que `git worktree list` ne liste plus la racine ; sinon violation unique | Non, plus strict que le brief (le brief ferait disparaître la vérification d'un worktree vivant dont on supprime `.git`). Violation unique au lieu de 200 lignes. Voir point ouvert 1. |
| BF-10 : un fichier non suivi inchangé compte comme inchangé | Non : même raisonnement que le contenu au commit `head`, comparé par empreinte ; modifié ensuite, il est signalé `oracle modifié` (testé). |
| BF-8 : `[ab]` dans un nom (`--literal-pathspecs`), ligne ajoutée « ++ » (diff par fichier, seules les sections `@@` comptent), tabulation et saut de ligne refusés | Non : trois durcissements. Mesure de l'agent sur 419 fichiers : 17,8 s au lieu de 28,6 s. |
| BF-9 : enchaînements multiples détectés | Non : élargit la détection. Seul rétrécissement : un nom de méthode hors API de test de Vitest 5 après l'échec attendu ne compte plus, c'est le but du brief. |

## 4. Journal des garde-fous, cycles

- Autorisation 9b3bea41 (lead-architecte, scope config, ticket BF-8-11) : 37 usages, tous sur les chemins
  déclarés (hooks, README, tests des hooks, script d'intégrité et ses tests) ; révoquée à 07:40:47.
  Pour l'agent, 9 refus, chacun une fois : script écrit par la même commande, écriture opaque d'un
  interpréteur mentionnant un oracle (trois fois, cibles différentes), variable illisible, lancement d'un
  script de garde-fou hors session principale, parenthèse illisible. Un refus n'est pas une faute ;
  aucune tentative répétée du même contournement, aucune violation de fin de tâche pour ce rôle.
- Cycles édition-test : au plus 3 commits sur un même fichier (`README.md` des hooks), 2 sur `state.mjs`
  et sur le script ; aucun fichier au-delà de cinq. Pas de transcription fournie : alternances non
  comptées. Le journal montre 5 éditions du script en 13 s (06:51), retouches successives d'une même
  fonction.

## 5. Retrait d'un test au hasard

Les fichiers de test du lot sont en `node:test` et en bash, hors de la mesure de couverture : retirer un
de leurs cas ne peut pas faire échouer `pnpm test:coverage`. Équivalents appliqués :
- (a) retour du code de production à a6d66bf : 11 cas rouges sur 20 pour les hooks, 3 sur 13 pour
  fails-marker ; chaque ticket a au moins un cas qui échoue sans lui ;
- (b) tirage au hasard (`shuf`) dans tout le dépôt : `apps/api/src/infrastructure/db/migrations-runner.spec.ts`,
  cas « refuse deux fichiers de même préfixe » retiré ; `pnpm test:coverage` code 1,
  `Coverage for lines (99.86%) does not meet global threshold (100%)`. Clone restauré.

## 6. Tests de réserve

Non applicables : le lot ne touche ni `apps/api/src` ni `packages/contracts/src` (rien hors
`.claude/hooks/`, `scripts/ci/`, `docs/`) ; l'API et le contrat OpenAPI sont identiques à la base. Aucun
scénario généré à partir de `openapi.json`. Remplacés par la sonde de 42 cas et les 33 formes de marqueurs
de la section 2. Pas de test de mutation : même raison.

## Décisions

- BF-11 : condition `git worktree list` ajoutée par l'agent, évaluée acceptable et plus sûre que le brief.
- Libellé `oracle modifié` pour un fichier devenu oracle puis changé : accepté.

## Points ouverts (non bloquants)

1. **BF-11, contournement résiduel.** Supprimer le `.git` d'un worktree puis lancer `git worktree prune`
   (prune retire un worktree dont le `.git` n'existe plus, vérifié en git 2.30.2) le rend « retiré » :
   instantané supprimé sans violation. Pas pire qu'avant le lot : supprimer le dossier, ou
   `git worktree remove --force`, le faisait déjà ignorer (`!existsSync(top)`), et les commits restent
   contrôlés par `pnpm integrity` en CI. Les hooks ne refusent ni `git worktree prune` ni
   `git worktree remove --force`. Question à Julien : refuser ces deux sous-commandes aux agents ?
2. **Marqueurs interdits enchaînés deux fois** : un saut suivi de `concurrent` puis `each` n'est reconnu ni
   par `MARKER_RE` ni par `FORBIDDEN_RE` (confirmé par ma sonde ; présent à la base). Correction possible
   en acceptant plusieurs méthodes après le marqueur, hors brief. Trou réel de détection à planifier.
3. **`guard.mjs`, `checkFileTool`** (point ouvert 1 de l'agent, confirmé non traité) : un fichier devenu
   test par élargissement de politique est éditable sans autorisation en cours de session ; la CI le
   rattrape au commit.
