// L25-05 (décision de Julien du 22 nov. 2026), refus : `gh run rerun` n'est jamais permis aux
// agents, sous aucune forme, et la session principale n'a qu'une forme (identifiant de run
// numérique en clair, `--failed` et `--job <identifiant numérique>` admis) : `-R`/`--repo`,
// `GH_REPO`, `GH_HOST`, `--debug`, toute autre option et toute forme calculée sont refusés.
// Ces refus valent avant et après l'ouverture de la forme permise (gh run rerun refusé à tous
// jusque-là). L'acceptation pour la session principale attend la mise à jour de deux tests
// existants (docs/comptes-rendus/lot-25-lead.md, L25-05). Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { analyzeCommand } from '../lib/shell.mjs';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(HOOKS, 'guard.mjs');
const AGENTS = join(dirname(HOOKS), 'agents');
const ROLES = readdirSync(AGENTS)
  .filter((f) => f.endsWith('.md'))
  .map((f) => /^name:\s*(\S+)\s*$/m.exec(readFileSync(join(AGENTS, f), 'utf8'))[1]);

let repo;
let project;

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-l25-05-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-l25-05-projet-')));
  execFileSync('git', ['init', '-q', '-b', 'lot/25-garde-fous'], { cwd: repo });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

function hook(command, role) {
  const input = {
    session_id: 's-l25-05',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command, description: 'test' },
  };
  if (role !== 'main') Object.assign(input, { agent_type: role, agent_id: `id-${role}` });
  const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

/** Formes que la session principale aura le droit d'écrire : refusées à tout agent. */
const MAIN_FORMS = [
  'gh run rerun 123',
  'gh run rerun 19473021856 --failed',
  'gh run rerun 19473021856 --job 55790123456',
  'gh run rerun 19473021856 --job=55790123456',
  'gh run rerun 19473021856 --failed --job 55790123456',
];

/** Formes refusées à toutes les sessions, la principale comprise. */
const REFUSED = [
  // autre dépôt ou autre hôte
  'gh run rerun 123 -R x/y',
  'gh run rerun 123 --repo x/y',
  'gh run rerun 123 --repo=x/y',
  'GH_REPO=x/y gh run rerun 123',
  'GH_HOST=example.invalid gh run rerun 123',
  'export GH_REPO=x/y; gh run rerun 123',
  // débogage et toute autre option
  'gh run rerun 123 --debug',
  'gh run rerun 123 -d',
  'gh run rerun 123 --failed=true',
  'gh run rerun 123 -j 456',
  'gh run rerun 123 --web',
  'gh run rerun 123 --unknown',
  // run ou job absent, plusieurs, non numérique
  'gh run rerun',
  'gh run rerun --failed',
  'gh run rerun --job 456',
  'gh run rerun 123 456',
  'gh run rerun abc',
  'gh run rerun 123 --job abc',
  'gh run rerun 123 --job 456 --job 789',
  'gh run rerun https://github.com/x/y/actions/runs/123',
  // formes calculées
  'gh run rerun $RUN',
  'gh run rerun "$(gh run list --json databaseId -q .[0].databaseId)"',
  'gh run rerun 123 --job $JOB',
  'gh run rerun 123 $OPT',
  'echo 123 | xargs gh run rerun',
  'gh $G rerun 123',
  'gh run $A 123',
  // groupe et action en tête
  'gh run --repo x/y rerun 123',
];

describe('L25-05 : gh run rerun refusé aux agents', () => {
  it('connaît les quinze rôles d’agent', () => {
    assert.equal(ROLES.length, 15, ROLES.join(', '));
  });

  for (const role of ROLES) {
    it(`refuse au rôle ${role} toute forme de gh run rerun`, () => {
      for (const command of [...MAIN_FORMS, ...REFUSED]) {
        assert.notEqual(analyzeCommand(command, repo, role).deny, null, `${role} : ${command}`);
      }
    });
  }

  it('le hook complet refuse les formes de la session principale à dev-api et revue-pr', () => {
    for (const command of MAIN_FORMS) {
      for (const role of ['dev-api', 'revue-pr']) {
        assert.equal(hook(command, role).code, 2, `${role} : ${command}`);
      }
    }
  });
});

describe('L25-05 : gh run rerun hors de la forme permise, refusé à la session principale', () => {
  it('refuse chaque forme refusée (analyse et hook complet)', () => {
    for (const command of REFUSED) {
      assert.notEqual(analyzeCommand(command, repo, 'main').deny, null, command);
      assert.equal(hook(command, 'main').code, 2, command);
    }
  });
});
