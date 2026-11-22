// L22-05 (décision de Julien du 21 nov. 2026) : la session principale (rôle « main ») peut
// télécharger les artefacts d'un run de CI pour en lire les traces, par
// `gh run download <identifiant> --dir <dossier temporaire de session>`. La destination est écrite
// en clair et se trouve dans le dossier temporaire de session (champ scratchpad_dir de l'entrée du
// hook, ou /tmp/claude-<uid>/<projet>/<session>/scratchpad), hors de tout dépôt git, liens
// symboliques résolus. Les agents ne téléchargent rien. Rejeu par l'analyse de la commande
// (lib/shell.mjs) et par le hook complet (entrée JSON de PreToolUse) ; gh n'est pas lancé.
// Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
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

// Dossier temporaire de session reconnu par sa forme (il n'a pas besoin d'exister).
const SESSION = '/tmp/claude-1000/projet-x/0f1e2d3c/scratchpad';

let repo;
let project;
let scratch;

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-dl-')));
  project = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-dl-projet-')));
  // Nom sans la forme reconnue : seul le champ scratchpad_dir le rend permis.
  scratch = join(realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-dl-session-'))), 'bac');
  mkdirSync(scratch);
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
  // Lien du dossier temporaire vers le dépôt, et clone (dépôt git) dans le dossier temporaire.
  symlinkSync(repo, join(scratch, 'vers-depot'));
  execFileSync('git', ['init', '-q', '-b', 'develop', join(scratch, 'clone')]);
});

after(() => {
  for (const dir of [repo, project, dirname(scratch)])
    rmSync(dir, { recursive: true, force: true });
});

/** Motif de refus de l'analyse de la commande (null : permise). */
const denyOf = (command, role = 'main', opts = {}) =>
  analyzeCommand(command, repo, role, opts).deny;

/** Hook complet ; `role` « main » : entrée sans agent_type. */
function hook(command, role = 'main', withScratch = true) {
  const input = {
    session_id: 's-dl',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command, description: 'test' },
  };
  if (withScratch) input.scratchpad_dir = scratch;
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
  `gh run download 123 --dir ${SESSION}/ci-123`,
  `gh run download 123 --dir=${SESSION}/ci-123`,
  `gh run download 123 -D ${SESSION}/ci-123`,
  `gh run download 123 -D${SESSION}/ci-123`,
  `gh run download --dir ${SESSION}/ci-123 123`,
  `gh run download 123 --dir ${SESSION}`,
  `gh run download 123 --dir ${SESSION}/ci-123 --name coverage-api`,
  `gh run download 123 --dir ${SESSION}/ci-123 -n coverage-api -n playwright-report`,
  `gh run download 123 --dir ${SESSION}/ci-123 --pattern 'coverage-*'`,
  `gh run download 123 --dir "${SESSION}/traces CI"`,
  `mkdir -p ${SESSION}/ci-123 && gh run download 123 --dir ${SESSION}/ci-123`,
];

const REFUSED = [
  // Destination absente, répétée, calculée ou hors du dossier temporaire de session.
  ['gh run download 123', /sans --dir/],
  ['gh run download 123 --name coverage-api', /sans --dir/],
  [`gh run download 123 --dir ${SESSION}/a --dir ${SESSION}/b`, /--dir répété/],
  ['gh run download 123 --dir "$D"', /dossier calculé/],
  ['gh run download 123 --dir "$(mktemp -d)"', /dossier calculé/],
  ['gh run download 123 --dir .', /hors du dossier temporaire de session/],
  ['gh run download 123 --dir artefacts', /hors du dossier temporaire de session/],
  ['gh run download 123 --dir /tmp/artefacts', /hors du dossier temporaire de session/],
  ['gh run download 123 --dir /tmp/claude-1000/scratchpad', /hors du dossier temporaire/],
  ['gh run download 123 --dir ~/artefacts', /hors du dossier temporaire de session/],
  [`gh run download 123 --dir ${SESSION}/../../x`, /hors du dossier temporaire de session/],
  [`gh run download 123 --dir ${SESSION}x`, /hors du dossier temporaire de session/],
  ['gh run download 123 --dir', /valeur absente/],
  // Run absent, illisible ou multiple.
  [`gh run download --dir ${SESSION}/x`, /un seul run par son identifiant/],
  [`gh run download 1 2 --dir ${SESSION}/x`, /un seul run par son identifiant/],
  [`gh run download abc --dir ${SESSION}/x`, /un seul run par son identifiant/],
  [`gh run download $RUN --dir ${SESSION}/x`, /run illisible/],
  // Autre dépôt, option inconnue ou interactive, xargs.
  [`gh run download 123 --dir ${SESSION}/x -R x/y`, /autre dépôt/],
  [`gh run download 123 --dir ${SESSION}/x --repo=x/y`, /autre dépôt/],
  [`GH_REPO=x/y gh run download 123 --dir ${SESSION}/x`, /variable GH_REPO/],
  [`GH_HOST=example.invalid gh run download 123 --dir ${SESSION}/x`, /variable GH_HOST/],
  [`gh run download 123 --dir ${SESSION}/x --web`, /option non permise/],
  [`gh run download 123 --dir ${SESSION}/x --unknown`, /option non permise/],
  [`echo 123 | xargs gh run download --dir ${SESSION}/x`, /entrée standard/],
  [`gh run --repo x/y download 123 --dir ${SESSION}/x`, /en tête/],
  // Le contenu téléchargé est une donnée : l'exécuter dans la même commande est illisible.
  [
    `gh run download 123 --dir ${SESSION}/x && bash ${SESSION}/x/script.sh`,
    /écrit par la même commande|illisible/,
  ],
  // Toujours refusé : toute autre écriture par gh sur les runs.
  ['gh run rerun 123', /ni une lecture ni une écriture du flux/],
  ['gh run cancel 123', /ni une lecture ni une écriture du flux/],
];

