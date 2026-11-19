// Lot 13 bis, T5 : gh est réservé à Julien pour tout ce qui fusionne, étiquette, publie ou
// supprime : gh pr merge, gh release create|delete|delete-asset|edit|upload, gh repo
// delete|edit|rename|archive|sync, toute action « delete », gh alias set|import, et gh api avec une
// méthode autre que GET ou avec -f, -F, --field, --raw-field ou --input. Refusés à tous les rôles ;
// les lectures restent permises. gh n'a pas besoin d'être installé : le hook analyse seulement.
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

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'garde-fous-gh-'));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
});

function bash(command, agent) {
  const input = {
    session_id: 's-gh',
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
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
  });
  return { code: res.status, stderr: res.stderr };
}

describe('T5 : gh réservé à Julien pour fusionner, étiqueter, publier, supprimer', () => {
  const cases = [
    'gh pr merge 1',
    'gh pr merge --squash --delete-branch 1',
    'gh pr merge -R x/y 1',
    'gh release create v1.0.0',
    'gh release delete v1.0.0 --yes',
    'gh release delete-asset v1.0.0 a.zip',
    'gh release edit v1.0.0 --draft=false',
    'gh release upload v1.0.0 a.zip',
    'gh repo delete x/y --yes',
    'gh repo edit --default-branch main',
    'gh repo rename z',
    'gh repo archive x/y',
    'gh repo sync',
    'gh issue delete 3',
    'gh run delete 12',
    'gh alias set m "pr merge"',
    'gh alias import aliases.yml',
    'gh api -X POST repos/x/y/merges',
    'gh api -XPOST repos/x/y/merges',
    'gh api --method PUT repos/x/y/pulls/1/merge',
    'gh api --method=DELETE repos/x/y/git/refs/heads/develop',
    'gh api repos/x/y/issues -f title=x',
    'gh api repos/x/y/git/refs -fref=refs/tags/v1',
    'gh api graphql -F query=@q.graphql',
    'gh api repos/x/y/releases --input r.json',
    'gh api repos/x/y/releases --field tag_name=v1',
    'gh api repos/x/y/releases --raw-field tag_name=v1',
    'gh api -X GET repos/x/y/pulls -f state=open',
    '{ gh pr merge 1; }',
    'gh frobnicate',
  ];
  for (const command of cases) {
    it(`refuse ${command}`, () => {
      for (const agent of [undefined, 'dev-api', 'dev-devops']) {
        const r = bash(command, agent);
        assert.equal(r.code, 2, `${command} (${agent ?? 'main'})`);
        assert.match(r.stderr, /gh/, `${command} : ${r.stderr}`);
      }
    });
  }

  it('laisse les lectures', () => {
    for (const command of [
      'gh pr view 1',
      'gh pr list --state open',
      'gh pr checks 1',
      'gh run view 12 --log',
      'gh run list',
      'gh run watch 12',
      'gh api repos/x/y',
      'gh api -X GET repos/x/y/pulls',
      'gh api --method get repos/x/y',
      'gh release list',
      'gh release view v1.0.0',
      'gh --version',
      'gh auth status',
    ]) {
      for (const agent of [undefined, 'dev-api']) {
        const r = bash(command, agent);
        assert.equal(r.code, 0, `${command} (${agent ?? 'main'}) : ${r.stderr}`);
      }
    }
  });
});
