// Lot 45, L45-01 : `authorize.mjs` lancé depuis un worktree sans CLAUDE_PROJECT_DIR rangeait
// l'autorisation dans l'état du checkout principal, que les hooks du worktree ne lisent pas
// (constaté deux fois le 26 nov. 2026). Il range désormais l'état dans le dépôt du dossier courant
// (`git rev-parse --show-toplevel`), CLAUDE_PROJECT_DIR l'emportant quand il est posé, annonce la
// destination sur la sortie d'erreur et refuse ce qu'il ne peut pas situer. Lancé par
// `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const AUTHORIZE =
  process.env.L45_AUTHORIZE ??
  join(dirname(dirname(fileURLToPath(import.meta.url))), 'authorize.mjs');
const STATE = ['.claude', 'hooks', 'state', 'authorizations.json'];

let root;
let main;
let worktree;
let other;
let outside;

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function initRepo(dir) {
  mkdirSync(dir);
  git(dir, ['init', '-q', '-b', 'develop']);
  git(dir, [
    '-c',
    'user.name=Test',
    '-c',
    'user.email=ci@noreply.invalid',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    'base',
  ]);
}

function authorize(cwd, project, args) {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  if (project !== undefined) env.CLAUDE_PROJECT_DIR = project;
  return spawnSync(process.execPath, [AUTHORIZE, ...args], { cwd, encoding: 'utf8', env });
}

const GRANT = (ticket) => [
  'grant',
  '--agent',
  'lead-architecte',
  '--scope',
  'config',
  '--ticket',
  ticket,
  '--reason',
  'test du lot 45',
  '--path',
  'turbo.json',
];

function tickets(dir) {
  const file = join(dir, ...STATE);
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const grants = Array.isArray(data) ? data : Array.isArray(data.grants) ? data.grants : [];
  return grants.map((g) => g.ticket);
}

before(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-l45-')));
  main = join(root, 'principal');
  worktree = join(root, 'arbre');
  other = join(root, 'autre');
  outside = join(root, 'hors-depot');
  initRepo(main);
  git(main, ['worktree', 'add', '-q', '-b', 'lot/45', worktree]);
  initRepo(other);
  mkdirSync(outside);
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('L45-01 : dépôt visé par authorize.mjs', () => {
  it('sans CLAUDE_PROJECT_DIR, depuis un worktree : état du worktree, pas du checkout principal', () => {
    const res = authorize(worktree, undefined, GRANT('L45-SANS'));
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(tickets(worktree), ['L45-SANS']);
    assert.deepEqual(tickets(main), []);
    assert.ok(
      res.stderr.includes(`état des garde-fous de ${worktree} (dossier courant)`),
      res.stderr,
    );
  });

  it('sans CLAUDE_PROJECT_DIR, depuis un sous-dossier du worktree : racine du worktree', () => {
    const sub = join(worktree, 'sous', 'dossier');
    mkdirSync(sub, { recursive: true });
    const res = authorize(sub, undefined, GRANT('L45-SOUS'));
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(tickets(worktree), ['L45-SANS', 'L45-SOUS']);
    assert.equal(existsSync(join(sub, '.claude')), false);
    const list = authorize(sub, undefined, ['list']);
    assert.equal(list.status, 0, list.stderr);
    assert.match(list.stdout, /L45-SANS/);
    assert.match(list.stdout, /L45-SOUS/);
  });

  it('sans CLAUDE_PROJECT_DIR, depuis le checkout principal : état du checkout principal', () => {
    const res = authorize(main, undefined, GRANT('L45-PRINCIPAL'));
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(tickets(main), ['L45-PRINCIPAL']);
    assert.deepEqual(tickets(worktree), ['L45-SANS', 'L45-SOUS']);
  });

  it('avec CLAUDE_PROJECT_DIR=<worktree> depuis le checkout principal : la variable l’emporte', () => {
    const res = authorize(main, worktree, GRANT('L45-AVEC'));
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(tickets(worktree), ['L45-SANS', 'L45-SOUS', 'L45-AVEC']);
    assert.deepEqual(tickets(main), ['L45-PRINCIPAL']);
    assert.ok(
      res.stderr.includes(`état des garde-fous de ${worktree} (CLAUDE_PROJECT_DIR)`),
      res.stderr,
    );
  });

  it('avec CLAUDE_PROJECT_DIR sur un autre dépôt : état de ce dépôt, annoncé', () => {
    const res = authorize(worktree, other, GRANT('L45-AUTRE'));
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(tickets(other), ['L45-AUTRE']);
    assert.deepEqual(tickets(worktree), ['L45-SANS', 'L45-SOUS', 'L45-AVEC']);
    assert.ok(
      res.stderr.includes(`état des garde-fous de ${other} (CLAUDE_PROJECT_DIR)`),
      res.stderr,
    );
  });

  it('CLAUDE_PROJECT_DIR vide : traité comme absent', () => {
    const res = authorize(worktree, '', ['list']);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stderr, /\(dossier courant\)/);
    assert.match(res.stdout, /L45-AVEC/);
  });

  it('CLAUDE_PROJECT_DIR sur un dossier absent : refus explicite, aucun repli', () => {
    const missing = join(root, 'absent');
    const res = authorize(worktree, missing, GRANT('L45-ABSENT'));
    assert.equal(res.status, 2);
    assert.match(res.stderr, /CLAUDE_PROJECT_DIR désigne un dossier absent/);
    assert.equal(existsSync(missing), false);
    assert.deepEqual(tickets(worktree), ['L45-SANS', 'L45-SOUS', 'L45-AVEC']);
    assert.deepEqual(tickets(main), ['L45-PRINCIPAL']);
  });

  it('hors de tout dépôt sans CLAUDE_PROJECT_DIR : refus explicite, rien d’écrit', () => {
    const res = authorize(outside, undefined, GRANT('L45-HORS'));
    assert.equal(res.status, 2);
    assert.match(res.stderr, /n'est dans aucun dépôt git/);
    assert.ok(res.stderr.includes('CLAUDE_PROJECT_DIR=<worktree>'), res.stderr);
    assert.equal(existsSync(join(outside, '.claude')), false);
  });

  it('hors de tout dépôt avec CLAUDE_PROJECT_DIR : la variable suffit', () => {
    const res = authorize(outside, worktree, ['list']);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /L45-SANS/);
  });
});
