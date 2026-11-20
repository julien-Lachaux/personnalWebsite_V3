// L14-14 (décision de Julien du 20 nov. 2026, « cadrer les agents correctement ») : chaque fichier
// .claude/agents/*.md se termine par une même section « Git et garde-fous » (ce que l'agent fait, ce
// qui lui est refusé, la conduite face à un refus). Ce test vérifie que les quatorze fichiers la
// portent, à l'identique et en dernier ; qu'elle énonce des règles sans décrire le fonctionnement des
// garde-fous (ces fichiers deviendront publics) ; et que chaque refus qu'elle déclare l'est
// effectivement par les hooks, pour chacun des quatorze rôles. Une ligne ajoutée à la liste des refus
// sans commandes de contrôle ci-dessous fait échouer le test. Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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
const HEADING = '## Git et garde-fous';

const FILES = readdirSync(AGENTS)
  .filter((f) => f.endsWith('.md'))
  .sort();
const TEXTS = Object.fromEntries(FILES.map((f) => [f, readFileSync(join(AGENTS, f), 'utf8')]));
const roleOf = (file) => /^name:\s*(\S+)\s*$/m.exec(TEXTS[file])[1];

/** Section finale d'un fichier : du titre à la fin, ou null si le titre manque. */
function sectionOf(text) {
  const at = text.lastIndexOf(`\n${HEADING}\n`);
  return at < 0 ? null : text.slice(at + 1);
}

/** Puces de la liste « Ce qui t'est refusé », lignes de suite recollées. */
function refusals(section) {
  const lines = section.split('\n');
  const start =
    lines.indexOf('Ce qui t’est refusé :') + 1 || lines.indexOf("Ce qui t'est refusé :") + 1;
  assert.ok(start > 0, 'liste « Ce qui t’est refusé » absente');
  const items = [];
  for (const line of lines.slice(start)) {
    if (line.startsWith('- ')) items.push(line.slice(2));
    else if (line.startsWith('  ') && items.length > 0)
      items[items.length - 1] += ` ${line.trim()}`;
    else if (line === '' && items.length === 0) continue;
    else break;
  }
  return items;
}

let develop;
let onMain;
let project;

const sh = (cwd, args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });

function makeRepo(branch, other) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `garde-fous-section-${branch}-`)));
  sh(dir, ['init', '-q', '-b', branch]);
  for (const [rel, content] of [
    ['.claude/hooks/authorize.mjs', "console.log('autorisations');\n"],
    ['.claude/hooks/guard.mjs', "console.log('garde-fous');\n"],
    ['.claude/settings.json', '{}\n'],
    ['.claude/agents/qa.md', '# qa\n'],
    ['scripts/ci/check-tests-integrity.sh', 'exit 0\n'],
  ]) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  sh(dir, ['add', '-A']);
  sh(dir, [
    '-c',
    'user.name=Test',
    '-c',
    'user.email=ci@noreply.invalid',
    'commit',
    '-q',
    '-m',
    'base',
  ]);
  sh(dir, ['branch', other]);
  return dir;
}

before(() => {
  develop = makeRepo('develop', 'main');
  onMain = makeRepo('main', 'develop');
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-section-projet-')));
});

after(() => {
  for (const dir of [develop, onMain, project]) rmSync(dir, { recursive: true, force: true });
});

