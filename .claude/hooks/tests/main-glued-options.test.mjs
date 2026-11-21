// L19-01 (décision de Julien du 21 nov. 2026) : comme `git checkout -b main` (L14-06), aucune
// session, la principale comprise, ne crée ni n'écrit la branche locale main par une forme voisine :
// options courtes groupées ou collées à leur valeur (`checkout -qb main`, `-bmain`, `switch -cmain`),
// options longues abrégées (`switch --cr main`, `checkout --or main`, `branch --cop`, `--mo`),
// création par --track sans nom (`checkout -qt origin/main`, `--tr`, `-t remotes/origin/main`),
// branche distante devinée (`checkout main`, `switch main`, `worktree add ../main`, `worktree add
// <dossier> main`) quand main n'existe pas en local, et `worktree add --orphan ../main`.
// Chaque forme refusée est d'abord rejouée par git dans un clone jetable dont la seule branche locale
// est develop (amont : main et develop) : elle y écrit refs/heads/main ou place une HEAD sur main ;
// chaque forme permise n'y écrit rien. Puis l'analyse de la commande pour les quatorze rôles et la
// session principale, et l'entrée JSON du hook PreToolUse pour la session principale et dev-api.
// Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
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
const MAIN_REASON = /la branche locale main ne s’écrit pas/;

let root; // dossier jetable : dépôt amont, clones, HOME neutre
let upstream; // amont : main et develop, HEAD sur develop
let repo; // clone : develop seule en local (suit origin/develop), lot/y sans amont
let localMain; // clone où main existe aussi en local (comme le checkout du projet)
let project;
let clones = 0;

const ENV = () => ({
  ...process.env,
  HOME: join(root, 'home'),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'ci@noreply.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'ci@noreply.invalid',
});

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: ENV(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Sortie d'une lecture git, ou null si git échoue. */
function gitRead(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', env: ENV() });
  return res.status === 0 ? res.stdout.trim() : null;
}

/** Clone neuf de l'amont, dans son propre dossier (les chemins ../x restent dans ce dossier). */
function clone({ withMain = false } = {}) {
  clones += 1;
  const dir = join(root, `clone-${clones}`, 'repo');
  mkdirSync(dirname(dir));
  git(root, ['clone', '-q', upstream, dir]);
  git(dir, ['branch', '--no-track', 'lot/y', 'origin/develop']);
  if (withMain) git(dir, ['branch', '--no-track', 'main', 'origin/main']);
  return dir;
}

/** État de main : la référence locale et les HEAD des worktrees qui la désignent. */
function mainState(dir) {
  const ref = gitRead(dir, ['rev-parse', '--verify', '-q', 'refs/heads/main']);
  const heads = (gitRead(dir, ['worktree', 'list', '--porcelain']) ?? '')
    .split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice(9))
    .filter((w) => gitRead(w, ['symbolic-ref', '-q', 'HEAD']) === 'refs/heads/main');
  return { ref, heads: heads.length };
}

/** Rejoue `command` dans un clone neuf : code de sortie, état de main avant et après. */
function replay(command, options) {
  const dir = clone(options);
  const before = mainState(dir);
  const res = spawnSync('sh', ['-c', command], { cwd: dir, encoding: 'utf8', env: ENV() });
  return { code: res.status, before, after: mainState(dir), stderr: res.stderr };
}

before(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-main-colle-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-main-colle-projet-')));
  mkdirSync(join(root, 'home'));
  // L'analyse lit la configuration git du processus : HOME neutre, pas de configuration système.
  process.env.HOME = join(root, 'home');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  upstream = join(root, 'amont');
  git(root, ['init', '-q', '-b', 'main', upstream]);
  git(upstream, ['commit', '-q', '--allow-empty', '--no-gpg-sign', '-m', 'base']);
  git(upstream, ['branch', 'develop']);
  git(upstream, ['symbolic-ref', 'HEAD', 'refs/heads/develop']);
  repo = clone();
  localMain = clone({ withMain: true });
});

