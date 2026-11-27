# Lancer les agents du dépôt dans herdr

Décision de Julien (26 et 27 nov. 2026, lot F11) : la session principale (orchestrateur) ne délègue plus à
des sous-agents invisibles. Chaque agent spécialisé (`.claude/agents/<rôle>.md`) tourne dans **un onglet de
herdr Desktop**, où Julien le voit dans le panneau des agents, peut le lire, lui écrire ou le reprendre.
Ce document est écrit pour être repris tel quel dans le boilerplate des futurs projets : il ne dépend ni de
ce dépôt ni d'une machine (chemins à adapter, entre chevrons).

## herdr en bref

- **herdr-core** (`hc`) : serveur de terminaux qui survivent à la session qui les lance. Lecture, envoi de
  texte, attente, attache : `hc ls`, `hc get tN`, `hc read tN`, `hc send tN "<texte>"`, `hc keys tN enter`,
  `hc wait tN`, `hc attach tN`.
- **herdr Desktop** (`herdr-app`) : l'application. Elle range les terminaux en **espaces** (un par dépôt) et
  en **onglets** (un par tâche). `herdr-app ls` liste les espaces et onglets avec leurs identifiants,
  `herdr-app commands` liste les commandes et leurs arguments, `herdr-app do <commande> '<json>'` en exécute
  une.
- **Documentation en ligne, à relire plutôt que de se fier à sa mémoire** (l'outil change vite) :
  - guide de l'application : https://github.com/herdrdev/herdr-app/blob/master/defaults/AGENTS.md
    (sections « The model: spaces, tabs, terminals » et « Sub-agents ») ;
  - référence de `hc` : https://herdr.dev/core/ ;
  - localement : `herdr-app commands`, `hc --help`, `hc <commande> --help`, `hc schema`.

## Règle d'affichage (pourquoi `hc run` ne suffit pas)

L'application n'affiche que les terminaux qui portent les étiquettes `herdr.space=<id>` et
`herdr.tab=<id>` ; les autres « restent hors de ses écrans ». Un terminal lancé par `hc run` sans ces
étiquettes tourne bien (visible par `hc ls`), mais n'apparaît pas dans l'application. Un enfant lancé par un
agent (`hc run` depuis son terminal, enregistré comme `parent`) appartient à l'onglet du parent, sans volet.

La façon la plus simple est donc de créer l'onglet par l'application elle-même : `tab.new`.

## Recette

### 1. Préparer

- Identifiant de l'espace du dépôt : `herdr-app ls` (champ `id` de l'espace, `sp…`). Au besoin, créer un
  espace par `herdr-app do space.new '{"name":"<projet>","folder":"<dossier>"}'`.
- Écrire la consigne de l'agent dans un fichier (le **brief**) hors du dépôt, dans le dossier temporaire de
  la session : cadre (worktree, branche, ports, isolation), contexte, tâches, vérifications, et la fin
  attendue (« termine par un message court dans ta session : commits, vérifications, points ouverts, puis
  arrête-toi »).
- Si l'agent doit toucher un oracle (test existant, configuration protégée), créer d'abord son autorisation
  (voir « Garde-fous » plus bas).

### 2. Lancer

```sh
herdr-app do tab.new '{
  "name": "<lot>-<rôle>-<sujet>",
  "space": "<id de l espace>",
  "folder": "<chemin absolu du worktree>",
  "argv": ["env", "PATH=<dossier de pnpm>:<dossier de node>:/usr/local/bin:/usr/bin:/bin",
           "claude", "--agent", "<rôle>", "--permission-mode", "auto"],
  "task": "Lis et applique le brief <chemin absolu du brief>",
  "focus": false
}'
```

La réponse donne `space`, `tab` et `terminal` (`tN`) : les garder pour la suite. L'onglet apparaît aussitôt
et le panneau reconnaît l'agent (`agent: claude-code` dans `hc ls`).

- **`env PATH=…` est indispensable** : les terminaux de herdr héritent du PATH du serveur herdr, souvent sans
  node ni pnpm (installés par nvm, pnpm ou mise). Sans node, les hooks des garde-fous ne peuvent pas tourner
  et refusent toute action (« node introuvable, action refusée par prudence »). Relever les deux dossiers
  avec `command -v node` et `command -v pnpm` dans la session principale, et les écrire en clair.
- **`--agent <rôle>`** : le rôle est le `name` du frontmatter de `.claude/agents/<rôle>.md`. Claude Code le
  transmet aux hooks (`agent_type`) : les garde-fous appliquent les droits de ce rôle, pas ceux de la session
  principale. Vérifié par une sonde : un `correcteur` sans autorisation reçoit « Aucune autorisation « tests »
  de l'orchestrateur pour l'agent correcteur ».
- **`--model`** : ne pas le passer, le modèle vient du frontmatter du rôle.
- **Mode interactif obligatoire** : `claude -p` n'affiche rien dans un terminal herdr.

### 3. Au démarrage

Claude Code peut ouvrir un dialogue (par exemple « Claude in Chrome extension detected ») qui attend
Entrée avant de traiter la consigne. Le lire et y répondre par l'option la plus prudente (garder les outils
du navigateur désactivés) :

```sh
hc read tN | grep -q "Enter to confirm" && hc keys tN enter
```

### 4. Suivre

