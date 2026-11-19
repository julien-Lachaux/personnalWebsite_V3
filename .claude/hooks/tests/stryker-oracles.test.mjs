// Oracles du test par mutation (lot 11, MUT-1) : la configuration Stryker, le projet TypeScript de
// son vérificateur et le fichier des mutants équivalents sont des configurations protégées, pour
// les hooks (lib/policy.mjs) comme pour le script d'intégrité de la CI
// (scripts/ci/check-tests-integrity.sh). Lancés par `pnpm hooks:test` (node --test).
//
// Le script d'intégrité est exercé ici, dans un dépôt git temporaire, plutôt que dans
// scripts/ci/tests/ : `pnpm integrity:test` et la CI n'y lancent qu'un fichier nommé.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { classify, isOracle } from '../lib/policy.mjs';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT = dirname(dirname(HOOKS));
const GUARD = join(HOOKS, 'guard.mjs');
const AUTHORIZE = join(HOOKS, 'authorize.mjs');
const INTEGRITY = join(ROOT, 'scripts/ci/check-tests-integrity.sh');

const STRYKER_CONFIG = "export default { testRunner: 'vitest', checkers: ['typescript'] };\n";
const TSCONFIG_STRYKER = '{ "extends": ["./tsconfig.json"] }\n';

const temps = [];
let repo;

