# Lot 25 — Trous et faux positifs des garde-fous (lead-architecte, 22 nov. 2026)

Branche `lot/25-garde-fous` (worktree `lot-25`), partie de `lot/22-un-seul-run`. Autorisation
`feabeb02` (portée `config`, `.claude/hooks/**`, `scripts/ci/**`). Aucun test existant modifié : les
quatre fichiers de test sont nouveaux. Docker indisponible : seules les vérifications sans Docker
ont tourné (`pnpm hooks:test`, `pnpm integrity`, `pnpm integrity:test`, Prettier).

Méthode commune : pour chaque ticket, le fichier de test est écrit d'abord et lancé sur l'ancien code
(« avant »), puis le code est changé (« après »). Les journaux sont dans le dossier de session.

| Ticket | Commit    | Test (nouveau)                         | Avant (ancien code)                     | Après    |
| ------ | --------- | -------------------------------------- | --------------------------------------- | -------- |
| L25-01 | `3682a78` | `tests/config-env-commands.test.mjs`   | 18 échecs (refus absents), rejeu vert   | 0 échec  |
| L25-02 | `9c64b1b` | `tests/rewritten-history.test.mjs`     | 7 refus verts, 4 acceptations en échec  | 0 échec  |
| L25-03 | `b4e1f45` | `tests/resumed-agent.test.mjs`         | 6 refus verts, 5 acceptations en échec  | 0 échec  |
| L25-04 | `3d3d1b5` | `tests/other-agent-authorized.test.mjs`| 9 refus verts, 3 acceptations en échec  | 0 échec  |
| docs   | `3cc82f6` | README des hooks, CLAUDE.md, backlog   |                                         |          |

`pnpm hooks:test` final : 1221 tests, 1221 réussis (1145 avant le lot). Les tests existants passent
tous sur le nouveau code (non-régression, dont les 88 commandes ordinaires de L14-07).

## L25-01 : clés qui lancent une commande par l'environnement de git (fait)

### Cas réels mesurés (git 2.30.2 de l'hôte, dépôt jetable, commande témoin `touch`)

Scripts `mesure.sh`, `mesure2.sh`, `mesure3.sh` du dossier de session. « lancé » : git a exécuté la
commande témoin (ou lu la valeur).

| Forme | 2.30.2 |
| --- | --- |
| `GIT_CONFIG_PARAMETERS="'diff.external=…'" git diff` (et `export`, `env`) | lancé |
| `GIT_CONFIG_PARAMETERS="' diff.external =…'"` (blancs autour de la clé) | lancé |
| `GIT_CONFIG_PARAMETERS` : `core.fsmonitor`, `credential.helper=!…`, `core.sshCommand`, `filter.<d>.clean`, `alias.<n>=!…`, `core.pager` (`git var`) | lancé |
| `GIT_CONFIG_PARAMETERS="'clé'='valeur'"` (nouvelle forme) | ignoré (git ≥ 2.31) |
| `GIT_CONFIG_COUNT`/`KEY`/`VALUE` (toutes clés) | ignoré (git ≥ 2.31) |
| `--config-env` | ignoré (git ≥ 2.32) |
| `git -c ' diff.external=…'`, `git -c 'diff.external =…'` | lancé |
| **`git -c ' core.hooksPath=/autre'`**, `-c 'core.hooksPath =/autre'` | **hooksPath changé** |
| `git -c alias.zz=status -c 'alias.zz=!…' zz` | le dernier est lancé |
| `GIT_CONFIG_PARAMETERS` sans apostrophes, espace en tête, entrées collées | ignoré (format rejeté) |
| `git ls-remote 'ext::sh <script>'` sans réglage | rien |
| idem avec `-c protocol.ext.allow=always`, `-c protocol.allow=always`, `GIT_ALLOW_PROTOCOL=ext`, `GIT_CONFIG_PARAMETERS` | lancé |
| `git ls-remote --upload-pack='…; git-upload-pack' <dépôt local>`, `-c remote.o.uploadpack=…` | lancé |

