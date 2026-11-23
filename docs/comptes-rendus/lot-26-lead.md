# Lot 26 — Élagage de l'état des garde-fous (lead-architecte, 23 nov. 2026)

Branche `lot/26-hooks` (worktree `lot-26-hooks`, depuis `origin/develop` 612b57a). Ticket L26-05,
suite de la revue automatisée de la PR #9 : `state/authorized-writes.jsonl` (L25-04) et
`state/carry/` (L25-03) n'étaient jamais purgés, et le journal des écritures autorisées était relu
en entier à chaque fin de tâche. Autorisation `484d5dbd` expirée pendant la coupure de quota,
remplacée par `6e8b8dcb` (portée `config`, `.claude/hooks/**`). Aucun test existant modifié ; un
nouveau fichier de test. Rien sous `.github/`, `scripts/ci/` ni `apps/`. Aucun conteneur lancé
(rien ne dépend de Docker ici).

| Commit    | Contenu                                                                                   |
| --------- | ----------------------------------------------------------------------------------------- |
| `2957658` | `refactor(hooks)` : un fichier par écriture autorisée, lecture par dépôt, ancien journal lu |
| `d880615` | `feat(hooks)` : `pruneState`, appelé par `verify` ; `revoked_at` posé par `authorize revoke` |
| `1090c64` | `test(hooks)` : `tests/state-prune.test.mjs` (21 tests, nouveau)                           |
| `390a899` | `docs(hooks)` : README, section « Élagage de l'état (L26-05) »                             |

## Fait

- **Format** (`lib/state.mjs`) : chaque relevé d'écriture autorisée est un fichier JSON
  `state/authorized-writes/<sha16 du dépôt>/<ms>-<pid>-<aléa>.json`, écrit par `writeJsonAtomic`
  (temporaire puis rename) et jamais réécrit. `authorizedWriteBy` ne lit plus que les relevés du
  dépôt vérifié (`readAuthorizedWrites`), du plus récent au plus ancien, plus l'ancien journal tant
  qu'il existe. Mêmes conditions d'attribution qu'en L25-04, inchangées.
- **Élagage** (`pruneState`, fin de `verify`, quel que soit le résultat, jamais bloquant : erreur
  journalisée en `error`/`prune`, retraits en `pruned` avec le nombre par motif) :
  - écriture autorisée retirée si illisible ou mal rangée ; dépôt disparu ou retiré (même règle que
    BF-11) ; autorisation inconnue, révoquée ou qui ne la couvre pas depuis plus de 24 h
    (`WRITE_GRACE_MS`) ; autorisation expirée depuis plus de 24 h **et** aucun instantané en cours
    d'une autre clé, sur le même dépôt, pris au plus tard à l'heure de l'écriture ;
  - report retiré si illisible ou mal rangé ; dépôt disparu ou retiré ; plus aucun test reporté à
    l'empreinte relevée ; plus de 7 jours (`CARRY_MAX_AGE_MS`) ;
  - dossiers vidés (`carry/<clé>/`, `authorized-writes/<dépôt>/`) retirés ; temporaires d'écritures
    plantées retirés après 24 h.
- **Ancien journal** : converti au premier élagage (copie de chaque ligne lisible sous un nom tiré
  de son empreinte, rename de côté, relecture des lignes arrivées entre-temps, suppression) ; en cas
  d'échec il reprend sa place.
