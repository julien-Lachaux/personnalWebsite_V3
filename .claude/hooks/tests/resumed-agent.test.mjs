// L25-03 (faux positif signalé par la session front le 21 nov. 2026) : un agent mis en pause puis
// repris (le même agent_id, relancé par un message) voyait les tests qu'il avait créés avant la
// pause traités comme des tests existants. Cause : la fin de tâche réussie (SubagentStop, Stop)
// supprime l'instantané ; à la reprise, l'instantané est repris (SubagentStart, ou instantané
// paresseux du premier outil) et relève ces fichiers non suivis comme présents au démarrage.
// Cas réel : worktree lot-F7-annexes, apps/web/app/error.spec.ts et suivants, levé par
// l'autorisation c67011fa.
// Correction : la fin de tâche réussie reporte, pour la même clé (agent ou session) et le même
// dépôt, les tests créés pendant la tâche avec leur empreinte ; le prochain instantané de cette
// clé les laisse libres s'ils n'ont pas changé depuis. Refus d'abord : un test non suivi présent
// avant le premier démarrage reste protégé, un autre agent ne profite pas du report, un test
// créé puis modifié par un autre pendant la pause redevient protégé.
// L'état des hooks vit dans un dossier de projet temporaire distinct du dépôt.
// Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');

/** Test non suivi présent avant le premier démarrage de l'agent. */
const BEFORE = 'apps/web/app/brouillon.spec.ts';
/** Test créé par l'agent pendant sa première tâche (comme apps/web/app/error.spec.ts). */
const CREATED = 'apps/web/app/error.spec.ts';
const SECOND = 'apps/web/test/pages.e2e.ts';

const temps = [];
let repo;
let project;

const tempDir = (prefix) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  temps.push(dir);
  return dir;
};

function git(...args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function write(rel, content) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), content);
}

function commitAll(message) {
  git('add', '-A');
  git('-c', 'user.name=Test', '-c', 'user.email=ci@noreply.invalid', 'commit', '-q', '-m', message);
}

