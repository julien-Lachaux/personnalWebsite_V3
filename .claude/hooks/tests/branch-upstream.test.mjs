// L14-17 (décision de Julien du 20 nov. 2026) : git branch -u et --set-upstream-to écrivent
// branch.<branche>.remote et branch.<branche>.merge hors de la règle des destinations de push du
// lot 13 bis (git config branch.*.remote) ; ils sont refusés aux agents spécialisés, sous toutes
// leurs formes : valeur séparée ou collée, groupe d'options courtes, abréviation de l'option longue
// (git accepte un préfixe sans ambiguïté), alias, -C, blocs, bash -c, option illisible. La session
// principale garde git push -u origin develop (et git branch -u). Chaque cas passe par l'analyse de
// la commande pour chacun des quinze rôles, et par l'entrée JSON du hook PreToolUse pour dev-api
// et la session principale ; rien n'est exécuté. Lancé par `pnpm hooks:test`.

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
/** Les quinze rôles d'agent, lus dans le frontmatter de .claude/agents/*.md. */
const ROLES = readdirSync(AGENTS)
  .filter((f) => f.endsWith('.md'))
  .map((f) => /^name:\s*(\S+)\s*$/m.exec(readFileSync(join(AGENTS, f), 'utf8'))[1]);
const REASON = /définir la branche suivie \(-u, --set-upstream-to\).*interdit aux agents/;

let repo;
let project;

function git(args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-amont-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-amont-projet-')));
  git(['init', '-q', '-b', 'develop']);
  git([
    '-c',
    'user.name=Test',
    '-c',
    'user.email=ci@noreply.invalid',
    'commit',
    '-q',
    '--allow-empty',
    '--no-gpg-sign',
    '-m',
    'base',
  ]);
  git(['branch', 'lot/x']);
  git(['config', 'alias.up', 'branch -u']);
  git(['config', 'alias.amont', '!git branch --set-upstream-to']);
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

function bash(command, role) {
  const input = {
    session_id: 's-amont',
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
  'git branch -u origin/develop',
  'git branch -u origin/develop lot/x',
  'git branch -uorigin/develop',
  'git branch -u lot/x develop',
  'git branch -vu origin/develop',
  'git branch -qu origin/develop lot/x',
  'git branch --set-upstream-to origin/develop',
  'git branch --set-upstream-to=origin/develop',
  'git branch --set-upstream-to=origin/develop lot/x',
  'git branch --set-upstream-t=origin/develop',
  'git branch --set-upstream-t origin/develop',
  'git branch --set-u=origin/develop',
  'git branch --set-upstream',
  'git branch --set-upstream lot/x origin/develop',
  'git branch -q --set-upstream-to=origin/develop',
  'git branch $OPT origin/develop',
  'git -C . branch -u origin/develop',
  'git -c color.ui=never branch -u origin/develop',
  'git status && git branch -u origin/develop',
  'if true; then git branch --set-upstream-to=origin/develop; fi',
  '(git branch -u origin/develop)',
  "bash -c 'git branch -u origin/develop'",
  'git up origin/develop',
  'git amont origin/develop',
];

describe('L14-17 : git branch -u et --set-upstream-to refusés aux agents', () => {
  it('connaît les quinze rôles d’agent', () => {
    assert.equal(ROLES.length, 15, ROLES.join(', '));
    assert.ok(!ROLES.includes('main'));
  });

  it('les formes collée et abrégée écrivent bien la branche suivie (git les accepte)', () => {
    // Vérifié sur un dépôt jetable : ce sont des formes réelles, pas des cas d'école.
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-amont-reel-')));
    try {
      const run = (args) =>
        execFileSync('git', args, {
          cwd: dir,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      run(['init', '-q', '-b', 'develop']);
      run(
        ['-c', 'user.name=T', '-c', 'user.email=ci@noreply.invalid', 'commit', '-q'].concat([
          '--allow-empty',
          '--no-gpg-sign',
          '-m',
          'base',
        ]),
      );
      run(['branch', 'lot/x']);
      run(['branch', '-ulot/x']);
      assert.equal(run(['config', '--get', 'branch.develop.merge']).trim(), 'refs/heads/lot/x');
      run(['branch', '--set-upstream-t=develop', 'lot/x']);
      assert.equal(run(['config', '--get', 'branch.lot/x.merge']).trim(), 'refs/heads/develop');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  for (const role of ROLES) {
    it(`refuse chaque forme au rôle ${role}`, () => {
      for (const command of REFUSED) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.match(deny ?? '', REASON, `${role} : ${command}`);
        if (role !== 'dev-api') continue;
        const r = bash(command, role);
        assert.equal(r.code, 2, `${role} : ${command}`);
        assert.match(r.stderr, REASON, `${role} : ${command}`);
      }
    });
  }

  it('laisse aux agents les autres usages de git branch', () => {
    for (const command of [
      'git branch',
      'git branch --list',
      'git branch -a',
      'git branch -vv',
      'git branch --show-current',
      'git branch --sort=-committerdate',
      "git branch --format='%(upstream)' --list lot/x",
      'git branch --contains HEAD',
      'git branch lot/y',
      'git branch -d lot/x',
      'git branch -m lot/x lot/y',
      'git branch -- -u',
      'git log --oneline -u',
      'git status -u',
    ]) {
      for (const role of ['dev-api', 'qa', 'lead-architecte', 'correcteur']) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.equal(deny, null, `${role} : ${command}`);
      }
      const r = bash(command, 'dev-api');
      assert.equal(r.code, 0, `dev-api : ${command} : ${r.stderr}`);
    }
  });
});

describe('L14-17 : la session principale garde la branche suivie', () => {
  it('accepte git push -u origin develop et git branch -u', () => {
    for (const command of [
      'git push -u origin develop',
      'git push --set-upstream origin develop',
      'git branch -u origin/develop',
      'git branch --set-upstream-to=origin/develop develop',
    ]) {
      assert.equal(analyzeCommand(command, repo, 'main').deny, null, command);
      const r = bash(command, 'main');
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });
});
