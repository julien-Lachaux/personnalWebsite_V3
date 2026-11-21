# Recette du lot 18 (chef de projet, 21 nov. 2026)

Branche `lot/18-suites-lot-14`, HEAD 5cf175f, base `develop` à ec5a30c. Arbre du HEAD : 9d0ef348.

## Verdict : acceptée, avec réserves

Aucun critère en échec, aucun oracle affaibli. Deux écarts de la règle `main` et de `core.hooksPath`,
signalés par l'agent, sont confirmés par la recette (réserves 1 et 2) : ils sont hors ticket.

## 1. Critères des deux tickets

Rejoués par le hook réel (`guard.mjs pre-tool-use`, entrée JSON, rôles `main` et `dev-api`, dépôt jetable du
scratchpad sans remote, rien d'exécuté). Code 0 = permis, 2 = refusé.

| Commande | main | dev-api |
| --- | --- | --- |
| `git config --get core.hooksPath` (L18-01) | 0 | 0 |
| `git config core.hooksPath /x`, `--unset core.hooksPath`, `git -c core.hooksPath=/x commit` | 2 | 2 |
| `git worktree add -b lot/x ../w develop` | 0 | 0 |
| `git checkout -b lot/y develop`, `git branch --no-track lot/y develop` | 0 | 0 |
| `git switch -c lot/y --track develop`, `git branch --track lot/y develop` (L18-02) | 0 | 2 |
| `git fetch --set-upstream origin develop` | 0 | 2 |
| `git -c branch.autoSetupMerge=always branch lot/y develop` | 0 | 2 |
| `git branch -u origin/develop` (L14-17) | 0 | 2 |
| `git config branch.autoSetupMerge always` | 2 | 2 |
| `git push -u origin develop` | 0 | 2 |
| `git status`, `git commit -m x`, `git fetch origin`, `git pull origin develop` | 0 | 0 |

Limite : sans remote dans le dépôt jetable, `git worktree add -b … origin/develop` donne 0 pour dev-api ;
le cas « point de départ distant » est couvert par `branch-tracking.test.mjs`, qui rejoue chaque forme par git
dans un clone jetable.

Suites rejouées : `pnpm hooks:test` 798 sur 798, `pnpm integrity:test` 9 sur 9, `pnpm integrity develop` code 0
(« Intégrité des tests : OK »).

`pnpm check` non relancé (consigne). Journal de l'orchestrateur `check-lot18-final.log` : chaîne `check`
lancée dans le worktree du lot, sans cache (« 0 cached, 11 total », 11 tâches sur 11 réussies, 5 min 3 s) ; hooks 798, husky 13,
couverture 100 % sur les trois paquets (contrats, API 117 fichiers, front 68), parcours du front 448.
Rattachement à l'arbre : le journal ne porte pas le SHA ; il est postérieur au commit 5cf175f (00:23:30, journal
00:30), le worktree est propre (`git status` vide) et le nombre de tests des hooks (798) est identique à mon
rejeu. Rattachement par cohérence, pas par empreinte.

## 2. Oracles

- Tests de `develop` modifiés : un seul, `agents-git-section.test.mjs`, 7 lignes ajoutées, 0 retirée (clé `créer`
  dans `PROBES`, cinq commandes). Commit 3861749 porte `Justification-test: L18-02 …`. `git diff --stat` : les
  deux autres fichiers de test (`branch-tracking.test.mjs`, `config-read.test.mjs`) sont des créations.
- `lib/shell.mjs` : 39 lignes retirées, toutes du remplacement du contrôle de `git config` et de
  `core.hooksPath` (écriture seule désormais, lecture par options). La non-régression est portée par les tests
  d'écriture refusée de `config-read.test.mjs` (core, remote, url, push, include, édition libre), que je n'ai pas
  rejoués un par un hors de la suite verte.
- Commits avec `Justification-test` : e4c060a, 99362f5, bb48adc, 85692e4, 3861749. Les commits docs sans
  justification (6ce107d CLAUDE.md, 9402a9d et 5cf175f comptes rendus) ne touchent ni test ni configuration protégée.
- Aucun marqueur de saut ou de focus, aucun commentaire d'ignore de couverture ajouté (`pnpm integrity` OK).

