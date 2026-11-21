// L20-02 (décision de Julien du 21 nov. 2026) : l'agent revue-pr relit le diff d'une pull request vers
// develop en lecture seule. Ses garde-fous : aucun chemin du dépôt ne lui est ouvert en écriture
// (ROLE_WRITE_SCOPES de lib/policy.mjs, liste vide), ni par Edit ou Write, ni par le shell ; seul le
// dossier temporaire de session reste libre, comme pour tout rôle. Aucun push, aucune écriture par gh
// (tests/pr-flow.test.mjs). Rejeu par l'entrée JSON du hook PreToolUse. Lancé par `pnpm hooks:test`.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { roleMayWrite, startReminder } from '../lib/policy.mjs';

const GUARD = join(dirname(dirname(fileURLToPath(import.meta.url))), 'guard.mjs');

let repo;
let scratch;

function write(rel, content) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), content);
}

before(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-revue-pr-')));
  scratch = realpathSync(mkdtempSync(join(tmpdir(), 'garde-fous-revue-pr-session-')));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
  write('apps/api/src/app.ts', 'export const answer = 42;\n');
  write('docs/revues/.keep', '');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=ci@noreply.invalid', 'commit', '-q', '-m', 'base'],
    { cwd: repo },
  );
});

after(() => {
  for (const dir of [repo, scratch]) rmSync(dir, { recursive: true, force: true });
});

function tool(name, toolInput, role = 'revue-pr') {
  const input = {
    session_id: 's-revue-pr',
    agent_type: role,
    agent_id: `id-${role}`,
    cwd: repo,
    hook_event_name: 'PreToolUse',
    scratchpad_dir: scratch,
    tool_name: name,
    tool_input: toolInput,
  };
  const res = spawnSync(process.execPath, [GUARD, 'pre-tool-use'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
  });
  return { code: res.status, stderr: res.stderr };
}

const PATHS = [
  'docs/revues/pr-12.md',
  'docs/comptes-rendus/lot-20-revue.md',
  'docs/backlog.md',
  'apps/api/src/app.ts',
  'apps/api/src/nouveau.ts',
  '.env',
  'README.md',
];

describe('L20-02 : revue-pr en lecture seule', () => {
  it('aucun chemin du dépôt ne lui est ouvert', () => {
    for (const rel of PATHS) assert.equal(roleMayWrite('revue-pr', rel), false, rel);
    // Témoin : revue-code garde ses rapports.
    assert.equal(roleMayWrite('revue-code', 'docs/revues/code-2026-11-21.md'), true);
  });

  it('refuse Write et Edit sur le dépôt', () => {
    for (const rel of PATHS) {
      const w = tool('Write', { file_path: join(repo, rel), content: '# x\n' });
      assert.equal(w.code, 2, `Write ${rel}`);
      assert.match(w.stderr, /le rôle revue-pr n'écrit pas ce chemin/, rel);
    }
    const e = tool('Edit', {
      file_path: join(repo, 'apps/api/src/app.ts'),
      old_string: '42',
      new_string: '43',
    });
    assert.equal(e.code, 2);
  });

  it('refuse les écritures du shell dans le dépôt', () => {
    for (const command of [
      'echo x > docs/revues/pr-12.md',
      'printf "x" >> apps/api/src/app.ts',
      'cp /etc/hostname docs/revues/pr-12.md',
      "sed -i 's/42/43/' apps/api/src/app.ts",
    ]) {
      const r = tool('Bash', { command, description: 'test' });
      assert.equal(r.code, 2, command);
    }
  });

  it('laisse lire le diff et écrire dans le dossier temporaire de session', () => {
    for (const command of [
      'git diff develop...HEAD --stat',
      'git log --oneline develop..HEAD',
      'gh pr diff 12',
      'gh pr view 12 --json files',
      'grep -rn "Justification-test" docs',
    ]) {
      const r = tool('Bash', { command, description: 'test' });
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
    const w = tool('Write', { file_path: join(scratch, 'notes.md'), content: '# notes\n' });
    assert.equal(w.code, 0, w.stderr);
  });

  it('le rappel de démarrage annonce la limite de chemins et l’absence d’écriture par gh', () => {
    const text = startReminder('revue-pr');
    assert.match(text, /limite aussi les chemins/);
    assert.match(text, /ni écriture sur GitHub par gh/);
  });
});
