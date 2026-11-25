// Lot 13 bis, T2 : la plomberie de push (git send-pack, git http-push) est refusée à tous les rôles,
// session principale comprise, avec son motif ; de même pour les commandes qui publient vers un
// autre système (git svn dcommit, git p4 submit) et pour l'appel direct des exécutables git-<cmd>.
// Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');

let repo;

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'garde-fous-plomberie-'));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
});

function bash(command, agent) {
  const input = {
    session_id: 's-plomberie',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command, description: 'test' },
  };
  if (agent) {
    input.agent_type = agent;
    input.agent_id = `id-${agent}`;
  }
  const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
  });
  return { code: res.status, stderr: res.stderr };
}

describe('T2 : plomberie de push refusée à tous', () => {
  const cases = [
    ['git send-pack https://example.invalid/x.git develop', /plomberie de push/],
    ['git send-pack git@example.invalid:x/y.git main', /plomberie de push/],
    ['git send-pack --all https://example.invalid/x.git', /plomberie de push/],
    ['git -C . send-pack origin develop', /plomberie de push/],
    ['git http-push https://example.invalid/x.git develop', /plomberie de push/],
    ['git-send-pack https://example.invalid/x.git develop', /plomberie de push/],
    ['/usr/lib/git-core/git-send-pack https://example.invalid/x.git develop', /plomberie de push/],
    ['git-http-push https://example.invalid/x.git develop', /plomberie de push/],
    ['{ git send-pack https://example.invalid/x.git develop; }', /plomberie de push/],
    ['git svn dcommit', /publie vers un autre dépôt/],
    ['git p4 submit', /publie vers un autre dépôt/],
    ['git-push origin develop', /écris git push/],
  ];
  for (const [command, reason] of cases) {
    it(`refuse ${command}`, () => {
      for (const agent of [undefined, 'dev-api', 'lead-architecte']) {
        const r = bash(command, agent);
        assert.equal(r.code, 2, `${command} (${agent ?? 'main'})`);
        assert.match(r.stderr, reason, `${command} (${agent ?? 'main'}) : ${r.stderr}`);
      }
    });
  }

  it('laisse les lectures et les autres commandes git', () => {
    for (const command of [
      'git ls-remote origin',
      'git svn --version',
      'git log --oneline -3',
      '/usr/bin/git status',
    ]) {
      const r = bash(command, 'dev-api');
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });
});
