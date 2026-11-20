// L14-06 (décision de Julien du 19 nov. 2026, après la recette du lot 13 bis) : aucune session, la
// principale comprise, n'écrit la branche locale main (elle partirait dans le prochain push de
// Julien) : fusion, rebase, cherry-pick, revert, am, pull et reset qui déplace la branche quand la
// branche courante est main ; création, déplacement, renommage, copie vers main ou suppression de
// main. Restent permis : l'étiquette locale et le déplacement local de develop. Chaque cas rejoue
// l'entrée JSON du hook PreToolUse ; rien n'est exécuté. Lancé par `pnpm hooks:test`.
//
// Écart au ticket : git commit quand la branche courante est main n'est pas refusé, car un test
// existant (guard.test.mjs, « accepte les commandes ordinaires ») l'exige permis ; voir le compte
// rendu du lot 14 (docs/comptes-rendus/lot-14-hooks-lead.md).

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');
const ROLES = ['main', 'dev-api', 'lead-architecte', 'correcteur', 'chef-de-projet'];
/** Rôles sans limite de chemins d'écriture (le chef de projet n'écrit que ses documents). */
const WRITERS = ['main', 'dev-api', 'lead-architecte', 'correcteur'];

let onMain;
let onDevelop;
let project;

function git(cwd, args) {
  execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
}

function makeRepo(branch, other) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `garde-fous-main-${branch}-`)));
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
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-main-projet-')));
});

after(() => {
  for (const dir of [onMain, onDevelop, project]) rmSync(dir, { recursive: true, force: true });
});

