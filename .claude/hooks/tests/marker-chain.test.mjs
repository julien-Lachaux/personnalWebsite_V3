// L14-11 (recette du lot 16, point ouvert 2) : un marqueur interdit suivi de plusieurs méthodes de
// l'API de test de Vitest (un saut, puis concurrent, puis each…) est reconnu par les hooks
// (MARKER_RE de lib/policy.mjs), comme une seule méthode l'était déjà. Comparaison de l'ancien et du
// nouveau sur toutes les formes du corpus : aucune forme refusée avant ne devient acceptée, et les
// formes ordinaires (prose, appels sur une portée nommée comme un marqueur) restent acceptées.
// scripts/ci/tests/marker-chain.test.sh fait la même comparaison pour le script d'intégrité.
// Lancé par `pnpm hooks:test`.
//
// Les marqueurs sont construits par concaténation : ce fichier n'en contient aucun littéralement.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { countMarkers } from '../lib/policy.mjs';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');

// Copie figée des expressions de lib/policy.mjs avant L14-11 (« ancien »), pour la comparaison.
const OLD_MARKER_RE =
  /\.(?:(skip|only|todo|skipIf|runIf)(?=\s*\(|\.\w+\s*[(`])|(fails)(?=\s*\(|(?:\.(?:each|for|concurrent|sequential|shuffle|skip|only|todo|fails|skipIf|runIf|extend|scoped|override))+\s*[(`]))/g;
const OLD_PLAYWRIGHT_RE =
  /(?<![\w$.])test(?:\.describe)?(?:\.(?:serial|parallel))?\.(fixme|slow|fail)(?=\s*\()/g;
const OLD_IGNORE_RE = /\b(?:v8|c8|istanbul)\s+ignore\b|node:coverage\s+(?:ignore|disable)/g;

function oldCount(text) {
  const r = { forbidden: 0, fails: 0 };
  for (const m of text.matchAll(OLD_MARKER_RE)) {
    if (m[2] === undefined) r.forbidden += 1;
    else r.fails += 1;
  }
  for (const m of text.matchAll(OLD_PLAYWRIGHT_RE)) {
    if (m[1] === 'fail') r.fails += 1;
    else r.forbidden += 1;
  }
  for (const _ of text.matchAll(OLD_IGNORE_RE)) r.forbidden += 1;
  return r;
}

const j = (...parts) => parts.join('');
const SKIP = j('sk', 'ip');
const ONLY = j('on', 'ly');
const TODO = j('to', 'do');
const SKIP_IF = j('skip', 'If');
const RUN_IF = j('run', 'If');
const FAILS = j('fa', 'ils');
const FIXME = j('fix', 'me');
const SLOW = j('sl', 'ow');
const FAIL = j('fa', 'il');
const BT = '`';

/** Formes enchaînées sur plusieurs méthodes, que l'ancien ne voyait pas (trou de L14-11). */
const CHAINED = [
  `it.${SKIP}.concurrent.each([1])('x', () => {});`,
  `it.${SKIP}.concurrent.each${BT}a${BT}('x', () => {});`,
  `it.${ONLY}.sequential.for([1])('x', () => {});`,
  `describe.${SKIP}.shuffle.each([1])('x', () => {});`,
  `test.${TODO}.concurrent.each([1])('x');`,
  `it.${SKIP}.concurrent.each ([1])('x', () => {});`,
  `it.${RUN_IF}.concurrent.each([1])('x', () => {});`,
  `it.${SKIP_IF}.concurrent.extend({})('x', () => {});`,
  `it.${ONLY}.concurrent.sequential.shuffle.each([1])('x', () => {});`,
  `it.${SKIP}.${FAILS}.each([1])('x', () => {});`,
];

/** Formes déjà refusées ou déjà soumises à autorisation avant L14-11. */
const KNOWN = [
  `it.${SKIP}('x', () => {});`,
  `it.${ONLY}('x', () => {});`,
  `it.${TODO}('x');`,
  `it.${SKIP_IF}(true)('x', () => {});`,
  `it.${RUN_IF}(false)('x', () => {});`,
  `describe.${SKIP}('x', () => {});`,
  `test.${ONLY} ('x', () => {});`,
  `it.${SKIP}.each([1])('x', () => {});`,
  `it.${SKIP}.each${BT}a${BT}('x', () => {});`,
  `it.${ONLY}.concurrent('x', () => {});`,
  `it.${SKIP}.quelconque('x', () => {});`,
  `it.concurrent.${SKIP}('x', () => {});`,
  `test.${TODO}.concurrent.${SKIP}('x');`,
  `it.each([1]).${SKIP}('x');`,
  `test.${FIXME}('x', async () => {});`,
  `test.${SLOW}();`,
  `test.describe.${FIXME}('x', () => {});`,
  `test.describe.serial.${FIXME}('x', () => {});`,
  `/* ${j('v', '8')} ${j('ign', 'ore')} next */`,
  `// ${j('c', '8')} ${j('ign', 'ore')} next`,
  `/* ${j('istan', 'bul')} ${j('ign', 'ore')} else */`,
  `// ${j('node:cov', 'erage')} ${j('ign', 'ore')} next`,
  `// ${j('node:cov', 'erage')} ${j('dis', 'able')}`,
  `it.${FAILS}('x', () => {});`,
  `it.${FAILS}.each([1])('x', () => {});`,
  `it.${FAILS}.concurrent.each([1])('x', () => {});`,
  `it.${FAILS}.for${BT}a${BT}('x', () => {});`,
  `it.concurrent.${FAILS}('x', () => {});`,
  `test.${FAIL}('x', async () => {});`,
];

/** Formes ordinaires : acceptées avant, elles doivent le rester. */
const ORDINARY = [
  `const scope = GRANTABLE.${FAILS}.includes(role);`,
  `const roles = GRANTABLE.${FAILS}.map((r) => r);`,
  `if (options.${SKIP}.length > 0) run();`,
  `const items = cfg.${TODO}.items.map((x) => x);`,
  `const v = state.${SKIP}.items.filter(Boolean);`,
  `Un marqueur it.${ONLY} cité en prose ne compte pas.`,
  `list.skipped('x');`,
  `expect(page).toHaveTitle('x');`,
  `GRANTABLE.${FAILS}.quelconque('x');`,
];

describe('L14-11 : marqueurs interdits enchaînés sur plusieurs méthodes', () => {
  it('les hooks reconnaissent chaque forme enchaînée, que l’ancien ne voyait pas', () => {
    for (const line of CHAINED) {
      assert.ok(countMarkers(line).forbidden > 0, `nouveau, non vu : ${line}`);
      assert.equal(oldCount(line).forbidden, 0, `ancien, déjà vu : ${line}`);
    }
  });

  it('aucune forme refusée ou soumise à autorisation avant ne devient acceptée', () => {
    for (const line of [...CHAINED, ...KNOWN, ...ORDINARY]) {
      const before = oldCount(line);
      const now = countMarkers(line);
      if (before.forbidden > 0)
        assert.ok(now.forbidden > 0, `interdit avant, plus après : ${line}`);
      if (before.fails > 0)
        assert.ok(now.forbidden + now.fails > 0, `échec attendu avant, accepté après : ${line}`);
      assert.ok(now.forbidden >= before.forbidden, `moins de marqueurs interdits : ${line}`);
    }
    for (const line of KNOWN) {
      const before = oldCount(line);
      assert.ok(
        before.forbidden + before.fails > 0,
        `forme du corpus non reconnue avant : ${line}`,
      );
    }
  });

  it('les formes ordinaires restent acceptées, comme avant', () => {
    for (const line of ORDINARY) {
      assert.deepEqual(oldCount(line), { forbidden: 0, fails: 0 }, `ancien : ${line}`);
      const now = countMarkers(line);
      assert.equal(now.forbidden + now.fails, 0, `nouveau : ${line}`);
    }
  });
});

describe('L14-11 : refus dès l’écriture', () => {
  let repo;

  before(() => {
    repo = mkdtempSync(join(tmpdir(), 'garde-fous-chaine-'));
    execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
    mkdirSync(join(repo, 'apps/api/src'), { recursive: true });
    writeFileSync(join(repo, 'apps/api/src/app.ts'), 'export const answer = 42;\n');
  });

  after(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  function hook(toolName, toolInput) {
    const input = {
      session_id: 's-chaine',
      agent_type: 'dev-api',
      agent_id: 'chaine',
      cwd: repo,
      hook_event_name: 'PreToolUse',
      tool_name: toolName,
      tool_input: toolInput,
    };
    const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
    });
    return { code: res.status, stderr: res.stderr };
  }

  it('refuse l’écriture d’un nouveau test qui porte un saut enchaîné, par Write et par le shell', () => {
    for (const line of CHAINED) {
      const w = hook('Write', { file_path: join(repo, 'apps/api/src/n.spec.ts'), content: line });
      assert.equal(w.code, 2, `Write : ${line}`);
      assert.match(w.stderr, /marqueur de saut, de focus/, line);
    }
    const b = hook('Bash', {
      command: `tee apps/api/src/n.spec.ts <<'EOF'\n${CHAINED[0]}\nEOF`,
      description: 'test',
    });
    assert.equal(b.code, 2, b.stderr);
  });

  it('accepte un nouveau test sans marqueur et les formes ordinaires', () => {
    const w = hook('Write', {
      file_path: join(repo, 'apps/api/src/n.spec.ts'),
      content: `it.concurrent.each([1])('x', () => {});\n${ORDINARY.join('\n')}\n`,
    });
    assert.equal(w.code, 0, w.stderr);
  });
});
