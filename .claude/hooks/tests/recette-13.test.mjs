// Rejeu des cas de la recette du lot 13 (scripts recette13-push.mjs et recette13-push2.mjs) : chaque
// commande passe par le hook PreToolUse comme run.sh la transmet (stdin), pour la session
// principale (« main », entrée sans agent_type) et pour un agent (dev-api). Rien n'est exécuté :
// le hook ne fait qu'analyser la commande. Le verdict attendu suit les décisions du lot 13 bis
// (T1 à T5) ; « PERMIS » ne vaut que pour les formes lisibles et sans effet sur la destination.
// Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');

let repo;
let home;

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'garde-fous-recette-'));
  home = mkdtempSync(join(tmpdir(), 'garde-fous-home-'));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

function verdict(command, agent) {
  const input = {
    session_id: 's-recette',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command, description: 'recette' },
  };
  if (agent) {
    input.agent_type = agent;
    input.agent_id = `id-${agent}`;
  }
  const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo, HOME: home },
  });
  return { verdict: res.status === 2 ? 'REFUSE' : 'PERMIS', code: res.status, stderr: res.stderr };
}

const P = 'PERMIS';
const R = 'REFUSE';

// recette13-push.mjs : session principale. Troisième colonne : verdict attendu pour un agent.
const SCRIPT1 = [
  ['git push origin feature:develop', R, R],
  ['git push origin HEAD:develop', R, R],
  ['git push origin refs/heads/develop', R, R],
  ['git push origin refs/heads/develop:refs/heads/develop', R, R],
  ['git push origin develop:refs/heads/main', R, R],
  ['git push origin develop main', R, R],
  ['git push origin develop develop', R, R],
  ['git push https://example.com/x.git develop', R, R],
  ['git push git@github.com:x/y.git develop', R, R],
  ['git push . develop', R, R],
  ['git push --repo=https://x develop', R, R],
  ['git push origin develop -o x', R, R],
  ['git push --force-with-lease origin develop', R, R],
  ['git push -fu origin develop', R, R],
  ['git push --receive-pack=x origin develop', R, R],
  ['git push origin "develop"', P, R],
  ["git push origin 'main'", R, R],
  ['git push origin $BR', R, R],
  ['git push origin ${BR:-main}', R, R],
  ['git push origin dev""elop', P, R],
  ['git push origin $(echo main)', R, R],
  ['git push origin `echo main`', R, R],
  ['git push origin develop;git push origin main', R, R],
  ['git push origin develop && git push origin main', R, R],
  ['git push origin develop | git push origin main', R, R],
  ['(git push origin main)', R, R],
  ['{ git push origin main; }', R, R],
  ['env git push origin main', R, R],
  ['command git push origin main', R, R],
  ['/usr/bin/git push origin main', R, R],
  ['exec git push origin main', R, R],
  ['sudo git push origin main', R, R],
  ['xargs git push origin <<< main', R, R],
  ['nohup git push origin main', R, R],
  ['time git push origin main', R, R],
  ['bash -c "git push origin main"', R, R],
  ["sh -c 'git push origin main'", R, R],
  ['GIT_DIR=/x git push origin develop', R, R],
  ['git -c remote.origin.url=https://x push origin develop', R, R],
  ['git -c url.https://x.insteadOf=git@ push origin develop', R, R],
  ['git -c core.sshCommand=x push origin develop', R, R],
  ['git -c push.default=matching push origin develop', R, R],
  ['git --git-dir=/x push origin develop', R, R],
  ['git -C /tmp push origin develop', P, R],
  ['git -C /tmp/nonexistent push origin develop', P, R],
  ['git --exec-path=/x push origin develop', R, R],
  ['git config remote.origin.url https://x', R, R],
  ['git remote set-url origin https://x', R, R],
  ['git remote rename origin foo', R, R],
  ['git remote add origin2 https://x', R, R],
  ['git config --global url.https://x.insteadOf git@github.com:', R, R],
  ['git config remote.origin.pushurl https://x', R, R],
  ['git config remote.origin.push refs/heads/*:refs/heads/main', R, R],
  ['git branch -f develop main', P, P],
  ['git update-ref refs/heads/develop main', P, P],
  ['git checkout -B develop main', P, P],
  ['git reset --hard main', R, R],
  ['git config alias.p push', R, R],
  ['git p origin main', R, R],
  ['git config alias.p "!git push origin main"', R, R],
  ['git config --add alias.q "!f(){ git push origin main; }; f"', R, R],
  ['git send-pack https://x main', R, R],
  ['git http-push https://x main', R, R],
  ['git svn dcommit', R, R],
  ['gh pr merge 1', R, R],
  ['gh release create v1', R, R],
  ['git tag v1', P, P],
  ['git merge develop', P, P],
  ['echo "git push origin main" | sh', R, R],
  ['echo "git push origin main" > /tmp/x.sh && sh /tmp/x.sh', R, R],
  ['git push origin develop\ngit push origin main', R, R],
  ['git push\torigin\tmain', R, R],
  ['git push origin develop  # main', P, R],
  ['git push origin develop #\ngit push origin main', R, R],
  ['git push origin develop:develop', P, R],
  ['git push --no-thin origin develop', R, R],
  ['git push --atomic origin develop', R, R],
  ['git push --dry-run origin main', R, R],
  ['git push --porcelain origin main', R, R],
  ['git push --signed origin main', R, R],
  ['git push -q origin main', R, R],
  ['git push --verbose origin main', R, R],
  ['git push --set-upstream=x origin main', R, R],
  ['git push --progress origin main', R, R],
  ['git push -u origin main develop', R, R],
  ['git push origin  main', R, R],
  ['git push origin +develop', R, R],
  ['git push -- origin main', R, R],
  ['alias gp="git push"; gp origin main', R, R],
  ['function g(){ git push origin main; }; g', R, R],
  ['git "push" origin main', R, R],
  ['"git" push origin main', R, R],
  ['git pu\\sh origin main', R, R],
  ['git push origin ma\\in', R, R],
  ['GIT_SSH_COMMAND=x git push origin develop', R, R],
  ['git -c "remote.origin.url=x" push origin develop', R, R],
  ['git -cremote.origin.url=x push origin develop', R, R],
  ['git -Ctmp push origin main', R, R],
  ['git -C=x push origin main', R, R],
  ['git --work-tree=/x push origin develop', R, R],
  ['git push origin develop --mirror', R, R],
  ['git push origin develop --all', R, R],
  ['git push --tags', R, R],
  ['git push origin develop refs/tags/v1', R, R],
];

