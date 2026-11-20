// L14-07 (décision de Julien du 19 nov. 2026, après la recette du lot 13 bis) : une règle plus
// stricte ne doit pas casser le travail courant. Deux rejeux, par l'entrée JSON du hook PreToolUse
// comme run.sh la transmet (rien n'est exécuté) :
// - les 88 commandes ordinaires de l'orchestrateur rejouées à la recette du lot 13 bis, toutes
//   permises à la session principale, et un échantillon de celles qu'un agent lance, permis à un
//   rôle de chaque famille de chemins d'écriture (sans limite, tests, documents de recette,
//   revues) ; chemins rendus neutres : dépôt et dossiers temporaires du test ;
// - les refus de push de la recette du lot 13 (recette-13.test.mjs, rejoués là pour dev-api) pour
//   chacun des quatorze rôles d'agent, rôles lus dans le frontmatter de .claude/agents/*.md :
//   l'analyse de la commande (lib/shell.mjs) pour toute la table, le hook complet pour ce qu'elle
//   laisse au contrôle des cibles et pour les formes permises à la session principale.
// Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

let W; // dépôt temporaire qui tient lieu de checkout principal (branche develop)
let T; // dossier temporaire hors dépôt (journaux, clone, dossier de session)
let project;
let home;

function write(rel, content) {
  mkdirSync(dirname(join(W, rel)), { recursive: true });
  writeFileSync(join(W, rel), content);
}

before(() => {
  W = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-ordinaires-')));
  T = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-ordinaires-tmp-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-ordinaires-projet-')));
  home = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-ordinaires-home-')));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: W });
  write('docs/backlog.md', '# Backlog\n');
  write('apps/api/src/app.ts', 'export const answer = 42;\n');
  // Le script d'autorisation lancé par l'orchestrateur doit exister pour être lu.
  write('.claude/hooks/authorize.mjs', "console.log('autorisations');\n");
  execFileSync('git', ['add', '-A'], { cwd: W });
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=ci@noreply.invalid', 'commit', '-q', '-m', 'base'],
    { cwd: W },
  );
});

after(() => {
  for (const dir of [W, T, project, home]) rmSync(dir, { recursive: true, force: true });
});

function hook(command, role) {
  const input = {
    session_id: 's-ordinaires',
    cwd: W,
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
    env: { ...process.env, CLAUDE_PROJECT_DIR: project, HOME: home },
  });
  return { code: res.status, stderr: res.stderr };
}