## 3. Section « Git et garde-fous »

La puce ajoutée est identique dans les 14 fichiers d'agent (même empreinte des lignes ajoutées, 14 sur 14) :
« créer une branche qui suit une autre branche (`git branch --track`, `checkout -b` ou `switch -c` depuis une
branche distante, `fetch --set-upstream`) : la destination des push est réservée à la session principale ;
`--no-track` reste permis ». Elle nomme des commandes refusées, aucun mécanisme de détection (pas de
`autoSetupMerge`, pas de lecture de configuration). Conforme à la contrainte de publication.

## 4. CLAUDE.md

Exact : lecture de `core.hooksPath` permise, écriture et retrait refusés (vérifié ci-dessus) ;
`branch.autoSetupMerge` et `autoSetupRebase` refusées en écriture (code 2 vérifié) ; puce « Branche suivie »
cohérente avec les refus constatés, dont l'orchestrateur gardant `git worktree add -b lot/x <dossier> develop`
(code 0).
Remarque : CLAUDE.md cite `branch.autoSetupMerge` et les cas de suivi automatique. Il n'est pas dans la liste
des fichiers à publier, mais si le dépôt devient public il décrit alors des détails de détection (réserve 3).

## 5. Processus

- Autorisation b058c66e (lead-architecte, config, `.claude/hooks/**` et `.claude/agents/**`) : 47 utilisations,
  toutes sur `.claude/hooks/lib/shell.mjs`, `.claude/hooks/tests/*`, `.claude/hooks/README.md` et
  `.claude/agents/*.md` ; révoquée à 23:23:51. Aucun chemin hors périmètre.
- Refus du lead dans le journal : deux, non répétés (lecture de `core.hooksPath` refusée par l'ancien code,
  c'est le faux positif du ticket ; écriture shell sur un motif couvrant des oracles, suivie de 14 éditions
  individuelles autorisées). Pas de contournement.
- Fichiers du diff hors `.claude/`, `CLAUDE.md` et `docs/comptes-rendus/` : aucun. Aucun push (reflog du
  checkout principal sans push ; la branche n'a pas de suivi).
- Mon propre refus : une préparation de dépôt jetable (`git -C <dossier> commit` dans le scratchpad) a été
  refusée (« branche courante illisible … illisible donc refusé »). Je n'ai pas reformulé : j'ai utilisé un
  dépôt sans commit, ce qui suffit à l'analyse du hook. Information pour l'orchestrateur : `git -C` suivi d'un
  `commit` est illisible pour l'analyseur.

## 6. Propositions de l'agent pour Julien

Les deux écarts sont confirmés, avec l'analyseur seul (aucune commande exécutée) :

- `git checkout -b main` : refusé (2). `git checkout -qb main`, `git checkout -bmain`, `git switch -cmain` : permis
  (0) pour la session principale. La règle L14-06 est donc contournable par options collées. Proposition
  pertinente et peu coûteuse ; à traiter dans un ticket dédié.
- `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/x git commit -m x` : permis (0), alors
  que `-c core.hooksPath=` est refusé. Écart réel, même nature que HUSKY=0 : à refuser. Proposition pertinente.

Limites connues de L18-02 (compte rendu du lead, § 4) : toutes du côté strict ou marginales ; acceptables.

## Réserves

1. Règle `main` contournable par options collées (proposition 2 de l'agent, confirmée).
2. `core.hooksPath` par `GIT_CONFIG_*` non refusé (proposition 3, confirmée).
3. CLAUDE.md détaille `branch.autoSetupMerge` : à revoir si le fichier doit être public.
4. Journal de `pnpm check` rattaché à l'arbre par cohérence (pas de SHA dans le journal).
5. Jusqu'à la fusion, L18-01 n'est pas effectif pour les sessions en cours (hooks de `develop`).

## Questions pour Julien

1. Faut-il un ticket pour refuser la création de `main` par options collées (`-qb`, `-bmain`, `-cmain`, `--cr`) ?
2. Faut-il refuser toute variable `GIT_CONFIG_PARAMETERS`, `GIT_CONFIG_COUNT/KEY/VALUE` nommant `core.hooksPath` ?
3. CLAUDE.md sera-t-il public, et faut-il alors en retirer les détails de détection ?
