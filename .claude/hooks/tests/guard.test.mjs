// Tests des garde-fous : chaque cas rejoue une entrée JSON de hook représentative contre un dépôt
// git temporaire. Lancés par `pnpm hooks:test` (node --test, sans dépendance), donc par
// `pnpm check` et par la CI.
//
// Les marqueurs interdits sont construits par concaténation : ce fichier ne doit en contenir
// aucun littéralement (le script d'intégrité de la CI le refuserait).

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(HOOKS, 'guard.mjs');
const AUTHORIZE = join(HOOKS, 'authorize.mjs');

const ONLY = `${['it', 'only'].join('.')}('cas isolé', () => {});\n`;
const FAILS = `${['it', 'fails'].join('.')}('BUG-9 attendu', () => {});\n`;
const IGNORE = `/* ${'v8'} ${'ignore'} next */\nexport const x = 1;\n`;

const temps = [];
let repo;

function sh(cwd, cmd, args) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function commitAll(cwd, message) {
  sh(cwd, 'git', ['add', '-A']);
  sh(cwd, 'git', [
    '-c',
    'user.name=Test',
    '-c',
    'user.email=ci@noreply.invalid',
    'commit',
    '-q',
    '--no-gpg-sign',
    '-m',
    message,
  ]);
}

function write(rel, content) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), content);
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'garde-fous-'));
  temps.push(dir);
  repo = dir;
  sh(dir, 'git', ['init', '-q', '-b', 'main']);
  write('.gitignore', '.claude/hooks/state/\n.claude/hooks/audit.log\n');
  write('apps/api/src/app.ts', 'export const answer = 42;\n');
  write('apps/api/src/app.spec.ts', "import { it } from 'vitest';\nit('répond', () => {});\n");
  write('apps/api/test/a.e2e-spec.ts', "import { it } from 'vitest';\nit('e2e', () => {});\n");
  write('apps/api/test/support/db.ts', 'export const reset = () => undefined;\n');
  write('apps/api/vitest.config.ts', 'export default {};\n');
  write('docs/revues/.keep', '');
  commitAll(dir, 'base');
  return dir;
}

function hook(mode, input, { raw } = {}) {
  const res = spawnSync(process.execPath, [GUARD, mode], {
    input: raw ?? JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
  });
  return { code: res.status, stderr: res.stderr, stdout: res.stdout };
}

function base({ agent, id = 'a1', cwd = repo, extra = {} } = {}) {
  const input = { session_id: 's1', cwd, hook_event_name: 'PreToolUse', ...extra };
  if (agent) {
    input.agent_type = agent;
    input.agent_id = id;
  }
  return input;
}

function tool(name, toolInput, opts = {}) {
  return hook('pre-tool-use', { ...base(opts), tool_name: name, tool_input: toolInput });
}

function bash(command, opts = {}) {
  return tool('Bash', { command, description: 'test' }, opts);
}

function authorize(args) {
  return spawnSync(process.execPath, [AUTHORIZE, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
  });
}