/** Verdict du hook PreToolUse pour une commande Bash ; rôle « main » = session principale. */
function bash(command, role, cwd) {
  const input = {
    session_id: 's-main-branch',
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

function refused(command, cwd, reason = /la branche locale main ne s’écrit pas/) {
  for (const role of ROLES) {
    const r = bash(command, role, cwd);
    assert.equal(r.code, 2, `${role} : ${command} : ${r.stderr}`);
    assert.match(r.stderr, reason, `${role} : ${command}`);
  }
}

function allowed(command, cwd) {
  for (const role of WRITERS) {
    const r = bash(command, role, cwd);
    assert.equal(r.code, 0, `${role} : ${command} : ${r.stderr}`);
  }
}

describe('L14-06 : écritures de la branche courante quand elle est main', () => {
  for (const command of [
    'git merge develop',
    'git merge --no-ff lot/x -m "merge: lot x"',
    'git merge --continue',
    'git pull',
    'git pull --ff-only origin develop',
    'git rebase develop',
    'git rebase -i HEAD~2',
    'git rebase --continue',
    'git cherry-pick abc1234',
    'git cherry-pick --continue',
    'git revert HEAD',
    'git am 0001-correctif.patch',
    'git reset --soft HEAD~1',
    'git reset --hard develop',
    'git reset develop',
    'git branch -m main-ancienne',
  ]) {
    it(`refuse ${command} sur main, à toutes les sessions`, () => {
      refused(command, onMain, /sur la branche main|git branch main/);
    });
  }

  it('suit la branche courante changée par la commande, sous-shell et code imbriqué compris', () => {
    for (const command of [
      'git checkout main && git merge develop',
      'git switch main && git cherry-pick abc1234',
      '(git checkout main) && git merge develop',
      'bash -c "git checkout main" && git merge develop',
      'git symbolic-ref HEAD refs/heads/main && git merge develop',
      'git worktree add ../w-main main && cd ../w-main && git merge develop',
      `git -C ${onMain} merge develop`,
      `cd ${onMain} && git rebase develop`,
    ]) {
      refused(command, onDevelop);
    }
  });

  it('refuse une écriture quand la branche courante est illisible', () => {
    for (const command of [
      'git checkout - && git merge develop',
      'cd "$X" && git merge develop',
      'git -C "$R" rebase develop',
      'git --git-dir=/tmp/autre merge develop',
      'GIT_DIR=/tmp/autre git merge develop',
      'git -C /tmp/inexistant-l14 merge develop',
    ]) {
      refused(command, onDevelop, /branche courante illisible/);
    }
  });

  it('laisse lire, annuler et réinitialiser sans déplacer la branche', () => {
    for (const command of [
      'git status --short',
      'git log --oneline -5',
      'git diff develop...HEAD',
      'git merge --abort',
      'git rebase --abort',
      'git cherry-pick --abort',
      'git am --abort',
      'git reset',
      'git reset HEAD',
      'git reset --hard',
      'git reset -- docs/a.md',
      'git reset HEAD~1 -- docs/a.md',
      'git stash push -u -m wip',
      'git fetch origin',
      'git checkout develop',
    ]) {
      allowed(command, onMain);
    }
  });
});

describe('L14-06 : écritures nommées de main, quelle que soit la branche courante', () => {
  for (const command of [
    'git branch -f main develop',
    'git branch --force main HEAD',
    'git branch main',
    'git branch -m main ancienne',
    'git branch -m lot/x main',
    'git branch -M lot/x main',
    'git branch -c develop main',
    'git branch -d main',
    'git branch -D main',
    'git update-ref refs/heads/main HEAD',
    'git update-ref -d refs/heads/main',
    'git update-ref heads/main HEAD',
    "git update-ref --stdin <<'EOF'\nupdate refs/heads/main abc1234\nEOF",
    'git symbolic-ref refs/heads/main refs/heads/develop',
    'git checkout -B main',
    'git checkout -b main origin/main',
    'git checkout --orphan main',
    'git checkout --track origin/main',
    'git switch -C main',
    'git switch -c main',
    'git switch --orphan main',
    'git switch --track origin/main',
    'git worktree add -B main ../w',
    'git worktree add -b main ../w develop',
    'git fetch origin main:main',
    'git fetch origin +main:refs/heads/main',
    'git fetch . develop:main',
    'git pull origin main:main',
    'git rebase develop main',
    'git rebase --onto develop lot/x main',
    'B=main; git branch -f $B develop',
  ]) {
    it(`refuse ${command}`, () => {
      refused(command, onDevelop);
    });
  }

  it('refuse un nom de branche écrit illisible', () => {
    for (const command of [
      'git branch -f $B develop',
      'git checkout -b "$NOM"',
      'git update-ref $REF HEAD',
      'git fetch origin $SPEC',
      'echo main | xargs git branch -f',
      'echo "update refs/heads/main x" | git update-ref --stdin',
    ]) {
      refused(command, onDevelop, /illisible/);
    }
  });
});

describe('L14-06 : ce qui reste permis (décision du même jour)', () => {
  it('l’étiquette locale et le déplacement local de develop', () => {
    for (const command of [
      'git tag v1.0.0',
      'git tag -f v1.0.0 main',
      'git branch -f develop main',
      'git update-ref refs/heads/develop main',
      'git checkout -B develop main',
    ]) {
      allowed(command, onDevelop);
    }
  });

  it('les lectures de main et les écritures des autres branches', () => {
    for (const command of [
      'git merge main',
      'git merge --no-ff lot/x -m "merge: lot x"',
      'git pull origin main',
      'git fetch origin main',
      'git fetch origin develop:develop',
      'git branch --merged main',
      'git branch -a --contains main',
      'git branch -c main copie',
      'git branch -D lot/x',
      'git branch -m lot/x lot/y',
      'git checkout -b lot/nouveau',
      'git switch -c lot/nouveau main',
      'git worktree add -b lot/z ../w develop',
      'git worktree add ../w lot/x && cd ../w && git merge develop',
      'git rebase develop lot/x',
      'git reset --soft HEAD~1',
      'git cherry-pick abc1234',
      'git log main..develop',
      'git diff main...develop',
      'git show main:README.md',
      'git checkout main -- README.md',
    ]) {
      allowed(command, onDevelop);
    }
  });
});