Le comportement de git ≥ 2.31 (`GIT_CONFIG_COUNT`, nouvelle forme) et ≥ 2.32 (`--config-env`) n'a
pas pu être rejoué : Docker est arrêté (image Playwright à git 2.43) et le téléchargement d'un git
2.56.1 portable (dugite-native, somme vérifiée) a été refusé par le classifieur de permissions (voir
« Refus rencontrés »). Il est établi par la documentation de git et par la mesure du lot 19 sur
2.43 (`core.hooksPath` par `GIT_CONFIG_COUNT` et `--config-env` change la valeur : même mécanisme
`config_parse_pair` que `-c`). Le test marque ces formes `mayFail` comme `hookspath-env.test.mjs`.

### Trous constatés sur l'ancien code (`probe-lib.mjs`, analyse seule, rôle `main`)

```
permis | GIT_CONFIG_PARAMETERS="'core.sshCommand=git push origin main'" git fetch origin
permis | GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.pager GIT_CONFIG_VALUE_0='git push origin main' git log
permis | V='git push origin main' git --config-env=core.sshCommand=V fetch origin
permis | GIT_CONFIG_PARAMETERS="'alias.zz=!git push origin main'" pnpm test
permis | git -c ' core.hooksPath=/autre' commit -m x
permis | git -c alias.zz=status -c 'alias.zz=!rm apps/api/src/app.spec.ts' zz   (aucune cible)
permis | git -c protocol.ext.allow=always ls-remote 'ext::sh x.sh'
permis | git ls-remote --upload-pack='rm apps/api/src/app.spec.ts;git-upload-pack' .   (aucune cible)
permis | git --config-env=core.pager=INCONNU log
```

Nouveau code : les sept premières refusées (git push dans du code opaque, alias qui pousse,
`core.hooksPath`, `ext::`), la suppression du test vue comme cible (refusée par le hook complet),
la dernière illisible.

### Règle appliquée (`lib/shell.mjs`, toutes les sessions)

- Une seule analyse, `configEntry`, pour `-c`, `--config-env` et les entrées de l'environnement :
  clé lue comme git (blancs autour retirés, casse ignorée), refus L19-02 (`core.hooksPath`,
  inclusion), alias qui pousse refusé, commande d'une clé de `COMMAND_CONFIG_KEY` analysée comme du
  code shell imbriqué (git push refusé, cibles d'écriture vérifiées par le hook), transport `ext::`
  refusé, alias analysé dès sa définition (`!code` comme du shell, sinon `git <valeur>`).
- `GIT_CONFIG_PARAMETERS` lu par `parseConfigParameters`, transcription de `parse_config_env_list`
  et `sq_dequote_step` de git (formes `'clé=valeur'`, `'clé'='valeur'`, `'clé'=`, `'\''`, `'\!'`) ;
  un format que git rejette est refusé (illisible).
- `GIT_CONFIG_KEY_<n>` / `GIT_CONFIG_VALUE_<n>` : toutes les paires, quel que soit
  `GIT_CONFIG_COUNT`, appariées où qu'elles soient affectées (variables de la commande, `export`,
  `declare -x`, affectations plus tôt), analysées dès que la paire est complète ; une clé qui lance
  une commande sans valeur lisible à la fin de la commande ou du sous-shell est refusée.
- `--config-env <clé>=<var>` : valeur de la variable prise dans la commande ; absente ou calculée
  pour une clé qui lance une commande (ou un alias, `protocol.*allow`) : refus. `commandConfig`
  (suivi de branche, `checkout.guess`, `worktree.guessRemote`) lit aussi `--config-env`.
- Alias : tous les candidats (environnement, `-c` et `--config-env`, dépôt) sont analysés, git
  lançant le dernier défini.
- `COMMAND_CONFIG_KEY` étendu : `remote.<n>.uploadpack|receivepack`, `core.alternateRefsCommand`,
  `gpg.ssh.defaultKeyCommand`, `trailer.<t>.command|cmd`, `sendemail.*cmd|smtpserver`,
  `imap.tunnel`, `guitool.<n>.cmd`, `browser.<t>.cmd|path`, `man.<t>.cmd|path`, `instaweb.httpd`,
  `submodule.<n>.update`. `GIT_PROXY_COMMAND` ajouté aux variables-commandes.
- `protocol.ext.allow` et `protocol.allow` autres que `never` (par `-c`, l'environnement,
  `--config-env`, `git config`) et `GIT_ALLOW_PROTOCOL` qui cite `ext` (ou illisible) : refusés.
