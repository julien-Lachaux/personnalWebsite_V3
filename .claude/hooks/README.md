# Garde-fous des agents (couche 1)

Hooks Claude Code déclarés dans `.claude/settings.json`, lancés par `run.sh` (refus si Node ou le
script manquent). Ils empêchent un agent d'obtenir des tests verts en touchant aux tests plutôt
qu'au code. Le rôle de l'agent vient du champ `agent_type` de l'entrée du hook (le `name` de son
fichier dans `.claude/agents/`) ; la session principale a le rôle `main`.

| Événement                       | Mode                              | Effet                                                                                                                               |
| ------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`, `SubagentStart` | `session-start`, `subagent-start` | instantané (sha256) des oracles du dépôt courant ; rappel des règles injecté au sous-agent                                          |
| `PreToolUse` (édition, shell)   | `pre-tool-use`                    | refus (code 2, raison sur stderr) de toute écriture d'un oracle ou d'un marqueur ; instantané paresseux d'un autre dépôt (worktree) |
| `Stop`, `SubagentStop`          | `verify`                          | compare les oracles à l'instantané ; refuse une fois la fin de tâche si l'un a changé sans autorisation ni commit justifié          |
| `PostToolUse` sur `Agent`       | `report`                          | signale à l'orchestrateur les violations laissées par un sous-agent                                                                 |

Oracles : fichiers de test existants (`*.spec.*`, `*.e2e-spec.*`, `*.test.*`, fixtures, dossiers
`test/`, `tests/`, `__snapshots__/`), configurations Vitest et de couverture, configurations du
test par mutation (`stryker.config.mjs` et toute variante `stryker.<x>.<ext>` que Stryker lit,
`tsconfig.stryker.json` de son vérificateur, `stryker.equivalents.json` des mutants équivalents
déclarés), `turbo.json`, `pnpm-workspace.yaml`, `.husky/`, `.github/workflows/`, `scripts/ci/`, et `.claude/` (réglages,
hooks, agents). Créer un nouveau fichier de test est permis. Les marqueurs de saut ou de focus de
Vitest et les commentaires d'ignore de couverture sont refusés partout (`lib/policy.mjs`). Le
dossier temporaire de session (`scratchpad_dir`) est libre.

## Exception contrôlée (correcteur, qa, lead-architecte, dev-devops)

Seule la session principale crée une autorisation (le hook refuse aux sous-agents l'exécution des
scripts de ce dossier) :

```sh
node .claude/hooks/authorize.mjs grant --agent correcteur --scope tests --ticket RC-12 \
  --reason "test faux établi par le triage" --path apps/api/test/errors.e2e-spec.ts
node .claude/hooks/authorize.mjs list
node .claude/hooks/authorize.mjs revoke --id <identifiant>
```

Portées : `tests` (correcteur, qa) modifier un test existant ; `fails` (qa, correcteur) écrire un
test en échec attendu ; `config` (lead-architecte, dev-devops) une configuration protégée. Une
autorisation vise des chemins précis, expire (4 h par défaut) et se lie au premier sous-agent qui
l'utilise. Création, usage, refus, révocation et violations sont journalisés dans
`.claude/hooks/audit.log`. État et journal sont gitignorés, sous le checkout principal.

Le commit qui modifie un test existant ou une configuration protégée porte en plus la ligne
`Justification-test: <identifiant> <raison>`, exigée par `scripts/ci/check-tests-integrity.sh`.

## Limites

Analyse du shell « au mieux » : un programme qui écrit sans nommer le fichier lui échappe. Le
hook de fin (empreintes) et le script d'intégrité de la CI sont les filets. Les hooks ne sont pas
un bac à sable : un agent déterminé peut écrire l'état local ; la CI ne dépend pas de cet état.

Tests : `pnpm hooks:test`.
