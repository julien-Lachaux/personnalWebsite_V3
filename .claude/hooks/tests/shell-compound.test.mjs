// Lot 13 bis, T1 : l'analyseur descend dans les constructions composées (accolades, if, for, while,
// until, case, !, fonctions, coproc, substitutions de processus, substitutions entre guillemets ou
// dans un here-document) et refuse ce qu'il ne sait pas lire (« illisible donc refusé ») : nom de
// commande, cible d'écriture, script ou code calculés, syntaxe inconnue. Le principe vaut pour
// toutes les règles : push, oracles, marqueurs, écritures opaques. Lancé par `pnpm hooks:test`.
//
// Les marqueurs interdits sont construits par concaténation : ce fichier n'en contient aucun.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');
const ONLY = ['it', 'only'].join('.');

let repo;
let home;

function write(rel, content) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), content);
}

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'garde-fous-compose-'));
  home = mkdtempSync(join(tmpdir(), 'garde-fous-home-'));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
  write('apps/api/src/app.ts', 'export const answer = 42;\n');
  write('apps/api/src/app.spec.ts', "it('répond', () => {});\n");
  write('apps/api/test/a.e2e-spec.ts', "it('e2e', () => {});\n");
  write('docs/.keep', '');
  write('outils/lire.mjs', "console.log('lecture seule');\n");
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=ci@noreply.invalid', 'commit', '-q', '-m', 'base'],
    { cwd: repo },
  );
  execFileSync('git', ['config', 'alias.p', 'push'], { cwd: repo });
  execFileSync('git', ['config', 'alias.pm', '!git push origin main'], { cwd: repo });
  execFileSync('git', ['config', 'alias.st', 'status --short'], { cwd: repo });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

/** Appelle le hook PreToolUse pour une commande Bash ; `agent` absent = session principale. */
function bash(command, agent) {
  const input = {
    session_id: 's-compose',
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
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo, HOME: home },
  });
  return { code: res.status, stderr: res.stderr };
}

function refused(command, reason, agent) {
  const r = bash(command, agent);
  assert.equal(r.code, 2, `${command} (${agent ?? 'main'}) aurait dû être refusée`);
  if (reason) assert.match(r.stderr, reason, `${command} : ${r.stderr}`);
}

function allowed(command, agent) {
  const r = bash(command, agent);
  assert.equal(r.code, 0, `${command} (${agent ?? 'main'}) : ${r.stderr}`);
}

const MAIN = /main est réservée à Julien/;

describe('T1 : push enveloppé dans une construction composée', () => {
  const cases = [
    '{ git push origin main; }',
    '{git push origin main;}',
    '{ { git push origin main; }; }',
    'if true; then git push origin main; fi',
    'if git push origin main; then :; fi',
    'if false; then :; elif true; then git push origin main; else :; fi',
    'for i in 1; do git push origin main; done',
    'for i (1) git push origin main',
    'while true; do git push origin main; done',
    'while git push origin main; do :; done',
    'until false; do git push origin main; done',
    'case x in x) git push origin main;; esac',
    'case x in (x) git push origin main;; esac',
    'case x in a|x) echo a; git push origin main; esac',
    'case x in a) echo a;; *) git push origin main;; esac',
    '! git push origin main',
    'if ! git push origin main; then :; fi',
    'function g(){ git push origin main; }; g',
    'function g { git push origin main; }; g',
    'g(){ git push origin main; }; g',
    'g () { git push origin main; }; g',
    '() { git push origin main; }',
    'coproc git push origin main',
    'coproc p { git push origin main; }',
    'repeat 1 git push origin main',
    '<(git push origin main)',
    'cat <(git push origin main)',
    'tee >(git push origin main)',
    'echo x > >(git push origin main)',
    'echo "$(git push origin main)"',
    'echo "`git push origin main`"',
    'echo ${x:-$(git push origin main)}',
    'echo $(( $(git push origin main) + 1 ))',
    'echo $((1<<2))\ngit push origin main',
    'x=(a $(git push origin main))',
    '[[ -n $(git push origin main) ]]',
    'cat <<EOF\n$(git push origin main)\nEOF',
    '=git push origin main',
  ];
  for (const command of cases) {
    it(`refuse ${JSON.stringify(command)} à la session principale et aux agents`, () => {
      refused(command, MAIN);
      refused(command, null, 'dev-api');
    });
  }

  it('refuse le code lancé plus tard : trap, alias du shell', () => {
    refused("trap 'git push origin main' EXIT", /git push/);
    refused('alias gp="git push"; gp origin main', /git push/);
  });

  it('laisse passer les formes lisibles de la session principale', () => {
    for (const command of [
      '{ git push origin develop; }',
      'if true; then git push origin develop; fi',
      'git push origin develop || echo échec',
      "cat <<'EOF'\n$(git push origin main)\nEOF",
      "echo '$(git push origin main)'",
      'echo $((1<<2))',
      'case "$1" in a) echo a;; *) echo b;; esac',
    ]) {
      allowed(command);
    }
  });
});

