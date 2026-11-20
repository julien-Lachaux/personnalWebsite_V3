// L14-12 (recette du lot 16, point ouvert 3) : un fichier qui devient test en cours de session
// (politique élargie depuis l'instantané : hooks du checkout principal mis à jour par une fusion)
// est protégé dès ce moment, comme un test existant : le modifier par Edit, Write ou le shell exige
// une autorisation « tests », et la fin de tâche le signale s'il a changé sans autorisation ni
// commit justifié. Un test réellement créé pendant la tâche reste libre.
//
// Deux façons d'obtenir un instantané qui ne relève pas comme oracle un fichier existant :
// - par les hooks : le fichier est au commit de l'instantané mais hors de l'index et ignoré quand
//   l'instantané est pris (exactement la situation « présent au head, absent des oracles ») ;
// - par la bibliothèque : l'instantané est pris puis le fichier retiré de ses oracles, comme pour
//   BF-10 (c'est l'instantané qu'aurait pris l'ancienne politique).
// L'état des hooks vit dans un dossier de projet temporaire distinct du dépôt.
// Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ensureSnapshot, existedAtSnapshot, verifySnapshot } from '../lib/state.mjs';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(HOOKS, 'guard.mjs');
const AUTHORIZE = join(HOOKS, 'authorize.mjs');

/** Fichier du commit de l'instantané, que l'instantané ne relève pas comme oracle. */
const WIDENED = 'apps/web/test/parcours.e2e.ts';
/** Fichier non suivi relevé à l'instantané, même situation (bibliothèque seulement). */
const UNTRACKED = 'apps/web/test/brouillon.e2e.ts';

const temps = [];
let repo;
let project;

function sh(cwd, cmd, args) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function write(rel, content) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), content);
}

function commitAll(message) {
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
    message,
  ]);
}

const tempDir = (prefix) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  temps.push(dir);
  return dir;
};

