// L19-02 (décision de Julien du 21 nov. 2026) : comme `git -c core.hooksPath=…`, core.hooksPath
// passé par l'environnement de git est refusé à toutes les sessions, la principale comprise :
// GIT_CONFIG_PARAMETERS (ce que `-c` transmet aux sous-processus de git) et GIT_CONFIG_COUNT avec
// GIT_CONFIG_KEY_<n> et GIT_CONFIG_VALUE_<n> (git >= 2.31), en tête de commande, par `env`,
// `export`, `declare -x` ou une affectation exportée plus loin. Formes voisines au même effet
// (mesurées sur git 2.30 et 2.43) : un fichier inclus depuis la ligne de commande
// (`-c include.path=`, `-c includeIf.<condition>.path=`, les mêmes clés par l'environnement), qui
// peut fixer core.hooksPath, et `--config-env core.hooksPath=<variable>` (git >= 2.32). Une valeur
// illisible de ces variables, ou une clé `-c` illisible, est refusée. Chaque forme refusée est
// d'abord rejouée par git dans un dépôt jetable dont la configuration locale fixe core.hooksPath
// (comme husky) : git y lit une autre valeur. Puis l'analyse de la commande pour les quinze rôles
// et la session principale, et l'entrée JSON du hook PreToolUse pour la session principale et
// dev-api. Lancé par `pnpm hooks:test`.

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
const ROLES = readdirSync(AGENTS)
  .filter((f) => f.endsWith('.md'))
  .map((f) => /^name:\s*(\S+)\s*$/m.exec(readFileSync(join(AGENTS, f), 'utf8'))[1]);
const LOCAL_VALUE = 'crochets-locaux';
const HOOKS_REASON = /core\.hooksPath/;

let root;
let repo; // dépôt dont la configuration locale fixe core.hooksPath (valeur neutre)
let included; // fichier de configuration qui fixe core.hooksPath, à inclure
let project;

const ENV = () => ({
  ...process.env,
  HOME: join(root, 'home'),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'ci@noreply.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'ci@noreply.invalid',
});

before(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-hookspath-env-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-hookspath-env-projet-')));
  mkdirSync(join(root, 'home'));
  process.env.HOME = join(root, 'home');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  repo = join(root, 'repo');
  execFileSync('git', ['init', '-q', '-b', 'develop', repo], { env: ENV() });
  execFileSync('git', ['config', 'core.hooksPath', LOCAL_VALUE], { cwd: repo, env: ENV() });
  included = join(root, 'inclus.gitconfig');
  writeFileSync(included, '[core]\n\thooksPath = /autre\n');
});

after(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

function hook(command, role) {
  const input = {
    session_id: 's-hookspath-env',
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
    env: { ...ENV(), CLAUDE_PROJECT_DIR: project },
  });
  return { code: res.status, stderr: res.stderr };
}

/** Commande d'un gabarit : %SUB% = sous-commande git, %INC% = fichier inclus. */
const fill = (template, sub) =>
  template.replaceAll('%SUB%', sub).replaceAll('%INC%', included ?? '/tmp/inclus.gitconfig');
const ANALYZED = (t) => fill(t, 'commit -q --allow-empty -m x');
const PROBE = (t) => fill(t, 'config --get core.hooksPath');

/**
 * Gabarits refusés et rejoués par git (bash) : la sonde y lit une autre valeur que la valeur
 * locale ; `mayFail` : versions de git qui ignorent ou rejettent la forme (valeur locale lue).
 */
