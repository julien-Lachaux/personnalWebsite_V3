// L25-01 (L19-05, décision de Julien du 21 nov. 2026) : une clé de configuration git qui lance une
// commande (core.sshCommand, core.pager, core.editor, core.fsmonitor, diff.external, alias,
// credential.helper, filtres…) passée par l'environnement de git (GIT_CONFIG_PARAMETERS ;
// GIT_CONFIG_COUNT avec GIT_CONFIG_KEY_<n> et GIT_CONFIG_VALUE_<n>, git >= 2.31) ou par
// `--config-env <clé>=<variable>` (git >= 2.32) est analysée comme `git -c <clé>=<valeur>` : la
// commande est lue comme du code shell imbriqué (git push refusé, cible d'écriture vérifiée), un
// alias qui pousse est refusé, une valeur illisible aussi. Formes voisines mesurées au même effet
// et fermées par le même lot :
// - la clé entourée d'espaces (`git -c ' core.hooksPath=…'`), que git 2.30 retire ;
// - deux `-c alias.<nom>` : git lance le dernier ; un alias de l'environnement l'emporte sur celui
//   du dépôt ;
// - `protocol.ext.allow` et `protocol.allow` (autre que never), `GIT_ALLOW_PROTOCOL` qui cite ext :
//   le transport ext:: lance la commande écrite dans l'URL ;
// - `remote.<nom>.uploadpack|receivepack` et les options `--upload-pack`, `-u` (clone),
//   `--exec` (archive) : commande lancée à la place de git-upload-pack, en local.
// Chaque forme refusée est d'abord rejouée par git dans un dépôt jetable avec une commande témoin
// (`touch <témoin>`) : git la lance quand sa version la connaît (`since` : première version qui
// la lit, `before` : première version qui ne la lit plus, git 2.31 ayant cessé de retirer les
// espaces autour d'une clé de `-c` ; `varies` : effet qui change selon la version sans borne
// connue, jamais exigé ; mesuré sur 2.30.2, sur 2.43.0 de l'image Playwright du compose et par la
// CI). Le refus par les hooks est exigé pour toutes les formes, quelle que soit la version. Puis
// l'analyse avec une commande qui pousse (refusée à la session principale et aux quinze rôles) et
// le hook complet avec une commande qui supprime un test existant (refusée à la session
// principale et à dev-api). Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
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
import { GIT_SPAWN_LIMITS, hermeticGitEnv } from './support/hermetic-git-env.mjs';

const HOOKS = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(HOOKS, 'guard.mjs');
const AGENTS = join(dirname(HOOKS), 'agents');
const ROLES = readdirSync(AGENTS)
  .filter((f) => f.endsWith('.md'))
  .map((f) => /^name:\s*(\S+)\s*$/m.exec(readFileSync(join(AGENTS, f), 'utf8'))[1]);

const PUSH = 'git push origin main';
const REMOVE = 'rm apps/api/src/app.spec.ts';

let root;
let repo;
let project;
let marker;
let extScript;

// Lot 49 : environnement hermétique (aucun askpass de l'utilisateur) ; la configuration globale de
// git reste celle du HOME jetable, des gabarits écrivant en --global.
const ENV = () =>
  hermeticGitEnv({
    HOME: join(root, 'home'),
    GIT_CONFIG_GLOBAL: join(root, 'home', '.gitconfig'),
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'ci@noreply.invalid',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'ci@noreply.invalid',
  });

function write(rel, content) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), content);
}

before(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-config-env-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-config-env-projet-')));
  mkdirSync(join(root, 'home'));
  marker = join(root, 'temoin');
  extScript = join(root, 'ext.sh');
  writeFileSync(extScript, `#!/bin/sh\ntouch ${marker}\n`);
  repo = join(root, 'repo');
  execFileSync('git', ['init', '-q', '-b', 'develop', repo], { env: ENV(), ...GIT_SPAWN_LIMITS });
  write('apps/api/src/app.ts', 'export const answer = 42;\n');
  write('apps/api/src/app.spec.ts', "it('répond', () => {});\n");
  write('suivi.txt', 'a\n');
  write('filtre.txt', 'a\n');
  write('.gitattributes', 'filtre.txt filter=zz\n');
  execFileSync('git', ['add', '-A'], { cwd: repo, env: ENV(), ...GIT_SPAWN_LIMITS });
  execFileSync('git', ['commit', '-q', '-m', 'base'], {
    cwd: repo,
    env: ENV(),
    ...GIT_SPAWN_LIMITS,
  });
  execFileSync('git', ['config', 'alias.st', 'status --short'], {
    cwd: repo,
    env: ENV(),
    ...GIT_SPAWN_LIMITS,
  });
  // Fichier suivi modifié : git diff lance diff.external.
  write('suivi.txt', 'b\n');
});

