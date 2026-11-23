// L25-05 (décision de Julien du 22 nov. 2026), acceptation : la session principale relance un run
// de la CI par `gh run rerun <identifiant numérique>`, avec `--failed` et `--job <identifiant
// numérique>` admis ; les agents reçoivent un motif qui le leur interdit, et les formes refusées à
// la session principale ont chacune leur motif. Lancé par `pnpm hooks:test`.

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
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-l25-05-main-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-l25-05-main-projet-')));
  execFileSync('git', ['init', '-q', '-b', 'lot/25-garde-fous'], { cwd: repo });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

function hook(command) {
  const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify({
      session_id: 's-l25-05-main',
      cwd: repo,
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command, description: 'test' },
    }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

const ALLOWED = [
  'gh run rerun 123',
  'gh run rerun 19473021856 --failed',
  'gh run rerun 19473021856 --job 55790123456',
  'gh run rerun 19473021856 --job=55790123456',
  'gh run rerun 19473021856 --failed --job 55790123456',
  'gh run view 19473021856 --log-failed && gh run rerun 19473021856 --failed',
];

const MOTIFS = [
  ['gh run rerun 123 -R x/y', /autre dépôt/],
  ['gh run rerun 123 --repo=x/y', /autre dépôt/],
  ['GH_REPO=x/y gh run rerun 123', /variable GH_REPO/],
  ['GH_HOST=example.invalid gh run rerun 123', /variable GH_HOST/],
  ['gh run rerun 123 --debug', /débogage/],
  ['gh run rerun 123 -d', /débogage/],
  ['gh run rerun 123 --web', /option non permise/],
  ['gh run rerun 123 -j 456', /option non permise/],
  ['gh run rerun 123 --failed=true', /option sans valeur/],
  ['gh run rerun', /identifiant numérique/],
  ['gh run rerun 123 456', /identifiant numérique/],
  ['gh run rerun 123 --job abc', /job numérique/],
  ['gh run rerun 123 --job 4 --job 5', /--job répété/],
  ['gh run rerun $RUN', /illisible/],
  ['gh run rerun 123 --job $JOB', /illisible/],
  ['echo 123 | xargs gh run rerun', /entrée standard/],
  ['gh run --repo x/y rerun 123', /en tête/],
];

describe('L25-05 : gh run rerun, session principale', () => {
  for (const command of ALLOWED) {
    it(`permet ${command}`, () => {
      assert.equal(analyzeCommand(command, repo, 'main').deny, null, command);
      const r = hook(command);
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    });
  }

  for (const [command, reason] of MOTIFS) {
    it(`refuse ${command}`, () => {
      assert.match(analyzeCommand(command, repo, 'main').deny ?? '', reason, command);
    });
  }

  it('motif des agents : interdit aux agents, pour les quinze rôles', () => {
    assert.equal(ROLES.length, 15);
    for (const role of ROLES) {
      assert.match(
        analyzeCommand('gh run rerun 123 --failed', repo, role).deny ?? '',
        /interdit aux agents/,
        role,
      );
    }
  });
});