- `--upload-pack` (abréviations comprises), `-u` de `clone`, `--exec` d'`archive` et de
  `fetch-pack` : valeur analysée comme du code shell.

### Décisions

- Surestimation plutôt que fidélité à `GIT_CONFIG_COUNT` : suivre l'indice exact aurait laissé une
  paire d'indice supérieur masquer celle que git lit (alias de même nom). Alternative écartée :
  lire seulement les indices `< GIT_CONFIG_COUNT`.
- Alias analysé à sa définition, `-c` compris : un git lancé plus loin (sous-processus de
  `rebase --exec`, programme) hérite de `GIT_CONFIG_PARAMETERS` sans que la commande le montre.
  Alternative écartée : analyse au seul usage (manquait `git -c alias.st='!…' rebase --exec 'git st'`
  quand le dépôt a aussi un alias `st`).
- Hors de la lettre du ticket, ajoutés parce que mesurés au même effet : clé à blancs de `-c`
  (contournement réel de `core.hooksPath` sur l'hôte), dernier alias, `ext::`, `--upload-pack`.

## L25-02 : commit justifié après réécriture de l'historique (fait)

Règle (`lib/state.mjs`, `justifiedAfterRewrite`) : si la tête de l'instantané n'est plus ancêtre de
HEAD, les commits de HEAD non atteignables depuis `git merge-base <tête> HEAD` sont ceux de la
branche réécrite ; l'oracle n'est accepté que si son contenu à HEAD (identique au disque) est
exactement celui qu'un de ces commits, portant `Justification-test`, lui a donné (ou supprimé).
L'ancienne règle (ancêtre : un commit justifié de `base..HEAD` qui touche le fichier, comme
`check-tests-integrity.sh`) reste telle quelle.

Tests de refus d'abord (verts avant et après) : commit sans justification après `reset` ; disque
différent du commit justifié ; commit non justifié après le commit justifié ; contenu justifié
seulement dans l'historique abandonné ; retour à un contenu justifié d'avant la base commune ;
historique orphelin ; workflow modifié sans justification. Avant : les 4 acceptations échouent
(`reset --mixed` puis commit justifié, contenu justifié suivi d'autres commits, suppression
justifiée, cas du 21 nov. sur `revue-pr.yml`) ; après : 0 échec.

Décision : la correspondance exacte du contenu est exigée pour l'historique réécrit seulement.
Alternative écartée : la règle de la CI (un commit justifié qui touche le fichier) sur
`base commune..HEAD`, qui aurait accepté un commit non justifié après le commit justifié. Effet
connu : une branche remise sur `develop` (`reset --hard origin/develop`) compte les commits
justifiés de `develop` depuis la base commune, comme le fait déjà une fusion de `develop`.

## L25-03 : tests créés avant la pause d'un agent (fait)

Cause établie par le test : la fin de tâche réussie (`verify`) supprime l'instantané
(`dropSnapshots`) ; à la reprise de la même clé, l'instantané est repris (`SubagentStart`, ou
instantané paresseux du premier outil) et relève les tests non suivis créés avant la pause parmi
les oracles et les fichiers non suivis : `existedAtSnapshot` les dit existants. Le test reproduit le
message réel (« modification d’un test existant : apps/web/app/error.spec.ts ») par les deux
chemins. Même faux positif, non signalé jusqu'ici, pour la session principale d'un tour à l'autre
(`Stop` à chaque fin de tour).

Correction : la fin de tâche réussie reporte les tests créés (absents de l'instantané) avec leur
empreinte dans `state/carry/<clé>/<dépôt>.json` ; le prochain instantané de la même clé et du même
dépôt relève ceux qui n'ont pas changé dans `carried`, hors des oracles et des fichiers non suivis,
et consomme le report. Un test commité par l'agent avant la pause reste libre aussi (même règle que
dans une seule tâche).

Refus (verts avant et après) : test non suivi présent avant le premier démarrage (Edit, shell, fin
de tâche) ; test suivi ; autre agent ; test modifié par un autre pendant la pause ; autre dépôt ;
fin de tâche refusée (instantané gardé, rien de reporté). Avant : 5 acceptations en échec ; après :
0.

