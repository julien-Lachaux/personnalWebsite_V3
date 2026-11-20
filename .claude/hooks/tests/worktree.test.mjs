// L14-13 (décision de Julien du 20 nov. 2026, recette du lot 16, point ouvert 1) : un agent ne gère
// pas les worktrees, l'orchestrateur les lui fournit. git worktree prune et remove --force feraient
// disparaître sans violation l'instantané d'un worktree (BF-11) ; par cohérence, tout git worktree
// remove ou move est refusé aux agents. La session principale (rôle « main ») garde ces commandes
// (ménage après fusion ; le .env non suivi d'un worktree impose la force). Chaque cas rejoue
// l'entrée JSON du hook PreToolUse ; rien n'est exécuté. Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(HOOKS, 'guard.mjs');
const AGENTS = join(dirname(HOOKS), 'agents');
/** Les quatorze rôles d'agent, lus dans le frontmatter de .claude/agents/*.md. */
const ROLES = readdirSync(AGENTS)
  .filter((f) => f.endsWith('.md'))
  .map((f) => /^name:\s*(\S+)\s*$/m.exec(readFileSync(join(AGENTS, f), 'utf8'))[1]);

let repo;
let project;

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-worktree-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-worktree-projet-')));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
  execFileSync('git', ['config', 'alias.wr', 'worktree remove'], { cwd: repo });
  execFileSync('git', ['config', 'alias.wp', '!git worktree prune'], { cwd: repo });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

function bash(command, role) {
  const input = {
    session_id: 's-worktree',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command, description: 'test' },
  };
  if (role !== 'main') {
    input.agent_type = role;
    input.agent_id = `id-${role}`;
  }
  const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

const REFUSED = [
  'git worktree prune',
  'git worktree prune --verbose',
  'git worktree prune -n',
  'git worktree remove .claude/worktrees/lot-x',
  'git worktree remove --force .claude/worktrees/lot-x',
  'git worktree remove -f .claude/worktrees/lot-x',
  'git worktree remove -f -f .claude/worktrees/lot-x',
  'git worktree move .claude/worktrees/lot-x /tmp/ailleurs',
  'git -C . worktree remove --force ../w',
  'cd /tmp && git worktree prune',
  'git status && git worktree prune',
  'if true; then git worktree remove ../w; fi',
  'bash -c "git worktree prune"',
  'git wr ../w',
  'git wp',
  'echo ../w | xargs git worktree remove',
];

describe('L14-13 : git worktree remove, move et prune refusés aux agents', () => {
  it('connaît les quatorze rôles d’agent', () => {
    assert.equal(ROLES.length, 14, ROLES.join(', '));
    assert.ok(!ROLES.includes('main'));
  });

  for (const role of ROLES) {
    it(`refuse chaque forme au rôle ${role}`, () => {
      for (const command of REFUSED) {
        const r = bash(command, role);
        assert.equal(r.code, 2, `${role} : ${command}`);
        assert.match(r.stderr, /réservé à la session principale/, `${role} : ${command}`);
      }
    });
  }

  it('refuse une sous-commande de worktree illisible', () => {
    const r = bash('git worktree $OP ../w', 'dev-api');
    assert.equal(r.code, 2);
    assert.match(r.stderr, /illisible/);
  });

  it('laisse aux agents la lecture des worktrees', () => {
    for (const command of ['git worktree list', 'git worktree list --porcelain']) {
      for (const role of ROLES) {
        const r = bash(command, role);
        assert.equal(r.code, 0, `${role} : ${command} : ${r.stderr}`);
      }
    }
  });
});

describe('L14-13 : la session principale garde la gestion des worktrees', () => {
  it('accepte add, remove (forcé compris), move, prune et list', () => {
    for (const command of [
      ...REFUSED,
      'git worktree add .claude/worktrees/lot-x -b lot/x develop',
      'git worktree list',
    ]) {
      const r = bash(command, 'main');
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });
});