after(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

function hook(command, role) {
  const input = {
    session_id: 's-config-env',
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
    ...GIT_SPAWN_LIMITS,
  });
  return { code: res.status, stderr: res.stderr };
}

const CREDENTIAL = "printf 'protocol=https\\nhost=x.invalid\\n\\n' |";
const SSH_URL = 'ssh://x.invalid/depot';

/**
 * Gabarits : %CMD% = commande que git lance. Rejoués avec une commande témoin, analysés avec une
 * commande qui pousse et une commande qui supprime un test existant.
 */
const LAUNCHED = [
  // GIT_CONFIG_PARAMETERS, ancienne forme 'clé=valeur' (git 2.30 et suivants)
  { t: `GIT_CONFIG_PARAMETERS="'diff.external=%CMD%'" git diff` },
  { t: `GIT_CONFIG_PARAMETERS="'user.name=x' 'diff.external=%CMD%'" git diff` },
  {
    t: `GIT_CONFIG_PARAMETERS="' diff.external =%CMD%'" git diff`,
    varies:
      'lancé par git 2.30.2 et 2.43.0, pas par git 2.56.1 de l’exécuteur GitHub (run 45025051529)',
  },
  { t: `GIT_CONFIG_PARAMETERS="'DIFF.EXTERNAL=%CMD%'" git diff` },
  { t: `export GIT_CONFIG_PARAMETERS="'diff.external=%CMD%'"; git diff` },
  { t: `env GIT_CONFIG_PARAMETERS="'core.fsmonitor=%CMD%'" git status` },
  { t: `${CREDENTIAL} GIT_CONFIG_PARAMETERS="'credential.helper=!%CMD%'" git credential fill` },
  { t: `GIT_CONFIG_PARAMETERS="'core.sshCommand=%CMD%;false'" git ls-remote ${SSH_URL}` },
  {
    t: `echo x >> filtre.txt; GIT_CONFIG_PARAMETERS="'filter.zz.clean=%CMD%;cat'" git add filtre.txt`,
  },
  { t: `GIT_CONFIG_PARAMETERS="'alias.zz=!%CMD%'" git zz` },
  // l'alias de l'environnement l'emporte sur celui du dépôt (alias.st = status --short)
  { t: `GIT_CONFIG_PARAMETERS="'alias.st=!%CMD%'" git st` },
  // GIT_CONFIG_PARAMETERS, nouvelle forme 'clé'='valeur' (git >= 2.31)
  { t: `GIT_CONFIG_PARAMETERS="'diff.external'='%CMD%'" git diff`, since: '2.31' },
  // GIT_CONFIG_COUNT, GIT_CONFIG_KEY_<n>, GIT_CONFIG_VALUE_<n> (git >= 2.31)
  {
    t: `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=diff.external GIT_CONFIG_VALUE_0='%CMD%' git diff`,
    since: '2.31',
  },
  {
    t: `GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=user.name GIT_CONFIG_VALUE_0=x GIT_CONFIG_KEY_1=core.sshCommand GIT_CONFIG_VALUE_1='%CMD%;false' git ls-remote ${SSH_URL}`,
    since: '2.31',
  },
  {
    t: `export GIT_CONFIG_VALUE_0='%CMD%'; export GIT_CONFIG_KEY_0=diff.external GIT_CONFIG_COUNT=1; git diff`,
    since: '2.31',
  },
  {
    t: `GIT_CONFIG_KEY_0=core.fsmonitor; GIT_CONFIG_VALUE_0='%CMD%'; GIT_CONFIG_COUNT=1; export GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 GIT_CONFIG_COUNT; git status`,
    since: '2.31',
  },
  {
    t: `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.zz GIT_CONFIG_VALUE_0='!%CMD%' git zz`,
    since: '2.31',
  },
  {
    t: `${CREDENTIAL} GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=credential.helper GIT_CONFIG_VALUE_0='!%CMD%' git credential fill`,
    since: '2.31',
  },
  // --config-env <clé>=<variable> (git >= 2.32), collé ou séparé
  { t: `V='%CMD%' git --config-env=diff.external=V diff`, since: '2.32' },
  { t: `V='%CMD%' git --config-env diff.external=V diff`, since: '2.32' },
  { t: `export V='!%CMD%'; git --config-env=alias.zz=V zz`, since: '2.32' },
  {
    t: `V='%CMD%;false' git --config-env=core.sshCommand=V ls-remote ${SSH_URL}`,
    since: '2.32',
  },
  // -c : clé entourée d'espaces (retirés par git 2.30), dernier alias de la commande
  { t: `git -c ' diff.external=%CMD%' diff`, before: '2.31' },
  { t: `git -c 'diff.external =%CMD%' diff`, before: '2.31' },
  { t: `git -c alias.zz=status -c 'alias.zz=!%CMD%' zz` },
  // commande lancée à la place de git-upload-pack, transport local
  { t: `git -c remote.o.url=. -c remote.o.uploadpack='%CMD%;git-upload-pack' ls-remote o` },
  {
    t: `GIT_CONFIG_PARAMETERS="'remote.o.url=.' 'remote.o.uploadpack=%CMD%;git-upload-pack'" git ls-remote o`,
  },
  { t: `git ls-remote --upload-pack='%CMD%;git-upload-pack' .` },
  { t: `git ls-remote --upload-pack '%CMD%;git-upload-pack' .` },
  { t: `git ls-remote --upl='%CMD%;git-upload-pack' .` },
  { t: `git fetch --upload-pack='%CMD%;git-upload-pack' .` },
];