- **Concurrence** : relevés immuables (suppression sans risque pour un relevé concurrent) ; report
  retiré par rename, réévaluation, puis suppression ou remise en place par `link` (qui échoue si un
  report plus récent l'a remplacé) ; `writeJsonAtomic` recommence (3 fois au plus) sur `ENOENT` si
  l'élagage a retiré son dossier vide entre sa création et le rename.
- **`authorize.mjs revoke`** date la révocation (`revoked_at`), première révocation seulement.

## Preuves

- `pnpm hooks:test` : 1264 tests verts avant le lot, **1285 verts** après (21 nouveaux, aucun
  échec ; journaux `hooks-base-l26.log`, `hooks-final-l26.log` du dossier de session).
- Tests nouveaux (`tests/state-prune.test.mjs`), retirés : révocation datée (gardée à 23 h, retirée
  à 25 h alors que l'expiration seule ne permettrait rien avant 28 h), expiration sans instantané,
  instantané d'une autre clé terminé puis retrait, dépôt disparu (par la fin de tâche d'une clé
  quelconque, `pruned` journalisé), worktree retiré (`.git` supprimé), autorisation inconnue après
  la grâce seulement, relevés illisibles ou mal rangés ; reports trop anciens (la reprise redevient
  protégée), aux tests modifiés ou supprimés, d'un dépôt disparu, illisibles.
- Jamais retirés : autorisation active (fin de tâche d'une autre clé toujours acceptée), expirée
  depuis un an mais retenue par un instantané en cours pris avant (attribution `attributed`
  conservée après l'élagage de la fin de tâche), moins de 24 h, instantané illisible, 8 Edit
  autorisés concurrents de 8 fins de tâche qui élaguent (8 relevés sur 8) ; report récent (reprise
  libre, L25-03), un test intact sur deux, 8 fins de tâche concurrentes d'autres clés.
- Ancien journal : lu avant conversion, converti par une fin de tâche (doublons fusionnés, ligne
  tronquée et ligne d'un dépôt disparu retirées), attribution L25-04 conservée ensuite.
- Contre-épreuve : avec l'appel `prune(ctx)` de `verify` neutralisé (modification temporaire,
  retirée avant commit), les 3 tests qui passent par une vraie fin de tâche échouent (dépôt disparu
  ×2, conversion), les 18 autres appellent `pruneState` directement.
- `tests/resumed-agent.test.mjs` (L25-03) et `tests/other-agent-authorized.test.mjs` (L25-04)
  inchangés et verts.
- `pnpm integrity develop` : « Intégrité des tests : OK ».

## Décisions

- **Un fichier par relevé plutôt qu'un journal réécrit sous verrou.** Motif : réécrire le JSON Lines
  (temporaire puis rename) perd une ligne ajoutée entre la lecture et le rename par un hook
  concurrent ; un verrou en Node synchrone (fichier `wx`, attente active, verrou périmé) laisse des
  courses résiduelles et ferait attendre PreToolUse. Des fichiers immuables se suppriment sans
  verrou et limitent la lecture au dépôt vérifié. Alternative écartée : verrou sur le journal.
- **La grâce de 24 h ne suffit pas seule pour une autorisation expirée** : `authorizedWriteBy` ne
  regarde pas l'expiration, une écriture reste utile à tout instantané pris avant elle, aussi vieux
  soit-il. D'où l'examen des instantanés en cours ; un instantané illisible suspend ce motif.
- **Révocation et autorisation inconnue avec grâce aussi**, bien qu'une telle écriture ne serve déjà
  plus : marge contre une horloge ou un fichier d'autorisations transitoirement faux.
- **Reports : 7 jours.** Aucun moyen documenté de savoir qu'un agent ne reprendra plus (Claude Code
  ne le signale pas aux hooks) : l'âge sert d'indice. Retirer un report trop tôt ne blanchit rien,
  il fait seulement revenir le faux positif de L25-03 (test créé vu comme existant, refusé).
- **Élagage en fin de tâche seulement**, après la vérification : la vérification en cours n'a plus
  besoin de rien, et PreToolUse reste aussi rapide qu'avant.

## Non fait

- `state/authorizations.json`, `state/violations/` et `audit.log` ne sont pas élagués (hors du
  ticket). Les autorisations doivent rester connues tant que leurs relevés existent.
- Pas de test déterministe de la reprise sur `ENOENT` de `writeJsonAtomic` (course de quelques
  microsecondes) ; couvert indirectement par les tests concurrents.

## Points ouverts

- **Lancer un seul fichier de test des hooks est refusé à l'agent** :
  `node --test .claude/hooks/tests/other-agent-authorized.test.mjs …` → « les scripts des garde-fous
  ne se lancent que depuis la session principale ». Je n'ai pas reformulé ; toutes les
  vérifications sont passées par `pnpm hooks:test` (suite complète, ~1 min), comme prévu par D26.
- **Instantanés orphelins** : un agent tué sans fin de tâche laisse son instantané ; il retient
  indéfiniment les écritures expirées de son dépôt écrites après lui (sur un worktree retiré, plus
  rien). C'est voulu (jamais retirer ce qui peut servir), mais un élagage des instantanés orphelins
  serait une décision à part : c'est la protection elle-même.
- **Reprise au-delà de 7 jours** : à confirmer par Julien que la durée convient (constante
  `CARRY_MAX_AGE_MS`).
- La concurrence de `findAuthorization` (lecture-modification-écriture d'`authorizations.json` lors
  de la liaison) est antérieure et inchangée : deux liaisons simultanées d'autorisations différentes
  peuvent en perdre une. Hors ticket, à traiter si besoin.
