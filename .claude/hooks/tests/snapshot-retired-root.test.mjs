// BF-11 (brief back-003, 20 nov. 2026) : l'instantané d'un worktree retiré (`git worktree remove`)
// dont un outil a recréé le dossier (serveur `nuxt dev` orphelin qui régénère `apps/web/.nuxt/`)
// est ignoré et supprimé, comme celui d'une racine absente : la racine n'est plus ce dépôt (plus
// de `.git`, ou `git rev-parse --show-toplevel` différent). Un worktree toujours présent dont on
// supprime un oracle reste une violation, et un worktree encore enregistré par git dont on a retiré
// le `.git` à la main donne une seule violation (pas une par oracle). Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ensureSnapshot } from '../lib/state.mjs';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');

const temps = [];
let base;
let repo;

function sh(cwd, cmd, args) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function write(abs, content) {
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

/** Dépôt principal (develop) avec des oracles ; les worktrees vont sous `.claude/worktrees/`. */
function makeRepo() {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-bf11-')));
  temps.push(base);
  repo = join(base, 'principal');
  mkdirSync(repo);
  sh(repo, 'git', ['init', '-q', '-b', 'develop']);
  write(
    join(repo, '.gitignore'),
    '.claude/hooks/state/\n.claude/hooks/audit.log\n.claude/worktrees/\n.nuxt/\n',
  );
  write(join(repo, 'apps/web/app/pages/index.vue'), '<template><h1>Accueil</h1></template>\n');
  write(join(repo, 'apps/web/app/pages/index.spec.ts'), "it('h1', () => {});\n");
  write(join(repo, 'apps/web/test/smoke.e2e.ts'), "test('fumée', async () => {});\n");
  write(join(repo, 'apps/web/vitest.config.ts'), 'export default { test: {} };\n');
  write(join(repo, 'apps/web/playwright.config.ts'), 'export default { retries: 0 };\n');
  sh(repo, 'git', ['add', '-A']);
  sh(repo, 'git', [
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

function addWorktree(path, branch) {
  sh(repo, 'git', ['worktree', 'add', '-q', '-b', branch, path]);
  return realpathSync(path);
}

/** Fichiers générés recréés dans un dossier de worktree retiré (4 fichiers, comme dans le brief). */
function regenerateNuxt(worktree) {
  for (const name of ['app.config.mjs', 'nuxt.d.ts', 'tsconfig.json', 'types/imports.d.ts']) {
    write(join(worktree, 'apps/web/.nuxt', name), '// généré\n');
  }
}

const stateRoot = () => join(repo, '.claude', 'hooks', 'state');
const snapshotsOf = (id) => {
  const dir = join(stateRoot(), 'snapshots', `agent-${id}`);
  return existsSync(dir) ? readdirSync(dir) : [];
};

function hook(mode, id, cwd) {
  const res = spawnSync(process.execPath, [GUARD, mode], {
    input: JSON.stringify({
      session_id: 's-bf11',
      cwd,
      hook_event_name: mode === 'verify' ? 'SubagentStop' : 'SubagentStart',
      agent_type: 'dev-api',
      agent_id: id,
      stop_hook_active: false,
    }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
  });
  return { code: res.status, stderr: res.stderr };
}

const violationLines = (stderr) => stderr.split('\n').filter((l) => l.startsWith('  - '));

beforeEach(() => {
  makeRepo();
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('BF-11 : instantané d’un worktree retiré', () => {
  it('worktree retiré puis sous-dossier non versionné recréé : aucune violation, instantané supprimé', () => {
    const wt = addWorktree(join(repo, '.claude/worktrees/f0'), 'lot/f0');
    assert.equal(hook('subagent-start', 'r1', wt).code, 0);
    assert.equal(snapshotsOf('r1').length, 1);

    sh(repo, 'git', ['worktree', 'remove', wt]);
    regenerateNuxt(wt);
    const r = hook('verify', 'r1', repo);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(violationLines(r.stderr), []);
    assert.deepEqual(snapshotsOf('r1'), []);
  });

  it('worktree retiré hors de tout dépôt, dossier recréé : aucune violation', () => {
    const wt = addWorktree(join(base, 'hors-depot'), 'lot/hors');
    assert.equal(hook('subagent-start', 'r2', wt).code, 0);
    sh(repo, 'git', ['worktree', 'remove', wt]);
    regenerateNuxt(wt);
    const r = hook('verify', 'r2', repo);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(snapshotsOf('r2'), []);
  });

  it('worktree toujours présent dont on supprime un oracle : violation', () => {
    const wt = addWorktree(join(repo, '.claude/worktrees/f1'), 'lot/f1');
    assert.equal(hook('subagent-start', 'r3', wt).code, 0);
    rmSync(join(wt, 'apps/web/test/smoke.e2e.ts'));
    const r = hook('verify', 'r3', wt);
    assert.equal(r.code, 2);
    assert.deepEqual(violationLines(r.stderr), [
      '  - apps/web/test/smoke.e2e.ts : oracle supprimé',
    ]);
  });

  it('seul l’instantané retiré est supprimé : celui d’un autre dépôt reste vérifié', () => {
    const wt = addWorktree(join(repo, '.claude/worktrees/f2'), 'lot/f2');
    ensureSnapshot(stateRoot(), 'agent-r4', wt);
    ensureSnapshot(stateRoot(), 'agent-r4', repo);
    assert.equal(snapshotsOf('r4').length, 2);
    sh(repo, 'git', ['worktree', 'remove', wt]);
    regenerateNuxt(wt);
    rmSync(join(repo, 'apps/web/app/pages/index.spec.ts'));

    const r = hook('verify', 'r4', repo);
    assert.equal(r.code, 2);
    assert.deepEqual(violationLines(r.stderr), [
      '  - apps/web/app/pages/index.spec.ts : oracle supprimé',
    ]);
    assert.equal(snapshotsOf('r4').length, 1, 'instantané du worktree retiré supprimé');
  });

  it('worktree encore enregistré dont le .git a été retiré à la main : une seule violation', () => {
    const wt = addWorktree(join(repo, '.claude/worktrees/f3'), 'lot/f3');
    assert.equal(hook('subagent-start', 'r5', wt).code, 0);
    rmSync(join(wt, '.git'));
    const r = hook('verify', 'r5', repo);
    assert.equal(r.code, 2);
    const lines = violationLines(r.stderr);
    assert.equal(lines.length, 1, lines.join('\n'));
    assert.match(lines[0], /\.git : .*n'est plus un dépôt git/);
    assert.equal(snapshotsOf('r5').length, 1, 'instantané conservé');
  });
});