function hook(mode, input) {
  const res = spawnSync(process.execPath, [GUARD, mode], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

const base = (agent, id, event) => ({
  session_id: 's-l14-12',
  cwd: repo,
  hook_event_name: event,
  agent_type: agent,
  agent_id: id,
  stop_hook_active: false,
});

const tool = (agent, id, name, toolInput) =>
  hook('pre-tool-use', {
    ...base(agent, id, 'PreToolUse'),
    tool_name: name,
    tool_input: toolInput,
  });

/** Démarre l'agent alors que WIDENED, présent au head, est hors de l'index et ignoré. */
function startWithWidenedFile(agent, id) {
  sh(repo, 'git', ['rm', '-q', '--cached', WIDENED]);
  write('.gitignore', `${WIDENED}\n`);
  assert.equal(hook('subagent-start', base(agent, id, 'SubagentStart')).code, 0);
  // Fichier de nouveau suivi : la politique « actuelle » le voit comme un test.
  rmSync(join(repo, '.gitignore'));
  sh(repo, 'git', ['add', WIDENED]);
}

const p = (rel) => join(repo, rel);

beforeEach(() => {
  repo = tempDir('garde-fous-l14-12-');
  project = tempDir('garde-fous-l14-12-projet-');
  sh(repo, 'git', ['init', '-q', '-b', 'develop']);
  write('apps/web/app/pages/index.vue', '<template><h1>Accueil</h1></template>\n');
  write(WIDENED, "test('accueil', async () => {});\n");
  commitAll('base');
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('L14-12 : fichier devenu test en cours de session, outils d’édition', () => {
  it('refuse Edit et Write sans autorisation, comme pour un test existant', () => {
    startWithWidenedFile('dev-front', 'e1');
    const e = tool('dev-front', 'e1', 'Edit', {
      file_path: p(WIDENED),
      old_string: 'async',
      new_string: 'async ',
    });
    assert.equal(e.code, 2, e.stderr);
    assert.match(e.stderr, /modification d’un test existant/);
    const w = tool('dev-front', 'e1', 'Write', { file_path: p(WIDENED), content: 'vide\n' });
    assert.equal(w.code, 2, w.stderr);
  });

  it('accepte la modification sous autorisation « tests »', () => {
    const grant = spawnSync(
      process.execPath,
      [
        AUTHORIZE,
        'grant',
        '--agent',
        'correcteur',
        '--scope',
        'tests',
        '--ticket',
        'L14-12',
        '--reason',
        'test devenu oracle établi faux',
        '--path',
        WIDENED,
      ],
      { cwd: repo, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: project } },
    );
    assert.equal(grant.status, 0, grant.stderr);
    startWithWidenedFile('correcteur', 'e2');
    const e = tool('correcteur', 'e2', 'Edit', {
      file_path: p(WIDENED),
      old_string: 'async',
      new_string: 'async ',
    });
    assert.equal(e.code, 0, e.stderr);
  });

  it('laisse libre un test réellement créé pendant la tâche, même modifié ensuite', () => {
    startWithWidenedFile('dev-front', 'e3');
    const rel = 'apps/web/test/nouveau.e2e.ts';
    const w = tool('dev-front', 'e3', 'Write', {
      file_path: p(rel),
      content: "test('a', () => {});\n",
    });
    assert.equal(w.code, 0, w.stderr);
    write(rel, "test('a', () => {});\n");
    const e = tool('dev-front', 'e3', 'Edit', {
      file_path: p(rel),
      old_string: "'a'",
      new_string: "'b'",
    });
    assert.equal(e.code, 0, e.stderr);
  });
});

describe('L14-12 : fichier devenu test en cours de session, shell', () => {
  it('refuse une écriture shell sans autorisation, laisse libre un test créé pendant la tâche', () => {
    startWithWidenedFile('dev-front', 's1');
    const r = tool('dev-front', 's1', 'Bash', {
      command: `echo x >> ${WIDENED}`,
      description: 'test',
    });
    assert.equal(r.code, 2, r.stderr);
    assert.match(r.stderr, /écriture shell sur un test existant/);
    const n = tool('dev-front', 's1', 'Bash', {
      command: 'echo x >> apps/web/test/nouveau.e2e.ts',
      description: 'test',
    });
    assert.equal(n.code, 0, n.stderr);
  });
});

describe('L14-12 : existence à l’instantané et fin de tâche (bibliothèque)', () => {
  /** Instantané pris par la politique actuelle, puis privé de `rels` (politique d'avant). */
  function snapshotBeforeWidening(root, key, rels) {
    const snapshot = ensureSnapshot(root, key, repo);
    for (const rel of rels) {
      assert.ok(rel in snapshot.oracles, `${rel} est un oracle de la politique actuelle`);
      delete snapshot.oracles[rel];
    }
    return snapshot;
  }

  it('un fichier du head ou non suivi relevé existait ; un fichier créé ensuite non', () => {
    write(UNTRACKED, "test('brouillon', async () => {});\n");
    const snapshot = snapshotBeforeWidening(tempDir('instantane-'), 'agent-x1', [
      WIDENED,
      UNTRACKED,
    ]);
    assert.equal(existedAtSnapshot(snapshot, WIDENED), true);
    assert.equal(existedAtSnapshot(snapshot, UNTRACKED), true);
    assert.equal(existedAtSnapshot(snapshot, 'apps/web/app/pages/index.vue'), true);
    assert.equal(existedAtSnapshot(snapshot, 'apps/web/test/nouveau.e2e.ts'), false);
    assert.equal(existedAtSnapshot({ ...snapshot, head: null }, WIDENED), false);
  });

  it('signale la modification et la suppression, pas un fichier inchangé ni un test créé', () => {
    write(UNTRACKED, "test('brouillon', async () => {});\n");
    const root = tempDir('instantane-');
    const ctx = { role: 'dev-front', key: 'agent-v1' };
    const snapshot = snapshotBeforeWidening(root, ctx.key, [WIDENED, UNTRACKED]);
    assert.deepEqual(verifySnapshot(root, snapshot, ctx), []);

    write('apps/web/test/nouveau.e2e.ts', "test('a', () => {});\n");
    write(WIDENED, "test('accueil modifié', async () => {});\n");
    rmSync(p(UNTRACKED));
    assert.deepEqual(
      verifySnapshot(root, snapshot, ctx).sort((a, b) => a.rel.localeCompare(b.rel)),
      [
        { rel: UNTRACKED, problem: 'oracle supprimé' },
        { rel: WIDENED, problem: 'oracle modifié' },
      ],
    );
  });

  it('accepte la modification commitée avec Justification-test, pas sans', () => {
    const root = tempDir('instantane-');
    const ctx = { role: 'dev-front', key: 'agent-v2' };
    const snapshot = snapshotBeforeWidening(root, ctx.key, [WIDENED]);
    write(WIDENED, "test('accueil corrigé', async () => {});\n");
    commitAll('fix(web): parcours');
    assert.deepEqual(verifySnapshot(root, snapshot, ctx), [
      { rel: WIDENED, problem: 'oracle modifié' },
    ]);
    write(WIDENED, "test('accueil corrigé deux fois', async () => {});\n");
    commitAll('fix(web): parcours\n\nJustification-test: L14-12 test établi faux par le triage');
    assert.deepEqual(verifySnapshot(root, snapshot, ctx), []);
  });

  it('signale la suppression commitée sans justification d’un fichier du head devenu test', () => {
    const root = tempDir('instantane-');
    const ctx = { role: 'dev-front', key: 'agent-v3' };
    const snapshot = snapshotBeforeWidening(root, ctx.key, [WIDENED]);
    sh(repo, 'git', ['rm', '-q', WIDENED]);
    commitAll('chore(web): retrait');
    assert.deepEqual(verifySnapshot(root, snapshot, ctx), [
      { rel: WIDENED, problem: 'oracle supprimé' },
    ]);
  });
});
