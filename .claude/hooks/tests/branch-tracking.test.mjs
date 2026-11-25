// L18-02 (décision de Julien du 20 nov. 2026) : comme git branch -u (L14-17), la création d'une
// branche qui suit une autre branche écrit branch.<branche>.remote et branch.<branche>.merge hors
// de la règle des destinations de push ; elle est refusée aux agents spécialisés, la session
// principale la garde. Formes couvertes : --track explicite (git branch, checkout, switch, worktree
// add ; -t, --track=direct|inherit, abréviations, groupes d'options courtes), point de départ pour
// lequel le suivi automatique s'applique (branch.autoSetupMerge, lu dans -c puis dans la
// configuration du dépôt), branche distante devinée (checkout <nom>, switch <nom>, worktree add),
// copie d'une branche suivie (git branch -c), git fetch et git pull --set-upstream. --no-track reste
// permis. Écrire branch.autoSetupMerge ou branch.autoSetupRebase est refusé à tous, comme les
// autres clés de destination. Chaque forme refusée est d'abord rejouée par git dans un clone jetable
// (elle écrit bien la branche suivie) ; chaque forme permise n'y écrit rien. Puis l'analyse de la
// commande pour les quinze rôles, et l'entrée JSON du hook PreToolUse pour dev-api et la session
// principale. Lancé par `pnpm hooks:test`.

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
const REASON =
  /(créer une branche qui suit une autre branche|définir la branche suivie).*interdit aux agents/;

let root; // dossier jetable : dépôt amont, clones, HOME neutre
let upstream; // dépôt amont (develop, feat)
let repo; // clone : develop suit origin/develop ; lot/x sans amont ; suivie suit origin/develop
let always; // clone dont la configuration fixe branch.autoSetupMerge=always
let guessing; // clone dont la configuration fixe worktree.guessRemote=true
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

/** Clone de l'amont dans le dossier jetable, avec les branches locales lot/x et suivie. */
function clone() {
  clones += 1;
  const dir = join(root, `clone-${clones}`);
  git(root, ['clone', '-q', upstream, dir]);
  git(dir, ['branch', '--no-track', 'lot/x', 'origin/develop']);
  git(dir, ['branch', '--track', 'suivie', 'origin/develop']);
  return dir;
}

/** Configuration branch.* d'un dépôt, triée. */
function branchConfig(dir) {
  const res = spawnSync('git', ['config', '--get-regexp', '^branch\\.'], {
    cwd: dir,
    encoding: 'utf8',
    env: ENV(),
  });
  return res.stdout.split('\n').filter(Boolean).sort().join('\n');
}

before(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-suivi-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-suivi-projet-')));
  mkdirSync(join(root, 'home'));
  // L'analyse lit la configuration git du processus : HOME neutre, pas de configuration système.
  process.env.HOME = join(root, 'home');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  upstream = join(root, 'amont');
  git(root, ['init', '-q', '-b', 'develop', upstream]);
  git(upstream, ['commit', '-q', '--allow-empty', '--no-gpg-sign', '-m', 'base']);
  git(upstream, ['branch', 'feat']);
  repo = clone();
  git(repo, ['config', 'alias.nb', 'checkout -b']);
  git(repo, ['config', 'alias.suit', '!git branch --track']);
  always = clone();
  git(always, ['config', 'branch.autoSetupMerge', 'always']);
  guessing = clone();
  git(guessing, ['config', 'worktree.guessRemote', 'true']);
});

