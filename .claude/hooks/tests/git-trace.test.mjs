// L48-01 (décision de Julien du 25 nov. 2026, point ouvert 2 du lot 25) : git écrit lui-même ses
// traces dans le fichier que nomme une variable `GIT_TRACE*` (GIT_TRACE, GIT_TRACE_PACKET,
// GIT_TRACE2, GIT_TRACE2_EVENT, GIT_TRACE2_PERF…) ou une clé `trace2.*Target`. Une valeur qui est
// un chemin est une cible d'écriture, vérifiée comme une redirection `>>` (mêmes refus sur les
// oracles) ; `0`, `false`, vide, `1`, `true` et un chiffre de descripteur sont permis ; une socket
// (`af_unix:…`) ou une valeur calculée sont refusées (illisibles). Même traitement pour
// `trace2.*Target` passée par `-c`, `--config-env`, GIT_CONFIG_PARAMETERS ou GIT_CONFIG_KEY_<n>.
// Les écritures de git sont d'abord mesurées dans un dépôt jetable (fichier créé par git), puis le
// hook complet est rejoué sur un dépôt qui contient un test existant. Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { analyzeCommand } from '../lib/shell.mjs';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(HOOKS, 'guard.mjs');
const AGENTS = join(dirname(HOOKS), 'agents');
const ROLES = readdirSync(AGENTS)
  .filter((f) => f.endsWith('.md'))
  .map((f) => /^name:\s*(\S+)\s*$/m.exec(readFileSync(join(AGENTS, f), 'utf8'))[1]);

const SPEC = 'apps/api/src/app.spec.ts';

let root;
let repo;
let project;

const ENV = () => ({
  ...process.env,
  HOME: join(root, 'home'),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'ci@noreply.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'ci@noreply.invalid',
});

function write(rel, content) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), content);
}

before(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-git-trace-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-git-trace-projet-')));
  mkdirSync(join(root, 'home'));
  repo = join(root, 'repo');
  execFileSync('git', ['init', '-q', '-b', 'develop', repo], { env: ENV() });
  write('apps/api/src/app.ts', 'export const answer = 42;\n');
  write(SPEC, "it('répond', () => {});\n");
  execFileSync('git', ['add', '-A'], { cwd: repo, env: ENV() });
  execFileSync('git', ['commit', '-q', '-m', 'base'], { cwd: repo, env: ENV() });
});

