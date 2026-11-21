// Tests de `.husky/check-staged-format.mjs` (L14-09) : `pnpm husky:test`.
// Chaque test monte un dépôt git jetable, y indexe des fichiers et lance le script comme le fait le
// hook pre-commit (cwd = dépôt) ; Prettier est celui du monorepo (résolu depuis le script).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

const script = resolve(import.meta.dirname, '../check-staged-format.mjs');
const prettierBin = resolve(import.meta.dirname, '../../node_modules/prettier/bin/prettier.cjs');

const FORMATTED = "const a = { b: 'c' };\n";
const UNFORMATTED = 'const a = {b:"c"}\n';

let repo;

// Sans les variables GIT_* héritées (un hook git les pose) : chaque commande vise le dépôt jetable.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
);
const git = (...args) => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8' });
const write = (file, content) => {
  const path = join(repo, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};
const stage = (file, content) => {
  write(file, content);
  git('add', '--', file);
};
const run = (cwd = repo) => spawnSync(process.execPath, [script], { cwd, env, encoding: 'utf8' });

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'staged-format-'));
  git('init', '-q');
  git('config', 'user.name', 'test');
  git('config', 'user.email', 'test@example.org');
  write('.prettierrc.json', '{ "singleQuote": true }\n');
  write('.prettierignore', 'ignored/\n');
  write('.gitignore', 'build/\n');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

test('rien d’indexé : succès sans message', () => {
  const result = run();
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('fichier indexé formaté selon .prettierrc.json : succès', () => {
  stage('src/a.ts', FORMATTED);
  assert.equal(run().status, 0);
});

test('fichier indexé non formaté : échec et fichier cité', () => {
  stage('src/a.ts', FORMATTED);
  stage('src/b.ts', UNFORMATTED);
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^ {2}src\/b\.ts$/m);
  assert.doesNotMatch(result.stderr, /src\/a\.ts/);
  assert.match(result.stderr, /pnpm format/);
});

test('la configuration du dépôt est appliquée (guillemets doubles refusés)', () => {
  stage('a.ts', 'const a = { b: "c" };\n');
  assert.equal(run().status, 1);
});

test('.editorconfig est lu comme par la CLI (indentation de 4)', () => {
  write('.editorconfig', 'root = true\n\n[*]\nindent_style = space\nindent_size = 4\n');
  stage('a.ts', 'function f() {\n  return 1;\n}\n');
  assert.equal(run().status, 1);
  stage('a.ts', 'function f() {\n    return 1;\n}\n');
  assert.equal(run().status, 0);
});

test('contenu de l’index jugé, pas celui de l’arbre de travail', () => {
  stage('a.ts', UNFORMATTED);
  write('a.ts', FORMATTED);
  assert.equal(run().status, 1, 'index non formaté, arbre formaté : échec');

  stage('b.ts', FORMATTED);
  git('rm', '-q', '--cached', '-f', 'a.ts');
  write('b.ts', UNFORMATTED);
  assert.equal(run().status, 0, 'index formaté, arbre non formaté : succès');
});

test('fichiers ignorés (.prettierignore, .gitignore forcé) et types inconnus : non vérifiés', () => {
  stage('ignored/a.ts', UNFORMATTED);
  write('build/a.ts', UNFORMATTED);
  git('add', '-f', '--', 'build/a.ts');
  stage('notes.unknown-extension', '  {{ pas du code }}\n');
  assert.equal(run().status, 0);
});

test('fichier non indexé, même non formaté : non vérifié', () => {
  stage('a.ts', FORMATTED);
  write('untracked.ts', UNFORMATTED);
  assert.equal(run().status, 0);
});

test('suppression indexée et lien symbolique : non vérifiés', () => {
  stage('a.ts', UNFORMATTED);
  git('commit', '-q', '--no-verify', '-m', 'init');
  git('rm', '-q', 'a.ts');
  symlinkSync('cible-absente.ts', join(repo, 'lien.ts'));
  git('add', 'lien.ts');
  assert.equal(run().status, 0);
});

test('fichier modifié après un commit et renommé : vérifiés', () => {
  stage('a.ts', FORMATTED);
  stage('c.ts', FORMATTED);
  git('commit', '-q', '--no-verify', '-m', 'init');
  stage('a.ts', UNFORMATTED);
  git('mv', 'c.ts', 'd.ts');
  stage('d.ts', UNFORMATTED);
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^ {2}a\.ts$/m);
  assert.match(result.stderr, /^ {2}d\.ts$/m);
});

test('noms de fichiers avec espaces et accents', () => {
  stage('dossier à part/mon fichier.ts', UNFORMATTED);
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /dossier à part\/mon fichier\.ts/);
});

test('lancé depuis un sous-dossier : mêmes fichiers vérifiés', () => {
  stage('src/a.ts', UNFORMATTED);
  const result = run(join(repo, 'src'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /src\/a\.ts/);
});

test('même verdict que `prettier --check` sur chaque fichier indexé identique à l’arbre', () => {
  const files = {
    'a.ts': FORMATTED,
    'b.ts': UNFORMATTED,
    'c.json': '{"a":1}\n',
    'd.md': '# Titre\n\nTexte.\n',
    'e.css': 'a{color:red}\n',
    'ignored/f.ts': UNFORMATTED,
    'g.yaml': 'a:   1\n',
  };
  for (const [file, content] of Object.entries(files)) {
    stage(file, content);
  }
  for (const file of Object.keys(files)) {
    const cli = spawnSync(process.execPath, [prettierBin, '--check', '--ignore-unknown', file], {
      cwd: repo,
      env,
      encoding: 'utf8',
    });
    const reported = new RegExp(`^ {2}${file.replace('.', '\\.')}$`, 'm').test(run().stderr);
    assert.equal(reported, cli.status !== 0, `${file} : CLI ${cli.status}`);
  }
});
