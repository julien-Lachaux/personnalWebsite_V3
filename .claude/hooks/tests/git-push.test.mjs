// Règle de git push (git flow, décision de Julien du 19 nov. 2026) : seule la session principale
// (rôle « main », entrée sans agent_type) pousse, et uniquement develop ou une branche lot/<nom>
// vers origin (flux par pull request depuis le 21 nov. 2026). Chaque cas
// rejoue l'entrée JSON du hook PreToolUse comme run.sh la transmet (stdin) ; rien n'est poussé, le
// hook ne fait qu'analyser la commande. Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');

let repo;

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'garde-fous-push-'));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
});

/** Appelle le hook PreToolUse pour une commande Bash ; `agent` absent = session principale. */
function bash(command, agent) {
  const input = {
    session_id: 's-push',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command, description: 'test' },
  };
  if (agent) {
    input.agent_type = agent;
    input.agent_id = `id-${agent}`;
  }
  const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
  });
  return { code: res.status, stderr: res.stderr };
}

const ALLOWED = [
  'git push origin develop',
  'git push -u origin develop',
  'git push --set-upstream origin develop',
  'git push origin develop:develop',
  // L20-01 (flux par pull request, décision de Julien du 21 nov. 2026) : branche de lot sous son nom.
  'git push -u origin lot/13-git-flow',
];