function hook(role, cwd, toolName, toolInput) {
  const input = {
    session_id: 's-section',
    agent_type: role,
    agent_id: `id-${role}`,
    cwd,
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
  };
  const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

const bash = (command, cwd = () => develop) => ({
  name: 'Bash',
  input: () => ({ command, description: 'test' }),
  cwd,
});

/**
 * Contrôle de chaque refus déclaré : premier mot de la puce, puis actions qui doivent être refusées
 * à chacun des quatorze rôles (dépôt sur develop, ou sur main pour l'écriture de main).
 */
const PROBES = {
  pousser: [
    bash('git push origin develop'),
    bash('git push -u origin develop'),
    bash('git push origin main'),
    bash('git push --force origin develop'),
  ],
  fusionner: [
    bash('git merge develop', () => onMain),
    bash('git rebase develop', () => onMain),
    bash('git reset --soft HEAD~1', () => onMain),
    bash('git branch -f main develop'),
    bash('git update-ref refs/heads/main HEAD'),
    bash('git checkout -B main'),
  ],
  publier: [
    bash('git push origin v1.0.0'),
    bash('git push --tags origin develop'),
    bash('git push origin refs/tags/v1.0.0'),
    bash('git push --follow-tags origin develop'),
  ],
  utiliser: [bash('git stash')],
  contourner: [
    bash('git commit --no-verify -m x'),
    bash('git commit -n -m x'),
    bash('HUSKY=0 git commit -m x'),
    bash('git config core.hooksPath /dev/null'),
  ],
  'retirer,': [
    bash('git worktree remove ../w'),
    bash('git worktree remove --force ../w'),
    bash('git worktree move ../w ../v'),
    bash('git worktree prune'),
  ],
  lancer: [
    bash('node .claude/hooks/authorize.mjs grant --agent qa --scope tests --ticket X --reason y'),
    bash('node .claude/hooks/guard.mjs pre-tool-use'),
    bash('echo x >> .claude/agents/qa.md'),
    {
      name: 'Write',
      input: () => ({ file_path: join(develop, '.claude/settings.json'), content: '{}\n' }),
      cwd: () => develop,
    },
    {
      name: 'Edit',
      input: () => ({
        file_path: join(develop, 'scripts/ci/check-tests-integrity.sh'),
        old_string: 'exit 0',
        new_string: 'exit 1',
      }),
      cwd: () => develop,
    },
  ],
};

/** Ce que la section ne doit pas décrire : le fonctionnement des détections. */
const INTERNALS =
  /analys|instantané|empreinte|motif|expression régulière|regex|PreToolUse|SubagentStop|guard\.mjs|shell\.mjs|policy\.mjs|state\.mjs|audit\.log|détect|illisible|journal/i;

describe('L14-14 : section « Git et garde-fous » des fichiers d’agent', () => {
  it('quatorze fichiers d’agent, un rôle chacun', () => {
    assert.equal(FILES.length, 14, FILES.join(', '));
    assert.equal(new Set(FILES.map(roleOf)).size, 14);
  });

  it('chaque fichier se termine par la section, identique dans les quatorze', () => {
    const sections = FILES.map((f) => [f, sectionOf(TEXTS[f])]);
    for (const [f, section] of sections) {
      assert.ok(section !== null, `${f} : section absente`);
      assert.ok(
        !section.slice(HEADING.length).includes('\n## '),
        `${f} : section suivie d’une autre`,
      );
      assert.ok(section.endsWith('.\n'), `${f} : la section ne termine pas le fichier proprement`);
      assert.equal(TEXTS[f].split(`\n${HEADING}\n`).length, 2, `${f} : section en double`);
    }
    const [, reference] = sections[0];
    for (const [f, section] of sections)
      assert.equal(section, reference, `${f} diffère de ${FILES[0]}`);
  });

  it('énonce ce que l’agent fait, ce qui lui est refusé et la conduite face à un refus', () => {
    const section = sectionOf(TEXTS[FILES[0]]);
    assert.match(section, /^Ce que tu fais :$/m);
    assert.match(section, /branche et dans le worktree que l'orchestrateur te fournit/);
    assert.match(section, /hook pre-commit passe à chaque commit/);
    assert.match(section, /compte rendu/);
    assert.match(section, /Face à un refus des garde-fous, tu ne reformules pas la commande/);
    assert.match(section, /sortie honorable/);
  });

  it('ne décrit pas le fonctionnement des garde-fous', () => {
    const section = sectionOf(TEXTS[FILES[0]]);
    const hit = INTERNALS.exec(section);
    assert.equal(hit, null, `terme interne : ${hit?.[0]}`);
  });

  it('chaque refus déclaré a ses commandes de contrôle, et réciproquement', () => {
    const keys = refusals(sectionOf(TEXTS[FILES[0]])).map((item) => item.split(' ')[0]);
    assert.deepEqual([...keys].sort(), Object.keys(PROBES).sort());
  });

  for (const file of FILES) {
    it(`les refus déclarés sont effectifs pour le rôle ${roleOf(file)}`, () => {
      const role = roleOf(file);
      for (const [key, probes] of Object.entries(PROBES)) {
        for (const probe of probes) {
          // Refus décidé par l'analyse de la commande, sinon rejoué par le hook complet (cibles
          // d'écriture, scripts des garde-fous, outils d'édition).
          if (
            probe.name === 'Bash' &&
            analyzeCommand(probe.input().command, probe.cwd(), role).deny
          )
            continue;
          const r = hook(role, probe.cwd(), probe.name, probe.input());
          assert.equal(r.code, 2, `${role}, « ${key} » : ${JSON.stringify(probe.input())} permis`);
          assert.match(r.stderr, /Garde-fous : refusé/);
        }
      }
    });
  }
});