/** Transport ext:: (commande écrite dans l'URL), permis par une clé ou une variable. */
const EXT = (git) => `${git} ls-remote 'ext::sh %SCRIPT%'`;
const EXT_ENABLED = [
  { t: EXT('git -c protocol.ext.allow=always') },
  { t: EXT('git -c protocol.allow=always') },
  { t: EXT('git -c protocol.ext.allow=user') },
  { t: EXT('GIT_ALLOW_PROTOCOL=ext git') },
  { t: EXT('GIT_ALLOW_PROTOCOL=file:ext git') },
  { t: EXT(`GIT_CONFIG_PARAMETERS="'protocol.ext.allow=always'" git`) },
  {
    t: EXT('GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=protocol.ext.allow GIT_CONFIG_VALUE_0=always git'),
    since: '2.31',
  },
  { t: EXT('V=always; export V; git --config-env=protocol.ext.allow=V'), since: '2.32' },
];
/** Écriture persistante du même réglage par git config (rejouée puis retirée). */
const EXT_CONFIG = [
  'git config protocol.ext.allow always',
  'git config --global protocol.allow always',
  'git config --add protocol.ext.allow user',
];

/** Formes illisibles, refusées sans rejeu. */
const ILLEGIBLE = [
  // valeur d'une clé qui lance une commande, venue d'une variable absente de la commande
  'git --config-env=core.pager=PAGER_INCONNU log',
  'git --config-env core.sshCommand=$N fetch origin',
  'git --config-env=alias.zz=INCONNU zz',
  'git --config-env=protocol.ext.allow=INCONNU fetch origin',
  // GIT_CONFIG_KEY_<n> sans GIT_CONFIG_VALUE_<n> lisible dans la commande
  'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.pager git log',
  'export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=diff.external; git diff',
  '(export GIT_CONFIG_KEY_0=diff.external GIT_CONFIG_COUNT=1; git diff)',
  // format que git rejette : lu autrement, il pourrait cacher une entrée
  `GIT_CONFIG_PARAMETERS="core.pager=x" git log`,
  `GIT_CONFIG_PARAMETERS="'core.pager=x" git log`,
  `GIT_CONFIG_PARAMETERS=" 'core.pager=x'" git log`,
  `GIT_CONFIG_PARAMETERS="'a.b=x''core.pager=y'" git log`,
  'GIT_ALLOW_PROTOCOL=$P git fetch origin',
  // valeur à apostrophes ou à espaces : jamais résolue depuis une variable
  `P="'diff.external=x'"; export GIT_CONFIG_PARAMETERS=$P; git diff`,
];

