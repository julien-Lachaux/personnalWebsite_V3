// L26-05 (revue automatisée de la PR #9, lot 25) : les écritures autorisées relevées par L25-04 et
// les reports de tests créés de L25-03 n'étaient jamais élagués, et les écritures autorisées étaient
// relues en entier à chaque fin de tâche.
// Règle : chaque fin de tâche (mode verify), après sa vérification, retire
// - une écriture autorisée illisible, d'un dépôt disparu ou retiré, d'une autorisation inconnue ou
//   révoquée depuis plus de 24 h, ou d'une autorisation expirée depuis plus de 24 h qu'aucun
//   instantané en cours d'une autre clé, pris avant l'écriture, ne peut plus retenir ;
// - un report illisible, d'un dépôt disparu ou retiré, dont plus aucun test n'a l'empreinte relevée,
//   ou plus vieux que 7 jours (clé qui n'a pas repris).
// Elle ne retire jamais une écriture qu'une vérification en cours pourrait retenir, ni un report
// récent dont un test est intact. Chaque relevé est un fichier écrit de façon atomique et jamais
// réécrit : des hooks concurrents ne perdent rien. L'ancien journal JSON Lines (lot 25) est converti.
// Le temps qui passe est simulé par le paramètre `now` de pruneState ; l'état des hooks vit dans un
// dossier de projet temporaire distinct du dépôt.
// Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
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
import {
  CARRY_MAX_AGE_MS,
  pruneState,
  readAuthorizedWrites,
  recordAuthorizedWrite,
  stateRoot,
  WRITE_GRACE_MS,
} from '../lib/state.mjs';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(HOOKS, 'guard.mjs');
const AUTHORIZE = join(HOOKS, 'authorize.mjs');

const WORKFLOW = '.github/workflows/revue-pr.yml';
const ORIGINAL = 'name: revue\non: pull_request\n';
const EDITED = 'name: revue\non: workflow_run\n';
const CREATED = 'apps/web/app/error.spec.ts';
const CREATED_CONTENT = "it('créé', () => {});\n";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const temps = [];
let repo;
let project;
let root;

const tempDir = (prefix) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  temps.push(dir);
  return dir;
};

function sh(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function write(rel, content, top = repo) {
  mkdirSync(dirname(join(top, rel)), { recursive: true });
  writeFileSync(join(top, rel), content);
}

function initRepo(dir) {
  sh(dir, 'init', '-q', '-b', 'lot/26-hooks');
  write(WORKFLOW, ORIGINAL, dir);
  write('apps/web/app/app.spec.ts', "it('monte', () => {});\n", dir);
  sh(dir, 'add', '-A');
  sh(
    dir,
    '-c',
    'user.name=Test',
    '-c',
    'user.email=ci@noreply.invalid',
    'commit',
    '-q',
    '-m',
    'base',
  );
}

const hookEnv = () => ({ ...process.env, CLAUDE_PROJECT_DIR: project });

function hook(mode, input) {
  const res = spawnSync(process.execPath, [GUARD, mode], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: hookEnv(),
  });
  return { code: res.status, stderr: res.stderr };
}

