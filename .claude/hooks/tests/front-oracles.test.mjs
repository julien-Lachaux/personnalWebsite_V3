// Oracles du front (lot F0, F0-06) : configurations Vitest, Playwright et Stryker d'apps/web,
// parcours `*.e2e.ts`, tests de composants, fixtures, captures attendues de Playwright et captures
// de référence du handoff de design sont protégés par les hooks (lib/policy.mjs) comme par le
// script d'intégrité de la CI (scripts/ci/check-tests-integrity.sh) ; rôles qa-front et revue-a11y
// limités à leurs chemins. Lancés par `pnpm hooks:test` (node --test).

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { classify, countMarkers, GRANTABLE, isOracle, roleMayWrite } from '../lib/policy.mjs';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT = dirname(dirname(HOOKS));
const GUARD = join(HOOKS, 'guard.mjs');
const INTEGRITY = join(ROOT, 'scripts/ci/check-tests-integrity.sh');

const REFERENCE = 'apps/web/design/handoff-v6/design/reference/desktop-1280_mosaique_clair.png';
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

/** Dépôt temporaire : develop avec un front minimal (tests, configurations, capture), puis lot/essai. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'oracles-front-'));
  temps.push(dir);
  repo = dir;
  sh(dir, 'git', ['init', '-q', '-b', 'develop']);
  write('apps/web/app/pages/index.vue', '<template><h1>Accueil</h1></template>\n');
  write('apps/web/app/pages/index.spec.ts', "it('h1', () => {});\n");
  write('apps/web/test/smoke.e2e.ts', "test('fumée', async () => {});\n");
  write('apps/web/test/visual.e2e.ts-snapshots/desktop-1280.png', 'png attendu\n');
  write('apps/web/vitest.config.ts', 'export default { test: {} };\n');
  write('apps/web/playwright.config.ts', 'export default { retries: 0 };\n');
  write('apps/web/stryker.config.mjs', 'export default { thresholds: { break: 100 } };\n');
  write(REFERENCE, 'png de référence\n');
  write('apps/web/package.json', '{\n  "scripts": {\n    "test:e2e": "playwright test"\n  }\n}\n');
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
  const res = spawnSync('bash', [INTEGRITY, 'develop'], { cwd: repo, encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

const p = (rel) => join(repo, rel);
const JUSTIFIED =
  'test(web): retouche\n\nJustification-test: F8-3 capture établie fausse par le triage';

beforeEach(() => {
  makeRepo();
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('Politique : oracles du front', () => {
  it('classe les configurations Vitest, Playwright, Stryker et turbo.json de paquet comme protégées', () => {
    for (const rel of [
      'apps/web/vitest.config.ts',
      'apps/web/playwright.config.ts',
      'apps/web/playwright.visual.config.mjs',
      'apps/web/stryker.config.mjs',
      'apps/web/turbo.json',
    ]) {
      assert.equal(classify(rel), 'config', rel);
    }
  });

  it('classe parcours, tests de composants, fixtures et captures comme tests', () => {
    for (const rel of [
      'apps/web/test/smoke.e2e.ts',
      'apps/web/test/support/serve.ts',
      'apps/web/app/pages/index.spec.ts',
      'apps/web/app/domain/filter.spec.ts',
      'apps/web/app/data/fixtures/cv-fr.json',
      'apps/web/app/data/cv.fixtures.ts',
      'apps/web/test/visual.e2e.ts-snapshots/desktop-1280.png',
      REFERENCE,
    ]) {
      assert.equal(classify(rel), 'test', rel);
    }
  });

  it('laisse ordinaires le code du front, sa configuration Nuxt et le reste du handoff', () => {
    for (const rel of [
      'apps/web/app/domain/filter.ts',
      'apps/web/app/components/base/Button.vue',
      'apps/web/nuxt.config.ts',
      'apps/web/design/handoff-v6/SPEC.md',
    ]) {
      assert.equal(isOracle(rel), false, rel);
    }
  });

  it('limite qa-front aux tests et revue-a11y à docs/revues ; qa-front reçoit tests et fails', () => {
    assert.equal(roleMayWrite('qa-front', 'apps/web/test/parcours.e2e.ts'), true);
    assert.equal(roleMayWrite('qa-front', 'apps/web/app/components/x/X.spec.ts'), true);
    assert.equal(roleMayWrite('qa-front', 'apps/web/app/domain/filter.ts'), false);
    assert.equal(roleMayWrite('qa-front', REFERENCE), false);
    assert.equal(roleMayWrite('revue-a11y', 'docs/revues/a11y-2026-11-19.md'), true);
    assert.equal(roleMayWrite('revue-a11y', 'apps/web/app/app.vue'), false);
    // Portées déstructurées : `GRANTABLE` suivi de la portée d'échec attendu et d'un appel serait
    // pris pour un marqueur par le script d'intégrité.
    const { tests: testsScope, fails: expectedFailureScope, config: configScope } = GRANTABLE;
    assert.ok(testsScope.includes('qa-front'));
    assert.ok(expectedFailureScope.includes('qa-front'));
    assert.equal(configScope.includes('qa-front'), false);
  });
});

describe('Politique : marqueurs de Playwright', () => {
  // Construits à l'exécution : ce fichier ne contient aucun marqueur littéral.
  const t = 'test';
  it('compte fixme et slow comme interdits, fail comme échec attendu', () => {
    assert.equal(countMarkers(`${t}.fix` + "me('x', async () => {});").forbidden, 1);
    assert.equal(countMarkers(`${t}.describe.fix` + "me('g', () => {});").forbidden, 1);
    assert.equal(countMarkers(`${t}.sl` + 'ow();').forbidden, 1);
    assert.equal(countMarkers(`${t}.fa` + "il('BUG-F1', async () => {});").fails, 1);
    assert.equal(countMarkers(`${t}.describe.serial.fa` + "il('BUG-F2', () => {});").fails, 1);
  });

  it('laisse l’appel du même nom sur expect ou assert', () => {
    for (const text of [
      'expect.fa' + "il('m');",
      'assert.fa' + "il('m');",
      'contest.fa' + "il('m');",
    ]) {
      const c = countMarkers(text);
      assert.equal(c.forbidden + c.fails, 0, text);
    }
  });
});

describe('Hooks : écritures sur les oracles du front', () => {
  it('refuse la modification d’un parcours ou d’un test de composant existant (dev-front)', () => {
    const e2e = tool(
      'Edit',
      { file_path: p('apps/web/test/smoke.e2e.ts'), old_string: 'fumée', new_string: 'vide' },
      'dev-front',
    );
    assert.equal(e2e.code, 2, e2e.stderr);
    assert.match(e2e.stderr, /test existant/);
    const spec = tool(
      'Write',
      { file_path: p('apps/web/app/pages/index.spec.ts'), content: "it('vide', () => {});\n" },
      'dev-front',
    );
    assert.equal(spec.code, 2, spec.stderr);
  });

  it('accepte la création d’un nouveau parcours', () => {
    const r = tool(
      'Write',
      { file_path: p('apps/web/test/filtre.e2e.ts'), content: "test('filtre', async () => {});\n" },
      'dev-front',
    );
    assert.equal(r.code, 0, r.stderr);
  });

  it('refuse sans autorisation la configuration Playwright, une capture attendue ou de référence', () => {
    assert.equal(
      tool(
        'Edit',
        { file_path: p('apps/web/playwright.config.ts'), old_string: '0', new_string: '3' },
        'dev-front',
      ).code,
      2,
    );
    assert.equal(
      tool(
        'Bash',
        { command: 'rm apps/web/test/visual.e2e.ts-snapshots/desktop-1280.png' },
        'qa-front',
      ).code,
      2,
    );
    assert.equal(
      tool('Write', { file_path: p(REFERENCE), content: 'autre\n' }, 'dev-front').code,
      2,
    );
  });

  it('refuse à revue-a11y toute écriture hors de docs/revues', () => {
    assert.equal(
      tool(
        'Write',
        { file_path: p('apps/web/app/app.vue'), content: '<template />\n' },
        'revue-a11y',
      ).code,
      2,
    );
    const ok = tool(
      'Write',
      { file_path: p('docs/revues/a11y-2026-11-19.md'), content: '# Audit\n' },
      'revue-a11y',
    );
    assert.equal(ok.code, 0, ok.stderr);
  });
});

describe('Intégrité (CI) : tests et configurations du front', () => {
  it('accepte une branche qui ajoute un parcours', () => {
    write('apps/web/test/filtre.e2e.ts', "test('filtre', async () => {});\n");
    commitAll(repo, 'test(web): parcours du filtre');
    assert.equal(integrity().code, 0);
  });

  it('refuse un parcours existant modifié sans Justification-test, l’accepte avec', () => {
    write('apps/web/test/smoke.e2e.ts', "test('fumée', async () => { /* vidé */ });\n");
    commitAll(repo, 'test(web): assouplit');
    const refused = integrity();
    assert.equal(refused.code, 1, refused.out);
    assert.match(
      refused.out,
      /test existant modifié sans Justification-test : apps\/web\/test\/smoke\.e2e\.ts/,
    );

    makeRepo();
    write('apps/web/test/smoke.e2e.ts', "test('fumée', async () => { /* corrigé */ });\n");
    commitAll(repo, JUSTIFIED);
    assert.equal(integrity().code, 0);
  });

  it('refuse un test de composant, une capture attendue ou de référence modifiés sans justification', () => {
    for (const rel of [
      'apps/web/app/pages/index.spec.ts',
      'apps/web/test/visual.e2e.ts-snapshots/desktop-1280.png',
      REFERENCE,
    ]) {
      makeRepo();
      write(rel, 'remplacé\n');
      commitAll(repo, 'chore: remplace');
      const r = integrity();
      assert.equal(r.code, 1, `${rel}\n${r.out}`);
    }
  });

  it('refuse la configuration Playwright modifiée et un turbo.json de paquet créé sans justification', () => {
    write('apps/web/playwright.config.ts', 'export default { retries: 3 };\n');
    commitAll(repo, 'chore: reprises');
    assert.equal(integrity().code, 1);

    makeRepo();
    write('apps/web/turbo.json', '{ "extends": ["//"], "tasks": { "test": { "cache": true } } }\n');
    commitAll(repo, 'chore: tâches du front');
    const r = integrity();
    assert.equal(r.code, 1, r.out);
    assert.match(
      r.out,
      /configuration protégée modifiée sans Justification-test \(A\) : apps\/web\/turbo\.json/,
    );
  });
});
