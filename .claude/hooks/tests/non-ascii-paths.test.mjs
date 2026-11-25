// BF-8 (brief back-002, 20 nov. 2026), côté hooks : les chemins qui viennent de git sont lus en
// `-z` (`ls-files -z`, `diff --name-only -z`), donc jamais cités ; un oracle au nom accentué (ou
// avec une espace) est protégé et justifié comme un autre. Ces cas verrouillent ce comportement.
// Lancé par `pnpm hooks:test`. Le marqueur d'échec attendu est construit par concaténation.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');
const ACCENTED = 'apps/web/test/cassé.e2e.ts';
const SPACED = 'apps/api/test/échec attendu.e2e-spec.ts';
const FAILS = `${['it', 'fails'].join('.')}('BUG-8 attendu', () => {});\n`;

const temps = [];
let repo;

function sh(args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function commitAll(message) {
  sh(['add', '-A']);
  sh([
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

function hook(mode, id, extra = {}) {
  const res = spawnSync(process.execPath, [GUARD, mode], {
    input: JSON.stringify({
      session_id: 's-bf8',
      cwd: repo,
      hook_event_name: mode === 'verify' ? 'SubagentStop' : 'PreToolUse',
      agent_type: 'dev-api',
      agent_id: id,
      stop_hook_active: false,
      ...extra,
    }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
  });
  return { code: res.status, stderr: res.stderr };
}

const start = (id) => hook('subagent-start', id, { hook_event_name: 'SubagentStart' });

beforeEach(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-bf8-')));
  temps.push(repo);
  sh(['init', '-q', '-b', 'develop']);
  write('.gitignore', '.claude/hooks/state/\n.claude/hooks/audit.log\n');
  write(ACCENTED, "test('fumée', async () => {});\n");
  commitAll('base');
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('BF-8 : oracles aux noms non ASCII dans les hooks', () => {
  it('refuse l’édition et la suppression d’un test existant au nom accentué', () => {
    const edit = hook('pre-tool-use', 'n1', {
      tool_name: 'Edit',
      tool_input: {
        file_path: join(repo, ACCENTED),
        old_string: 'fumée',
        new_string: 'vide',
      },
    });
    assert.equal(edit.code, 2);
    assert.match(edit.stderr, /test existant/);
    const rm = hook('pre-tool-use', 'n1', {
      tool_name: 'Bash',
      tool_input: { command: `rm ${ACCENTED}`, description: 'test' },
    });
    assert.equal(rm.code, 2);
  });

  it('accepte en fin de tâche le test accentué modifié et commité avec Justification-test', () => {
    start('n2');
    write(ACCENTED, "test('fumée', async () => { /* corrigé */ });\n");
    commitAll('test: corrige\n\nJustification-test: F8-2 parcours établi faux par le triage');
    const r = hook('verify', 'n2');
    assert.equal(r.code, 0, r.stderr);
  });

  it('refuse en fin de tâche le même changement sans justification, chemin cité en clair', () => {
    start('n3');
    write(ACCENTED, "test('fumée', async () => { /* vidé */ });\n");
    commitAll('test: assouplit');
    const r = hook('verify', 'n3');
    assert.equal(r.code, 2);
    assert.match(r.stderr, /apps\/web\/test\/cassé\.e2e\.ts : oracle modifié/);
  });

  it('signale un échec attendu écrit hors hooks dans un fichier au nom accentué avec espace', () => {
    start('n4');
    write(SPACED, FAILS);
    const r = hook('verify', 'n4');
    assert.equal(r.code, 2);
    assert.match(r.stderr, /apps\/api\/test\/échec attendu\.e2e-spec\.ts : test en échec attendu/);
  });
});
