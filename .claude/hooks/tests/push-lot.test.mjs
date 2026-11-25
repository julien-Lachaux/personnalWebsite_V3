// L20-01 (décision de Julien du 21 nov. 2026, flux par pull request) : la session principale pousse
// la branche d'un lot vers origin pour en ouvrir la pull request, sous son nom et en clair
// (git push [-u | --set-upstream] origin lot/<nom>[:lot/<nom>]). Push forcé, suppression d'une
// branche distante, autre nom de destination, main, étiquettes : toujours refusés ; les agents ne
// poussent jamais. Rejeu par l'analyse de la commande et par le hook complet (entrée JSON de
// PreToolUse) ; rien n'est poussé. Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { analyzeCommand } from '../lib/shell.mjs';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(HOOKS, 'guard.mjs');
const AGENTS = join(dirname(HOOKS), 'agents');
const ROLES = [
  ...new Set([
    ...readdirSync(AGENTS)
      .filter((f) => f.endsWith('.md'))
      .map((f) => /^name:\s*(\S+)\s*$/m.exec(readFileSync(join(AGENTS, f), 'utf8'))[1]),
    'revue-pr',
  ]),
].sort();

let repo;
let project;

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-push-lot-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-push-lot-projet-')));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
});

after(() => {
  for (const dir of [repo, project]) rmSync(dir, { recursive: true, force: true });
});

const denyOf = (command, role) => analyzeCommand(command, repo, role).deny;

function hook(command, role) {
  const input = {
    session_id: 's-push-lot',
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

const ALLOWED = [
  'git push -u origin lot/20-flux-pr',
  'git push --set-upstream origin lot/20-flux-pr',
  'git push origin lot/20-flux-pr',
  'git push origin lot/20-flux-pr:lot/20-flux-pr',
  'git push -u origin lot/F6-sections',
  'git push -u origin "lot/20-flux-pr"',
  'git -C . push -u origin lot/20-flux-pr',
  'cd . && git push -u origin lot/20-flux-pr',
  'git push -u origin lot/20-flux-pr && gh pr create --base develop --head lot/20-flux-pr --title x --body y',
];

const REFUSED = [
  ['git push --force origin lot/20-flux-pr', /push forcé/],
  ['git push -f origin lot/20-flux-pr', /push forcé/],
  ['git push --force-with-lease origin lot/20-flux-pr', /push forcé/],
  ['git push origin +lot/20-flux-pr', /refspec forcée/],
  ['git push origin :lot/20-flux-pr', /supprime une branche distante/],
  ['git push --delete origin lot/20-flux-pr', /suppression d'une branche distante/],
  ['git push origin lot/20-flux-pr:lot/autre', /sous son nom/],
  ['git push origin lot/20-flux-pr:develop', /sous son nom/],
  ['git push origin lot/20-flux-pr:main', /main est réservée à Julien/],
  ['git push origin refs/heads/lot/20-flux-pr', /sous son nom/],
  ['git push origin lot/a/b', /sous son nom/],
  ['git push origin lot/', /sous son nom/],
  ['git push origin lot/20-flux-pr develop', /plusieurs refspecs/],
  ['git push upstream lot/20-flux-pr', /remote upstream refusé/],
  ['git push origin lot/$NOM', /refusée|sous son nom/],
  ['git push origin "$(git branch --show-current)"', /refusée|illisible/],
  ['git push --tags origin lot/20-flux-pr', /étiquettes/],
  ['git push -o ci.skip origin lot/20-flux-pr', /options transmises au serveur/],
  ['git push --no-verify origin lot/20-flux-pr', /contourne le hook pre-push/],
  ['bash -c "git push -u origin lot/20-flux-pr"', /code opaque/],
];

describe('L20-01 : push d’une branche de lot par la session principale', () => {
  it('accepte la branche de lot sous son nom, -u et --set-upstream compris', () => {
    for (const command of ALLOWED) assert.equal(denyOf(command, 'main'), null, command);
  });

  it('le hook complet laisse passer git push -u origin lot/<nom>', () => {
    for (const command of [ALLOWED[0], ALLOWED[1], 'git push origin develop']) {
      const r = hook(command, 'main');
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });

  for (const [command, reason] of REFUSED) {
    it(`refuse ${command}`, () => {
      const deny = denyOf(command, 'main');
      assert.notEqual(deny, null, command);
      assert.match(deny, reason, `${command} : ${deny}`);
    });
  }
});

describe('L20-01 : push d’une branche de lot refusé aux agents', () => {
  for (const role of ROLES) {
    it(`refuse au rôle ${role}`, () => {
      for (const command of [...ALLOWED, ...REFUSED.map(([c]) => c)]) {
        const deny = denyOf(command, role);
        assert.notEqual(deny, null, `${role} : ${command}`);
      }
      const deny = denyOf(ALLOWED[0], role);
      assert.match(deny, /git push est interdit aux agents/);
      assert.match(deny, new RegExp(`rôle ${role}`));
    });
  }

  it('le hook complet refuse git push -u origin lot/<nom> aux agents', () => {
    for (const role of ['revue-pr', 'dev-devops', 'lead-architecte']) {
      const r = hook(ALLOWED[0], role);
      assert.equal(r.code, 2, role);
      assert.match(r.stderr, /git push est interdit aux agents/, role);
    }
  });
});