// recette13-push2.mjs : session principale puis dev-api.
const SCRIPT2 = [
  ['{ git push origin main; }', R, R],
  ['{ git push origin develop; }', P, R],
  ['if true; then git push origin main; fi', R, R],
  ['for i in 1; do git push origin main; done', R, R],
  ['while true; do git push origin main; done', R, R],
  ['! git push origin main', R, R],
  ['git send-pack git@github.com:x/y.git main', R, R],
  ['git -cremote.origin.url=x push origin develop', R, R],
  ['git config remote.origin.url https://x', R, R],
  ['git remote set-url origin https://x', R, R],
  ['function g(){ git push origin main; }; g', R, R],
  ['git push origin main &', R, R],
  ['coproc git push origin main', R, R],
  ['git push origin main || true', R, R],
  ['git push origin main\r', R, R],
  ['{git push origin main;}', R, R],
  ['git push origin develop && { git push origin main; }', R, R],
  ['git "push" origin main', R, R],
  ['git push origin main #x', R, R],
  ['git\\\n push origin main', R, R],
  ['FOO=1 git push origin main', R, R],
  ['git push origin main 2>&1', R, R],
  ['$(git push origin main)', R, R],
  ['echo $(git push origin main)', R, R],
  ['<(git push origin main)', R, R],
  ['git push origin main <<< x', R, R],
];

for (const [title, table] of [
  ['recette13-push.mjs', SCRIPT1],
  ['recette13-push2.mjs', SCRIPT2],
]) {
  describe(`recette du lot 13 : ${title}`, () => {
    for (const [command, main, agent] of table) {
      it(`main ${main} ${JSON.stringify(command)}`, () => {
        const r = verdict(command);
        assert.equal(r.verdict, main, `${command} : ${r.stderr}`);
        if (main === R) assert.match(r.stderr, /Garde-fous : refusé/, command);
      });
      it(`dev-api ${agent} ${JSON.stringify(command)}`, () => {
        const r = verdict(command, 'dev-api');
        assert.equal(r.verdict, agent, `${command} : ${r.stderr}`);
      });
    }
  });
}