describe('Illisible donc refusé : push et git', () => {
  it('refuse un nom de commande calculé', () => {
    for (const command of [
      '$CMD push origin main',
      '"$(echo git)" push origin main',
      '`echo git` push origin main',
      '${G} status',
      'X="git push origin main"; $=X',
    ]) {
      refused(command, /illisible/);
      refused(command, /illisible/, 'dev-api');
    }
  });

  it('résout une variable littérale de la même commande', () => {
    refused('G=git; $G push origin main', MAIN);
    allowed('G=git; $G status', 'dev-api');
  });

  it('refuse une syntaxe incomplète ou inconnue', () => {
    for (const command of [
      'echo $(git status',
      '(echo a',
      'echo a )',
      'echo ${x',
      'echo `x',
      'case x in a) echo a;;',
      'echo $[1+1]',
      "ls *(e:'git push origin main':)",
      'echo >',
    ]) {
      refused(command, /commande illisible/, 'dev-api');
    }
  });

  it('refuse les variables qui changent le push hors de la commande git', () => {
    refused('export GIT_DIR=/tmp/autre; git push origin develop', /GIT_DIR/);
    refused('GIT_DIR=/tmp/autre; export GIT_DIR; git push origin develop', /GIT_DIR/);
  });

  it('refuse HUSKY=0 exporté avant le commit', () => {
    refused('export HUSKY=0; git commit -m x', /HUSKY/, 'dev-api');
    refused('HUSKY=$V git commit -m x', /HUSKY/, 'dev-api');
  });

  it('refuse les commandes que git lance lui-même quand elles poussent', () => {
    for (const command of [
      "git -c core.pager='git push origin main' log",
      "git -c core.editor='git push origin main' commit",
      "git rebase -x 'git push origin main' develop",
      "git rebase --exec='git push origin main' develop",
      "git submodule foreach 'git push origin main'",
      'git bisect run git push origin main',
    ]) {
      refused(command, /git push/);
      refused(command, null, 'dev-api');
    }
  });

  it('résout les alias git de la configuration et refuse une sous-commande inconnue', () => {
    refused('git p origin develop', /alias qui lance git push/);
    refused('git pm', /git push/);
    refused('git frobnicate', /ni une commande git connue ni un alias/, 'dev-api');
    allowed('git st', 'dev-api');
  });

  it('refuse les enveloppes qui lancent une commande ou du code', () => {
    for (const command of [
      'pnpm exec git push origin main',
      'pnpm --filter x exec git push origin main',
      'npx -c "git push origin main"',
      "env -S 'git push origin main'",
      "watch 'git push origin main'",
      'flock /tmp/verrou git push origin main',
      "flock /tmp/verrou -c 'git push origin main'",
      'exec -a nom git push origin main',
      'nocorrect git push origin main',
    ]) {
      refused(command, /git push|main est réservée/);
      refused(command, null, 'dev-api');
    }
  });
});

describe('Illisible donc refusé : oracles', () => {
  it('voit une écriture d’oracle dans un bloc composé', () => {
    for (const command of [
      '{ rm apps/api/test/a.e2e-spec.ts; }',
      'if true; then rm apps/api/test/a.e2e-spec.ts; fi',
      'for f in x; do rm apps/api/src/app.spec.ts; done',
      'case x in *) mv apps/api/src/app.spec.ts /tmp/x;; esac',
      '! truncate -s 0 apps/api/test/a.e2e-spec.ts',
      'cat <(rm apps/api/test/a.e2e-spec.ts)',
      "env -S 'rm apps/api/test/a.e2e-spec.ts'",
    ]) {
      refused(command, null, 'dev-api');
    }
  });

  it('ne laisse pas un cd de sous-shell déplacer la cible', () => {
    refused('(cd docs) ; rm apps/api/src/app.spec.ts', /test existant/, 'dev-api');
    refused('echo $(cd docs) ; rm apps/api/src/app.spec.ts', /test existant/, 'dev-api');
  });

  it('refuse une cible d’écriture calculée', () => {
    for (const command of [
      'rm "$F"',
      'echo x > "$(pwd)/apps/api/src/app.spec.ts"',
      'cp /tmp/x `echo apps/api/src/app.spec.ts`',
      'rm apps/api/src/app.{spec.ts,ts}',
      'cd "$D" && rm app.spec.ts',
      'cd - && rm app.spec.ts',
    ]) {
      refused(command, /illisible/, 'dev-api');
    }
  });

  it('accepte une cible écrite en clair ou résolue dans la commande', () => {
    allowed('F=apps/api/src/sortie.txt; echo ok > "$F"', 'dev-api');
    allowed('echo ok > ~/sortie.txt', 'dev-api');
    allowed('cd apps/api && echo ok > src/sortie.txt', 'dev-api');
    allowed('x=$((1+2)); echo $x', 'dev-api');
    allowed('for f in a b; do echo "$f"; done', 'dev-api');
    allowed('if [ -f x ]; then echo ok; fi', 'dev-api');
    allowed('diff <(git show HEAD:apps/api/src/app.ts) apps/api/src/app.ts', 'dev-api');
    allowed('git commit -q -m "$(cat <<\'EOF\'\nfeat: x\n\nCorps du message.\nEOF\n)"', 'dev-api');
  });
});