/** Même entrée que `hook`, processus lancé sans attendre (rejeux en parallèle). */
function hookAsync(command, role) {
  return new Promise((done) => {
    const input = {
      session_id: 's-ordinaires',
      cwd: W,
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command, description: 'test' },
    };
    if (role !== 'main') {
      input.agent_type = role;
      input.agent_id = `id-${role}`;
    }
    const child = spawn(process.execPath, [GUARD, 'pre-tool-use'], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: project, HOME: home },
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.stdout.resume();
    child.on('close', (code) => done({ command, code, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

/** Commandes refusées parmi `commands` pour un rôle, rejouées par lots de huit processus. */
async function refusedAmong(commands, role) {
  const results = [];
  for (let k = 0; k < commands.length; k += 8) {
    results.push(...(await Promise.all(commands.slice(k, k + 8).map((c) => hookAsync(c, role)))));
  }
  return results
    .filter((r) => r.code !== 0)
    .map((r) => `${r.command} : ${r.stderr.split('\n')[0]}`);
}

/** Les 88 commandes de la recette du lot 13 bis ; X : worktree d'un lot, S : dossier de session. */
function orchestrator() {
  const X = `${W}/.claude/worktrees/lot-x`;
  const S = `${T}/session`;
  return [
    'git merge --no-ff lot/x -m "merge: lot/x"',
    'git merge --no-ff lot/13bis-durcissement-push -m "merge: lot/13bis (recette acceptee)"',
    'git worktree add .claude/worktrees/lot-x -b lot/x develop',
    `git worktree add ${X} lot/x`,
    'git worktree remove .claude/worktrees/lot-x',
    `git worktree remove --force ${T}/x`,
    'git worktree list',
    'git worktree prune',
    `git -C ${X} status`,
    `git -C ${T}/x log --oneline -5`,
    `git -C ${T}/x diff --stat develop...HEAD`,
    `git -C ${T}/x status --short`,
    'git branch -d lot/x',
    'git branch -D lot/x',
    'git branch -m lot/x lot/y',
    'git branch --list',
    'git status --short',
    'git log --oneline develop..HEAD',
    'git diff develop...HEAD -- docs/',
    'git checkout develop',
    'git switch develop',
    'node .claude/hooks/authorize.mjs grant qa --path "apps/api/test/x.e2e-spec.ts" --reason "x"',
    'node .claude/hooks/authorize.mjs grant correcteur lot-3 --reason x',
    'node .claude/hooks/authorize.mjs revoke qa',
    'node .claude/hooks/authorize.mjs list',
    'pnpm install --frozen-lockfile',
    `pnpm check --force > ${T}/x/check.log 2>&1`,
    `pnpm check --force > ${S}/check.log 2>&1`,
    'pnpm check',
    'pnpm db:down',
    'pnpm hooks:test',
    'pnpm integrity develop',
    'docker compose down -v',
    'docker compose up -d postgres-test',
    'docker compose ps',
    `git commit -q -m "$(printf 'feat(api): x\\n\\nCo-Authored-By: Claude <noreply@example.org>')" -- docs/backlog.md`,
    `git commit -q -m "$(printf 'docs: x\\n\\nJustification-test: GITFLOW-2 y')" -- .claude/hooks/lib/shell.mjs`,
    'git commit -m "docs: x" -m "Co-Authored-By: Claude <noreply@example.org>"',
    'git commit -F /tmp/msg.txt',
    `git commit -q -m "$(cat <<'EOF'\nfeat: x\n\nCo-Authored-By: C\nEOF\n)"`,
    'git add docs/backlog.md',
    'git add -A',
    'git add .',
    `printf 'COMPOSE_PROJECT_NAME=x\\nPOSTGRES_PORT=5852\\n' > ${X}/.env`,
    `printf 'DATABASE_URL=postgres://u:p@localhost:5852/db\\n' > ${X}/apps/api/.env`,
    'grep -rn "foo" apps/api/src',
    'grep -n foo docs/backlog.md | head -20',
    'grep -c foo a b',
    'sed -n "1,40p" docs/backlog.md',
    'sed -n 1,40p .claude/hooks/lib/shell.mjs',
    'cat docs/backlog.md',
    'cat docs/a.md docs/b.md',
    'find . -name "*.ts" -not -path "./node_modules/*"',
    'find apps -type f | wc -l',
    'wc -l docs/backlog.md',
    'docker ps',
    'docker ps --format "{{.Names}}"',
    'docker ps -a',
    'git status --short | wc -l',
    'ls -la',
    'head -50 docs/backlog.md',
    'git show HEAD --stat',
    'git diff --stat develop...HEAD | tail -5',
    'git log --format="%h %s" develop..HEAD',
    `cd ${T}/x && git status`,
    `cd ${T}/x && pnpm check --force > ${T}/x/c.log 2>&1; echo $?`,
    'git stash list',
    'git rev-parse --abbrev-ref HEAD',
    'git rebase develop',
    'git cherry-pick abc',
    'git tag --list',
    'git fetch origin',
    'git pull --ff-only origin develop',
    'git reset --soft HEAD~1',
    'git restore docs/x.md',
    'git mv a b',
    'git rm docs/x.md',
    'for c in $(git log --format=%h develop..HEAD); do echo $c; done',
    'git log --format=%h develop..HEAD | while read c; do git show --stat $c; done',
    'test -f docs/x && echo ok',
    'git diff --name-only develop..HEAD | sort | uniq -c',
    'curl -s http://localhost:3000/api/v1/health',
    'pnpm --filter @siteperso/contracts build',
    'pnpm test:coverage',
    'pnpm format',
    `mkdir -p ${S}`,
    `git clone ${W} ${S}/clone`,
    `rm -rf ${S}/clone`,
  ];
}

/** Un rôle par famille de chemins d'écriture (lib/policy.mjs, ROLE_WRITE_SCOPES). */
const SAMPLE_ROLES = ['dev-api', 'qa', 'chef-de-projet', 'revue-code'];

/** Indices, dans la liste des 88, des commandes qu'un agent lance aussi dans son travail. */
const AGENT_SAMPLE = [
  7, 9, 11, 16, 17, 18, 19, 21, 26, 27, 28, 29, 31, 33, 36, 38, 40, 41, 42, 44, 45, 46, 49, 53, 62,
  64, 66, 78, 79, 81, 83, 86, 87, 88,
];

/** Refus de push de la recette du lot 13 pour un agent (recette-13.test.mjs, colonne dev-api). */
const PUSH_REFUSED = [
  'git push origin feature:develop',
  'git push origin HEAD:develop',
  'git push origin refs/heads/develop',
  'git push origin refs/heads/develop:refs/heads/develop',
  'git push origin develop:refs/heads/main',
  'git push origin develop main',
  'git push origin develop develop',
  'git push https://example.com/x.git develop',
  'git push git@github.com:x/y.git develop',
  'git push . develop',
  'git push --repo=https://x develop',
  'git push origin develop -o x',
  'git push --force-with-lease origin develop',
  'git push -fu origin develop',
  'git push --receive-pack=x origin develop',
  'git push origin "develop"',
  "git push origin 'main'",
  'git push origin $BR',
  'git push origin ${BR:-main}',
  'git push origin dev""elop',
  'git push origin $(echo main)',
  'git push origin `echo main`',
  'git push origin develop;git push origin main',
  'git push origin develop && git push origin main',
  'git push origin develop | git push origin main',
  '(git push origin main)',
  '{ git push origin main; }',
  'env git push origin main',
  'command git push origin main',
  '/usr/bin/git push origin main',
  'exec git push origin main',
  'sudo git push origin main',
  'xargs git push origin <<< main',
  'nohup git push origin main',
  'time git push origin main',
  'bash -c "git push origin main"',
  "sh -c 'git push origin main'",
  'GIT_DIR=/x git push origin develop',
  'git -c remote.origin.url=https://x push origin develop',
  'git -c url.https://x.insteadOf=git@ push origin develop',
  'git -c core.sshCommand=x push origin develop',
  'git -c push.default=matching push origin develop',
  'git --git-dir=/x push origin develop',
  'git -C /tmp push origin develop',
  'git -C /tmp/nonexistent push origin develop',
  'git --exec-path=/x push origin develop',
  'git config remote.origin.url https://x',
  'git remote set-url origin https://x',
  'git remote rename origin foo',
  'git remote add origin2 https://x',
  'git config --global url.https://x.insteadOf git@github.com:',
  'git config remote.origin.pushurl https://x',
  'git config remote.origin.push refs/heads/*:refs/heads/main',
  'git reset --hard main',
  'git config alias.p push',
  'git p origin main',
  'git config alias.p "!git push origin main"',
  'git config --add alias.q "!f(){ git push origin main; }; f"',
  'git send-pack https://x main',
  'git http-push https://x main',
  'git svn dcommit',
  'gh pr merge 1',
  'gh release create v1',
  'echo "git push origin main" | sh',
  'echo "git push origin main" > /tmp/x.sh && sh /tmp/x.sh',
  'git push origin develop\ngit push origin main',
  'git push\torigin\tmain',
  'git push origin develop  # main',
  'git push origin develop #\ngit push origin main',
  'git push origin develop:develop',
  'git push --no-thin origin develop',
  'git push --atomic origin develop',
  'git push --dry-run origin main',
  'git push --porcelain origin main',
  'git push --signed origin main',
  'git push -q origin main',
  'git push --verbose origin main',
  'git push --set-upstream=x origin main',
  'git push --progress origin main',
  'git push -u origin main develop',
  'git push origin  main',
  'git push origin +develop',
  'git push -- origin main',
  'alias gp="git push"; gp origin main',
  'function g(){ git push origin main; }; g',
  'git "push" origin main',
  '"git" push origin main',
  'git pu\\sh origin main',
  'git push origin ma\\in',
  'GIT_SSH_COMMAND=x git push origin develop',
  'git -c "remote.origin.url=x" push origin develop',
  'git -cremote.origin.url=x push origin develop',
  'git -Ctmp push origin main',
  'git -C=x push origin main',
  'git --work-tree=/x push origin develop',
  'git push origin develop --mirror',
  'git push origin develop --all',
  'git push --tags',
  'git push origin develop refs/tags/v1',
  '{ git push origin develop; }',
  'if true; then git push origin main; fi',
  'for i in 1; do git push origin main; done',
  'while true; do git push origin main; done',
  '! git push origin main',
  'git send-pack git@github.com:x/y.git main',
  'git push origin main &',
  'coproc git push origin main',
  'git push origin main || true',
  'git push origin main\r',
  '{git push origin main;}',
  'git push origin develop && { git push origin main; }',
  'git push origin main #x',
  'git\\\n push origin main',
  'FOO=1 git push origin main',
  'git push origin main 2>&1',
  '$(git push origin main)',
  'echo $(git push origin main)',
  '<(git push origin main)',
  'git push origin main <<< x',
];

/** Commandes de la même recette permises à un agent (aucune ne pousse). */
const AGENT_ALLOWED = [
  'git branch -f develop main',
  'git update-ref refs/heads/develop main',
  'git checkout -B develop main',
  'git tag v1',
  'git merge develop',
];

/** Formes de push permises à la seule session principale (git-push.test.mjs). */
const MAIN_PUSH = [
  'git push origin develop',
  'git push -u origin develop',
  'git push --set-upstream origin develop',
  'git push origin develop:develop',
];

describe('L14-07 : commandes ordinaires de l’orchestrateur (recette du lot 13 bis)', () => {
  it('compte les 88 commandes et les quatorze rôles d’agent', () => {
    assert.equal(orchestrator().length, 88);
    assert.equal(ROLES.length, 14, ROLES.join(', '));
    for (const role of SAMPLE_ROLES) assert.ok(ROLES.includes(role), role);
  });

  it('les 88 restent permises à la session principale', async () => {
    assert.deepEqual(await refusedAmong(orchestrator(), 'main'), []);
  });

  for (const role of SAMPLE_ROLES) {
    it(`l’échantillon des commandes d’agent reste permis au rôle ${role}`, async () => {
      const all = orchestrator();
      assert.deepEqual(
        await refusedAmong(
          AGENT_SAMPLE.map((k) => all[k - 1]),
          role,
        ),
        [],
      );
    });
  }
});

describe('L14-07 : refus de push de la recette du lot 13 pour chaque rôle d’agent', () => {
  it('reprend toute la recette : 119 refus et 5 commandes permises, sans doublon', () => {
    assert.equal(PUSH_REFUSED.length, 119);
    assert.equal(new Set([...PUSH_REFUSED, ...AGENT_ALLOWED]).size, 124);
  });

  for (const role of ROLES) {
    it(`refuse chaque commande au rôle ${role}, laisse les cinq autres`, () => {
      // Refus par l'analyse, sinon par le hook complet (cibles d'écriture : reset --hard…).
      const missed = PUSH_REFUSED.filter(
        (c) => analyzeCommand(c, W, role).deny === null && hook(c, role).code !== 2,
      );
      assert.deepEqual(missed, [], `${role} : commandes non refusées`);
      const blocked = AGENT_ALLOWED.filter((c) => analyzeCommand(c, W, role).deny !== null);
      assert.deepEqual(blocked, [], `${role} : commandes refusées à tort`);
    });

    it(`refuse par le hook les formes de push de la session principale au rôle ${role}`, () => {
      for (const command of MAIN_PUSH) {
        const r = hook(command, role);
        assert.equal(r.code, 2, `${role} : ${command}`);
        assert.match(r.stderr, new RegExp(`git push est interdit aux agents \\(rôle ${role}\\)`));
      }
    });
  }

  it('la session principale garde ses formes de push', () => {
    for (const command of MAIN_PUSH) assert.equal(hook(command, 'main').code, 0, command);
  });
});