function hook(mode, input) {
  const res = spawnSync(process.execPath, [GUARD, mode], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

const base = (id, event, agent = 'lead-architecte') =>
  id === 'main'
    ? { session_id: 's-l25-03', cwd: repo, hook_event_name: event, stop_hook_active: false }
    : {
        session_id: 's-l25-03',
        cwd: repo,
        hook_event_name: event,
        agent_type: agent,
        agent_id: id,
        stop_hook_active: false,
      };

const start = (id) => assert.equal(hook('subagent-start', base(id, 'SubagentStart')).code, 0);
const stop = (id) => hook('verify', base(id, id === 'main' ? 'Stop' : 'SubagentStop'));
const tool = (id, name, input) =>
  hook('pre-tool-use', { ...base(id, 'PreToolUse'), tool_name: name, tool_input: input });
const create = (id, rel) =>
  tool(id, 'Write', { file_path: join(repo, rel), content: "it('créé', () => {});\n" });
const edit = (id, rel) =>
  tool(id, 'Edit', { file_path: join(repo, rel), old_string: "it('", new_string: "it('x" });
const append = (id, rel) =>
  tool(id, 'Bash', { command: `echo "// suite" >> ${rel}`, description: 'test' });

/** Première tâche : l'agent crée CREATED (le hook l'autorise, le fichier est écrit), puis s'arrête. */
function firstRun(id, { withStart = true } = {}) {
  if (withStart) start(id);
  const w = create(id, CREATED);
  assert.equal(w.code, 0, w.stderr);
  write(CREATED, "it('créé', () => {});\n");
  const s = stop(id);
  assert.equal(s.code, 0, s.stderr);
}

beforeEach(() => {
  repo = tempDir('garde-fous-l25-03-');
  project = tempDir('garde-fous-l25-03-projet-');
  git('init', '-q', '-b', 'lot/F7-annexes');
  write('apps/web/app/app.vue', '<template><main /></template>\n');
  write('apps/web/app/app.spec.ts', "it('monte', () => {});\n");
  commitAll('base');
  write(BEFORE, "it('brouillon', () => {});\n");
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('L25-03 : reprise d’un agent, refus (ce qui était protégé le reste)', () => {
  it('un test non suivi présent avant le premier démarrage reste protégé après la reprise', () => {
    firstRun('a1');
    start('a1');
    const e = edit('a1', BEFORE);
    assert.equal(e.code, 2, e.stderr);
    assert.match(e.stderr, /modification d’un test existant/);
    const b = append('a1', BEFORE);
    assert.equal(b.code, 2, b.stderr);
    write(BEFORE, "it('brouillon modifié', () => {});\n");
    const s = stop('a1');
    assert.equal(s.code, 2, s.stderr);
    assert.match(s.stderr, /brouillon\.spec\.ts : oracle modifié/);
  });

  it('un test suivi reste protégé après la reprise', () => {
    firstRun('a2');
    start('a2');
    assert.equal(edit('a2', 'apps/web/app/app.spec.ts').code, 2);
  });

  it('un autre agent ne profite pas du report : le test créé par a3 est existant pour b3', () => {
    firstRun('a3');
    start('b3');
    const e = edit('b3', CREATED);
    assert.equal(e.code, 2, e.stderr);
    assert.match(e.stderr, /modification d’un test existant/);
    write(CREATED, "it('modifié par b3', () => {});\n");
    assert.equal(stop('b3').code, 2);
  });

  it('un test créé puis modifié par un autre pendant la pause redevient protégé', () => {
    firstRun('a4');
    write(CREATED, "it('modifié pendant la pause', () => {});\n");
    start('a4');
    const e = edit('a4', CREATED);
    assert.equal(e.code, 2, e.stderr);
    assert.match(e.stderr, /modification d’un test existant/);
  });

  it('le report ne vaut que pour le dépôt de la tâche', () => {
    firstRun('a5');
    const other = tempDir('garde-fous-l25-03-autre-');
    execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: other });
    mkdirSync(join(other, 'apps/web/app'), { recursive: true });
    writeFileSync(join(other, CREATED), "it('créé', () => {});\n");
    const e = hook('pre-tool-use', {
      ...base('a5', 'PreToolUse'),
      cwd: other,
      tool_name: 'Edit',
      tool_input: { file_path: join(other, CREATED), old_string: "it('", new_string: "it('x" },
    });
    assert.equal(e.code, 2, e.stderr);
  });

  it('une fin de tâche refusée garde l’instantané : rien n’est reporté ni blanchi', () => {
    start('a6');
    assert.equal(create('a6', CREATED).code, 0);
    write(CREATED, "it('créé', () => {});\n");
    write(BEFORE, "it('brouillon modifié', () => {});\n");
    assert.equal(stop('a6').code, 2);
    start('a6');
    assert.equal(edit('a6', CREATED).code, 0);
    assert.equal(stop('a6').code, 2, 'le brouillon modifié reste signalé');
  });
});

describe('L25-03 : reprise d’un agent, test créé pendant la tâche libre', () => {
  it('reprise par SubagentStart : Edit, Write et le shell restent libres, fin de tâche acceptée', () => {
    firstRun('r1');
    start('r1');
    const e = edit('r1', CREATED);
    assert.equal(e.code, 0, e.stderr);
    assert.equal(create('r1', CREATED).code, 0);
    const b = append('r1', CREATED);
    assert.equal(b.code, 0, b.stderr);
    write(CREATED, "it('créé puis modifié après la reprise', () => {});\n");
    const s = stop('r1');
    assert.equal(s.code, 0, s.stderr);
  });

  it('reprise sans SubagentStart (instantané paresseux du premier outil)', () => {
    firstRun('r2');
    const e = edit('r2', CREATED);
    assert.equal(e.code, 0, e.stderr);
  });

  it('plusieurs reprises : chaque test créé reste libre', () => {
    firstRun('r3');
    start('r3');
    assert.equal(create('r3', SECOND).code, 0);
    write(SECOND, "test('pages', () => {});\n");
    assert.equal(stop('r3').code, 0);
    start('r3');
    assert.equal(edit('r3', CREATED).code, 0);
    assert.equal(append('r3', SECOND).code, 0);
  });

  it('test créé, commité par l’agent, puis repris : toujours libre', () => {
    start('r4');
    assert.equal(create('r4', CREATED).code, 0);
    write(CREATED, "it('créé', () => {});\n");
    commitAll('test(web): page d’erreur');
    assert.equal(stop('r4').code, 0);
    start('r4');
    assert.equal(edit('r4', CREATED).code, 0);
    write(CREATED, "it('créé puis corrigé', () => {});\n");
    const s = stop('r4');
    assert.equal(s.code, 0, s.stderr);
  });

  it('session principale : un test créé lors d’un tour reste libre au tour suivant', () => {
    assert.equal(hook('session-start', base('main', 'SessionStart')).code, 0);
    assert.equal(create('main', CREATED).code, 0);
    write(CREATED, "it('créé', () => {});\n");
    assert.equal(stop('main').code, 0);
    const e = edit('main', CREATED);
    assert.equal(e.code, 0, e.stderr);
  });
});