after(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

function hook(command, role) {
  const input = {
    session_id: 's-git-trace',
    cwd: repo,
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
    env: { ...ENV(), CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

/** Gabarits : %P% = destination des traces (chemin absolu). */
const FORMS = [
  'GIT_TRACE=%P% git status',
  'GIT_TRACE_SETUP=%P% git status',
  'GIT_TRACE_PERFORMANCE=%P% git status',
  'GIT_TRACE2=%P% git status',
  'GIT_TRACE2_EVENT=%P% git status',
  'GIT_TRACE2_PERF=%P% git status',
  'env GIT_TRACE2_EVENT=%P% git status',
  'export GIT_TRACE2_EVENT=%P%; git status',
  'GIT_TRACE=%P%; export GIT_TRACE; git status',
  '(export GIT_TRACE=%P%; git status)',
  'sh -c "GIT_TRACE=%P% git status"',
];

/** git ne lit trace2.*Target que dans les configurations système et globale : refus par prudence. */
const CONFIG_FORMS = [
  'git -c trace2.eventTarget=%P% status',
  'git -c TRACE2.EVENTTARGET=%P% status',
  'git -ctrace2.perfTarget=%P% status',
  'git -c trace2.normalTarget=%P% status',
  'V=%P% git --config-env trace2.eventTarget=V status',
  'V=%P% git --config-env=trace2.eventTarget=V status',
  `GIT_CONFIG_PARAMETERS="'trace2.eventTarget=%P%'" git status`,
  `GIT_CONFIG_PARAMETERS="'trace2.eventTarget'='%P%'" git status`,
  'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=trace2.eventTarget GIT_CONFIG_VALUE_0=%P% git status',
];

const fill = (t, p) => t.replaceAll('%P%', p);

describe('mesure : git écrit ses traces dans le fichier nommé', () => {
  it('GIT_TRACE, GIT_TRACE2, GIT_TRACE2_EVENT, GIT_TRACE2_PERF à un chemin absolu', () => {
    for (const name of ['GIT_TRACE', 'GIT_TRACE2', 'GIT_TRACE2_EVENT', 'GIT_TRACE2_PERF']) {
      const file = join(root, `mesure-${name}.log`);
      execFileSync('git', ['status'], { cwd: repo, env: { ...ENV(), [name]: file } });
      assert.ok(existsSync(file), `${name} : ${file} non écrit`);
    }
  });

  it('un dossier reçoit un fichier par processus (trace2)', () => {
    const dir = join(root, 'mesure-dossier');
    mkdirSync(dir);
    execFileSync('git', ['status'], { cwd: repo, env: { ...ENV(), GIT_TRACE2_EVENT: dir } });
    assert.equal(readdirSync(dir).length, 1);
  });

  it('trace2.eventTarget de la configuration globale', () => {
    const file = join(root, 'mesure-globale.log');
    const config = join(root, 'globale.gitconfig');
    writeFileSync(config, `[trace2]\n\teventTarget = ${file}\n`);
    execFileSync('git', ['status'], { cwd: repo, env: { ...ENV(), GIT_CONFIG_GLOBAL: config } });
    assert.ok(existsSync(file));
  });
});

describe('cible d’écriture : destination des traces', () => {
  it('un chemin absolu ou relatif est une cible, relative au dossier courant ou à -C', () => {
    const file = join(root, 'trace.log');
    for (const command of [...FORMS, ...CONFIG_FORMS].map((t) => fill(t, file))) {
      const a = analyzeCommand(command, repo, 'dev-api');
      assert.equal(a.deny, null, command);
      assert.ok(
        a.targets.some((t) => t.path === file),
        `${command} : ${JSON.stringify(a.targets)}`,
      );
    }
    const rel = analyzeCommand('GIT_TRACE=traces/t.log git status', repo, 'dev-api');
    assert.deepEqual(rel.targets, [{ path: 'traces/t.log', base: repo }]);
    const moved = analyzeCommand('git -C apps -c trace2.eventTarget=t.log status', repo, 'qa');
    assert.deepEqual(moved.targets, [{ path: 't.log', base: join(repo, 'apps') }]);
    const cd = analyzeCommand('cd apps && GIT_TRACE2_PERF=./t.log git status', repo, 'qa');
    assert.deepEqual(cd.targets, [{ path: './t.log', base: join(repo, 'apps') }]);
  });

  const neutral = ['0', 'false', 'FALSE', '', '1', 'true', 'True', '2', '5', '9'];
  it('désactivée, sortie d’erreur ou descripteur : permis, sans cible', () => {
    for (const v of neutral) {
      for (const command of [
        `GIT_TRACE=${v} git status`,
        `GIT_TRACE2_EVENT=${v} git status`,
        `export GIT_TRACE_PACKET=${v}; git status`,
        `git -c trace2.perfTarget=${v} status`,
        `GIT_CONFIG_PARAMETERS="'trace2.eventTarget=${v}'" git status`,
      ]) {
        const a = analyzeCommand(command, repo, 'dev-api');
        assert.equal(a.deny, null, command);
        assert.deepEqual(a.targets, [], command);
      }
    }
    for (const role of ['main', 'dev-api']) {
      for (const command of ['GIT_TRACE=1 git status', 'GIT_TRACE2_PERF=2 git status']) {
        const r = hook(command, role);
        assert.equal(r.code, 0, `${role} : ${command} : ${r.stderr}`);
      }
    }
  });

  it('réglages des traces sans destination : ni cible ni refus', () => {
    for (const command of [
      "GIT_TRACE2_ENV_VARS='GIT_*' git status",
      "GIT_TRACE2_CONFIG_PARAMS='core.*' git status",
      'GIT_TRACE2_EVENT_NESTING=5 git status',
      'GIT_TRACE2_BRIEF=1 GIT_TRACE2_PERF_BRIEF=1 GIT_TRACE2_EVENT_BRIEF=1 git status',
      'GIT_TRACE2_MAX_FILES=10 GIT_TRACE2_DST_DEBUG=1 git status',
      'GIT_TRACE2_PARENT_SID=x GIT_TRACE2_PARENT_NAME=y GIT_TRACE2_REDACT=0 git status',
      'GIT_TRACE_CURL_NO_DATA=1 GIT_TRACE_REDACT=0 git status',
      'git -c trace2.eventNesting=5 -c trace2.configParams=core.x status',
    ]) {
      const a = analyzeCommand(command, repo, 'dev-api');
      assert.equal(a.deny, null, command);
      assert.deepEqual(a.targets, [], command);
    }
  });
});

describe('refus sur les oracles, comme une redirection', () => {
  it('un test existant ou un dossier d’oracles ne reçoit pas de traces', () => {
    const forms = [...FORMS, ...CONFIG_FORMS];
    for (const p of [join(repo, SPEC), join(repo, 'apps/api/src')]) {
      for (const command of forms.map((t) => fill(t, p))) {
        for (const role of ['main', 'dev-api']) {
          const r = hook(command, role);
          assert.equal(r.code, 2, `${role} : ${command}`);
          assert.match(r.stderr, /test existant|dossier qui contient des oracles/, command);
        }
      }
    }
    for (const command of [
      `GIT_TRACE=${SPEC} git status`,
      `git -c trace2.eventTarget=./${SPEC} status`,
    ]) {
      const r = hook(command, 'dev-api');
      assert.equal(r.code, 2, command);
    }
  });

  it('la même trace hors oracle est permise', () => {
    const file = join(root, 'permis.log');
    for (const command of [...FORMS, ...CONFIG_FORMS].map((t) => fill(t, file))) {
      const r = hook(command, 'dev-api');
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });
});

describe('illisible, donc refusé', () => {
  const illegible = [
    'GIT_TRACE=af_unix:/tmp/s git status',
    'GIT_TRACE2_EVENT=af_unix:stream:/tmp/s git status',
    'git -c trace2.eventTarget=af_unix:dgram:/tmp/s status',
    `GIT_CONFIG_PARAMETERS="'trace2.eventTarget=af_unix:/tmp/s'" git status`,
    'GIT_TRACE=$X git status',
    'GIT_TRACE2_PERF="$(mktemp)" git status',
    'export GIT_TRACE2_EVENT=$X; git status',
    'GIT_TRACE+=/tmp/t git status',
    'read GIT_TRACE; git status',
    'printf -v GIT_TRACE2 %s /tmp/t; git status',
    'declare -n R=GIT_TRACE; R=/tmp/t git status',
    'for GIT_TRACE in /tmp/t; do git status; done',
    'git -c trace2.eventTarget=$X status',
    'git --config-env trace2.eventTarget=ABSENTE status',
    'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=trace2.eventTarget git status',
    'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=trace2.eventTarget GIT_CONFIG_VALUE_0=$X git status',
  ];
  for (const role of ['main', ...ROLES]) {
    it(`refuse au rôle ${role} une socket ou une destination calculée`, () => {
      for (const command of illegible) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.match(deny ?? '', /illisible/, `${role} : ${command}`);
      }
    });
  }
});