const REAL_REFUSED = [
  { t: `GIT_CONFIG_PARAMETERS="'core.hooksPath=/autre'" git %SUB%` },
  { t: `GIT_CONFIG_PARAMETERS="'CORE.HOOKSPATH=/autre'" git %SUB%` },
  { t: `GIT_CONFIG_PARAMETERS="'core.hooksPath'='/autre'" git %SUB%`, mayFail: 'git < 2.31' },
  { t: `GIT_CONFIG_PARAMETERS="'user.name=x' 'core.hooksPath=/autre'" git %SUB%` },
  { t: `export GIT_CONFIG_PARAMETERS="'core.hooksPath=/autre'"; git %SUB%` },
  { t: `env GIT_CONFIG_PARAMETERS="'core.hooksPath=/autre'" git %SUB%` },
  { t: `env -u X GIT_CONFIG_PARAMETERS="'core.hooksPath=/autre'" git %SUB%` },
  { t: `P="'core.hooksPath=/autre'"; GIT_CONFIG_PARAMETERS=$P git %SUB%` },
  {
    t: 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/autre git %SUB%',
    mayFail: 'git < 2.31',
  },
  {
    t: 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=Core.HooksPath GIT_CONFIG_VALUE_0=/autre git %SUB%',
    mayFail: 'git < 2.31',
  },
  {
    t: 'GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=user.name GIT_CONFIG_VALUE_0=x GIT_CONFIG_KEY_1=core.hooksPath GIT_CONFIG_VALUE_1=/autre git %SUB%',
    mayFail: 'git < 2.31',
  },
  {
    t: 'export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/autre; git %SUB%',
    mayFail: 'git < 2.31',
  },
  {
    t: 'env GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/autre git %SUB%',
    mayFail: 'git < 2.31',
  },
  {
    t: 'export GIT_CONFIG_KEY_0=core.hooksPath; export GIT_CONFIG_VALUE_0=/autre GIT_CONFIG_COUNT=1; git %SUB%',
    mayFail: 'git < 2.31',
  },
  {
    t: 'GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/autre GIT_CONFIG_COUNT=1; export GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 GIT_CONFIG_COUNT; git %SUB%',
    mayFail: 'git < 2.31',
  },
  {
    t: 'declare -x GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/autre; git %SUB%',
    mayFail: 'git < 2.31',
  },
  {
    t: 'K=core.hooksPath; GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=$K GIT_CONFIG_VALUE_0=/autre git %SUB%',
    mayFail: 'git < 2.31',
  },
  // fichier inclus depuis la ligne de commande ou l'environnement
  { t: 'git -c include.path=%INC% %SUB%' },
  // -c collé : git le rejette (option inconnue) ; refusé quand même, lu comme -c séparé (T4)
  { t: 'git -cinclude.path=%INC% %SUB%', mayFail: 'git : -c collé inconnu' },
  { t: 'git -c Include.Path=%INC% %SUB%' },
  { t: 'git -c includeIf.gitdir:/.path=%INC% %SUB%' },
  { t: `GIT_CONFIG_PARAMETERS="'include.path=%INC%'" git %SUB%` },
  {
    t: 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=include.path GIT_CONFIG_VALUE_0=%INC% git %SUB%',
    mayFail: 'git < 2.31',
  },
  // --config-env (git >= 2.32), collé ou séparé
  { t: 'X=/autre git --config-env=core.hooksPath=X %SUB%', mayFail: 'git < 2.32' },
  { t: 'X=/autre git --config-env core.hooksPath=X %SUB%', mayFail: 'git < 2.32' },
  { t: 'X=%INC% git --config-env=include.path=X %SUB%', mayFail: 'git < 2.32' },
];

/** Formes illisibles refusées à toutes les sessions, sans rejeu. */
const ILLEGIBLE = [
  'GIT_CONFIG_PARAMETERS="$P" git commit -m x',
  'GIT_CONFIG_PARAMETERS=$(cat params.txt) git commit -m x',
  'export GIT_CONFIG_PARAMETERS="$P"; git commit -m x',
  'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=$K GIT_CONFIG_VALUE_0=/x git commit -m x',
  'GIT_CONFIG_COUNT=$N GIT_CONFIG_KEY_0=user.name GIT_CONFIG_VALUE_0=x git commit -m x',
  'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=user.name GIT_CONFIG_VALUE_0="$V" git commit -m x',
  'env GIT_CONFIG_KEY_0="$K" git commit -m x',
  'GIT_CONFIG_KEY_0=core.hooks; GIT_CONFIG_KEY_0+=Path; export GIT_CONFIG_KEY_0 GIT_CONFIG_COUNT=1 GIT_CONFIG_VALUE_0=/x; git commit -m x',
  'read GIT_CONFIG_KEY_0 < cle.txt; export GIT_CONFIG_KEY_0; git commit -m x',
  'printf -v GIT_CONFIG_KEY_0 %s core.hooksPath; export GIT_CONFIG_KEY_0; git commit -m x',
  'declare -n R=GIT_CONFIG_KEY_0; R=core.hooksPath; git commit -m x',
  'git -c "$KV" commit -m x',
  'git -c"$KV" commit -m x',
  'git --config-env="$KV" commit -m x',
  'git --config-env "$K"=X commit -m x',
];