- État : `hc get tN` (`status` : `working`, puis `done` ou `idle` à la fin d'un tour).
- Écran : `hc read tN` (le compte rendu final de l'agent est en bas).
- Répondre à un agent arrêté (sortie honorable, question) : `hc send tN "<texte>"`. Le message est une
  consigne de l'orchestrateur : jamais un moyen de faire faire à l'agent ce que les garde-fous ou le
  classifieur ont refusé (voir « Ce qu'il ne faut pas faire »).
- Attente en arrière-plan : une boucle `until hc get tN | grep -qE '"status":"(done|idle)"' …` doit aussi
  **sortir si le terminal n'existe plus** (`hc get` en échec). Le 26 nov. 2026, six boucles ont tourné
  13 heures à vide après la fermeture de leurs terminaux. Arrêter ses boucles avant de fermer un onglet.

### 5. Relire, puis fermer

- Relire le travail de l'agent (diff, commits, tests) : son compte rendu est une déclaration, pas une preuve.
- Fermer l'onglet : `herdr-app do tab.close '{"id":"<tab>","confirmed":true}'` (ferme aussi ses terminaux).
- Révoquer ses autorisations.

## Garde-fous

- **Autorisations depuis un worktree** : `authorize.mjs` range l'état dans `CLAUDE_PROJECT_DIR` s'il est posé,
  sinon dans le dépôt du dossier courant (worktree compris, lot 45), et annonce l'état visé sur la sortie
  d'erreur (`état des garde-fous de <dossier> (…)`) : le relire. Une variable héritée qui désigne le checkout
  principal l'emporte sur le dossier courant ; le plus sûr reste de nommer le worktree :

  ```sh
  CLAUDE_PROJECT_DIR=<worktree> node .claude/hooks/authorize.mjs grant --agent <rôle> --scope <portée> \
    --ticket <id> --reason "<raison>" --path <fichier> [--path <fichier> …]
  CLAUDE_PROJECT_DIR=<worktree> node .claude/hooks/authorize.mjs list
  ```

  Une autorisation vise des fichiers, pas un dossier (`scripts/ci` est refusé ; ses fichiers sont protégés
  un par un).
- **Commandes illisibles refusées** : écrire puis exécuter un script dans la même commande, du code `node -e`
  ou `python3 -m` calculé, un `sed` trop complexe, un script qui mentionne un oracle (par exemple un dossier
  de fixtures) sont refusés, à la session principale comme aux agents. Écrire par les outils d'édition ;
  lancer les tests de `scripts/ci/` par `pnpm integrity:test`.
- **Parcours Playwright** : `pnpm --filter <paquet> test:e2e -- <args>` ignore ses arguments (et lance tout,
  sur tous les cœurs). Générer le site, puis dans le paquet : `pnpm exec playwright test --workers=2
  <fichiers>`.
- **Conteneurs (Podman)** : ne jamais tuer un processus podman ni l'envelopper dans `timeout` (verrou
  orphelin, Podman bloqué jusqu'au redémarrage). Un agent qui lance `pnpm db:down` arrête aussi les
  navigateurs Playwright du même projet compose.

- **Un agent ne lance ni `claude` ni `hc`** : une session lancée sans `--agent` a le rôle de la session
  principale (`main`) et ses droits (push, écritures `gh`, autorisations). Seule la session principale lance
  et pilote des terminaux. Les hooks ne le vérifient pas encore (carte Trello « Garde-fous : `hc` et
  `claude` interdits aux agents ») : d'ici là, c'est une règle de l'orchestrateur.

## Charge de la machine

Le 26 nov. 2026, la machine a planté avec deux lots, leurs agents, une pile d'essai et des parcours
Playwright en même temps. Donc :

- au plus **deux lots** en cours en même temps, et dans chaque worktree **un seul agent lourd** à la fois
  (tests e2e, Playwright, génération, mutation) ; un agent de revue ou de doc peut s'y ajouter ;
- **un seul lot sur Podman** à la fois, désigné par la session principale ; les autres se limitent aux tests
  sans conteneurs jusqu'à ce qu'elle le libère ;
- `TEST_MAX_WORKERS=2` dans le `.env` racine de chaque worktree, Playwright avec `--workers=2` ;
- une pile d'essai sous `systemd-run --user --scope` avec `MemoryMax` et `TasksMax`.

## Ce qu'il ne faut pas faire

- Contourner un refus des garde-fous ou du classifieur par un détour (script `pnpm` ajouté pour lancer une
  commande refusée, autre syntaxe, autre agent) : c'est refusé, et à juste titre. L'agent s'arrête (sortie
  honorable), l'orchestrateur décide ou demande à Julien.
- Lancer plusieurs agents lourds en même temps dans le même worktree : leurs commits passent le hook
  pre-commit sur l'arbre de travail des autres.

## Pilotage de l'usage

Consigne de Julien (26 nov. 2026) : **à 90 % de la limite hebdomadaire d'usage, tout se met en pause.**
L'orchestrateur lit l'usage avant chaque lancement et à chaque compte rendu, et surveille le pied des
terminaux (« You've used N% of your weekly limit »). À 90 % : ne plus rien lancer ; demander aux agents en
cours (`hc send`) de finir leur commande, de ne rien commiter de partiel et de s'arrêter, sans jamais les
interrompre au milieu d'une commande podman ; puis faire le point avec Julien.