describe('L22-05 : gh run download, session principale', () => {
  for (const command of ALLOWED) {
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

  it('reconnaît le dossier temporaire transmis par le hook (scratchpad_dir)', () => {
    assert.equal(denyOf(`gh run download 7 --dir ${scratch}/ci-7`, 'main', { scratch }), null);
    assert.equal(denyOf(`gh run download 7 --dir ${scratch}`, 'main', { scratch }), null);
    assert.equal(
      denyOf(`cd ${scratch} && gh run download 7 --dir ci-7`, 'main', { scratch }),
      null,
    );
    // Sans le champ, ce dossier n'a pas la forme reconnue : refusé.
    assert.match(denyOf(`gh run download 7 --dir ${scratch}/ci-7`), /hors du dossier temporaire/);
  });

  it('refuse un lien du dossier temporaire vers le dépôt, et un dépôt git dans le dossier', () => {
    assert.match(
      denyOf(`gh run download 7 --dir ${scratch}/vers-depot/ci`, 'main', { scratch }),
      /hors du dossier temporaire/,
    );
    assert.match(
      denyOf(`gh run download 7 --dir ${scratch}/clone/ci`, 'main', { scratch }),
      /dans un dépôt git/,
    );
  });

  it('le hook complet laisse passer la forme permise et refuse les autres', () => {
    for (const command of [
      `gh run download 7 --dir ${scratch}/ci-7`,
      `gh run download 7 --dir ${SESSION}/ci-7 --name coverage-api`,
    ]) {
      const r = hook(command);
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
    for (const command of [
      'gh run download 7',
      `gh run download 7 --dir ${repo}/artefacts`,
      `gh run download 7 --dir ${scratch}/vers-depot/ci`,
    ]) {
      const r = hook(command);
      assert.equal(r.code, 2, command);
      assert.match(r.stderr, /Garde-fous : refusé/, command);
    }
    // Sans scratchpad_dir dans l'entrée, seule la forme reconnue passe.
    assert.equal(hook(`gh run download 7 --dir ${scratch}/ci-7`, 'main', false).code, 2);
  });
});

describe('L22-05 : gh run download, agents spécialisés', () => {
  it('quinze rôles, revue-pr compris', () => {
    assert.ok(ROLES.includes('revue-pr'));
    assert.ok(ROLES.length >= 15, ROLES.join(', '));
  });

  for (const role of ROLES) {
    it(`refuse au rôle ${role} tout téléchargement d'artefacts`, () => {
      for (const command of [...ALLOWED, `gh run download 7 --dir ${scratch}/ci-7`]) {
        const deny = analyzeCommand(command, repo, role, { scratch }).deny;
        assert.notEqual(deny, null, `${role} : ${command}`);
        assert.match(deny, new RegExp(`rôle ${role}`), `${role} : ${command} : ${deny}`);
        assert.match(deny, /interdit aux agents/, `${role} : ${command} : ${deny}`);
      }
    });
  }

  // L22-01 : la recette lit la CI de la pull request par ces lectures, permises à tous les rôles.
  it('laisse à chaque rôle les lectures de la CI utilisées par la recette', () => {
    for (const role of [...ROLES, 'main']) {
      for (const command of [
        'gh run list --branch lot/22-un-seul-run',
        'gh run list --branch lot/22-un-seul-run --limit 5 --json databaseId,headSha,status,conclusion',
        'gh run view 123',
        'gh run view 123 --log-failed',
        'gh run view 123 --job 456 --log',
      ])
        assert.equal(analyzeCommand(command, repo, role).deny, null, `${role} : ${command}`);
    }
  });

  it('le hook complet refuse le téléchargement aux agents', () => {
    for (const role of ['dev-api', 'chef-de-projet', 'revue-pr']) {
      const r = hook(`gh run download 7 --dir ${scratch}/ci-7`, role);
      assert.equal(r.code, 2, role);
      assert.match(r.stderr, /interdit aux agents/, role);
    }
  });
});
