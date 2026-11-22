// L22-02 (décision de Julien du 21 nov. 2026) : pull request vers main. La session principale (rôle
// « main ») pousse une branche release/<majeur>.<mineur>.<correctif> vers origin, ouvre la pull
// request (gh pr create --base main --head release/<version>) et la fusionne par commit de merge
// (gh pr merge --merge release/<version>), après l'accord explicite de Julien : règle de
// l'orchestrateur, que le hook ne peut pas vérifier. Squash, rebase, --admin, --delete-branch et
// --auto restent refusés ; le push de main et des étiquettes aussi. Les agents ne font rien de tout
// cela. Rejeu par l'analyse de la commande (lib/shell.mjs) et, pour un échantillon, par le hook
// complet ; rien n'est poussé ni envoyé à GitHub. Lancé par `pnpm hooks:test`.

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
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-release-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-release-projet-')));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
});

after(() => {
  for (const dir of [repo, project]) rmSync(dir, { recursive: true, force: true });
});

const denyOf = (command, role = 'main') => analyzeCommand(command, repo, role).deny;

function hook(command, role = 'main') {
  const input = {
    session_id: 's-release',
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

const WRITES = [
  'git push origin release/1.0.0',
  'git push -u origin release/1.0.0',
  'git push --set-upstream origin release/1.2.3',
  'git push origin release/1.0.0:release/1.0.0',
  'git push -u origin release/10.20.30',
  'gh pr create --base main --head release/1.0.0 --title "Version 1.0.0" --body "Notes."',
  'gh pr create -B main -H release/1.0.0 --title x --body y',
  'gh pr create --base=main --head=release/1.0.0 --fill',
  'gh pr merge --merge release/1.0.0',
  'gh pr merge -m release/1.0.0',
  'gh pr merge --merge release/1.0.0 --subject "Version 1.0.0"',
];

const REFUSED = [
  // Nom de release hors de la forme majeur.mineur.correctif.
  ['git push origin release/1.0', /refspec release\/1\.0 refusée|branche de release/],
  ['git push origin release/v1.0.0', /branche de release se pousse sous son nom/],
  ['git push origin release/01.0.0', /branche de release se pousse sous son nom/],
  ['git push origin release/1.0.0-rc.1', /branche de release se pousse sous son nom/],
  ['git push origin release/1.0.0:release/1.0.1', /branche de release se pousse sous son nom/],
  ['git push origin release/1.0.0:main', /main est réservée à Julien/],
  ['git push origin refs/heads/release/1.0.0', /branche de release se pousse sous son nom/],
  ['git push --force origin release/1.0.0', /push forcé/],
  ['git push origin +release/1.0.0', /refspec forcée/],
  ['git push origin :release/1.0.0', /supprime une branche distante/],
  ['git push --delete origin release/1.0.0', /suppression d'une branche distante/],
  ['git push --follow-tags origin release/1.0.0', /pousse des étiquettes/],
  ['git push upstream release/1.0.0', /remote upstream refusé/],
  // Push de main et des étiquettes : toujours refusés.
  ['git push origin main', /main est réservée à Julien/],
  ['git push origin release/1.0.0 main', /plusieurs refspecs/],
  ['git push origin v1.0.0', /refspec v1\.0\.0 refusée/],
  ['git push origin refs/tags/v1.0.0', /étiquettes de version sont réservées/],
  // Création : base main seulement depuis release/<version>, et release seulement vers main.
  ['gh pr create --base main --head lot/22-un-seul-run', /pull request de lot vise develop/],
  [
    'gh pr create --base main --title x',
    /--head release\/<majeur>\.<mineur>\.<correctif> obligatoire/,
  ],
  ['gh pr create --base main --head develop', /--head release\/.* obligatoire/],
  ['gh pr create --base main --head release/1.0', /--head release\/.* obligatoire/],
  ['gh pr create --base main --head x:release/1.0.0', /--head release\/.* obligatoire/],
  [
    'gh pr create --base main --head release/1.0.0 --head release/1.0.1',
    /--head release\/.* obligatoire/,
  ],
  ['gh pr create --base develop --head release/1.0.0', /pull request de release vise main/],
  ['gh pr create --base release/1.0.0 --head lot/22-un-seul-run', /vise develop/],
  ['gh pr create --base main --head release/1.0.0 -R x/y', /autre dépôt/],
  ['GH_REPO=x/y gh pr create --base main --head release/1.0.0', /variable GH_REPO/],
  ['gh pr create --base main --head release/1.0.0 --web', /navigateur/],
  // Édition : la base ne passe jamais à main.
  ['gh pr edit release/1.0.0 --base main', /vise develop/],
  ['gh pr edit 12 --base main', /vise develop/],
  // Fusion : commit de merge seulement, nom de release conforme.
  ['gh pr merge release/1.0.0', /sans --merge/],
  ['gh pr merge --squash release/1.0.0', /jamais squash/],
  ['gh pr merge --rebase release/1.0.0', /jamais rebase/],
  ['gh pr merge --merge --admin release/1.0.0', /contourne la protection/],
  ['gh pr merge --merge --delete-branch release/1.0.0', /supprime la branche distante/],
  ['gh pr merge --merge -d release/1.0.0', /supprime la branche distante/],
  ['gh pr merge --merge --auto release/1.0.0', /fusion différée/],
  ['gh pr merge --merge release/1.0', /branche de lot ou de release/],
  ['gh pr merge --merge main', /branche de lot ou de release/],
  ['gh pr merge --merge release/1.0.0 lot/a', /plusieurs pull requests/],
  ['gh pr merge --merge $REL', /illisible/],
  // Étiquettes et releases GitHub : toujours réservées.
  ['gh release create v1.0.0', /réservé à Julien/],
  ['gh api -X POST repos/x/y/git/refs -f ref=refs/tags/v1.0.0', /seule la lecture/],
];

describe('L22-02 : pull request vers main, session principale', () => {
  for (const command of WRITES) {
    it(`permet ${command}`, () => {
      assert.equal(denyOf(command), null, command);
    });
  }

  for (const [command, reason] of REFUSED) {
    it(`refuse ${command}`, () => {
      const deny = denyOf(command);
      assert.notEqual(deny, null, command);
      assert.match(deny, reason, `${command} : ${deny}`);
    });
  }

  it('le hook complet laisse passer le flux de release et refuse ses variantes interdites', () => {
    for (const command of [
      'git push -u origin release/1.0.0',
      'gh pr create --base main --head release/1.0.0 --title x --body y',
      'gh pr merge --merge release/1.0.0',
    ]) {
      const r = hook(command);
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
    for (const command of [
      'git push origin main',
      'gh pr merge --squash release/1.0.0',
      'gh pr create --base main --head lot/22-un-seul-run',
    ]) {
      const r = hook(command);
      assert.equal(r.code, 2, command);
      assert.match(r.stderr, /Garde-fous : refusé/, command);
    }
  });
});

describe('L22-02 : pull request vers main, agents spécialisés', () => {
  it('quinze rôles, revue-pr compris', () => {
    assert.ok(ROLES.includes('revue-pr'));
    assert.ok(ROLES.length >= 15, ROLES.join(', '));
  });

  for (const role of ROLES) {
    it(`refuse au rôle ${role} le push, la création et la fusion d'une release`, () => {
      for (const command of WRITES) {
        const deny = denyOf(command, role);
        assert.notEqual(deny, null, `${role} : ${command}`);
        assert.match(deny, new RegExp(`rôle ${role}`), `${role} : ${command} : ${deny}`);
        assert.match(deny, /interdit aux agents/, `${role} : ${command} : ${deny}`);
      }
      for (const [command] of REFUSED)
        assert.notEqual(denyOf(command, role), null, `${role} : ${command}`);
    });
  }

  it('le hook complet refuse aux agents le flux de release', () => {
    for (const role of ['dev-devops', 'chef-de-projet', 'revue-pr']) {
      for (const command of [
        'git push -u origin release/1.0.0',
        'gh pr create --base main --head release/1.0.0 --title x --body y',
        'gh pr merge --merge release/1.0.0',
      ]) {
        const r = hook(command, role);
        assert.equal(r.code, 2, `${role} : ${command}`);
        assert.match(r.stderr, /interdit aux agents/, `${role} : ${command}`);
      }
    }
  });
});
