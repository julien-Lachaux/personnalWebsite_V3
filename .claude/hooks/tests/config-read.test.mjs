// L18-01 (décision de Julien du 20 nov. 2026) : les lectures de la configuration git
// (git config --get et ses équivalents), core.hooksPath compris, sont permises comme le dit
// CLAUDE.md ; toute écriture reste refusée comme avant : core.hooksPath (et la section core
// entière), remote.*, url.*, push.*, branch.*.remote, branch.*.pushRemote, include*, édition libre.
// Faux positif constaté à la recette du lot 14 : `git config --get core.hooksPath` était refusé
// avec le motif « changer core.hooksPath ». Chaque cas passe par l'analyse de la commande pour la
// session principale et pour quatre rôles d'agent, et par l'entrée JSON du hook PreToolUse pour
// dev-api et la session principale ; rien n'est exécuté. Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { analyzeCommand } from '../lib/shell.mjs';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(HOOKS, 'guard.mjs');
const ROLES = ['main', 'dev-api', 'qa', 'lead-architecte', 'correcteur'];

let repo;
let project;

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-config-lecture-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-config-lecture-projet-')));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

function hook(command, role) {
  const input = {
    session_id: 's-config-lecture',
    cwd: repo,
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
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

/** Lectures permises à tous : ancienne syntaxe, sous-commandes get et list, options de lecture. */
const READS = [
  'git config --get core.hooksPath',
  'git config --get-all core.hooksPath',
  'git config --get-regexp core.hooks',
  "git config --get-regexp '^core\\.'",
  'git config core.hooksPath',
  'git config --local --get core.hooksPath',
  'git config --global --get core.hooksPath',
  'git config --show-origin --get core.hooksPath',
  'git config --show-scope --get core.hooksPath',
  'git config --type=path --get core.hooksPath',
  'git config --type path --get core.hooksPath',
  'git config --default .husky/_ --get core.hooksPath',
  'git config -f .git/config --get core.hooksPath',
  'git config --file=.git/config --get core.hooksPath',
  'git config -z --get core.hooksPath',
  'git config get core.hooksPath',
  'git config get --all core.hooksPath',
  'git config get --show-origin core.hooksPath',
  'git config --list',
  'git config -l',
  'git config --list --show-origin',
  'git config list',
  'git config list --show-scope',
  'git config --get remote.origin.url',
  'git config --get-all remote.origin.fetch',
  'git config --get branch.develop.remote',
  'git config --get branch.develop.merge',
  'git config --get-regexp ^remote\\.',
  'git config --get-regexp ^branch\\.',
  'git config --get-urlmatch http https://example.org',
  'git config --get push.default',
  'git config --get include.path',
  'git config get remote.origin.url',
  'git config --get alias.p',
  'git config --get alias.p push',
  'git config --get-regexp alias push',
  'git config --get branch.autoSetupMerge',
  'git config --get branch.autoSetupRebase',
  'git -C . config --get core.hooksPath',
  'git status && git config --get core.hooksPath',
  'test "$(git config --get core.hooksPath)" = .husky/_ && echo ok',
  "bash -c 'git config --get core.hooksPath'",
];

/** Écritures refusées à tous, la session principale comprise. */
const HOOKS_PATH_WRITES = [
  'git config core.hooksPath /dev/null',
  'git config core.hookspath /dev/null',
  'git config --local core.hooksPath /dev/null',
  'git config --global core.hooksPath /dev/null',
  'git config -f .git/config core.hooksPath /dev/null',
  'git config --file=.git/config core.hooksPath /dev/null',
  'git config --add core.hooksPath /dev/null',
  'git config --replace-all core.hooksPath /dev/null',
  'git config --unset core.hooksPath',
  'git config --unset-all core.hooksPath',
  'git config --unset-a core.hooksPath',
  'git config --un core.hooksPath',
  'git config --type=path core.hooksPath /dev/null',
  'git config --comment --get core.hooksPath /dev/null',
  'git config --default --get core.hooksPath /dev/null',
  'git config --get --unset core.hooksPath',
  'git config set core.hooksPath /dev/null',
  'git config set --comment x core.hooksPath /dev/null',
  'git config unset core.hooksPath',
  'git config --remove-section core',
  'git config --rename-section core ailleurs',
  'git config remove-section core',
  'git config rename-section core ailleurs',
  'git -c core.hooksPath=/dev/null commit -m x',
  'git -ccore.hooksPath=/dev/null commit -m x',
  'git status && git config --unset core.hooksPath',
  "bash -c 'git config core.hooksPath /dev/null'",
];

const DESTINATION_WRITES = [
  'git config remote.origin.url https://example.org/x.git',
  'git config --add remote.origin.pushurl https://example.org/x.git',
  'git config set remote.origin.url https://example.org/x.git',
  'git config --unset remote.origin.url',
  'git config unset remote.origin.url',
  'git config url.https://example.org/.insteadOf git@github.com:',
  'git config push.default matching',
  'git config branch.develop.remote ext',
  'git config branch.develop.pushRemote ext',
  'git config --unset branch.develop.remote',
  'git config include.path ../x',
  'git config includeIf.gitdir:/x.path ../x',
  'git config --remove-section remote.origin',
  'git config --rename-section branch.develop branch.autre',
  'git config --edit',
  'git config -e',
  'git config edit',
  'git config --comment --get remote.origin.url https://example.org/x.git',
];

describe('L18-01 : lectures de la configuration git permises', () => {
  it('chaque lecture est permise à la session principale et aux agents', () => {
    for (const command of READS) {
      for (const role of ROLES) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.equal(deny, null, `${role} : ${command}`);
      }
    }
  });

  it('le hook complet laisse passer les lectures (dev-api et session principale)', () => {
    for (const command of READS) {
      for (const role of ['main', 'dev-api']) {
        const r = hook(command, role);
        assert.equal(r.code, 0, `${role} : ${command} : ${r.stderr}`);
      }
    }
  });
});

describe('L18-01 : écritures de la configuration git toujours refusées', () => {
  it('écrire, retirer ou renommer core.hooksPath est refusé à tous', () => {
    for (const command of HOOKS_PATH_WRITES) {
      for (const role of ROLES) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.match(deny ?? '', /core\.hooksPath/, `${role} : ${command}`);
      }
      const r = hook(command, 'dev-api');
      assert.equal(r.code, 2, `dev-api : ${command}`);
      assert.match(r.stderr, /core\.hooksPath/, `dev-api : ${command}`);
    }
  });

  it('les clés de destination des push restent refusées à tous', () => {
    for (const command of DESTINATION_WRITES) {
      for (const role of ROLES) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.match(deny ?? '', /destination des push/, `${role} : ${command}`);
      }
      const r = hook(command, 'main');
      assert.equal(r.code, 2, `main : ${command}`);
    }
  });

  it('un alias qui lance git push reste refusé à l’écriture', () => {
    for (const command of [
      'git config alias.p push',
      'git config alias.p "!git push origin main"',
      'git config --add alias.q "!f(){ git push origin main; }; f"',
      'git config set alias.p push',
    ]) {
      for (const role of ROLES) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.match(deny ?? '', /alias qui lance git push/, `${role} : ${command}`);
      }
    }
  });

  it('git refuse lui-même deux actions à la fois (lecture et retrait)', () => {
    // Mesuré sur un dépôt jetable : --get --unset n'est ni une lecture ni un retrait pour git.
    const res = spawnSync('git', ['config', '--get', '--unset', 'core.hooksPath'], {
      cwd: repo,
      encoding: 'utf8',
    });
    assert.notEqual(res.status, 0);
  });
});