/** Formes permises à toutes les sessions (aucune ne lance de commande hors de la liste lue). */
const PERMITTED = [
  `GIT_CONFIG_PARAMETERS="'core.pager=less'" git log`,
  `GIT_CONFIG_PARAMETERS="'user.name=x' 'core.quotepath=false'" git status`,
  `GIT_CONFIG_PARAMETERS="'color.ui'='never' 'core.pager'=" git status`,
  `GIT_CONFIG_PARAMETERS= git status`,
  'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.editor GIT_CONFIG_VALUE_0=true git status',
  'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=user.name GIT_CONFIG_VALUE_0=Test git status',
  'export GIT_CONFIG_KEY_0=core.pager GIT_CONFIG_VALUE_0=cat GIT_CONFIG_COUNT=1; git log',
  'V=cat git --config-env=core.pager=V log',
  'git --config-env=user.name=LOGNAME log',
  'git -c core.pager=less log',
  'git -c alias.zz=status zz',
  'git -c protocol.file.allow=always status',
  'git -c protocol.ext.allow=never status',
  'GIT_ALLOW_PROTOCOL=file:https git status',
  'git config protocol.file.allow always',
  'git config --unset protocol.ext.allow',
  'git ls-remote --upload-pack=git-upload-pack .',
  'git fetch --upload-pack git-upload-pack .',
];

const fill = (t, cmd) => t.replaceAll('%CMD%', cmd).replaceAll('%SCRIPT%', extScript);

/** Version de git qui rejoue les formes : [majeure, mineure]. */
const GIT_VERSION = (() => {
  const m = /(\d+)\.(\d+)/.exec(
    execFileSync('git', ['--version'], { encoding: 'utf8', ...GIT_SPAWN_LIMITS }),
  );
  return [Number(m[1]), Number(m[2])];
})();
const atLeast = (version) => {
  const [major, minor] = version.split('.').map(Number);
  return GIT_VERSION[0] > major || (GIT_VERSION[0] === major && GIT_VERSION[1] >= minor);
};
/**
 * La forme est effective pour cette version de git : `since` (première version qui la lit) et
 * `before` (première version qui ne la lit plus) bornent son effet. Hors de ces bornes, git
 * l'ignore ou la rejette ; `varies` : effet mesuré différent selon la version sans borne connue,
 * jamais exigé. Le refus par les hooks reste exigé pour toutes les formes et toutes les versions.
 */
const effectiveHere = ({ since, before, varies }) =>
  varies === undefined &&
  (since === undefined || atLeast(since)) &&
  (before === undefined || !atLeast(before));

/** Vrai si git, rejouant le gabarit (bash), lance la commande témoin. */
function launches(template) {
  rmSync(marker, { force: true });
  spawnSync('bash', ['-c', fill(template, `touch ${marker}`)], {
    cwd: repo,
    encoding: 'utf8',
    env: ENV(),
    timeout: 20000,
    killSignal: 'SIGKILL',
  });
  return existsSync(marker);
}

