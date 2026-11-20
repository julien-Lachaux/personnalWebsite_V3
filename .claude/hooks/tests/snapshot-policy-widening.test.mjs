// BF-10 (brief back-003, 20 nov. 2026) : un fichier devenu oracle après la prise de l'instantané
// (politique élargie entre-temps, hooks exécutés depuis le checkout principal) n'est ni « créé » ni
// « modifié » tant que son contenu est celui qu'il avait à l'instantané (commit `head`, ou fichier
// non suivi relevé dans l'instantané). Modifié ensuite sans justification, il reste une violation.
//
// L'élargissement de la politique est simulé en retirant le fichier des oracles de l'instantané :
// c'est exactement l'instantané qu'aurait pris l'ancienne politique. Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ensureSnapshot, verifySnapshot } from '../lib/state.mjs';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');
const CONFIG = 'apps/web/playwright.config.ts';
const LOCAL = 'apps/web/playwright.local.config.ts';

const temps = [];
let repo;

function sh(cwd, cmd, args) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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

function write(rel, content) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), content);
}

function makeRepo() {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-bf10-')));
  temps.push(repo);
  sh(repo, 'git', ['init', '-q', '-b', 'develop']);
  write('.gitignore', '.claude/hooks/state/\n.claude/hooks/audit.log\n');
  write('apps/web/app/pages/index.vue', '<template><h1>Accueil</h1></template>\n');
  // Créé par un commit justifié (0d24bda dans le scénario du brief), présent au head de l'instantané.
  write(CONFIG, 'export default { retries: 0 };\n');
  commitAll('chore(web): configuration Playwright\n\nJustification-test: F0-06 création');
}

const stateRoot = () => join(repo, '.claude', 'hooks', 'state');
const ctx = (key) => ({ role: 'dev-api', key });

/** Instantané pris avec une politique qui ne connaissait pas encore les fichiers `rels`. */
function snapshotBeforeWidening(key, rels) {
  const snapshot = ensureSnapshot(stateRoot(), key, repo);
  for (const rel of rels) {
    assert.ok(rel in snapshot.oracles, `${rel} est un oracle de la politique actuelle`);
    delete snapshot.oracles[rel];
  }
  return snapshot;
}

function hook(mode, input) {
  const res = spawnSync(process.execPath, [GUARD, mode], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
  });
  return { code: res.status, stderr: res.stderr };
}

const input = (id, event) => ({
  session_id: 's-bf10',
  cwd: repo,
  hook_event_name: event,
  agent_type: 'dev-api',
  agent_id: id,
  stop_hook_active: false,
});

beforeEach(() => {
  makeRepo();
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('BF-10 : politique élargie après la prise de l’instantané', () => {
  it('un fichier existant inchangé n’est pas une violation, modifié ensuite il en est une', () => {
    const snapshot = snapshotBeforeWidening('agent-b1', [CONFIG]);
    assert.deepEqual(verifySnapshot(stateRoot(), snapshot, ctx('agent-b1')), []);

    writeFileSync(join(repo, CONFIG), 'export default { retries: 3 };\n');
    assert.deepEqual(verifySnapshot(stateRoot(), snapshot, ctx('agent-b1')), [
      { rel: CONFIG, problem: 'oracle modifié' },
    ]);
  });

  it('la modification commitée sans justification reste une violation, avec justification non', () => {
    const snapshot = snapshotBeforeWidening('agent-b2', [CONFIG]);
    writeFileSync(join(repo, CONFIG), 'export default { retries: 3 };\n');
    commitAll('chore(web): reprises');
    assert.equal(verifySnapshot(stateRoot(), snapshot, ctx('agent-b2')).length, 1);

    writeFileSync(join(repo, CONFIG), 'export default { retries: 1 };\n');
    commitAll('chore(web): reprises\n\nJustification-test: F8-1 une reprise pour le réseau lent');
    assert.deepEqual(verifySnapshot(stateRoot(), snapshot, ctx('agent-b2')), []);
  });

  it('un fichier non suivi relevé à l’instantané, inchangé, n’est pas une violation', () => {
    write(LOCAL, 'export default { workers: 1 };\n');
    const snapshot = snapshotBeforeWidening('agent-b3', [LOCAL]);
    assert.deepEqual(verifySnapshot(stateRoot(), snapshot, ctx('agent-b3')), []);

    writeFileSync(join(repo, LOCAL), 'export default { workers: 8 };\n');
    assert.deepEqual(verifySnapshot(stateRoot(), snapshot, ctx('agent-b3')), [
      { rel: LOCAL, problem: 'oracle modifié' },
    ]);
  });

  it('une configuration réellement créée depuis l’instantané reste une violation', () => {
    const snapshot = snapshotBeforeWidening('agent-b4', [CONFIG]);
    write(LOCAL, 'export default { workers: 8 };\n');
    assert.deepEqual(verifySnapshot(stateRoot(), snapshot, ctx('agent-b4')), [
      { rel: LOCAL, problem: 'configuration de test ou garde-fou créé' },
    ]);
  });

  it('scénario du brief par les hooks : fin de tâche acceptée tant que le fichier est inchangé', () => {
    assert.equal(hook('subagent-start', input('b5', 'SubagentStart')).code, 0);
    assert.equal(hook('subagent-start', input('b6', 'SubagentStart')).code, 0);
    for (const id of ['b5', 'b6']) {
      const dir = join(stateRoot(), 'snapshots', `agent-${id}`);
      const [file] = readdirSync(dir);
      const snapshot = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      delete snapshot.oracles[CONFIG];
      writeFileSync(join(dir, file), JSON.stringify(snapshot));
    }
    assert.equal(hook('verify', input('b5', 'SubagentStop')).code, 0);

    writeFileSync(join(repo, CONFIG), 'export default { retries: 3 };\n');
    const r = hook('verify', input('b6', 'SubagentStop'));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /apps\/web\/playwright\.config\.ts : oracle modifié/);
  });
});