after(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

function hook(command, role, cwd = repo) {
  const input = {
    session_id: 's-suivi',
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
 * Formes refusées aux agents et rejouées par git : `mayFail` signale une forme que certaines
 * versions de git rejettent (sans rien écrire) ; quand git l'accepte, elle écrit la branche suivie.
 */
const REAL_REFUSED = [
  // --track explicite, quel que soit le point de départ
  { command: 'git branch --track a develop' },
  { command: 'git branch --track a origin/develop' },
  { command: 'git branch -t a origin/develop' },
  { command: 'git branch --t a develop' },
  { command: 'git branch --tr a develop' },
  { command: 'git branch -ft a develop' },
  { command: 'git branch --no-track --track a develop' },
  { command: 'git branch --track=direct a develop', mayFail: 'git >= 2.35' },
  { command: 'git branch --track=inherit a develop', mayFail: 'git >= 2.35' },
  { command: 'git checkout -b a --track develop' },
  { command: 'git checkout -tb a origin/develop', mayFail: 'git < 2.35 (-t sans valeur)' },
  { command: 'git checkout --track origin/feat' },
  { command: 'git checkout -t origin/feat' },
  { command: 'git checkout --tr origin/feat' },
  { command: 'git checkout -b a --no-track --track develop' },
  { command: 'git switch --track origin/feat' },
  { command: 'git switch --tra origin/feat' },
  { command: 'git switch -c a --track develop' },
  { command: 'git worktree add --track -b a ../w-track develop' },
  { command: 'git worktree add --tr -b a ../w-tr develop' },
  // suivi automatique (branch.autoSetupMerge=true, défaut) : point de départ distant
  { command: 'git branch a origin/develop' },
  { command: 'git branch a refs/remotes/origin/develop' },
  { command: 'git branch a remotes/origin/develop' },
  { command: 'git branch a origin' },
  { command: 'git branch a origin/HEAD' },
  { command: "git branch a '@{u}'" },
  { command: 'git branch -f lot/x origin/feat' },
  { command: 'git checkout -b a origin/develop' },
  { command: 'git checkout -B a origin/develop' },
  { command: 'git checkout -B lot/x origin/feat' },
  { command: 'git checkout -qb a origin/develop' },
  { command: 'git checkout -ba origin/develop' },
  { command: 'git switch -c a origin/develop' },
  { command: 'git switch -C a origin/develop' },
  { command: 'git switch -ca origin/develop' },
  { command: 'git switch --create a origin/develop' },
  { command: 'git switch --cr a origin/develop' },
  { command: 'git switch --force-create a origin/develop' },
  { command: 'git worktree add -b a ../w-auto origin/develop' },
  // branche distante devinée
  { command: 'git checkout feat' },
  { command: 'git checkout feat --' },
  { command: 'git checkout --guess feat' },
  { command: 'git switch feat' },
  { command: 'git worktree add ../w-feat feat' },
  { command: 'git worktree add --guess-remote ../feat' },
  // copie d'une branche suivie
  { command: 'git branch -c suivie copie' },
  { command: 'git branch -C suivie copie' },
  { command: 'git branch --copy suivie copie' },
  // amont de la branche courante (develop) changé
  { command: 'git fetch --set-upstream origin feat' },
  { command: 'git fetch --set-up origin feat' },
  { command: 'git pull -q --set-upstream origin feat' },
  // valeurs de branch.autoSetupMerge données par -c
  { command: 'git -c branch.autoSetupMerge=always branch a develop' },
  { command: 'git -c branch.autoSetupMerge=always branch a lot/x' },
  { command: 'git -c branch.autoSetupMerge=always checkout -b a' },
  { command: 'git -c branch.autoSetupMerge=inherit branch a suivie', mayFail: 'git >= 2.35' },
  { command: 'git -c branch.autoSetupMerge=inherit switch -c a', mayFail: 'git >= 2.35' },
  {
    command: 'git -c branch.autoSetupMerge=simple branch feat origin/feat',
    mayFail: 'git >= 2.37',
  },
  // configuration passée par l'environnement (ce que -c fait en interne)
  { command: `GIT_CONFIG_PARAMETERS="'branch.autoSetupMerge=always'" git branch a develop` },
];

/** Formes refusées aux agents, illisibles ou composées : non rejouées par git. */
const OTHER_REFUSED = [
  'git branch --track',
  // GIT_CONFIG_COUNT : git >= 2.31 seulement (ignoré par git 2.30, qui ne suit alors rien)
  'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=branch.autoSetupMerge GIT_CONFIG_VALUE_0=always git branch a develop',
  'git branch a origin/nouvelle',
  'git fetch origin && git checkout -b a origin/nouvelle',
  'git -c branch.autoSetupMerge=bizarre branch a lot/x',
  'git -C . checkout -b a origin/develop',
  'git status && git checkout -b a origin/develop',
  '(git switch -c a origin/develop)',
  'if true; then git branch a origin/develop; fi',
  "bash -c 'git checkout -b a origin/develop'",
  'git nb a origin/develop',
  'git suit a develop',
  'git switch -c a $START',
  'cd "$D" && git switch -c a origin/develop',
  'cd "$D" && git checkout develop',
  'git fetch --set-upstream',
];

/** Formes permises aux agents, rejouées par git : elles n'écrivent aucune branche suivie. */
const REAL_PERMITTED = [
  'git branch a',
  'git branch a develop',
  'git branch a lot/x',
  'git branch a origin/develop~0',
  'git branch a HEAD~0',
  'git branch --no-track a origin/develop',
  'git branch --track --no-track a origin/develop',
  'git branch --no-t a origin/develop',
  'git branch -f lot/x develop',
  'git branch -c lot/x copie',
  'git branch -m lot/x lot/y',
  'git branch -d lot/x',
  'git branch --sort -committerdate',
  'git branch -vv',
  'git checkout -b a',
  'git checkout -b a develop',
  'git checkout -b a lot/x',
  'git checkout -bt develop',
  'git checkout -b a --no-track origin/develop',
  'git checkout -b a --track --no-track origin/develop',
  'git checkout -B lot/x develop',
  'git checkout lot/x',
  'git checkout develop',
  'git checkout --detach origin/develop',
  'git checkout origin/develop',
  'git checkout --no-guess feat',
  'git -c checkout.guess=false checkout feat',
  'git checkout --orphan neuve',
  'git switch -c a',
  'git switch -c a develop',
  'git switch -ct develop',
  'git switch -c a --no-track origin/develop',
  'git switch --detach origin/develop',
  'git switch lot/x',
  'git switch --no-guess feat',
  'git -c branch.autoSetupMerge=false branch a origin/develop',
  'git -c branch.autoSetupMerge=false checkout -b a origin/develop',
  'git -c branch.autoSetupMerge=inherit branch a lot/x',
  'git -c branch.autoSetupMerge=inherit branch a origin/develop',
  'git -c branch.autoSetupMerge=simple branch a origin/develop',
  'git worktree add -b lot/y ../w-lot develop',
  'git worktree add --no-track -b a ../w-nt origin/develop',
  'git worktree add --no-track ../w-nt2 feat',
  'git worktree add ../w-x lot/x',
  'git worktree add ../w-feat2/feat',
  'git worktree add --detach ../w-d origin/develop',
  'git fetch origin',
  'git fetch origin develop',
  'git pull -q --ff-only origin develop',
  'git config --get branch.autoSetupMerge',
];

/** Rejoue `command` dans un clone neuf : code de sortie et configuration branch.* changée. */
function replay(command) {
  const dir = clone();
  const beforeConfig = branchConfig(dir);
  const res = spawnSync('sh', ['-c', command], { cwd: dir, encoding: 'utf8', env: ENV() });
  return { code: res.status, changed: branchConfig(dir) !== beforeConfig, stderr: res.stderr };
}

describe('L18-02 : comportement réel de git (clones jetables)', () => {
  it('chaque forme refusée écrit une branche suivie quand git l’accepte', () => {
    for (const { command, mayFail } of REAL_REFUSED) {
      const r = replay(command);
      if (r.code !== 0 && mayFail) {
        assert.equal(r.changed, false, `${command} (${mayFail}) : échec qui écrit`);
        continue;
      }
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
      assert.ok(r.changed, `${command} : aucune branche suivie écrite`);
    }
  });

  it('chaque forme permise n’écrit aucune branche suivie', () => {
    for (const command of REAL_PERMITTED) {
      const r = replay(command);
      assert.equal(r.changed, false, `${command} : branche suivie écrite`);
    }
  });

  it('branch.autoSetupMerge=always et worktree.guessRemote=true en configuration', () => {
    for (const [config, command] of [
      ['branch.autoSetupMerge=always', 'git branch a develop'],
      ['branch.autoSetupMerge=always', 'git worktree add ../w-always'],
      ['worktree.guessRemote=true', 'git worktree add ../w-guess/feat'],
    ]) {
      const dir = clone();
      git(dir, ['config', ...config.split('=')]);
      const beforeConfig = branchConfig(dir);
      spawnSync('sh', ['-c', command], { cwd: dir, env: ENV() });
      assert.notEqual(branchConfig(dir), beforeConfig, `${config} : ${command}`);
    }
  });
});

describe('L18-02 : création d’une branche suivie refusée aux agents', () => {
  it('connaît les quinze rôles d’agent', () => {
    assert.equal(ROLES.length, 15, ROLES.join(', '));
    assert.ok(!ROLES.includes('main'));
  });

  const refused = [...REAL_REFUSED.map((c) => c.command), ...OTHER_REFUSED];

  for (const role of ROLES) {
    it(`refuse chaque forme au rôle ${role}`, () => {
      for (const command of refused) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.match(deny ?? '', REASON, `${role} : ${command}`);
      }
    });
  }

  it('le hook complet refuse chaque forme à dev-api', () => {
    for (const command of refused) {
      const r = hook(command, 'dev-api');
      assert.equal(r.code, 2, `dev-api : ${command}`);
      assert.match(r.stderr, REASON, `dev-api : ${command}`);
    }
  });

  it('suit la configuration du dépôt : branch.autoSetupMerge=always, worktree.guessRemote=true', () => {
    for (const [dir, command] of [
      [() => always, 'git branch a develop'],
      [() => always, 'git checkout -b a lot/x'],
      [() => always, 'git switch -c a'],
      [() => always, 'git worktree add ../w-always'],
      [() => guessing, 'git worktree add ../w-guess/feat'],
    ]) {
      for (const role of ['dev-api', 'qa', 'lead-architecte', 'correcteur']) {
        const deny = analyzeCommand(command, dir(), role).deny;
        assert.match(deny ?? '', REASON, `${role} : ${command}`);
      }
      const r = hook(command, 'dev-api', dir());
      assert.equal(r.code, 2, `dev-api : ${command}`);
      // La session principale garde ces commandes.
      assert.equal(analyzeCommand(command, dir(), 'main').deny, null, `main : ${command}`);
    }
  });

  it('laisse aux agents les créations de branche sans suivi', () => {
    for (const command of REAL_PERMITTED) {
      for (const role of ['dev-api', 'qa', 'lead-architecte', 'correcteur']) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.equal(deny, null, `${role} : ${command}`);
      }
      const r = hook(command, 'dev-api');
      assert.equal(r.code, 0, `dev-api : ${command} : ${r.stderr}`);
    }
  });
});

describe('L18-02 : la session principale garde ces commandes', () => {
  it('accepte chaque forme refusée aux agents', () => {
    for (const command of [...REAL_REFUSED.map((c) => c.command), ...OTHER_REFUSED]) {
      assert.equal(analyzeCommand(command, repo, 'main').deny, null, command);
      const r = hook(command, 'main');
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });

  it('crée ses branches de lot depuis develop locale (git worktree add -b)', () => {
    for (const command of [
      'git worktree add -b lot/x .claude/worktrees/lot-x develop',
      'git worktree add .claude/worktrees/lot-x -b lot/x develop',
      'git worktree add -b lot/18-suites ../lot-18 develop',
    ]) {
      for (const dir of [repo, always]) {
        assert.equal(analyzeCommand(command, dir, 'main').deny, null, command);
        const r = hook(command, 'main', dir);
        assert.equal(r.code, 0, `${command} : ${r.stderr}`);
      }
    }
  });
});

describe('L18-02 : branch.autoSetupMerge et branch.autoSetupRebase ne s’écrivent pas', () => {
  it('écriture refusée à tous, la session principale comprise ; lecture permise', () => {
    for (const command of [
      'git config branch.autoSetupMerge always',
      'git config branch.autosetupmerge false',
      'git config --global branch.autoSetupMerge always',
      'git config --add branch.autoSetupRebase always',
      'git config --unset branch.autoSetupMerge',
      'git config set branch.autoSetupRebase always',
      'git config unset branch.autoSetupMerge',
    ]) {
      for (const role of ['main', ...ROLES]) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.match(deny ?? '', /destination des push/, `${role} : ${command}`);
      }
      const r = hook(command, 'main');
      assert.equal(r.code, 2, `main : ${command}`);
    }
    for (const command of [
      'git config --get branch.autoSetupMerge',
      'git config branch.autoSetupRebase',
      'git config get branch.autoSetupMerge',
    ]) {
      for (const role of ['main', 'dev-api']) {
        assert.equal(analyzeCommand(command, repo, role).deny, null, `${role} : ${command}`);
      }
    }
  });
});