describe('L25-01 : comportement réel de git (dépôt jetable, témoin)', () => {
  it('chaque forme lance la commande quand la version de git la connaît', () => {
    // Toutes les formes sont rejouées avant l'assertion : un échec les nomme toutes.
    const missed = [...LAUNCHED, ...EXT_ENABLED]
      .filter((form) => effectiveHere(form) && !launches(form.t))
      .map((form) => fill(form.t, '<témoin>'));
    assert.deepEqual(
      missed,
      [],
      `commande témoin non lancée par git ${GIT_VERSION.join('.')} :\n${missed.join('\n')}`,
    );
  });

  it('chaque version de git exécute au moins les formes connues partout', () => {
    const everywhere = [...LAUNCHED, ...EXT_ENABLED].filter(
      (f) => !f.since && !f.before && !f.varies,
    );
    assert.ok(everywhere.length >= 20, `${everywhere.length} formes sans borne de version`);
  });

  it('git config qui permet ext:: lance la commande de l’URL', () => {
    for (const command of EXT_CONFIG) {
      const unset = command.replace(/ (--add )?(protocol\.\S+) \S+$/, ' --unset $2');
      const launched = launches(`${command}; ${EXT('git')}`);
      spawnSync('bash', ['-c', unset], { cwd: repo, env: ENV(), ...GIT_SPAWN_LIMITS });
      assert.ok(launched, command);
    }
  });

  it('sans réglage, ext:: ne lance rien', () => {
    assert.equal(launches(EXT('git')), false);
  });
});

describe('L25-01 : clé de -c entourée d’espaces (git 2.30 les retire), core.hooksPath compris', () => {
  const SPACED = [
    "git -c ' core.hooksPath=/autre' %SUB%",
    "git -c 'core.hooksPath =/autre' %SUB%",
    "git -c ' include.path=/tmp/inclus.gitconfig' %SUB%",
    `GIT_CONFIG_PARAMETERS="' core.hooksPath =/autre'" git %SUB%`,
  ];

  it('git 2.30 lit la clé sans ses espaces', () => {
    const res = spawnSync(
      'bash',
      ['-c', SPACED[0].replace('%SUB%', 'config --get core.hooksPath')],
      { cwd: repo, encoding: 'utf8', env: ENV(), ...GIT_SPAWN_LIMITS },
    );
    const version = execFileSync('git', ['--version'], { encoding: 'utf8', ...GIT_SPAWN_LIMITS });
    if (/ 2\.([0-9]|[12][0-9]|30)\./.test(version)) assert.equal(res.stdout.trim(), '/autre');
  });

  for (const role of ['main', ...ROLES]) {
    it(`refuse au rôle ${role} la clé à espaces qui fixe core.hooksPath ou inclut un fichier`, () => {
      for (const t of SPACED) {
        const command = t.replace('%SUB%', 'commit -q -m x');
        assert.match(analyzeCommand(command, repo, role).deny ?? '', /core\.hooksPath/, command);
      }
    });
  }
});

describe('L25-01 : clés qui lancent une commande, refusées comme -c', () => {
  it('connaît les quinze rôles d’agent', () => {
    assert.equal(ROLES.length, 15, ROLES.join(', '));
  });

  const pushes = LAUNCHED.map(({ t }) => fill(t, PUSH));
  const removes = LAUNCHED.map(({ t }) => fill(t, REMOVE));
  const ext = [
    ...EXT_ENABLED.map(({ t }) => fill(t, PUSH)),
    ...EXT_CONFIG.map((c) => `${c}; ${fill(EXT('git'), PUSH)}`),
  ];

  for (const role of ['main', ...ROLES]) {
    it(`refuse au rôle ${role} une commande qui pousse, ext:: et les formes illisibles`, () => {
      for (const command of pushes) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.match(deny ?? '', /git push/, `${role} : ${command}`);
      }
      for (const command of ext) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.match(deny ?? '', /ext::/, `${role} : ${command}`);
      }
      for (const command of ILLEGIBLE) {
        const deny = analyzeCommand(command, repo, role).deny;
        assert.match(deny ?? '', /illisible/, `${role} : ${command}`);
      }
    });
  }

  it('le hook complet refuse la suppression d’un test existant par la commande lancée', () => {
    for (const command of removes) {
      for (const role of ['main', 'dev-api']) {
        const r = hook(command, role);
        assert.equal(r.code, 2, `${role} : ${command}`);
        assert.match(r.stderr, /test existant/, `${role} : ${command}`);
      }
    }
  });

  it('le hook complet refuse les formes qui poussent et ext:: à la session principale', () => {
    for (const command of [...pushes, ...ext, ...ILLEGIBLE]) {
      const r = hook(command, 'main');
      assert.equal(r.code, 2, command);
    }
  });

  it('laisse les clés lisibles qui ne lancent rien de refusé', () => {
    for (const command of PERMITTED) {
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