## L25-04 : écriture autorisée d'un autre agent (fait, partiel par construction)

Évaluation : le hook ne sait pas qui a écrit un fichier ; accepter tout oracle couvert par
l'autorisation d'un autre agent aurait laissé la clé vérifiée modifier le fichier à l'abri de
cette autorisation. Règle sûre retenue : le hook PreToolUse d'un Edit, MultiEdit ou Write autorisé
relève l'empreinte exacte du contenu produit (`state/authorized-writes.jsonl`, seulement si le
résultat est exactement connu : Write, ou chaque texte remplacé présent une fois). La fin de tâche
d'une autre clé accepte un oracle dont le contenu actuel est exactement celui-là, relevé depuis son
instantané, même dépôt, même portée, autorisation liée à l'agent et non révoquée ; elle journalise
`attributed`. Seul le contenu autorisé passe : la clé vérifiée ne peut rien y cacher.

L'alerte reste (refus verts avant et après) : modification ultérieure par la clé vérifiée, contenu
différent, écriture shell autorisée (contenu inconnu du hook), suppression, autorisation révoquée,
autre dépôt, écriture antérieure à l'instantané, Edit au résultat inexact. Avant : 3 acceptations
en échec (dont le cas du 21 nov. : Edit de dev-devops puis fin de tour de la session principale) ;
après : 0.

## Vérifications (sans Docker)

- `pnpm hooks:test` : 1221 / 1221.
- `pnpm integrity develop` et `pnpm integrity lot/22-un-seul-run` : OK.
- `pnpm integrity:test` : 9 réussis, 0 échoué (scripts de CI non modifiés).
- `pnpm format` puis Prettier : conforme. Hook pre-commit (lint, typecheck, unitaires) passé à
  chaque commit.
- Pas de `pnpm check`, pas de conteneur lancé (Docker arrêté), donc pas de `pnpm db:down`.

## Refus rencontrés et respectés

- Sonde `node probe.mjs` écrite et lancée par la même commande : refusée (script écrit par la même
  commande) ; écrite d'abord, lancée ensuite.
- Sonde du hook complet (`probe-hook.mjs`, qui cite `.claude/hooks/guard.mjs` et supprime son
  dossier temporaire) : refusée (écriture opaque qui mentionne un oracle). Remplacée par les tests.
- Téléchargement de git 2.56.1 portable (dugite-native, archive GitHub Desktop, somme vérifiée),
  pour mesurer git ≥ 2.31 sans Docker : refusé par le classifieur de permissions (« Undermining
  Oversight »). Non contourné ; mesure à faire (point ouvert 1).
- Édition de `lib/shell.mjs` par `python3` : refusée (écriture opaque) ; faite par Edit.
- Boucle `git $c -h`, `rm -rf "$W"`, `node -e` sur un instantané : refusés (illisibles) ; écrits en
  clair ou abandonnés (l'instantané réel du cas F7 était déjà supprimé).

## Points ouverts

1. Rejouer `tests/config-env-commands.test.mjs` sur git ≥ 2.32 (image Playwright 2.43 ou CI) : les
   formes `GIT_CONFIG_COUNT`, nouvelle forme et `--config-env` y sont `mayFail` sur l'hôte 2.30.
2. Fichiers écrits par git à la demande de l'environnement (`GIT_TRACE*=<chemin>`,
   `trace2.*Target`) : ce sont des écritures, pas des commandes ; non lus comme cibles. Proposition :
   les traiter comme une redirection (cible vérifiée). Décision de Julien.
3. Clés qui lancent une commande déjà présentes dans un fichier de configuration (dépôt, global)
   avant la commande : hors de portée de l'analyse d'une ligne de commande (limite documentée).
4. L25-04 ne couvre pas une écriture shell autorisée (`sed -i`, `cp`) : son contenu n'est pas connu
   avant l'exécution. L'alerte reste ; l'orchestrateur la lève comme aujourd'hui.
5. `state/carry/` et `state/authorized-writes.jsonl` ne sont pas purgés (quelques octets par tâche) ;
   une purge à l'âge pourra s'ajouter si besoin.
6. Les commits portent `Co-Authored-By: Claude Fable 5.1` comme demandé par le cadre du lot et
   CLAUDE.md.