describe('Commandes ordinaires', () => {
  it('n’entrave pas les commandes courantes des agents et de la session principale', () => {
    for (const command of [
      'pnpm check 2>&1 | tail -40',
      'git -C . log --oneline -5 && git status --short',
      'git diff --stat develop...HEAD',
      "git log --format='%h %s' -3",
      'git worktree list',
      'git add -A && git commit -q -F /tmp/message.txt',
      'docker compose down -v',
      'S=/tmp/journal; mkdir -p $S && pnpm hooks:test > $S/run.log 2>&1; grep -c ok $S/run.log',
      'for f in apps/api/src/*.ts; do wc -l "$f"; done',
      "find apps -name '*.ts' | xargs grep -l Injectable",
      'grep -rn "TODO" apps | wc -l',
      'node -e "console.log(process.version)"',
      'export PATH="$HOME/.local/bin:$PATH" && pnpm --version',
      'if [ -d node_modules ]; then echo ok; else pnpm install; fi',
      'cat > /tmp/notes.txt <<EOF\nlot $N\nEOF',
      'curl -s http://localhost:3000/api/v1/health | python3 -m json.tool',
      'pnpm --filter @siteperso/api exec vitest run src/app.spec.ts',
      'npx prettier --check .',
      'time pnpm test',
      'git stash push -u -m wip && git stash pop',
      'git merge --no-ff lot/x -m "merge: lot x"',
      'git -c core.quotepath=false status',
      'echo "$(date +%F)"',
      "printf '%s\\n' a b | sort",
      'while read -r l; do echo "$l"; done < docs/.keep',
      '[ -f x ] && echo y || echo n',
      'case $(uname) in Linux) echo l;; esac',
      'cd ~ && ls',
    ]) {
      allowed(command, 'dev-api');
      allowed(command);
    }
  });
});

describe('Illisible donc refusé : marqueurs', () => {
  it('voit l’écriture d’un marqueur dans un bloc composé', () => {
    refused(`if true; then tee apps/api/src/n.spec.ts <<< "${ONLY}(" ; fi`, /marqueur/, 'dev-api');
    refused(`{ tee apps/api/src/n.spec.ts <<< "${ONLY}("; }`, /marqueur/, 'dev-api');
    refused(`coproc tee apps/api/src/n.spec.ts <<< "${ONLY}("`, /marqueur/, 'dev-api');
  });
});

describe('Illisible donc refusé : écritures opaques', () => {
  it('refuse un code ou un script calculé, lu sur un tube ou écrit par la même commande', () => {
    for (const command of [
      'bash -c "$CODE"',
      'eval "$C"',
      'node "$S"',
      'python3 $(echo s.py)',
      "echo 'x' > /tmp/w.js && node /tmp/w.js",
      'cat w.js | node',
      'cat s.sh | bash',
      'node absent.mjs',
      'bash <<EOF\n$CMD\nEOF',
    ]) {
      refused(command, /illisible/, 'dev-api');
    }
  });

  it('analyse le code shell en ligne comme une commande', () => {
    refused("bash -c 'cd apps/api && rm src/app.spec.ts'", null, 'dev-api');
    refused("sh -c '{ rm apps/api/test/a.e2e-spec.ts; }'", null, 'dev-api');
    refused("git -c core.pager='tee apps/api/src/app.spec.ts' log", null, 'dev-api');
    refused("F=apps/api/src/app.spec.ts; trap 'rm $F' EXIT", /test existant/, 'dev-api');
    allowed("F=apps/api/src/sortie.txt; trap 'rm $F' EXIT", 'dev-api');
  });

  it('lit les écritures et l’exécution des scripts sed', () => {
    refused("sed -n 'w apps/api/src/app.spec.ts' apps/api/src/app.ts", /test existant/, 'dev-api');
    refused("sed 's/a/b/w apps/api/test/a.e2e-spec.ts' apps/api/src/app.ts", null, 'dev-api');
    refused("sed -n '1e git push origin main' apps/api/src/app.ts", /git push/);
    allowed("sed -n '/git push/p' docs/.keep", 'dev-api');
    allowed("sed -n '1,5p' apps/api/src/app.spec.ts", 'dev-api');
  });

  it('accepte les interpréteurs lisibles', () => {
    allowed('node --version', 'dev-api');
    allowed('node outils/lire.mjs', 'dev-api');
    allowed("echo '{}' | node -e 'process.stdin.pipe(process.stdout)'", 'dev-api');
    allowed('cat x.json | python3 -m json.tool', 'dev-api');
    allowed("bash -c 'echo ok'", 'dev-api');
    allowed("python3 - <<'EOF'\nprint('ok')\nEOF", 'dev-api');
  });
});