after(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

function hook(command, role, cwd = repo) {
  const input = {
    session_id: 's-main-colle',
    cwd,
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

/**
 * Formes qui créent ou écrivent main, rejouées par git : `mayFail` signale une forme que certaines
 * versions de git rejettent (sans rien écrire) ; quand git l'accepte, elle écrit main.
 */
const REAL_REFUSED = [
  // checkout : -b et -B groupés ou collés à leur valeur
  { command: 'git checkout -qb main' },
  { command: 'git checkout -bmain' },
  { command: 'git checkout -qbmain' },
  { command: 'git checkout -fbmain' },
  { command: 'git checkout -Bmain' },
  { command: 'git checkout -qBmain develop' },
  // checkout : --orphan abrégé (HEAD placée sur main, écrite au premier commit)
  { command: 'git checkout --or main' },
  { command: 'git checkout --orp main' },
  // checkout --track sans -b : la branche créée porte le nom de la distante
  { command: 'git checkout -qt origin/main' },
  { command: 'git checkout -tq origin/main', mayFail: 'git >= 2.35 : -t prend une valeur' },
  { command: 'git checkout --tr origin/main' },
  { command: 'git checkout --track=direct origin/main', mayFail: 'git < 2.35' },
  { command: 'git checkout -t remotes/origin/main' },
  { command: 'git checkout -t refs/remotes/origin/main' },
  // checkout : branche distante devinée
  { command: 'git checkout main' },
  { command: 'git checkout -q main' },
  { command: 'git checkout main --' },
  // switch : -c et -C groupés ou collés, --create et --force-create abrégés
  { command: 'git switch -cmain' },
  { command: 'git switch -qcmain' },
  { command: 'git switch -qc main' },
  { command: 'git switch -Cmain' },
  { command: 'git switch --cr main' },
  { command: 'git switch --cre=main' },
  { command: 'git switch --create=main' },
  { command: 'git switch --force-c main' },
  { command: 'git switch --force-create=main' },
  { command: 'git switch --or main' },
  { command: 'git switch --orp main' },
  { command: 'git switch -qt origin/main' },
  { command: 'git switch --tr origin/main' },
  { command: 'git switch main' },
  { command: 'git switch -q main' },
  // worktree add : -b groupé ou collé, branche du nom du dossier, branche distante devinée
  { command: 'git worktree add -bmain ../w1' },
  { command: 'git worktree add -fbmain ../w2' },
  { command: 'git worktree add -qbmain ../w3' },
  { command: 'git worktree add -Bmain ../w4 develop' },
  { command: 'git worktree add ../main' },
  { command: 'git worktree add -q ../main' },
  { command: 'git worktree add --guess-remote ../main' },
  { command: 'git worktree add ../w5 main' },
  { command: 'git worktree add --orphan ../main', mayFail: 'git < 2.42' },
  { command: 'git worktree add --orphan -bmain ../w6', mayFail: 'git < 2.42' },
  // branch : --copy et --move abrégés
  { command: 'git branch --cop develop main' },
  { command: 'git branch --mo lot/y main' },
];

/** Formes refusées à toutes les sessions sans rejeu : suppression de main, noms illisibles. */
const OTHER_REFUSED = [
  ['git branch --del main', MAIN_REASON],
  ['git branch --de lot/y main', MAIN_REASON],
  ['git checkout -qb"$NOM"', /illisible/],
  ['git checkout -B"$NOM" develop', /illisible/],
  ['git checkout -qt "$R"', /illisible/],
  ['git checkout --orp="$NOM"', /illisible/],
  ['git switch -c"$NOM"', /illisible/],
  ['git switch --cr="$NOM"', /illisible/],
  ['git worktree add -qb"$NOM" ../w develop', /illisible/],
  ['git worktree add "$D"', /illisible/],
  ['git checkout -qbmain && git commit -m x', MAIN_REASON],
  ['(git switch -cmain)', MAIN_REASON],
  ["bash -c 'git checkout -qb main'", MAIN_REASON],
  ['git -C . switch --cr main', MAIN_REASON],
];

/** Formes permises à toutes les sessions, rejouées par git : main n'est ni créée ni écrite. */
const REAL_PERMITTED = [
  'git checkout -qb lot/x',
  'git checkout -blot/x',
  'git checkout -qBlot/x develop',
  'git checkout -qb lot/main-x',
  'git checkout develop',
  'git checkout lot/y',
  'git checkout --no-guess main',
  'git -c checkout.guess=false checkout main',
  'git switch -qc lot/x',
  'git switch -clot/x',
  'git switch --cr lot/x',
  'git switch --create=lot/x develop',
  'git switch develop',
  'git switch --no-guess main',
  'git worktree add -b lot/x ../w-x develop',
  'git worktree add -qblot/x ../w-x2 develop',
  'git worktree add ../w-y lot/y',
  'git worktree add --detach ../main',
  'git worktree add -d ../main develop',
  'git branch --cop lot/y copie',
  'git branch --mo lot/y lot/w',
];

/** Dans un dépôt où main existe en local : on y passe sans l'écrire, comme avant le lot. */
const LOCAL_MAIN_PERMITTED = [
  'git checkout main',
  'git switch main',
  'git worktree add ../main',
  'git worktree add ../w-main main',
  'git worktree add -b lot/x ../w-x develop',
];

describe('L19-01 : comportement réel de git (clones jetables)', () => {
  it('chaque forme refusée crée ou écrit main quand git l’accepte', () => {
    for (const { command, mayFail } of REAL_REFUSED) {
      const r = replay(command);
      assert.equal(r.before.ref, null, `${command} : main existait avant`);
      const wrote = r.after.ref !== null || r.after.heads > 0;
      if (r.code !== 0 && mayFail) {
        assert.equal(wrote, false, `${command} (${mayFail}) : échec qui écrit main`);
        continue;
      }
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
      assert.ok(wrote, `${command} : main ni créée ni placée en HEAD`);
    }
  });

  it('chaque forme permise ne crée ni n’écrit main', () => {
    for (const command of REAL_PERMITTED) {
      const r = replay(command);
      assert.equal(r.after.ref, null, `${command} : main créée`);
      assert.equal(r.after.heads, 0, `${command} : HEAD placée sur main`);
    }
  });

  it('main locale existante : on y passe sans changer la référence', () => {
    for (const command of LOCAL_MAIN_PERMITTED) {
      const r = replay(command, { withMain: true });
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
      assert.notEqual(r.before.ref, null);
      assert.equal(r.after.ref, r.before.ref, `${command} : main déplacée`);
    }
  });
});

describe('L19-01 : création ou écriture de main refusée à toutes les sessions', () => {
  it('connaît les quatorze rôles d’agent', () => {
    assert.equal(ROLES.length, 14, ROLES.join(', '));
    assert.ok(!ROLES.includes('main'));
  });

  const refused = [...REAL_REFUSED.map(({ command }) => [command, MAIN_REASON]), ...OTHER_REFUSED];

  for (const role of ['main', ...ROLES]) {
    it(`refuse chaque forme au rôle ${role}`, () => {
      for (const [command, reason] of refused) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.match(deny ?? '', reason, `${role} : ${command}`);
      }
    });
  }

  it('le hook complet refuse chaque forme à la session principale et à dev-api', () => {
    for (const [command, reason] of refused) {
      for (const role of ['main', 'dev-api']) {
        const r = hook(command, role);
        assert.equal(r.code, 2, `${role} : ${command}`);
        assert.match(r.stderr, reason, `${role} : ${command}`);
      }
    }
  });
});

describe('L19-01 : ce qui reste permis', () => {
  it('les créations d’autres branches et les formes sans écriture de main', () => {
    for (const command of REAL_PERMITTED) {
      for (const role of ['main', 'dev-api', 'qa', 'lead-architecte', 'correcteur']) {
        assert.equal(analyzeCommand(command, repo, role).deny, null, `${role} : ${command}`);
      }
      for (const role of ['main', 'dev-api']) {
        const r = hook(command, role);
        assert.equal(r.code, 0, `${role} : ${command} : ${r.stderr}`);
      }
    }
  });

  it('le passage sur une main locale existante', () => {
    for (const command of LOCAL_MAIN_PERMITTED) {
      for (const role of ['main', 'dev-api', 'lead-architecte']) {
        assert.equal(analyzeCommand(command, localMain, role).deny, null, `${role} : ${command}`);
      }
      const r = hook(command, 'main', localMain);
      assert.equal(r.code, 0, `main : ${command} : ${r.stderr}`);
    }
  });

  it('git worktree add -b lot/x <dossier> develop reste à la session principale', () => {
    for (const command of [
      'git worktree add -b lot/x .claude/worktrees/lot-x develop',
      'git worktree add .claude/worktrees/lot-x -b lot/x develop',
      'git worktree add -b lot/19-garde-fous-charge ../lot-19 develop',
    ]) {
      for (const dir of [repo, localMain]) {
        assert.equal(analyzeCommand(command, dir, 'main').deny, null, command);
        const r = hook(command, 'main', dir);
        assert.equal(r.code, 0, `${command} : ${r.stderr}`);
      }
    }
  });
});
