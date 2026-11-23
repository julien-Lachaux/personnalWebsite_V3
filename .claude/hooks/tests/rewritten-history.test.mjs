// L25-02 (L19-06, décision de Julien du 21 nov. 2026) : la vérification de fin de tâche retrouve
// le commit justifié quand l'historique de la branche a été réécrit après l'instantané (`git reset`
// puis de nouveaux commits : la tête de l'instantané n'est plus ancêtre de HEAD ; cas réel du
// 21 nov. sur lot/20-ci). Règle : les commits de HEAD non atteignables depuis la base commune
// (merge-base de la tête de l'instantané et de HEAD) sont ceux de la branche réécrite ; un oracle
// changé n'est accepté que si son contenu, identique à HEAD et sur le disque, est exactement celui
// qu'un de ces commits, portant une ligne Justification-test, lui a donné (ou si ce commit l'a
// supprimé). Tests de refus d'abord : aucune modification non justifiée ne devient acceptée.
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

const TEST = 'apps/api/src/app.spec.ts';
const WORKFLOW = '.github/workflows/revue-pr.yml';
const JUSTIFIED = 'fix: test\n\nJustification-test: L25-02 test établi faux par le triage';

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
  }).trim();
}

function write(rel, content) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), content);
}

function commit(message, ...paths) {
  git('add', '-A', ...paths);
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=ci@noreply.invalid',
    'commit',
    '-q',
    '--no-gpg-sign',
    '--allow-empty',
    '-m',
    message,
  );
  return git('rev-parse', 'HEAD');
}

function hook(mode, extra = {}) {
  const res = spawnSync(process.execPath, [GUARD, mode], {
    input: JSON.stringify({
      session_id: 's-l25-02',
      cwd: repo,
      hook_event_name: mode === 'verify' ? 'SubagentStop' : 'SubagentStart',
      agent_type: 'dev-devops',
      agent_id: 'reecriture',
      stop_hook_active: false,
      ...extra,
    }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

const start = () => assert.equal(hook('subagent-start').code, 0);
/** Fin de tâche : code 0 (acceptée) ou 2 (refusée, avec la liste des oracles). */
const stop = () => hook('verify');

let first;

beforeEach(() => {
  repo = tempDir('garde-fous-l25-02-');
  project = tempDir('garde-fous-l25-02-projet-');
  git('init', '-q', '-b', 'lot/20-ci');
  write('apps/api/src/app.ts', 'export const answer = 42;\n');
  write(TEST, "it('répond', () => {});\n");
  write(WORKFLOW, 'name: revue\n');
  first = commit('base');
  write('docs/a.md', 'a\n');
  commit('docs: a');
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('L25-02 : historique réécrit, refus (aucune modification non justifiée acceptée)', () => {
  it('refuse un test modifié et commité sans justification après git reset', () => {
    start();
    git('reset', '-q', '--mixed', first);
    write(TEST, "it('répond autrement', () => {});\n");
    commit('fix: test sans justification');
    const r = stop();
    assert.equal(r.code, 2, r.stderr);
    assert.match(r.stderr, /apps\/api\/src\/app\.spec\.ts : oracle modifié/);
  });

  it('refuse un test dont le contenu sur le disque diffère du commit justifié', () => {
    start();
    git('reset', '-q', '--mixed', first);
    write(TEST, "it('justifié', () => {});\n");
    commit(JUSTIFIED);
    write(TEST, "it('retouché ensuite', () => {});\n");
    assert.equal(stop().code, 2);
  });

  it('refuse un test changé par un commit non justifié après le commit justifié', () => {
    start();
    git('reset', '-q', '--mixed', first);
    write(TEST, "it('justifié', () => {});\n");
    commit(JUSTIFIED);
    write(TEST, "it('changé sans justification', () => {});\n");
    commit('style: test');
    assert.equal(stop().code, 2);
  });

  it('refuse un contenu justifié seulement dans l’historique abandonné par le reset', () => {
    start();
    write(TEST, "it('justifié puis abandonné', () => {});\n");
    commit(JUSTIFIED);
    git('reset', '-q', '--mixed', first);
    commit('fix: même contenu, sans justification');
    const r = stop();
    assert.equal(r.code, 2, r.stderr);
  });

  it('refuse le retour à un contenu justifié avant la base commune', () => {
    write(TEST, "it('version justifiée ancienne', () => {});\n");
    const old = commit(JUSTIFIED);
    write(TEST, "it('version actuelle', () => {});\n");
    commit('fix: version actuelle\n\nJustification-test: L25-02 avant l’instantané');
    start();
    git('reset', '-q', '--hard', old);
    const r = stop();
    assert.equal(r.code, 2, r.stderr);
  });

  it('refuse un commit justifié d’un historique sans base commune', () => {
    start();
    git('checkout', '-q', '--orphan', 'orpheline');
    write(TEST, "it('orphelin', () => {});\n");
    commit(JUSTIFIED);
    assert.equal(stop().code, 2);
  });

  it('refuse une configuration protégée modifiée sans justification après git reset', () => {
    start();
    git('reset', '-q', '--mixed', first);
    write(WORKFLOW, 'name: revue modifiée\n');
    commit('ci: revue');
    const r = stop();
    assert.equal(r.code, 2, r.stderr);
    assert.match(r.stderr, /revue-pr\.yml : oracle modifié/);
  });
});

describe('L25-02 : historique réécrit, commit justifié retrouvé', () => {
  it('accepte un test modifié et commité avec justification après git reset --mixed', () => {
    start();
    git('reset', '-q', '--mixed', first);
    write(TEST, "it('répond autrement', () => {});\n");
    commit(JUSTIFIED);
    const r = stop();
    assert.equal(r.code, 0, r.stderr);
  });

  it('accepte le contenu justifié suivi d’autres commits qui ne touchent pas le test', () => {
    start();
    git('reset', '-q', '--mixed', first);
    write(TEST, "it('justifié', () => {});\n");
    commit(JUSTIFIED);
    write('docs/b.md', 'b\n');
    commit('docs: b');
    assert.equal(stop().code, 0);
  });

  it('accepte un test supprimé par un commit justifié après git reset', () => {
    start();
    git('reset', '-q', '--mixed', first);
    git('rm', '-q', TEST);
    commit(JUSTIFIED);
    const r = stop();
    assert.equal(r.code, 0, r.stderr);
  });

  it('cas du 21 nov. : workflow commité justifié, reset --mixed puis commité de nouveau', () => {
    start();
    write(WORKFLOW, 'name: revue modifiée\n');
    commit('ci: revue\n\nJustification-test: L20-05 revue après la CI');
    git('reset', '-q', '--mixed', 'HEAD~2');
    commit('ci: revue (réécrit)\n\nJustification-test: L20-05 revue après la CI');
    const r = stop();
    assert.equal(r.code, 0, r.stderr);
  });

  it('garde la règle de l’ancêtre quand l’historique n’est pas réécrit', () => {
    start();
    write(TEST, "it('justifié', () => {});\n");
    commit(JUSTIFIED);
    assert.equal(stop().code, 0);
  });
});