/** Même hook, lancé sans attendre : pour des hooks qui tournent en même temps. */
function hookAsync(mode, input) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [GUARD, mode], { env: hookEnv() });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => done({ code, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

function authorize(...args) {
  const res = spawnSync(process.execPath, [AUTHORIZE, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: hookEnv(),
  });
  assert.equal(res.status, 0, res.stderr);
  return res.stdout;
}

/** Autorisation « config » de dev-devops sur le workflow ; retourne son identifiant. */
function grantDevops(ttl = '240') {
  const out = authorize(
    'grant',
    '--agent',
    'dev-devops',
    '--scope',
    'config',
    '--ticket',
    'L26-05',
    '--reason',
    'élagage des écritures autorisées',
    '--path',
    WORKFLOW,
    '--ttl',
    ttl,
  );
  return /autorisation (\S+) :/.exec(out)[1];
}

const MAIN = 'main';
const DEVOPS = { role: 'dev-devops', id: 'devops-1' };
const LEAD = (id) => ({ role: 'lead-architecte', id });

const ctx = (who, event, cwd = repo) =>
  who === MAIN
    ? { session_id: 's-l26-05', cwd, hook_event_name: event, stop_hook_active: false }
    : {
        session_id: 's-l26-05',
        cwd,
        hook_event_name: event,
        agent_type: who.role,
        agent_id: who.id,
        stop_hook_active: false,
      };

const start = (who, cwd = repo) =>
  assert.equal(
    hook(who === MAIN ? 'session-start' : 'subagent-start', ctx(who, 'Start', cwd)).code,
    0,
  );
const stop = (who, cwd = repo) =>
  hook('verify', ctx(who, who === MAIN ? 'Stop' : 'SubagentStop', cwd));
const tool = (who, name, input, cwd = repo) =>
  hook('pre-tool-use', { ...ctx(who, 'PreToolUse', cwd), tool_name: name, tool_input: input });

/** Edit autorisé de dev-devops (relevé par PreToolUse), puis l'écriture que l'outil aurait faite. */
function devopsEdit(top = repo) {
  const r = tool(
    DEVOPS,
    'Edit',
    { file_path: join(top, WORKFLOW), old_string: 'pull_request', new_string: 'workflow_run' },
    top,
  );
  assert.equal(r.code, 0, r.stderr);
  write(WORKFLOW, EDITED, top);
}

/** Tâche d'un agent qui crée un test puis s'arrête : sa fin de tâche réussie le reporte. */
function createdThenStopped(who) {
  start(who);
  const w = tool(who, 'Write', { file_path: join(repo, CREATED), content: CREATED_CONTENT });
  assert.equal(w.code, 0, w.stderr);
  write(CREATED, CREATED_CONTENT);
  const s = stop(who);
  assert.equal(s.code, 0, s.stderr);
}

const editCreated = (who) =>
  tool(who, 'Edit', { file_path: join(repo, CREATED), old_string: "it('", new_string: "it('x" });

const carryFiles = () =>
  readdirSync(join(root, 'carry'), { recursive: true }).filter((f) => f.endsWith('.json'));
const carryDirs = () => (existsSync(join(root, 'carry')) ? readdirSync(join(root, 'carry')) : []);

const auditLog = () => {
  const path = join(project, '.claude', 'hooks', 'audit.log');
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
};

beforeEach(() => {
  repo = tempDir('garde-fous-l26-05-');
  project = tempDir('garde-fous-l26-05-projet-');
  process.env.CLAUDE_PROJECT_DIR = project;
  root = stateRoot(repo);
  initRepo(repo);
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('L26-05 : écritures autorisées retirées', () => {
  it('autorisation révoquée depuis plus de 24 h (date de révocation, pas d’expiration)', () => {
    const id = grantDevops('240');
    devopsEdit();
    authorize('revoke', '--id', id);
    assert.deepEqual(pruneState(root, { now: Date.now() + 23 * HOUR }).writes, {});
    assert.equal(readAuthorizedWrites(root, repo).length, 1);
    // Expiration à 4 h : sans la date de révocation, rien ne partirait avant 28 h.
    const r = pruneState(root, { now: Date.now() + 25 * HOUR });
    assert.deepEqual(r.writes, { 'autorisation révoquée': 1 });
    assert.equal(readAuthorizedWrites(root, repo).length, 0);
  });

  it('autorisation expirée depuis plus de 24 h, aucun instantané d’une autre clé', () => {
    grantDevops('1');
    devopsEdit();
    const r = pruneState(root, { now: Date.now() + 60_000 + WRITE_GRACE_MS + HOUR });
    assert.deepEqual(r.writes, { 'autorisation expirée': 1 });
    assert.equal(readAuthorizedWrites(root, repo).length, 0);
  });

  it('instantané d’une autre clé devenu inutile après sa fin de tâche : l’écriture part ensuite', () => {
    grantDevops('1');
    start(MAIN);
    devopsEdit();
    const later = Date.now() + 30 * DAY;
    assert.deepEqual(pruneState(root, { now: later }).writes, {});
    const s = stop(MAIN);
    assert.equal(s.code, 0, s.stderr);
    assert.deepEqual(pruneState(root, { now: later }).writes, { 'autorisation expirée': 1 });
  });

  it('dépôt disparu : retirée par la fin de tâche suivante, quelle que soit la clé', () => {
    grantDevops();
    const other = tempDir('garde-fous-l26-05-retire-');
    initRepo(other);
    devopsEdit(other);
    assert.equal(readAuthorizedWrites(root, other).length, 1);
    rmSync(other, { recursive: true, force: true });
    const s = stop(LEAD('lead-1'));
    assert.equal(s.code, 0, s.stderr);
    assert.equal(readAuthorizedWrites(root, other).length, 0);
    assert.match(auditLog(), /"event":"pruned".*"dépôt retiré":1/);
    assert.deepEqual(readdirSync(join(root, 'authorized-writes')), []);
  });

  it('dossier qui n’est plus un dépôt et que git ne liste plus (worktree retiré)', () => {
    grantDevops();
    const other = tempDir('garde-fous-l26-05-retire-');
    initRepo(other);
    devopsEdit(other);
    rmSync(join(other, '.git'), { recursive: true, force: true });
    assert.deepEqual(pruneState(root).writes, { 'dépôt retiré': 1 });
  });

  it('autorisation inconnue, après le délai de grâce seulement', () => {
    grantDevops();
    recordAuthorizedWrite(root, {
      top: repo,
      rel: WORKFLOW,
      sha256: 'a'.repeat(64),
      key: 'agent-x',
      role: 'dev-devops',
      grant: 'inconnue',
      scope: 'config',
    });
    assert.deepEqual(pruneState(root).writes, {});
    const r = pruneState(root, { now: Date.now() + WRITE_GRACE_MS + HOUR });
    assert.deepEqual(r.writes, { 'autorisation inconnue': 1 });
  });

  it('relevé illisible ou rangé hors du dossier de son dépôt', () => {
    grantDevops();
    devopsEdit();
    const [entry] = readAuthorizedWrites(root, repo);
    const misplaced = join(root, 'authorized-writes', 'autre-depot');
    mkdirSync(misplaced, { recursive: true });
    writeFileSync(join(misplaced, 'a.json'), JSON.stringify(entry));
    writeFileSync(join(misplaced, 'b.json'), '{"tronqué":');
    assert.deepEqual(pruneState(root).writes, { illisible: 2 });
    assert.equal(existsSync(misplaced), false);
    assert.equal(readAuthorizedWrites(root, repo).length, 1);
  });
});

describe('L26-05 : écritures autorisées jamais retirées', () => {
  it('autorisation active : gardée, et la fin de tâche d’une autre clé reste acceptée', () => {
    grantDevops('240');
    start(MAIN);
    devopsEdit();
    assert.deepEqual(pruneState(root, { now: Date.now() + 3 * HOUR }).writes, {});
    const s = stop(MAIN);
    assert.equal(s.code, 0, s.stderr);
    assert.equal(readAuthorizedWrites(root, repo).length, 1);
  });

  it('expirée depuis plus de 24 h mais retenue par un instantané en cours, pris avant', () => {
    grantDevops('1');
    start(LEAD('lead-2'));
    devopsEdit();
    assert.deepEqual(pruneState(root, { now: Date.now() + 365 * DAY }).writes, {});
    // La fin de tâche (qui élague elle aussi) attribue toujours la modification à dev-devops.
    const s = stop(LEAD('lead-2'));
    assert.equal(s.code, 0, s.stderr);
    assert.match(auditLog(), /"event":"attributed".*"by":"agent-devops-1"/);
  });

  it('instantané en cours de la clé qui a écrit : il ne retient rien, l’écriture part', () => {
    grantDevops('1');
    devopsEdit();
    const r = pruneState(root, { now: Date.now() + 60_000 + WRITE_GRACE_MS + HOUR });
    assert.deepEqual(r.writes, { 'autorisation expirée': 1 });
  });

  it('expirée depuis moins de 24 h : gardée, même sans instantané', () => {
    grantDevops('1');
    devopsEdit();
    assert.deepEqual(pruneState(root, { now: Date.now() + 60_000 + 23 * HOUR }).writes, {});
  });

  it('un instantané illisible empêche de prouver l’inutilité : rien d’expiré ne part', () => {
    grantDevops('1');
    devopsEdit();
    mkdirSync(join(root, 'snapshots', 'cle-illisible'), { recursive: true });
    writeFileSync(join(root, 'snapshots', 'cle-illisible', 'x.json'), '{');
    assert.deepEqual(pruneState(root, { now: Date.now() + 365 * DAY }).writes, {});
  });

  it('hooks concurrents : aucun relevé perdu pendant que d’autres fins de tâche élaguent', async () => {
    grantDevops('240');
    start(MAIN);
    const edits = Array.from({ length: 8 }, () =>
      hookAsync('pre-tool-use', {
        ...ctx(DEVOPS, 'PreToolUse'),
        tool_name: 'Edit',
        tool_input: {
          file_path: join(repo, WORKFLOW),
          old_string: 'pull_request',
          new_string: 'workflow_run',
        },
      }),
    );
    const stops = Array.from({ length: 8 }, (_, k) =>
      hookAsync('verify', ctx(LEAD(`lead-c${k}`), 'SubagentStop')),
    );
    const results = await Promise.all([...edits, ...stops]);
    for (const r of results) assert.equal(r.code, 0, r.stderr);
    assert.equal(readAuthorizedWrites(root, repo).length, 8);
    write(WORKFLOW, EDITED);
    const s = stop(MAIN);
    assert.equal(s.code, 0, s.stderr);
  });
});

describe('L26-05 : ancien journal JSON Lines (lot 25) converti', () => {
  it('lignes lisibles converties, illisibles et inutiles retirées, attribution conservée', () => {
    grantDevops('240');
    start(MAIN);
    start(LEAD('lead-3'));
    devopsEdit();
    const [entry] = readAuthorizedWrites(root, repo);
    rmSync(join(root, 'authorized-writes'), { recursive: true, force: true });
    const gone = { ...entry, top: join(tmpdir(), 'garde-fous-l26-05-absent') };
    const legacy = join(root, 'authorized-writes.jsonl');
    writeFileSync(
      legacy,
      `${JSON.stringify(entry)}\n{"tronqué":\n${JSON.stringify(gone)}\n${JSON.stringify(entry)}\n`,
    );
    // Lu tel quel avant sa conversion.
    assert.equal(readAuthorizedWrites(root, repo).length, 2);
    const s = stop(MAIN);
    assert.equal(s.code, 0, s.stderr);
    assert.equal(existsSync(legacy), false);
    // Deux lignes identiques donnent un seul fichier ; la ligne du dépôt disparu est retirée.
    assert.equal(readAuthorizedWrites(root, repo).length, 1);
    const l = stop(LEAD('lead-3'));
    assert.equal(l.code, 0, l.stderr);
    assert.match(auditLog(), /"event":"attributed".*"key":"agent-lead-3".*"by":"agent-devops-1"/);
  });
});

describe('L26-05 : reports de tests créés retirés', () => {
  it('plus vieux que 7 jours : retiré, le test redevient protégé à la reprise', () => {
    createdThenStopped(LEAD('a1'));
    const r = pruneState(root, { now: Date.now() + CARRY_MAX_AGE_MS + HOUR });
    assert.deepEqual(r.carry, { 'trop ancien': 1 });
    assert.deepEqual(carryDirs(), []);
    start(LEAD('a1'));
    const e = editCreated(LEAD('a1'));
    assert.equal(e.code, 2, e.stderr);
    assert.match(e.stderr, /modification d’un test existant/);
  });

  it('plus aucun test reporté n’a son empreinte (supprimé ou modifié depuis)', () => {
    createdThenStopped(LEAD('a2'));
    write(CREATED, "it('modifié par un autre', () => {});\n");
    assert.deepEqual(pruneState(root).carry, { 'tests disparus': 1 });
    rmSync(join(repo, CREATED));
    createdThenStopped(LEAD('a3'));
    rmSync(join(repo, CREATED));
    assert.deepEqual(pruneState(root).carry, { 'tests disparus': 1 });
  });

  it('dépôt disparu : retiré par la fin de tâche suivante d’une autre clé', () => {
    createdThenStopped(LEAD('a4'));
    const other = tempDir('garde-fous-l26-05-suite-');
    initRepo(other);
    rmSync(repo, { recursive: true, force: true });
    const s = stop(LEAD('b4'), other);
    assert.equal(s.code, 0, s.stderr);
    assert.deepEqual(carryDirs(), []);
    assert.match(auditLog(), /"event":"pruned".*"carry":\{"dépôt retiré":1\}/);
  });

  it('report illisible ou rangé hors de sa clé', () => {
    createdThenStopped(LEAD('a5'));
    const [file] = carryFiles();
    const data = readFileSync(join(root, 'carry', file), 'utf8');
    mkdirSync(join(root, 'carry', 'agent-autre'), { recursive: true });
    writeFileSync(join(root, 'carry', 'agent-autre', file.split('/').pop()), data);
    writeFileSync(join(root, 'carry', 'agent-autre', 'b.json'), '{');
    assert.deepEqual(pruneState(root).carry, { illisible: 2 });
    assert.deepEqual(carryFiles(), [file]);
  });
});

describe('L26-05 : reports de tests créés jamais retirés', () => {
  it('report récent au test intact : gardé, la reprise reste libre (L25-03)', () => {
    createdThenStopped(LEAD('k1'));
    assert.deepEqual(pruneState(root, { now: Date.now() + CARRY_MAX_AGE_MS - HOUR }).carry, {});
    start(LEAD('k1'));
    const e = editCreated(LEAD('k1'));
    assert.equal(e.code, 0, e.stderr);
  });

  it('un test reporté sur deux encore intact suffit à garder le report', () => {
    start(LEAD('k2'));
    const second = 'apps/web/test/pages.e2e.ts';
    for (const rel of [CREATED, second]) {
      assert.equal(tool(LEAD('k2'), 'Write', { file_path: join(repo, rel), content: 'x' }).code, 0);
      write(rel, CREATED_CONTENT);
    }
    assert.equal(stop(LEAD('k2')).code, 0);
    rmSync(join(repo, second));
    assert.deepEqual(pruneState(root).carry, {});
    start(LEAD('k2'));
    assert.equal(editCreated(LEAD('k2')).code, 0);
  });

  it('fins de tâche concurrentes d’autres clés : le report survit, la reprise reste libre', async () => {
    createdThenStopped(LEAD('k3'));
    const stops = Array.from({ length: 8 }, (_, k) =>
      hookAsync('verify', ctx(LEAD(`autre-${k}`), 'SubagentStop')),
    );
    for (const r of await Promise.all(stops)) assert.equal(r.code, 0, r.stderr);
    assert.equal(carryFiles().length, 1);
    start(LEAD('k3'));
    assert.equal(editCreated(LEAD('k3')).code, 0);
  });
});
