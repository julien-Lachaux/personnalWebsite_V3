// L14-01 (décision de Julien du 19 nov. 2026, recette du lot 12) : les hooks refusent dès l'écriture
// une directive « Stryker disable » qui ne cite pas l'identifiant d'un mutant équivalent déclaré
// dans un stryker.equivalents.json, comme ils refusent les marqueurs de saut de Vitest ; jusque-là
// seul scripts/ci/check-tests-integrity.sh la refusait, au commit et en CI. Outils d'édition et
// shell ; une directive déjà présente ne bloque pas les autres modifications du fichier.
// Lancé par `pnpm hooks:test`.
//
// Les directives sont construites à l'exécution : ce fichier n'en contient aucune littéralement.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');

const SD = ['Stryker', 'disable'].join(' ');
const NEXT = `// ${SD} next-line StringLiteral`;
const EQUIVALENTS = '{ "equivalents": [{ "id": "API-EQ-01", "file": "src/app.ts", "line": 2 }] }\n';
const CODE = "export const mode = 'false';\n";

const temps = [];
let repo;
let project;

function write(rel, content) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), content);
}

const p = (rel) => join(repo, rel);

beforeEach(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-directive-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-directive-projet-')));
  temps.push(repo, project);
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
  write('apps/api/stryker.equivalents.json', EQUIVALENTS);
  write('apps/api/src/app.ts', CODE);
  write('apps/api/src/ancien.ts', `${NEXT}: sans identifiant\n${CODE}`);
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=ci@noreply.invalid', 'commit', '-q', '-m', 'base'],
    { cwd: repo },
  );
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function tool(name, toolInput, role = 'dev-api') {
  const input = {
    session_id: 's-directive',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    tool_name: name,
    tool_input: toolInput,
  };
  if (role !== 'main') {
    input.agent_type = role;
    input.agent_id = `id-${role}`;
  }
  const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

const bash = (command, role) => tool('Bash', { command, description: 'test' }, role);

describe('L14-01 : directive Stryker disable refusée dès l’écriture (outils d’édition)', () => {
  it('refuse une directive sans identifiant, avec un identifiant non déclaré ou en partie', () => {
    for (const directive of [
      `${NEXT}: équivalent, croyez-moi`,
      `${NEXT}: API-EQ-02 jamais déclaré`,
      `${NEXT}: API-EQ-01 et API-EQ-09`,
      `/* ${SD} all */`,
      `  * ${SD} next-line BlockStatement`,
      `// ${SD} next-line StringLiteral: CONTRACTS-EQ-01 autre paquet, non déclaré`,
    ]) {
      for (const role of ['dev-api', 'correcteur', 'main']) {
        const w = tool(
          'Write',
          { file_path: p('apps/api/src/app.ts'), content: `${directive}\n${CODE}` },
          role,
        );
        assert.equal(w.code, 2, `${role} : ${directive}`);
        assert.match(w.stderr, /directive Stryker disable sans équivalent déclaré/);
      }
    }
  });

  it('refuse l’ajout par Edit, y compris dans un fichier .tsx, .mjs ou .cjs nouveau', () => {
    const e = tool('Edit', {
      file_path: p('apps/api/src/app.ts'),
      old_string: CODE,
      new_string: `${NEXT}: raison\n${CODE}`,
    });
    assert.equal(e.code, 2, e.stderr);
    for (const rel of ['apps/web/app/a.tsx', 'outils/b.mjs', 'outils/c.cjs']) {
      const w = tool('Write', { file_path: p(rel), content: `${NEXT}\n${CODE}` });
      assert.equal(w.code, 2, rel);
    }
  });

  it('accepte une directive qui cite un équivalent déclaré, suivi ou non suivi', () => {
    const w = tool('Write', {
      file_path: p('apps/api/src/app.ts'),
      content: `${NEXT}: API-EQ-01 (stryker.equivalents.json)\n${CODE}`,
    });
    assert.equal(w.code, 0, w.stderr);
    write(
      'packages/contracts/stryker.equivalents.json',
      '{ "equivalents": [{ "id": "CONTRACTS-EQ-01", "file": "src/x.ts", "line": 2 }] }\n',
    );
    const c = tool('Write', {
      file_path: p('packages/contracts/src/x.ts'),
      content: `${NEXT}: CONTRACTS-EQ-01\n${CODE}`,
    });
    assert.equal(c.code, 0, c.stderr);
  });

  it('ne bloque pas les autres modifications d’un fichier qui porte déjà une directive', () => {
    const e = tool('Edit', {
      file_path: p('apps/api/src/ancien.ts'),
      old_string: "'false'",
      new_string: "'true'",
    });
    assert.equal(e.code, 0, e.stderr);
    const retrait = tool('Edit', {
      file_path: p('apps/api/src/ancien.ts'),
      old_string: `${NEXT}: sans identifiant\n`,
      new_string: '',
    });
    assert.equal(retrait.code, 0, retrait.stderr);
    const ajout = tool('Edit', {
      file_path: p('apps/api/src/ancien.ts'),
      old_string: CODE,
      new_string: `${NEXT}: deuxième\n${CODE}`,
    });
    assert.equal(ajout.code, 2, ajout.stderr);
  });

  it('laisse la directive citée en prose hors code', () => {
    for (const rel of ['docs/notes.md', 'apps/api/README.md', 'notes.txt']) {
      const w = tool('Write', { file_path: p(rel), content: `Une ${NEXT}: sans identifiant.\n` });
      assert.equal(w.code, 0, `${rel} : ${w.stderr}`);
    }
  });
});

describe('L14-01 : directive Stryker disable refusée dès l’écriture (shell)', () => {
  it('refuse une directive non déclarée écrite dans un fichier de code', () => {
    for (const command of [
      `cat > apps/api/src/n.ts <<'EOF'\n${NEXT}: raison\n${CODE}EOF`,
      `printf '%s\\n' '${NEXT}' >> apps/api/src/app.ts`,
      `echo '${NEXT}: API-EQ-02' | tee apps/api/src/n.ts`,
      `sed -i '1i \\/\\/ ${SD} all' apps/api/src/app.ts`,
      `node -e "require('fs').appendFileSync('apps/api/src/app.ts', '// ${SD} all')"`,
    ]) {
      const r = bash(command);
      assert.equal(r.code, 2, `${command} : ${r.stderr}`);
      assert.match(r.stderr, /directive Stryker disable sans équivalent déclaré/, command);
    }
  });

  it('accepte une directive déclarée, la prose hors code et la lecture', () => {
    for (const command of [
      `cat > apps/api/src/n.ts <<'EOF'\n${NEXT}: API-EQ-01\n${CODE}EOF`,
      `echo '${NEXT}: sans identifiant' >> docs/notes.md`,
      `grep -rn "${SD}" apps`,
      `git log --grep "${SD}"`,
    ]) {
      const r = bash(command);
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });
});
