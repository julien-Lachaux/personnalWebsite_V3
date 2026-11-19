# Lot 8 : agents spécialisés et garde-fous anti-contournement (compte rendu du lead-architecte)

Branche `lot/8-agents-garde-fous` depuis `v3/backend` (HEAD `071e66e`). Décisions de Julien du
19 novembre 2026 (onze agents, règles de publication, quatre couches contre le contournement des
tests), appliquées sans les rediscuter.

## Ce que la plateforme permet (documentation officielle relue le 19 novembre 2026)

Sources : `code.claude.com/docs/en/hooks`, `/sub-agents`, `/permissions`. Les choix de conception
du lot en découlent.

### Fichiers d'agents (`.claude/agents/<nom>.md`)

- Markdown avec frontmatter YAML ; seuls `name` et `description` sont obligatoires, un champ
  inconnu est ignoré sans erreur. Le corps est le prompt système de l'agent.
- Champs utiles ici : `tools` (liste blanche ; sans elle l'agent hérite de tous les outils),
  `disallowedTools`, `model` (`sonnet`, `opus`, `haiku`, `fable`, identifiant complet ou
  `inherit`), `effort` (`low` à `max`), `permissionMode`, `isolation: worktree`, `maxTurns`,
  `skills`, `memory`, `hooks`, `color`.
- Résolution du modèle : paramètre `model` de l'appel, puis frontmatter, puis
  `CLAUDE_CODE_SUBAGENT_MODEL`, puis modèle de la session. L'orchestrateur peut donc lancer le
  chef-de-projet en Opus pour la recette finale sans second fichier.
- Un sous-agent ne peut lancer d'autres sous-agents que si l'outil `Agent` figure dans ses
  `tools` : aucun des onze ne l'a.
- Rechargement à chaud de `.claude/agents/` (sauf création du tout premier fichier du dossier :
  redémarrage de la session nécessaire).

### Hooks par agent (frontmatter `hooks`)

- Existent : même format que `settings.json`, actifs seulement pendant la vie du sous-agent, un
  `Stop` y est converti en `SubagentStop`.
- **Limite décisive** : pour un agent du dépôt (`.claude/agents/`), ces hooks ne sont utilisés que
  si le dossier a été approuvé dans la boîte de dialogue de confiance. En `claude -p` et via le
  SDK (donc dans les workflows d'orchestration), ils ne sont **jamais** utilisés. Les hooks de
  `.claude/settings.json`, eux, sont utilisés dans les deux cas.
- Conséquence : aucun garde-fou ne repose sur les hooks de frontmatter. Tout passe par
  `.claude/settings.json`, qui distingue les rôles grâce au champ `agent_type` de l'entrée.

### Événements et schéma d'entrée

- Événements retenus : `SessionStart` (matcher `startup|resume|clear|compact|fork`),
  `SubagentStart` et `SubagentStop` (matcher = `name` de l'agent), `PreToolUse` et `PostToolUse`
  (matcher = nom d'outil), `Stop` (pas de matcher).
- Champs communs : `session_id`, `transcript_path`, `cwd` (suit l'agent dans les worktrees et après
  `cd`), `permission_mode`, `hook_event_name`, `scratchpad_dir` (récent), et **`agent_id` et
  `agent_type` présents dans tout hook déclenché depuis un sous-agent** (absents dans la session
  principale). `agent_type` vaut le `name` du frontmatter : il est fourni par la plateforme,
  l'agent ne peut pas le choisir.
- `PreToolUse` : `tool_name`, `tool_input`, `tool_use_id`. `Write` : `file_path` (toujours absolu),
  `content` ; `Edit` : `file_path`, `old_string`, `new_string`, `replace_all` ; `Bash` : `command`,
  `description`, `timeout`, `run_in_background`.
- `SubagentStart` : `agent_id`, `agent_type` ; ne peut pas bloquer ; peut injecter
  `hookSpecificOutput.additionalContext` dans le contexte du sous-agent.
- `SubagentStop` : `stop_hook_active`, `agent_id`, `agent_type`, `agent_transcript_path`,
  `last_assistant_message`. `Stop` : `stop_hook_active`, `last_assistant_message`.
- Variable `CLAUDE_PROJECT_DIR` : racine du projet où la session a démarré (pas le worktree).
  `.claude/settings.json` est lu dans le dossier de démarrage de la session, sans remonter : les
  hooks des sous-agents en worktree sont ceux du checkout principal.

### Codes de sortie et décisions

- `PreToolUse` : 0 = suite normale (JSON lu sur stdout) ; **2 = appel bloqué, stderr renvoyé à
  l'agent comme raison** ; autre code = erreur non bloquante, l'appel passe, sauf
  `"onFailure": "block"` sur le handler (versions récentes) : c'est ce qui rend un garde-fou
  fail-closed même si le script plante ou expire.
- `Stop` / `SubagentStop` : 2 (ou `decision: "block"`) empêche l'arrêt et renvoie la raison à
  l'agent ; la plateforme plafonne à 8 relances consécutives. `onFailure` n'y a pas d'effet : le
  script attrape lui-même toutes ses erreurs et sort en 2.
- `SessionStart` / `SubagentStart` : 2 ne bloque pas (message à l'utilisateur seulement).
- Un hook qui sort en 2 l'emporte sur une règle `allow` ; une règle `deny` de `permissions`
  l'emporte sur un hook qui autorise. Les règles `deny` sur `Edit(...)` couvrent tous les outils
  d'édition et les commandes shell reconnues (`sed`, `tee`, redirections), pas un script Python ou
  Node qui ouvre lui-même le fichier.
- Les règles `Bash(...)` portent sur le texte de la commande : `git -C . push` échappe à
  `Bash(git push *)`. Elles sont un filet de confort, pas une frontière.