describe('git push : formes permises à la session principale', () => {
  it('accepte les trois formes et la refspec develop:develop', () => {
    for (const command of ALLOWED) {
      const r = bash(command);
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });

  it('accepte les options globales -C et -c ordinaires, et un cd préalable', () => {
    for (const command of [
      `git -C ${repo} push origin develop`,
      'git -C . push -u origin develop',
      'git -c color.ui=never push origin develop',
      `cd ${repo} && git push origin develop`,
    ]) {
      const r = bash(command);
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });
});

describe('git push : refusé aux agents', () => {
  for (const agent of ['dev-api', 'lead-architecte', 'correcteur', 'chef-de-projet']) {
    it(`refuse chaque forme permise au rôle ${agent}`, () => {
      for (const command of [...ALLOWED, `git -C ${repo} push origin develop`]) {
        const r = bash(command, agent);
        assert.equal(r.code, 2, `${agent} : ${command}`);
        assert.match(r.stderr, /git push est interdit aux agents/, command);
        assert.match(r.stderr, new RegExp(`rôle ${agent}`), command);
      }
    });
  }

  it('laisse les agents lire ce qui parle de push', () => {
    for (const command of [
      'git log --oneline --grep push',
      'grep -rn "git push" docs',
      'git config --get alias.push',
    ]) {
      const r = bash(command, 'dev-api');
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });
});

describe('git push : variantes refusées à la session principale', () => {
  const cases = [
    // Autre branche ou refspec.
    ['git push origin main', /main est réservée à Julien/],
    ['git push -u origin main', /main est réservée à Julien/],
    ['git push origin develop:main', /main est réservée à Julien/],
    ['git push origin HEAD:main', /main est réservée à Julien/],
    ['git push origin refs/heads/main', /main est réservée à Julien/],
    ['git push origin master', /main est réservée à Julien/],
    ['git push origin HEAD', /HEAD dépend de la branche courante/],
    ['git push origin HEAD:develop', /HEAD dépend de la branche courante/],
    ['git push origin +develop', /refspec forcée/],
    ['git push origin +develop:develop', /refspec forcée/],
    ['git push origin :develop', /supprime une branche distante/],
    ['git push origin lot/13-git-flow:lot/autre', /branche de lot se pousse sous son nom/],
    ['git push origin release/1.0.0', /refspec release\/1\.0\.0 refusée/],
    ['git push origin refs/tags/v1.0.0', /étiquettes de version sont réservées/],
    ['git push origin tag v1.0.0', /étiquettes de version sont réservées/],
    ['git push origin v1.0.0', /refspec v1\.0\.0 refusée/],
    ['git push origin develop main', /plusieurs refspecs/],
    // Push forcé.
    ['git push --force origin develop', /push forcé \(--force\)/],
    ['git push origin develop --force', /push forcé/],
    ['git push -f origin develop', /push forcé \(-f\)/],
    ['git push -uf origin develop', /push forcé \(-uf\)/],
    ['git push --force-with-lease origin develop', /push forcé/],
    ['git push --force-with-lease=develop:0123abc origin develop', /push forcé/],
    ['git push --force-if-includes origin develop', /push forcé/],
    // Suppression, plusieurs références, étiquettes.
    ['git push --delete origin develop', /suppression d'une branche distante/],
    ['git push -d origin develop', /suppression d'une branche distante/],
    ['git push --prune origin develop', /supprime des branches distantes/],
    ['git push --all origin', /pousse plusieurs références/],
    ['git push --mirror origin', /pousse plusieurs références/],
    ['git push --tags origin develop', /pousse des étiquettes/],
    ['git push --follow-tags origin develop', /pousse des étiquettes/],
    // Options transmises au serveur ou autres options.
    ['git push --push-option=ci.skip origin develop', /options transmises au serveur/],
    ['git push --push-option ci.skip origin develop', /options transmises au serveur/],
    ['git push -o ci.skip origin develop', /options transmises au serveur/],
    ['git push --no-verify origin develop', /contourne le hook pre-push/],
    ['git push --repo=origin develop', /change le dépôt ou la commande distante/],
    ['git push --receive-pack=x origin develop', /change le dépôt ou la commande distante/],
    ['git push --dry-run origin develop', /option --dry-run non permise/],
    ['git push -- origin develop', /option -- non permise/],
    // Refspec absente : dépend de la configuration.
    ['git push', /sans remote ni branche explicite dépend de la configuration/],
    ['git -C . push', /dépend de la configuration/],
    ['git push origin', /sans branche explicite dépend de la configuration/],
    ['git push -u origin', /dépend de la configuration/],
    // Autre remote.
    ['git push upstream develop', /remote upstream refusé/],
    ['git push git@example.invalid:x/y.git develop', /remote .* refusé : seul origin/],
    // Destination ou configuration changées autour du push.
    ['git --git-dir=/tmp/autre push origin develop', /option globale --git-dir/],
    ['git --git-dir /tmp/autre push origin develop', /option globale --git-dir/],
    ['git --namespace=x push origin develop', /option globale --namespace/],
    ['git --config-env remote.origin.url=X push origin develop', /option globale --config-env/],
    ['git -c remote.origin.url=/tmp/autre push origin develop', /cette configuration change/],
    ['git -c remote.origin.pushurl=/tmp/autre push origin develop', /cette configuration change/],
    ['git -c url./tmp/x.insteadOf=origin push origin develop', /cette configuration change/],
    ['GIT_DIR=/tmp/autre git push origin develop', /variable GIT_DIR/],
    ['env GIT_CONFIG_COUNT=1 git push origin develop', /variable GIT_CONFIG_COUNT/],
    // Push caché : alias, code opaque, segment suivant.
    ['git -c alias.p=push p origin main', /alias qui lance git push/],
    ['git config alias.p push', /alias qui lance git push/],
    ["bash -c 'git push origin main'", /git push dans du code opaque/],
    ["sh -c 'git push origin develop'", /git push dans du code opaque/],
    // xargs ajouterait des refspecs lues sur l'entrée standard à une forme d'apparence permise.
    ['echo main | xargs git push origin develop', /git push dans du code opaque \(xargs git\)/],
    [`python3 -c "import subprocess; subprocess.run(['git', 'push'])"`, /code opaque/],
    ['git push origin develop && git push origin main', /main est réservée à Julien/],
  ];

  for (const [command, reason] of cases) {
    it(`refuse ${command}`, () => {
      const r = bash(command);
      assert.equal(r.code, 2, command);
      assert.match(r.stderr, reason, `${command} : ${r.stderr}`);
    });
  }

  it('refuse aussi ces variantes aux agents', () => {
    for (const [command] of cases) {
      assert.equal(bash(command, 'dev-api').code, 2, command);
    }
  });
});
