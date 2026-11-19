// Lot 13 bis, T3 : la destination d'un push ne se redéfinit pas. Refusés à tous les rôles :
// git remote add|rename|remove|rm|set-url, git config en écriture sur remote.*, url.*, push.*,
// branch.*.remote, branch.*.pushRemote, include.*, includeIf.* (quelle que soit la portée), et
// l'édition de la configuration git (.git/config, ~/.gitconfig…) par Edit, Write ou le shell.
// Les lectures restent permises. Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');

let repo;
let home;

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'garde-fous-destination-'));
  home = mkdtempSync(join(tmpdir(), 'garde-fous-home-'));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
  writeFileSync(join(home, '.gitconfig'), '[user]\n\tname = Test\n');
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

function hook(toolName, toolInput, agent) {
  const input = {
    session_id: 's-destination',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
  };
  if (agent) {
    input.agent_type = agent;
    input.agent_id = `id-${agent}`;
  }
  const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo, HOME: home, XDG_CONFIG_HOME: '' },
  });
  return { code: res.status, stderr: res.stderr };
}

const bash = (command, agent) => hook('Bash', { command, description: 'test' }, agent);
const ROLES = [undefined, 'dev-api', 'lead-architecte', 'dev-devops'];

describe('T3 : git remote et git config ne redéfinissent pas la destination', () => {
  const cases = [
    'git remote set-url origin https://example.invalid/x.git',
    'git remote set-url --push origin https://example.invalid/x.git',
    'git remote add o2 https://example.invalid/x.git',
    'git remote rename origin foo',
    'git remote remove origin',
    'git remote rm origin',
    'git -C . remote set-url origin x',
    'git config remote.origin.url https://example.invalid/x.git',
    'git config remote.origin.pushurl https://example.invalid/x.git',
    'git config remote.origin.push refs/heads/*:refs/heads/main',
    'git config --add remote.origin.push refs/heads/develop:refs/heads/main',
    'git config remote.pushDefault o2',
    'git config --global url.https://example.invalid/.insteadOf git@example.com:',
    'git config --system url.x.pushInsteadOf origin',
    'git config --local remote.origin.url x',
    'git config --file .git/config remote.origin.url x',
    'git config -f /tmp/c branch.develop.remote o2',
    'git config branch.develop.pushRemote o2',
    'git config branch.develop.remote o2',
    'git config push.default matching',
    'git config --unset remote.origin.url',
    'git config --unset-all remote.origin.push',
    'git config --replace-all remote.origin.url x',
    'git config --remove-section remote.origin',
    'git config --rename-section remote.origin remote.autre',
    'git config set remote.origin.url x',
    'git config unset remote.origin.url',
    'git config include.path /tmp/autre.gitconfig',
    'git config includeIf.gitdir:/tmp/.path /tmp/autre.gitconfig',
    'git config --edit',
    'git config -e',
    'git config edit',
    'git config "$K" x',
    '{ git remote set-url origin x; }',
  ];
  for (const command of cases) {
    it(`refuse ${command}`, () => {
      for (const agent of ROLES) {
        const r = bash(command, agent);
        assert.equal(r.code, 2, `${command} (${agent ?? 'main'})`);
        assert.match(r.stderr, /destination|illisible/, `${command} : ${r.stderr}`);
      }
    });
  }

  it('laisse les lectures et les clés sans effet sur la destination', () => {
    for (const command of [
      'git config --get remote.origin.url',
      'git config remote.origin.url',
      "git config --get-regexp '^remote\\.'",
      'git config -l',
      'git config --list --show-origin',
      'git config get remote.origin.url',
      'git config --global --get url.x.insteadOf',
      'git remote -v',
      'git remote',
      'git remote get-url origin',
      'git remote show origin',
      'git config user.name Test',
      'git config --global core.quotepath false',
    ]) {
      for (const agent of [undefined, 'dev-api']) {
        const r = bash(command, agent);
        assert.equal(r.code, 0, `${command} (${agent ?? 'main'}) : ${r.stderr}`);
      }
    }
  });
});

describe('T3 : la configuration git ne s’édite pas', () => {
  const files = () => [
    join(repo, '.git/config'),
    join(repo, '.git/config.worktree'),
    join(repo, '.git/worktrees/w/config.worktree'),
    join(home, '.gitconfig'),
    join(home, '.config/git/config'),
  ];

  it('refuse Edit et Write sur .git/config, ~/.gitconfig et leurs variantes, à tous', () => {
    for (const file of files()) {
      for (const agent of ROLES) {
        const w = hook('Write', { file_path: file, content: '[remote "origin"]\n' }, agent);
        assert.equal(w.code, 2, `Write ${file} (${agent ?? 'main'})`);
        assert.match(w.stderr, /configuration git/, w.stderr);
        const e = hook('Edit', { file_path: file, old_string: 'Test', new_string: 'Autre' }, agent);
        assert.equal(e.code, 2, `Edit ${file} (${agent ?? 'main'})`);
      }
    }
  });

  it('refuse l’écriture shell de ces fichiers, en clair ou dans du code', () => {
    for (const command of [
      'echo "[remote]" >> .git/config',
      "sed -i 's/a/b/' .git/config",
      'cat >> ~/.gitconfig <<EOF\n[url "x"]\nEOF',
      `tee -a ${join(home, '.gitconfig')} < /dev/null`,
      `python3 -c "open('.git/config','a').write('x')"`,
    ]) {
      for (const agent of [undefined, 'dev-api']) {
        const r = bash(command, agent);
        assert.equal(r.code, 2, `${command} (${agent ?? 'main'})`);
        assert.match(r.stderr, /configuration git/, `${command} : ${r.stderr}`);
      }
    }
  });

  it('laisse les fichiers ordinaires nommés config et la lecture', () => {
    const w = hook(
      'Write',
      { file_path: join(repo, 'apps/api/config/x.json'), content: '{}' },
      'dev-api',
    );
    assert.equal(w.code, 0, w.stderr);
    const r = bash('cat .git/config ~/.gitconfig', 'dev-api');
    assert.equal(r.code, 0, r.stderr);
  });
});