function sh(cwd, cmd, args) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function commitAll(cwd, message) {
  sh(cwd, 'git', ['add', '-A']);
  sh(cwd, 'git', [
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

/** Dépôt temporaire : branche d'intégration v3/backend avec une configuration Stryker, puis lot/essai. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'oracles-mutation-'));
  temps.push(dir);
  repo = dir;
  sh(dir, 'git', ['init', '-q', '-b', 'v3/backend']);
  write('.gitignore', 'reports/mutation/\n');
  write('apps/api/src/app.ts', 'export const answer = 42;\n');
  write('apps/api/stryker.config.mjs', STRYKER_CONFIG);
  write('apps/api/tsconfig.stryker.json', TSCONFIG_STRYKER);
  write('packages/contracts/stryker.config.mjs', STRYKER_CONFIG);
  commitAll(dir, 'base');
  sh(dir, 'git', ['checkout', '-q', '-b', 'lot/essai']);
  return dir;
}

function tool(name, toolInput, agent, id = 'a1') {
  const input = {
    session_id: 's1',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    agent_type: agent,
    agent_id: id,
    tool_name: name,
    tool_input: toolInput,
  };
  const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
  });
  return { code: res.status, stderr: res.stderr };
}

function integrity() {
  const res = spawnSync('bash', [INTEGRITY, 'v3/backend'], { cwd: repo, encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

const p = (rel) => join(repo, rel);

beforeEach(() => {
  makeRepo();
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('Politique : fichiers du test par mutation', () => {
  it('classe la configuration Stryker, sous tous ses noms, comme configuration protégée', () => {
    for (const rel of [
      'apps/api/stryker.config.mjs',
      'packages/contracts/stryker.config.mjs',
      'apps/api/stryker.config.json',
      'apps/api/stryker.conf.json',
      'apps/api/stryker.conf.js',
      'apps/api/stryker.config.cjs',
      'apps/api/.stryker.config.mjs',
      'apps/api/.stryker.conf.json',
      'stryker.config.mjs',
    ]) {
      assert.equal(classify(rel), 'config', rel);
    }
  });

  it('protège aussi le tsconfig du vérificateur et le fichier des mutants équivalents', () => {
    assert.equal(classify('apps/api/tsconfig.stryker.json'), 'config');
    assert.equal(classify('packages/contracts/tsconfig.stryker.json'), 'config');
    assert.equal(classify('apps/api/stryker.equivalents.json'), 'config');
    assert.equal(classify('packages/contracts/stryker.equivalents.json'), 'config');
  });

  it('laisse ordinaires le code, les rapports et les autres tsconfig', () => {
    for (const rel of [
      'apps/api/src/strykerish.ts',
      'apps/api/src/mutation/stryker-like.ts',
      'apps/api/reports/mutation/mutation.json',
      'apps/api/reports/mutation/mutation.html',
      'apps/api/tsconfig.json',
      'apps/api/tsconfig.build.json',
      'docs/comptes-rendus/lot-11-mutation-mesure.md',
    ]) {
      assert.equal(isOracle(rel), false, rel);
    }
  });
});

describe('PreToolUse : configuration Stryker', () => {
  it('refuse la modification de stryker.config.mjs sans autorisation, quel que soit le rôle', () => {
    for (const agent of ['dev-api', 'lead-architecte', 'qa', 'correcteur']) {
      const r = tool(
        'Edit',
        {
          file_path: p('apps/api/stryker.config.mjs'),
          old_string: "checkers: ['typescript']",
          new_string: 'checkers: []',
        },
        agent,
      );
      assert.equal(r.code, 2, agent);
      assert.match(r.stderr, /configuration|n'écrit pas ce chemin/);
    }
  });

  it('refuse la création du fichier des mutants équivalents et la retouche du tsconfig Stryker', () => {
    assert.equal(
      tool(
        'Write',
        { file_path: p('apps/api/stryker.equivalents.json'), content: '[]\n' },
        'dev-api',
      ).code,
      2,
    );
    assert.equal(
      tool('Write', { file_path: p('apps/api/tsconfig.stryker.json'), content: '{}\n' }, 'dev-api')
        .code,
      2,
    );
    assert.equal(
      tool('Bash', { command: 'rm packages/contracts/stryker.config.mjs' }, 'dev-api').code,
      2,
    );
  });

  it('laisse écrire les rapports de mutation', () => {
    const r = tool(
      'Write',
      { file_path: p('apps/api/reports/mutation/mutation.json'), content: '{}\n' },
      'dev-api',
    );
    assert.equal(r.code, 0, r.stderr);
  });

  it('accepte une modification sous autorisation « config » du lead-architecte, sur le seul chemin listé', () => {
    const g = spawnSync(
      process.execPath,
      [
        AUTHORIZE,
        'grant',
        '--agent',
        'lead-architecte',
        '--scope',
        'config',
        '--ticket',
        'MUT-9',
        '--reason',
        'déclaration de mutants équivalents',
        '--path',
        'apps/api/stryker.equivalents.json',
      ],
      { cwd: repo, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: repo } },
    );
    assert.equal(g.status, 0, g.stderr);
    assert.equal(
      tool(
        'Write',
        { file_path: p('apps/api/stryker.equivalents.json'), content: '[]\n' },
        'lead-architecte',
        'l1',
      ).code,
      0,
    );
    assert.equal(
      tool(
        'Write',
        { file_path: p('apps/api/stryker.config.mjs'), content: 'export default {};\n' },
        'lead-architecte',
        'l1',
      ).code,
      2,
      'chemin non listé',
    );
  });
});

describe('Intégrité (CI) : configuration Stryker', () => {
  it('refuse une configuration Stryker modifiée sans Justification-test', () => {
    write('apps/api/stryker.config.mjs', "export default { testRunner: 'vitest' };\n");
    commitAll(repo, 'chore: retire le vérificateur');
    const r = integrity();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /sans Justification-test \(M\) : apps\/api\/stryker\.config\.mjs/);
  });

  it('accepte la même modification avec Justification-test', () => {
    write(
      'apps/api/stryker.config.mjs',
      "export default { testRunner: 'vitest', concurrency: 4 };\n",
    );
    commitAll(repo, 'chore: concurrence\n\nJustification-test: MUT-9 machine de CI à quatre cœurs');
    const r = integrity();
    assert.equal(r.code, 0, r.out);
  });

  it('refuse un fichier de mutants équivalents ajouté sans Justification-test', () => {
    write('packages/contracts/stryker.equivalents.json', '[]\n');
    commitAll(repo, 'chore: équivalents');
    const r = integrity();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /\(A\) : packages\/contracts\/stryker\.equivalents\.json/);
  });

  it('refuse un tsconfig du vérificateur modifié ou une configuration supprimée sans justification', () => {
    write('apps/api/tsconfig.stryker.json', '{ "compilerOptions": { "strict": false } }\n');
    sh(repo, 'git', ['rm', '-q', 'packages/contracts/stryker.config.mjs']);
    commitAll(repo, 'chore: assouplit');
    const r = integrity();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /apps\/api\/tsconfig\.stryker\.json/);
    assert.match(r.out, /\(D\) : packages\/contracts\/stryker\.config\.mjs/);
  });
});