function auditLines() {
  const file = join(repo, '.claude/hooks/audit.log');
  return existsSync(file)
    ? readFileSync(file, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
    : [];
}

const p = (rel) => join(repo, rel);

beforeEach(() => {
  makeRepo();
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('PreToolUse : outils d’édition', () => {
  it('refuse l’édition d’un spec existant', () => {
    const r = tool(
      'Edit',
      { file_path: p('apps/api/src/app.spec.ts'), old_string: 'répond', new_string: 'passe' },
      { agent: 'dev-api' },
    );
    assert.equal(r.code, 2);
    assert.match(r.stderr, /test existant/);
    assert.match(r.stderr, /sortie honorable/);
  });

  it('accepte la création d’un nouveau spec', () => {
    const r = tool(
      'Write',
      { file_path: p('apps/api/src/nouveau.spec.ts'), content: "it('nouveau', () => {});\n" },
      { agent: 'dev-api' },
    );
    assert.equal(r.code, 0, r.stderr);
  });

  it('refuse l’écriture d’un marqueur de focus, même dans un nouveau fichier', () => {
    const r = tool(
      'Write',
      { file_path: p('apps/api/src/focus.spec.ts'), content: ONLY },
      { agent: 'dev-api' },
    );
    assert.equal(r.code, 2);
    assert.match(r.stderr, /marqueur/);
  });

  it('refuse un marqueur formé par une édition à la jointure de deux textes', () => {
    write('apps/api/src/join.ts', 'const s = "it.onXYZ";\n');
    const r = tool(
      'Edit',
      { file_path: p('apps/api/src/join.ts'), old_string: 'XYZ"', new_string: 'ly("' },
      { agent: 'dev-api' },
    );
    assert.equal(r.code, 2);
  });

  it('refuse l’écriture d’un commentaire d’ignore de couverture', () => {
    const r = tool(
      'Write',
      { file_path: p('apps/api/src/couvert.ts'), content: IGNORE },
      { agent: 'dev-api' },
    );
    assert.equal(r.code, 2);
    assert.match(r.stderr, /ignore/);
  });

  it('accepte l’édition d’un fichier source ordinaire', () => {
    const r = tool(
      'Edit',
      { file_path: p('apps/api/src/app.ts'), old_string: '42', new_string: '43' },
      { agent: 'dev-api' },
    );
    assert.equal(r.code, 0, r.stderr);
  });

  it('refuse la modification de vitest.config.ts', () => {
    const r = tool(
      'Edit',
      {
        file_path: p('apps/api/vitest.config.ts'),
        old_string: '{}',
        new_string: '{ coverage: {} }',
      },
      { agent: 'lead-architecte' },
    );
    assert.equal(r.code, 2);
    assert.match(r.stderr, /configuration/);
  });

  it('refuse un fichier existant de test/support', () => {
    const r = tool(
      'Write',
      { file_path: p('apps/api/test/support/db.ts'), content: 'export const reset = () => 1;\n' },
      { agent: 'qa' },
    );
    assert.equal(r.code, 2);
  });

  it('refuse l’écriture de l’état des garde-fous et des garde-fous eux-mêmes', () => {
    assert.equal(
      tool(
        'Write',
        { file_path: p('.claude/hooks/state/authorizations.json'), content: '{}' },
        { agent: 'correcteur' },
      ).code,
      2,
    );
    assert.equal(
      tool('Write', { file_path: p('.claude/settings.json'), content: '{}' }, { agent: 'dev-api' })
        .code,
      2,
    );
    assert.equal(
      tool('Write', { file_path: p('.claude/agents/qa.md'), content: 'x' }, { agent: 'qa' }).code,
      2,
    );
  });

  it('limite l’écriture de la qa aux tests et des revues à docs/revues', () => {
    assert.equal(
      tool(
        'Edit',
        { file_path: p('apps/api/src/app.ts'), old_string: '42', new_string: '1' },
        { agent: 'qa' },
      ).code,
      2,
    );
    assert.equal(
      tool(
        'Write',
        { file_path: p('apps/api/test/b.e2e-spec.ts'), content: "it('b', () => {});\n" },
        { agent: 'qa' },
      ).code,
      0,
    );
    assert.equal(
      tool('Write', { file_path: p('apps/api/src/x.ts'), content: '1' }, { agent: 'revue-code' })
        .code,
      2,
    );
    assert.equal(
      tool(
        'Write',
        { file_path: p('docs/revues/code.md'), content: '# Revue\n' },
        { agent: 'revue-code' },
      ).code,
      0,
    );
  });

  it('laisse libre le dossier temporaire de session', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'scratch-'));
    temps.push(scratch);
    const r = tool(
      'Write',
      { file_path: join(scratch, 'clone/a.spec.ts'), content: ONLY },
      { agent: 'chef-de-projet', extra: { scratchpad_dir: scratch } },
    );
    assert.equal(r.code, 0, r.stderr);
  });
});

