// L25-04 : alerte de fin de tâche attribuée à la session principale pour un fichier modifié par un
// sous-agent sous sa propre autorisation, avant son commit justifié, parce que la session
// principale avait photographié le worktree (cas réel du 21 nov. 2026 : revue-pr.yml, dev-devops
// sous l'autorisation 28fd51ee, trois alertes de la session principale avant le commit).
// Règle : le hook PreToolUse d'un Edit, MultiEdit ou Write autorisé relève l'empreinte exacte du
// contenu qu'il produit (state/authorized-writes.jsonl : dépôt, chemin, empreinte, clé, autorisation,
// portée). La fin de tâche d'une autre clé n'alerte pas pour un oracle dont le contenu actuel est
// exactement celui-là, écrit depuis son instantané, sous une autorisation de la même portée non
// révoquée ; l'attribution est journalisée. Tout autre contenu reste une alerte : modification par
// la clé vérifiée après celle de l'agent autorisé, écriture shell (contenu inconnu), suppression,
// autorisation révoquée, autre dépôt, édition dont le résultat n'est pas exactement connu.
// L'état des hooks vit dans un dossier de projet temporaire distinct du dépôt.
// Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(HOOKS, 'guard.mjs');
const AUTHORIZE = join(HOOKS, 'authorize.mjs');

const WORKFLOW = '.github/workflows/revue-pr.yml';
const ORIGINAL = 'name: revue\non: pull_request\n';
const EDITED = 'name: revue\non: workflow_run\n';

const temps = [];
let repo;
let project;
let grantId;

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
  sh(dir, 'init', '-q', '-b', 'lot/20-ci');
  write(WORKFLOW, ORIGINAL, dir);
  write('docs/a.md', 'a\n', dir);
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

