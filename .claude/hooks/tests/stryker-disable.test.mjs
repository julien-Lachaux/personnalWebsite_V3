// Directives « Stryker disable » (lot 12, MUT-2) : une directive retire des mutants du score de
// mutation, comme une exclusion de configuration. Les hooks (couche 1) ne la repèrent pas : le
// script d'intégrité de la CI (couche 2, scripts/ci/check-tests-integrity.sh) exige une ligne
// Justification-test dans un commit qui touche le fichier, et l'identifiant d'un mutant équivalent
// déclaré dans un stryker.equivalents.json (lui-même configuration protégée). Lancés par
// `pnpm hooks:test` (node --test) ; scripts/ci/tests/stryker-disable.test.sh couvre les autres cas.
//
// La directive est construite à l'exécution : ce fichier n'en contient aucune littéralement (le
// script d'intégrité la chercherait dans tout l'arbre).

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { classify } from '../lib/policy.mjs';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT = dirname(dirname(HOOKS));
const INTEGRITY = join(ROOT, 'scripts/ci/check-tests-integrity.sh');

const DIRECTIVE = `// ${['Stryker', 'disable'].join(' ')} next-line StringLiteral`;
const EQUIVALENTS = '{ "equivalents": [{ "id": "API-EQ-01", "file": "src/app.ts", "line": 2 }] }\n';
const JUSTIFIED =
  'chore(mutation): équivalent\n\nJustification-test: MUT-9 mutant équivalent vérifié un à un';

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

function integrity() {
  const res = spawnSync('bash', [INTEGRITY, 'v3/backend'], { cwd: repo, encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'directives-stryker-'));
  temps.push(repo);
  sh(repo, 'git', ['init', '-q', '-b', 'v3/backend']);
  write('apps/api/src/app.ts', "export const mode = 'false';\n");
  commitAll('base');
  sh(repo, 'git', ['checkout', '-q', '-b', 'lot/essai']);
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('Intégrité (CI) : directives Stryker disable', () => {
  it('le fichier qui les déclare est une configuration protégée', () => {
    assert.equal(classify('apps/api/stryker.equivalents.json'), 'config');
  });

  it('refuse une directive ajoutée dans un commit sans Justification-test', () => {
    write('apps/api/stryker.equivalents.json', EQUIVALENTS);
    commitAll(JUSTIFIED);
    write('apps/api/src/app.ts', `${DIRECTIVE}: API-EQ-01 raison\nexport const mode = 'false';\n`);
    commitAll('refactor: commentaire');
    const r = integrity();
    assert.equal(r.code, 1, r.out);
    assert.match(
      r.out,
      /directive Stryker disable ajoutée sans Justification-test : apps\/api\/src\/app\.ts/,
    );
  });

  it('accepte une directive justifiée qui cite un mutant équivalent déclaré', () => {
    write('apps/api/stryker.equivalents.json', EQUIVALENTS);
    write('apps/api/src/app.ts', `${DIRECTIVE}: API-EQ-01 raison\nexport const mode = 'false';\n`);
    commitAll(JUSTIFIED);
    const r = integrity();
    assert.equal(r.code, 0, r.out);
  });

  it("refuse une directive justifiée dont l'identifiant n'est déclaré nulle part", () => {
    write('apps/api/stryker.equivalents.json', EQUIVALENTS);
    write('apps/api/src/app.ts', `${DIRECTIVE}: API-EQ-02 raison\nexport const mode = 'false';\n`);
    commitAll(JUSTIFIED);
    const r = integrity();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /équivalent non déclaré \(API-EQ-02\)/);
  });

  it("refuse une directive justifiée qui ne cite aucun identifiant d'équivalent", () => {
    write('apps/api/src/app.ts', `${DIRECTIVE}: équivalent\nexport const mode = 'false';\n`);
    commitAll(JUSTIFIED);
    const r = integrity();
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /sans identifiant de mutant équivalent/);
  });
});