/** Gabarits permis à toutes les sessions : aucun ne touche core.hooksPath ni n'inclut de fichier. */
const PERMITTED = [
  'git %SUB%',
  `GIT_CONFIG_PARAMETERS="'color.ui=never'" git %SUB%`,
  'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=user.name GIT_CONFIG_VALUE_0=Test git %SUB%',
  'export GIT_CONFIG_NOSYSTEM=1; git %SUB%',
  'GIT_CONFIG_NOSYSTEM=1 git %SUB%',
  'GIT_CONFIG_GLOBAL=%INC% git %SUB%',
  'git -c user.name=Test %SUB%',
  'git -c core.quotepath=false %SUB%',
  'NOM=lot; git -c user.name=$NOM %SUB%',
  'git status --short && git %SUB%',
];

/** Valeur de core.hooksPath lue par git après le gabarit (bash), ou null si git échoue. */
function probe(template) {
  const res = spawnSync('bash', ['-c', PROBE(template)], {
    cwd: repo,
    encoding: 'utf8',
    env: ENV(),
  });
  return res.status === 0 ? res.stdout.trim() : null;
}

describe('L19-02 : comportement réel de git (dépôt jetable)', () => {
  it('la configuration locale fixe core.hooksPath', () => {
    assert.equal(probe('git %SUB%'), LOCAL_VALUE);
  });

  it('chaque forme refusée change core.hooksPath quand git la connaît', () => {
    for (const { t, mayFail } of REAL_REFUSED) {
      const value = probe(t);
      if (mayFail && (value === null || value === LOCAL_VALUE)) continue;
      assert.equal(value, '/autre', `${PROBE(t)}`);
    }
  });

  it('chaque forme permise laisse la valeur locale', () => {
    for (const t of PERMITTED) {
      assert.equal(probe(t), LOCAL_VALUE, PROBE(t));
    }
  });
});

describe('L19-02 : core.hooksPath par l’environnement refusé à toutes les sessions', () => {
  it('connaît les quinze rôles d’agent', () => {
    assert.equal(ROLES.length, 15, ROLES.join(', '));
  });

  const refused = [
    ...REAL_REFUSED.map(({ t }) => [ANALYZED(t), HOOKS_REASON]),
    ...REAL_REFUSED.map(({ t }) => [PROBE(t), HOOKS_REASON]),
    ...ILLEGIBLE.map((c) => [c, /illisible/]),
  ];

  for (const role of ['main', ...ROLES]) {
    it(`refuse chaque forme au rôle ${role}`, () => {
      for (const [command, reason] of refused) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.match(deny ?? '', reason, `${role} : ${command}`);
      }
    });
  }

  it('le hook complet refuse chaque forme à la session principale et à dev-api', () => {
    for (const [command, reason] of refused) {
      for (const role of ['main', 'dev-api']) {
        const r = hook(command, role);
        assert.equal(r.code, 2, `${role} : ${command}`);
        assert.match(r.stderr, reason, `${role} : ${command}`);
      }
    }
  });

  it('laisse les variables et les options -c sans effet sur core.hooksPath', () => {
    for (const command of [...PERMITTED.map(ANALYZED), ...PERMITTED.map(PROBE)]) {
      for (const role of ['main', 'dev-api', 'qa', 'lead-architecte', 'correcteur']) {
        assert.equal(analyzeCommand(command, repo, role).deny, null, `${role} : ${command}`);
      }
      for (const role of ['main', 'dev-api']) {
        const r = hook(command, role);
        assert.equal(r.code, 0, `${role} : ${command} : ${r.stderr}`);
      }
    }
  });
});