function hook(mode, input) {
  const res = spawnSync(process.execPath, [GUARD, mode], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

function authorize(...args) {
  const res = spawnSync(process.execPath, [AUTHORIZE, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  assert.equal(res.status, 0, res.stderr);
  return res.stdout;
}

/** Contexte d'une clé : 'main' (session principale) ou un agent (rôle, identifiant). */
const ctx = (who, event, cwd = repo) =>
  who === 'main'
    ? { session_id: 's-l25-04', cwd, hook_event_name: event, stop_hook_active: false }
    : {
        session_id: 's-l25-04',
        cwd,
        hook_event_name: event,
        agent_type: who.role,
        agent_id: who.id,
        stop_hook_active: false,
      };

const MAIN = 'main';
const DEVOPS = { role: 'dev-devops', id: 'devops-1' };
const REVIEW = { role: 'revue-code', id: 'revue-1' };

const start = (who, cwd = repo) =>
  assert.equal(
    hook(who === MAIN ? 'session-start' : 'subagent-start', ctx(who, 'Start', cwd)).code,
    0,
  );
const stop = (who) => hook('verify', ctx(who, who === MAIN ? 'Stop' : 'SubagentStop'));
const tool = (who, name, input, cwd = repo) =>
  hook('pre-tool-use', { ...ctx(who, 'PreToolUse', cwd), tool_name: name, tool_input: input });

/** Edit autorisé de dev-devops, puis l'écriture que l'outil aurait faite. */
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

const auditLog = () => {
  const path = join(project, '.claude', 'hooks', 'audit.log');
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
};

beforeEach(() => {
  repo = tempDir('garde-fous-l25-04-');
  project = tempDir('garde-fous-l25-04-projet-');
  initRepo(repo);
  const out = authorize(
    'grant',
    '--agent',
    'dev-devops',
    '--scope',
    'config',
    '--ticket',
    'L20-05',
    '--reason',
    'workflow de revue',
    '--path',
    WORKFLOW,
  );
  grantId = /autorisation (\S+) :/.exec(out)[1];
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('L25-04 : modification par un autre agent autorisé, refus (l’alerte reste)', () => {
  it('la session principale qui modifie ensuite le fichier reste signalée', () => {
    start(MAIN);
    devopsEdit();
    write(WORKFLOW, `${EDITED}# ajout de la session principale\n`);
    const r = stop(MAIN);
    assert.equal(r.code, 2, r.stderr);
    assert.match(r.stderr, /revue-pr\.yml : oracle modifié/);
  });

  it('un contenu différent de celui de l’écriture autorisée reste signalé', () => {
    start(MAIN);
    const r = tool(DEVOPS, 'Edit', {
      file_path: join(repo, WORKFLOW),
      old_string: 'pull_request',
      new_string: 'workflow_run',
    });
    assert.equal(r.code, 0, r.stderr);
    write(WORKFLOW, 'name: autre contenu\n');
    assert.equal(stop(MAIN).code, 2);
  });

  it('une écriture shell autorisée (contenu inconnu du hook) reste signalée', () => {
    start(MAIN);
    const r = tool(DEVOPS, 'Bash', {
      command: `sed -i 's/pull_request/workflow_run/' ${WORKFLOW}`,
      description: 'test',
    });
    assert.equal(r.code, 0, r.stderr);
    write(WORKFLOW, EDITED);
    assert.equal(stop(MAIN).code, 2);
  });

  it('une suppression reste signalée', () => {
    start(MAIN);
    devopsEdit();
    rmSync(join(repo, WORKFLOW));
    const r = stop(MAIN);
    assert.equal(r.code, 2, r.stderr);
    assert.match(r.stderr, /oracle supprimé/);
  });

  it('une autorisation révoquée depuis ne couvre plus l’écriture', () => {
    start(MAIN);
    devopsEdit();
    authorize('revoke', '--id', grantId);
    assert.equal(stop(MAIN).code, 2);
  });

  it('une écriture autorisée dans un autre dépôt ne compte pas', () => {
    const other = tempDir('garde-fous-l25-04-autre-');
    initRepo(other);
    start(MAIN);
    devopsEdit(other);
    write(WORKFLOW, EDITED);
    assert.equal(stop(MAIN).code, 2);
  });

  it('une écriture autorisée avant l’instantané ne couvre pas un changement postérieur', () => {
    devopsEdit();
    write(WORKFLOW, ORIGINAL);
    start(MAIN);
    write(WORKFLOW, EDITED);
    assert.equal(stop(MAIN).code, 2);
  });

  it('un Edit dont le résultat n’est pas exactement connu (texte absent) ne relève rien', () => {
    start(MAIN);
    const r = tool(DEVOPS, 'Edit', {
      file_path: join(repo, WORKFLOW),
      old_string: 'absent du fichier',
      new_string: 'workflow_run',
    });
    assert.equal(r.code, 0, r.stderr);
    write(WORKFLOW, `${ORIGINAL}\nworkflow_run`);
    assert.equal(stop(MAIN).code, 2);
  });

  it('un agent sans autorisation n’écrit toujours pas le fichier lui-même', () => {
    start(REVIEW);
    const r = tool(REVIEW, 'Write', { file_path: join(repo, WORKFLOW), content: EDITED });
    assert.equal(r.code, 2, r.stderr);
  });
});

describe('L25-04 : modification par un autre agent autorisé, attribuée à cet agent', () => {
  it('cas du 21 nov. : Edit de dev-devops, fin de tour de la session principale acceptée', () => {
    start(MAIN);
    devopsEdit();
    const r = stop(MAIN);
    assert.equal(r.code, 0, r.stderr);
    assert.match(auditLog(), /"event":"attributed".*revue-pr\.yml.*"by":"agent-devops-1"/);
  });

  it('Write autorisé de dev-devops, fin de tâche d’un autre agent acceptée', () => {
    start(REVIEW);
    const w = tool(DEVOPS, 'Write', { file_path: join(repo, WORKFLOW), content: EDITED });
    assert.equal(w.code, 0, w.stderr);
    write(WORKFLOW, EDITED);
    const r = stop(REVIEW);
    assert.equal(r.code, 0, r.stderr);
  });

  it('plusieurs Edit successifs : seul le dernier contenu compte, il est accepté', () => {
    start(MAIN);
    devopsEdit();
    const r = tool(DEVOPS, 'Edit', {
      file_path: join(repo, WORKFLOW),
      old_string: 'name: revue',
      new_string: 'name: revue PR',
    });
    assert.equal(r.code, 0, r.stderr);
    write(WORKFLOW, EDITED.replace('name: revue', 'name: revue PR'));
    assert.equal(stop(MAIN).code, 0);
  });

  it('l’agent autorisé garde sa propre fin de tâche acceptée', () => {
    start(DEVOPS);
    devopsEdit();
    assert.equal(stop(DEVOPS).code, 0);
  });
});
