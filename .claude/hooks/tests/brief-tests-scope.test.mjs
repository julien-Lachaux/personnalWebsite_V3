// Portée « tests » ouverte à dev-contrats, dev-sql et dev-api quand un brief validé par Julien rend un
// test existant obsolète (décision du 19 nov. 2026, BF-TESTS) : l'autorisation s'accorde à ces trois
// rôles, reste refusée aux autres, et sans elle le test existant reste protégé.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(HOOKS, 'guard.mjs');
const AUTHORIZE = join(HOOKS, 'authorize.mjs');
const SPEC = 'packages/contracts/src/profile/profile.spec.ts';

const temps = [];
let repo;

function sh(cwd, cmd, args) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function write(rel, content) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), content);
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'garde-fous-brief-'));
  temps.push(dir);
  repo = dir;
  sh(dir, 'git', ['init', '-q', '-b', 'main']);
  write('.gitignore', '.claude/hooks/state/\n.claude/hooks/audit.log\n');
  write(SPEC, "import { it } from 'vitest';\nit('profil', () => {});\n");
  sh(dir, 'git', ['add', '-A']);
  sh(dir, 'git', [
    '-c',
    'user.name=Test',
    '-c',
    'user.email=ci@noreply.invalid',
    'commit',
    '-q',
    '--no-gpg-sign',
    '-m',
    'base',
  ]);
}

const env = () => ({ ...process.env, CLAUDE_PROJECT_DIR: repo });

function grant(agent) {
  return spawnSync(
    process.execPath,
    [
      AUTHORIZE,
      'grant',
      '--agent',
      agent,
      '--scope',
      'tests',
      '--ticket',
      'BF-1',
      '--reason',
      'brief back-001 : champ supprimé du profil',
      '--path',
      SPEC,
    ],
    { cwd: repo, encoding: 'utf8', env: env() },
  ).status;
}

function editSpec(agent, id) {
  const input = {
    session_id: 's1',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    agent_type: agent,
    agent_id: id,
    tool_name: 'Edit',
    tool_input: {
      file_path: join(repo, SPEC),
      old_string: 'profil',
      new_string: 'profil restructuré',
    },
  };
  return spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: env(),
  }).status;
}

beforeEach(() => {
  makeRepo();
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('Portée « tests » pour un brief validé', () => {
  for (const agent of ['dev-contrats', 'dev-sql', 'dev-api']) {
    it(`${agent} : test existant protégé sans autorisation, modifiable avec`, () => {
      assert.equal(editSpec(agent, `${agent}-1`), 2);
      assert.equal(grant(agent), 0);
      assert.equal(editSpec(agent, `${agent}-1`), 0);
    });
  }

  for (const agent of ['dev-devops', 'lead-architecte', 'revue-code', 'triage', 'chef-de-projet']) {
    it(`refuse la portée « tests » à ${agent}`, () => {
      assert.equal(grant(agent), 2);
      assert.equal(editSpec(agent, `${agent}-1`), 2);
    });
  }
});
