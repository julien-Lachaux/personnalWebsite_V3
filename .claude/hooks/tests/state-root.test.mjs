// Lot 13 bis, T6 : hors session (CLAUDE_PROJECT_DIR absent : authorize.mjs lancé depuis un terminal
// dans un worktree, rejeu manuel du hook), la racine de l'état des garde-fous est le checkout
// principal du dépôt. `git rev-parse --path-format=absolute` n'existe qu'à partir de git 2.31 : avec
// git 2.30, l'option revenait telle quelle sur une ligne et l'état partait dans un dossier parasite
// « --path-format=absolute » créé dans le worktree. Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { mainCheckoutOf } from '../lib/state.mjs';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');

let root;
let main;
let worktree;

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

before(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-racine-')));
  main = join(root, 'principal');
  worktree = join(root, 'arbre');
  mkdirSync(main);
  git(main, ['init', '-q', '-b', 'develop']);
  git(main, [
    '-c',
    'user.name=Test',
    '-c',
    'user.email=ci@noreply.invalid',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    'base',
  ]);
  git(main, ['worktree', 'add', '-q', '-b', 'lot/x', worktree]);
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

function envWithoutProject() {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  return env;
}

describe('T6 : racine de l’état hors session', () => {
  it('mainCheckoutOf rend le checkout principal depuis un worktree et depuis le principal', () => {
    assert.equal(mainCheckoutOf(worktree), main);
    assert.equal(mainCheckoutOf(join(worktree, 'sous', 'dossier')), main);
    assert.equal(mainCheckoutOf(main), main);
  });

  it('le hook lancé dans un worktree sans CLAUDE_PROJECT_DIR ne crée rien dans le worktree', () => {
    const res = spawnSync(process.execPath, [GUARD, 'session-start'], {
      cwd: worktree,
      input: JSON.stringify({
        session_id: 's-racine',
        cwd: worktree,
        hook_event_name: 'SessionStart',
      }),
      encoding: 'utf8',
      env: envWithoutProject(),
    });
    assert.equal(res.status, 0, res.stderr);
    const parasites = readdirSync(worktree).filter((name) => name !== '.git');
    assert.deepEqual(parasites, [], `entrées créées dans le worktree : ${parasites.join(', ')}`);
    assert.ok(readdirSync(main).includes('.claude'), 'état rangé sous le checkout principal');
  });
});
