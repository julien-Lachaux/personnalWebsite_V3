// L14-06, décision de Julien du 20 nov. 2026 : le commit sur la branche locale main est refusé à
// toute session, la principale comprise, comme les autres écritures de main (main-branch.test.mjs),
// ainsi que ses équivalents : outils de commit (citool, gui), import de correctifs (quiltimport),
// rebase depuis un autre gestionnaire (svn rebase, p4 rebase), et les écritures de références
// qui visent main sans passer par les commandes déjà lues (stash branch, fast-import, replay,
// rebase --update-refs). Le commit sur une autre branche reste permis. Chaque cas passe par
// l'analyse de la commande pour chaque rôle, et par l'entrée JSON du hook PreToolUse pour la
// session principale et dev-api ; rien n'est exécuté. Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { analyzeCommand } from '../lib/shell.mjs';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');
const ROLES = ['main', 'dev-api', 'lead-architecte', 'correcteur', 'qa', 'chef-de-projet'];
const WRITERS = ['main', 'dev-api', 'lead-architecte', 'correcteur'];
const BY_HOOK = new Set(['main', 'dev-api']);
const MAIN_REASON = /la branche locale main ne s’écrit pas/;

let onMain;
let onDevelop;
let project;

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function makeRepo(branch, other) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `garde-fous-commit-${branch}-`)));
  git(dir, ['init', '-q', '-b', branch]);
  git(dir, [
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
  git(dir, ['branch', other]);
  git(dir, ['branch', 'lot/x']);
  return dir;
}

before(() => {
  onMain = makeRepo('main', 'develop');
  onDevelop = makeRepo('develop', 'main');
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-commit-projet-')));
});

after(() => {
  for (const dir of [onMain, onDevelop, project]) rmSync(dir, { recursive: true, force: true });
});

function bash(command, role, cwd) {
  const input = {
    session_id: 's-main-commit',
    cwd,
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

function refused(command, cwd, reason = MAIN_REASON) {
  for (const role of ROLES) {
    const deny = analyzeCommand(command, cwd, role).deny;
    assert.match(deny ?? '', reason, `${role} (analyse) : ${command}`);
    if (!BY_HOOK.has(role)) continue;
    const r = bash(command, role, cwd);
    assert.equal(r.code, 2, `${role} : ${command} : ${r.stderr}`);
    assert.match(r.stderr, reason, `${role} : ${command}`);
  }
}

function allowed(command, cwd) {
  for (const role of WRITERS) {
    const deny = analyzeCommand(command, cwd, role).deny;
    assert.equal(deny, null, `${role} (analyse) : ${command}`);
    if (!BY_HOOK.has(role)) continue;
    const r = bash(command, role, cwd);
    assert.equal(r.code, 0, `${role} : ${command} : ${r.stderr}`);
  }
}

describe('L14-06 : commit quand la branche courante est main', () => {
  it('les dépôts du test sont bien sur main et sur develop', () => {
    assert.equal(git(onMain, ['symbolic-ref', '--short', 'HEAD']).trim(), 'main');
    assert.equal(git(onDevelop, ['symbolic-ref', '--short', 'HEAD']).trim(), 'develop');
  });

  for (const command of [
    'git commit -m x',
    'git commit -q -m "feat: x"',
    'git commit --amend --no-edit',
    'git commit -am x',
    'git commit --allow-empty -m x',
    'git commit -F /tmp/message.txt',
    `git commit -q -m "$(cat <<'EOF'\nfeat: x\n\nCo-Authored-By: C\nEOF\n)"`,
    'git commit -m --dry-run',
    'git add -A && git commit -m x',
    'git -c user.name=T commit -m x',
    'git -c alias.ci=commit ci -m x',
    "bash -c 'git commit -m x'",
    '(git commit -m x)',
    'git citool',
    'git gui',
    'git gui citool',
    'git quiltimport --patches p',
    'git svn rebase',
    'git p4 rebase',
  ]) {
    it(`refuse sur main : ${command}`, () => refused(command, onMain));
  }

  it('refuse le commit sur main désigné depuis un autre dépôt ou après un changement de branche', () => {
    refused(`git -C ${onMain} commit -m x`, onDevelop);
    refused(`cd ${onMain} && git commit -m x`, onDevelop);
    refused('git checkout main && git commit -m x', onDevelop);
    refused('git switch main; git commit -m x', onDevelop);
  });

  it('refuse le commit quand la branche courante est illisible', () => {
    refused('cd "$W" && git commit -m x', onDevelop, /branche courante illisible/);
    refused('git checkout - && git commit -m x', onDevelop, /branche courante illisible/);
  });

  it('permet ce qui n’écrit pas main', () => {
    allowed('git commit --dry-run', onMain);
    allowed('git commit --dry-run -m x', onMain);
    allowed('git gui blame README.md', onMain);
    allowed('git quiltimport --dry-run', onMain);
    allowed('git status && git log --oneline -3', onMain);
  });

  for (const command of [
    'git commit -m x',
    'git commit -q -m "feat: x"',
    'git add -A && git commit -m x',
    'git commit --amend --no-edit',
    'git citool',
    'git checkout lot/x && git commit -m x',
  ]) {
    it(`permet sur develop : ${command}`, () => allowed(command, onDevelop));
  }

  it('permet le commit après être passé de main à une autre branche', () => {
    allowed('git checkout develop && git commit -m x', onMain);
    allowed('git switch -c lot/y && git commit -m x', onMain);
  });
});

describe('L14-06 : autres écritures de références vers main', () => {
  it('git stash branch main est refusé, une autre branche est permise', () => {
    refused('git stash branch main', onDevelop);
    refused('git stash branch refs/heads/main stash@{0}', onDevelop);
    allowed('git stash branch lot/y', onDevelop);
  });

  it('git stash branch suit la branche créée', () => {
    allowed('git stash branch lot/y && git commit -m x', onMain);
  });

  it('git fast-import lit les références de son flux', () => {
    refused("git fast-import <<'EOF'\ncommit refs/heads/main\nmark :1\nEOF", onDevelop);
    refused("git fast-import <<'EOF'\nreset refs/heads/main\nfrom :1\nEOF", onDevelop);
    refused('git fast-export --all | git fast-import', onDevelop);
    refused('git fast-import < "$FLUX"', onDevelop);
    allowed("git fast-import <<'EOF'\ncommit refs/heads/lot/y\nmark :1\nEOF", onDevelop);
  });

  it('git replay écrit les branches nommées ou déduites du parcours', () => {
    refused('git replay --advance main lot/x', onDevelop);
    refused('git replay --revert=main lot/x', onDevelop);
    refused('git replay --onto develop --ref refs/heads/main lot/x..develop', onDevelop);
    refused('git replay --onto develop lot/x..main', onDevelop);
    refused('git replay --contained --onto develop --advance develop lot/x', onDevelop);
    allowed('git replay --ref-action=print --onto develop lot/x..main', onDevelop);
    allowed('git replay --advance develop lot/x', onDevelop);
    allowed('git replay --onto develop --ref refs/heads/lot/x main..lot/x', onDevelop);
  });

  it('git rebase --update-refs est refusé (branches du parcours illisibles)', () => {
    refused('git rebase --update-refs develop', onDevelop);
    refused('git rebase -i --update-refs develop lot/x', onDevelop);
    allowed('git rebase develop lot/x', onDevelop);
  });
});
