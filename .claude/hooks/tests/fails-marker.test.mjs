// BF-9 (brief back-002, 20 nov. 2026) : le marqueur d'échec attendu de Vitest n'est reconnu que
// sur un appel direct ou enchaîné par une méthode de l'API de test de Vitest (each, for,
// concurrent…), plus par n'importe quel appel : la portée d'échec attendu de `GRANTABLE` suivie
// d'`includes` n'est plus un marqueur. Les formes déjà détectées le restent (et l'enchaînement de
// plusieurs méthodes l'est désormais). Lancé par `pnpm hooks:test`.
//
// Les marqueurs sont construits par concaténation : ce fichier n'en contient aucun littéralement.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { countMarkers, hasMarker } from '../lib/policy.mjs';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');
const F = '.fa' + 'ils';
const PW = 'test.fa' + 'il';

const temps = [];

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('BF-9 : faux positifs du marqueur d’échec attendu', () => {
  it('ne prend plus un appel ordinaire après la portée d’échec attendu pour un marqueur', () => {
    for (const text of [
      `GRANTABLE${F}.includes(role)`,
      `scopes${F}.map((r) => r.trim())`,
      `scopes${F}.filter(Boolean)`,
      `result${F}.toString()`,
      `const n = report${F}.length;`,
      `stats${F} += 1;`,
    ]) {
      const c = countMarkers(text);
      assert.equal(c.fails + c.forbidden, 0, text);
      assert.equal(hasMarker(text), false, text);
    }
  });

  it('compte toujours l’échec attendu direct ou enchaîné par Vitest', () => {
    for (const text of [
      `it${F}('BUG-9', () => {});`,
      `test${F} ('BUG-9', () => {});`,
      `it.concurrent${F}('BUG-9', async () => {});`,
      `myTest${F}('BUG-9', ({ db }) => {});`,
      `it${F}.each([1, 2])('BUG-9 %i', () => {});`,
      `it${F}.each\`a | b\`('BUG-9', () => {});`,
      `it${F}.for([1])('BUG-9 %i', () => {});`,
      `it${F}.concurrent('BUG-9', async () => {});`,
      `it${F}.sequential('BUG-9', async () => {});`,
      `it${F}.extend({ db: async ({}, use) => use(1) })`,
      `it${F}.scoped({ db: 2 })`,
      `it${F}.override({ db: 2 })`,
    ]) {
      assert.equal(countMarkers(text).fails, 1, text);
    }
  });

  it('compte l’échec attendu enchaîné par plusieurs méthodes de Vitest', () => {
    assert.equal(countMarkers(`it${F}.concurrent.each([1])('BUG-9 %i', () => {});`).fails, 1);
    assert.equal(countMarkers(`it${F}.concurrent.for([1])('BUG-9 %i', () => {});`).fails, 1);
  });

  it('garde les marqueurs interdits enchaînés après l’échec attendu', () => {
    const skipIf = countMarkers(`it${F}.skip` + "If(ci)('BUG-9', () => {});");
    assert.equal(skipIf.fails, 1);
    assert.equal(skipIf.forbidden, 1);
    const only = countMarkers(`it${F}.on` + "ly('BUG-9', () => {});");
    assert.equal(only.fails, 1);
    assert.equal(only.forbidden, 1);
  });

  it('garde l’échec attendu de Playwright', () => {
    assert.equal(countMarkers(`${PW}('BUG-F1', async () => {});`).fails, 1);
    assert.equal(countMarkers(`${PW}();`).fails, 1);
  });

  it('les hooks laissent écrire un fichier ordinaire qui lit la portée d’échec attendu', () => {
    const repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-bf9-')));
    temps.push(repo);
    execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
    writeFileSync(join(repo, '.gitignore'), '.claude/hooks/state/\n.claude/hooks/audit.log\n');
    const write = (rel, content) =>
      spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
        input: JSON.stringify({
          session_id: 's-bf9',
          cwd: repo,
          hook_event_name: 'PreToolUse',
          agent_type: 'dev-api',
          agent_id: 'f1',
          tool_name: 'Write',
          tool_input: { file_path: join(repo, rel), content },
        }),
        encoding: 'utf8',
        env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
      });

    const ordinary = write(
      'scripts/roles.mjs',
      `export const ok = GRANTABLE${F}.includes('qa');\n`,
    );
    assert.equal(ordinary.status, 0, ordinary.stderr);
    const marker = write('apps/api/src/bug.spec.ts', `it${F}.each([1])('BUG-9', () => {});\n`);
    assert.equal(marker.status, 2);
    assert.match(marker.stderr, /autorisation|échec attendu/);
  });
});