describe('PreToolUse : shell', () => {
  it('refuse sed -i sur un spec existant', () => {
    const r = bash("sed -i 's/répond/passe/' apps/api/src/app.spec.ts", { agent: 'dev-api' });
    assert.equal(r.code, 2);
  });

  it('refuse git checkout -- test/ (depuis la racine et depuis apps/api)', () => {
    assert.equal(bash('git checkout -- test/', { agent: 'dev-api' }).code, 2);
    assert.equal(bash('git checkout -- test/', { agent: 'dev-api', cwd: p('apps/api') }).code, 2);
    assert.equal(bash('git restore apps/api/test/a.e2e-spec.ts', { agent: 'dev-api' }).code, 2);
  });

  it('refuse rm, mv, tee, redirection, truncate et perl -i sur un oracle', () => {
    for (const command of [
      'rm apps/api/test/a.e2e-spec.ts',
      'rm -rf apps/api/test',
      'mv apps/api/src/app.spec.ts /tmp/x',
      'echo x | tee apps/api/src/app.spec.ts',
      'echo x > apps/api/vitest.config.ts',
      'truncate -s 0 apps/api/test/a.e2e-spec.ts',
      "perl -pi -e 's/a/b/' apps/api/test/a.e2e-spec.ts",
      "find apps/api/test -name '*.ts' -delete",
      "git ls-files '*.spec.ts' | xargs sed -i 's/a/b/'",
      'cd apps/api && rm test/a.e2e-spec.ts',
    ]) {
      assert.equal(bash(command, { agent: 'dev-api' }).code, 2, command);
    }
  });

  it('refuse un interpréteur qui écrit un oracle, accepte celui qui ne fait que lire', () => {
    const w = bash(`python3 -c "open('apps/api/test/a.e2e-spec.ts','w').write('')"`, {
      agent: 'dev-api',
    });
    assert.equal(w.code, 2);
    const r = bash(
      `node -e "console.log(require('fs').readFileSync('apps/api/test/a.e2e-spec.ts','utf8'))"`,
      { agent: 'dev-api' },
    );
    assert.equal(r.code, 0, r.stderr);
  });

  it('refuse un marqueur écrit par le shell, accepte une recherche de marqueur', () => {
    const w = bash(`cat > apps/api/src/n.spec.ts <<'EOF'\n${ONLY}EOF`, { agent: 'dev-api' });
    assert.equal(w.code, 2);
    const g = bash(`grep -rn "${['it', 'only'].join('.')}(" apps`, { agent: 'chef-de-projet' });
    assert.equal(g.code, 0, g.stderr);
  });

  it('accepte les commandes ordinaires', () => {
    for (const command of [
      'pnpm check',
      'git status && git diff --stat',
      'echo ok > apps/api/src/sortie.txt 2>&1',
      'git checkout -b lot-x',
      `git commit -q -m "feat: x"`,
      'cat apps/api/test/a.e2e-spec.ts | head -5',
    ]) {
      const r = bash(command, { agent: 'dev-api' });
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });

  it('refuse git push, --no-verify, core.hooksPath et HUSKY=0 pour tous', () => {
    for (const command of [
      'git push origin HEAD',
      'git -C . push',
      'git commit --no-verify -m x',
      'git commit -nm x',
      'git config core.hooksPath /dev/null',
      'HUSKY=0 git commit -m x',
      'git update-index --assume-unchanged apps/api/test/a.e2e-spec.ts',
      'git stash',
    ]) {
      assert.equal(bash(command).code, 2, command);
      assert.equal(bash(command, { agent: 'lead-architecte' }).code, 2, command);
    }
  });

  it('refuse une commande illisible et une entrée JSON invalide (fail-closed)', () => {
    assert.equal(bash(`echo "non refermé`, { agent: 'dev-api' }).code, 2);
    assert.equal(hook('pre-tool-use', null, { raw: '{ pas du json' }).code, 2);
    assert.equal(hook('pre-tool-use', null, { raw: '[]' }).code, 2);
    assert.equal(
      hook('pre-tool-use', { cwd: repo, tool_name: 'Bash', tool_input: { command: 'ls' } }).code,
      2,
    );
    assert.equal(
      hook('pre-tool-use', { session_id: 's', cwd: repo, tool_name: 'Edit', tool_input: {} }).code,
      2,
    );
  });

  it('réserve les scripts des garde-fous à la session principale', () => {
    const cmd = `node ${AUTHORIZE} list`;
    assert.equal(bash(cmd, { agent: 'correcteur' }).code, 2);
    assert.equal(bash(cmd).code, 0);
  });
});

describe('Exception contrôlée et auditée', () => {
  it('autorise le correcteur nommé sur le test listé, et lui seul', () => {
    const g = authorize([
      'grant',
      '--agent',
      'correcteur',
      '--scope',
      'tests',
      '--ticket',
      'RC-42',
      '--reason',
      'test faux établi par le triage',
      '--path',
      'apps/api/test/a.e2e-spec.ts',
    ]);
    assert.equal(g.status, 0, g.stderr);
    const id = /autorisation (\w+)/.exec(g.stdout)[1];

    const edit = {
      file_path: p('apps/api/test/a.e2e-spec.ts'),
      old_string: "'e2e'",
      new_string: "'e2e corrigé'",
    };
    assert.equal(tool('Edit', edit, { agent: 'qa', id: 'q1' }).code, 2, 'autre rôle');
    assert.equal(
      tool('Edit', edit, { agent: 'correcteur', id: 'c1' }).code,
      0,
      'correcteur autorisé',
    );
    assert.equal(
      tool('Edit', edit, { agent: 'correcteur', id: 'c2' }).code,
      2,
      'autre instance : autorisation déjà liée',
    );
    const other = {
      file_path: p('apps/api/src/app.spec.ts'),
      old_string: 'répond',
      new_string: 'x',
    };
    assert.equal(
      tool('Edit', other, { agent: 'correcteur', id: 'c1' }).code,
      2,
      'chemin non listé',
    );

    const events = auditLines();
    assert.ok(events.some((e) => e.event === 'grant' && e.id === id && e.ticket === 'RC-42'));
    assert.ok(
      events.some((e) => e.event === 'authorized' && e.grant === id && e.key === 'agent-c1'),
    );
    assert.ok(events.some((e) => e.event === 'deny' && e.key === 'agent-c2'));

    // La modification autorisée n'est pas une violation en fin de tâche.
    writeFileSync(p('apps/api/test/a.e2e-spec.ts'), "it('e2e corrigé', () => {});\n");
    assert.equal(
      hook('verify', {
        ...base({ agent: 'correcteur', id: 'c1' }),
        hook_event_name: 'SubagentStop',
        stop_hook_active: false,
      }).code,
      0,
    );
  });

  it('autorise un test en échec attendu pour la qa seulement sous autorisation', () => {
    const write = { file_path: p('apps/api/test/bug.e2e-spec.ts'), content: FAILS };
    assert.equal(tool('Write', write, { agent: 'qa', id: 'q1' }).code, 2);
    assert.equal(
      authorize([
        'grant',
        '--agent',
        'qa',
        '--scope',
        'fails',
        '--ticket',
        'BUG-9',
        '--reason',
        'défaut trouvé en qa',
        '--path',
        'apps/api/test/bug.e2e-spec.ts',
      ]).status,
      0,
    );
    assert.equal(tool('Write', write, { agent: 'qa', id: 'q1' }).code, 0);
  });

  it('refuse les autorisations hors des rôles prévus et hors des chemins protégés', () => {
    assert.equal(
      authorize([
        'grant',
        '--agent',
        'dev-devops',
        '--scope',
        'tests',
        '--ticket',
        'X',
        '--reason',
        'raison longue',
        '--path',
        'apps/api/test/a.e2e-spec.ts',
      ]).status,
      2,
    );
    assert.equal(
      authorize([
        'grant',
        '--agent',
        'correcteur',
        '--scope',
        'tests',
        '--ticket',
        'X',
        '--reason',
        'raison longue',
        '--path',
        'apps/api/src/app.ts',
      ]).status,
      2,
    );
    assert.equal(
      authorize([
        'grant',
        '--agent',
        'correcteur',
        '--scope',
        'tests',
        '--ticket',
        'X',
        '--reason',
        'raison longue',
        '--path',
        '.claude/hooks/state/x',
      ]).status,
      2,
    );
    assert.equal(
      authorize([
        'grant',
        '--agent',
        'lead-architecte',
        '--scope',
        'config',
        '--ticket',
        'L8',
        '--reason',
        'raison longue',
        '--path',
        'apps/api/vitest.config.ts',
      ]).status,
      0,
    );
  });

  it('n’accepte plus une autorisation révoquée', () => {
    const g = authorize([
      'grant',
      '--agent',
      'correcteur',
      '--scope',
      'tests',
      '--ticket',
      'RC-1',
      '--reason',
      'test faux établi',
      '--path',
      'apps/api/test/*.e2e-spec.ts',
    ]);
    const id = /autorisation (\w+)/.exec(g.stdout)[1];
    assert.equal(authorize(['revoke', '--id', id]).status, 0);
    const edit = {
      file_path: p('apps/api/test/a.e2e-spec.ts'),
      old_string: "'e2e'",
      new_string: "'x'",
    };
    assert.equal(tool('Edit', edit, { agent: 'correcteur', id: 'c1' }).code, 2);
    assert.ok(auditLines().some((e) => e.event === 'revoke' && e.id === id));
  });
});

describe('Instantané et vérification de fin de tâche', () => {
  const start = (id) =>
    hook('subagent-start', { ...base({ agent: 'dev-api', id }), hook_event_name: 'SubagentStart' });
  const stop = (id, active = false) =>
    hook('verify', {
      ...base({ agent: 'dev-api', id }),
      hook_event_name: 'SubagentStop',
      stop_hook_active: active,
    });

  it('injecte le rappel des règles au démarrage', () => {
    const r = start('d0');
    assert.equal(r.code, 0);
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /Garde-fous actifs/);
  });

  it('laisse finir une tâche sans changement d’oracle et nettoie l’instantané', () => {
    start('d1');
    writeFileSync(p('apps/api/src/app.ts'), 'export const answer = 1;\n');
    assert.equal(stop('d1').code, 0);
    assert.equal(existsSync(p('.claude/hooks/state/snapshots/agent-d1')), false);
  });

  it('détecte une modification faite hors hooks, une fois, puis la signale à l’orchestrateur', () => {
    start('d2');
    writeFileSync(p('apps/api/test/a.e2e-spec.ts'), "it('e2e', () => { /* vidé */ });\n");
    rmSync(p('apps/api/src/app.spec.ts'));
    const first = stop('d2');
    assert.equal(first.code, 2);
    assert.match(first.stderr, /apps\/api\/test\/a\.e2e-spec\.ts : oracle modifié/);
    assert.match(first.stderr, /apps\/api\/src\/app\.spec\.ts : oracle supprimé/);
    assert.equal(stop('d2', true).code, 0, 'pas de boucle : deuxième arrêt accepté');

    const report = hook('report', {
      session_id: 's1',
      cwd: repo,
      hook_event_name: 'PostToolUse',
      tool_name: 'Agent',
    });
    assert.match(JSON.parse(report.stdout).hookSpecificOutput.additionalContext, /a\.e2e-spec\.ts/);
    assert.equal(
      hook('report', {
        session_id: 's1',
        cwd: repo,
        hook_event_name: 'PostToolUse',
        tool_name: 'Agent',
      }).stdout,
      '',
    );
    assert.ok(auditLines().some((e) => e.event === 'violation' && e.key === 'agent-d2'));
  });

  it('détecte un marqueur ajouté hors hooks et une configuration créée', () => {
    start('d3');
    write('apps/api/src/n.spec.ts', ONLY);
    write('.github/workflows/autre.yml', 'on: push\n');
    const r = stop('d3');
    assert.equal(r.code, 2);
    assert.match(r.stderr, /n\.spec\.ts : marqueur interdit/);
    assert.match(r.stderr, /autre\.yml : configuration/);
  });

  it('accepte un test modifié et commité avec Justification-test, refuse sans', () => {
    start('d4');
    writeFileSync(p('apps/api/test/a.e2e-spec.ts'), "it('e2e juste', () => {});\n");
    commitAll(repo, 'fix: test\n\nJustification-test: RC-7 le test vérifiait le mauvais code');
    assert.equal(stop('d4').code, 0);

    start('d5');
    writeFileSync(p('apps/api/src/app.spec.ts'), "it('affaibli', () => {});\n");
    commitAll(repo, 'test: sans justification');
    assert.equal(stop('d5').code, 2);
  });

  it('prend aussi l’instantané paresseusement au premier outil (worktree non vu au démarrage)', () => {
    assert.equal(
      tool(
        'Edit',
        { file_path: p('apps/api/src/app.ts'), old_string: '42', new_string: '7' },
        { agent: 'dev-api', id: 'd6' },
      ).code,
      0,
    );
    writeFileSync(p('apps/api/vitest.config.ts'), 'export default { coverage: false };\n');
    assert.equal(stop('d6').code, 2);
  });
});
