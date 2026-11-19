// Lot 13 bis, T4 : l'option -c collée à sa valeur (git -cremote.origin.url=x) se lit comme -c x ;
// avec git push, seules des clés sans effet sur la destination sont admises (color.*, advice.*,
// user.*, i18n.*, core.quotepath) et seules les options globales -C, -c, --no-pager et -P.
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
  repo = mkdtempSync(join(tmpdir(), 'garde-fous-option-c-'));
  execFileSync('git', ['init', '-q', '-b', 'develop'], { cwd: repo });
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
});

function bash(command, agent) {
  const input = {
    session_id: 's-option-c',
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

describe('T4 : -c collé', () => {
  const cases = [
    ['git -cremote.origin.url=x push origin develop', /cette configuration change/],
    ['git -cremote.origin.pushurl=x push origin develop', /cette configuration change/],
    ['git -curl.x.insteadOf=origin push origin develop', /cette configuration change/],
    ['git -cpush.default=matching push origin develop', /cette configuration change/],
    ['git -calias.p=push p origin develop', /alias qui lance git push/],
    ['git -ccore.hooksPath=/dev/null commit -m x', /core\.hooksPath/],
  ];
  for (const [command, reason] of cases) {
    it(`refuse ${command}`, () => {
      for (const agent of [undefined, 'dev-api']) {
        const r = bash(command, agent);
        assert.equal(r.code, 2, `${command} (${agent ?? 'main'})`);
        if (!agent) assert.match(r.stderr, reason, `${command} : ${r.stderr}`);
      }
    });
  }

  it('lit -c collé comme -c séparé quand la clé est admise', () => {
    const r = bash('git -ccolor.ui=never push origin develop');
    assert.equal(r.code, 0, r.stderr);
  });
});

describe('git push : clés -c et options globales admises', () => {
  it('refuse les clés qui changent la connexion ou incluent une configuration', () => {
    for (const command of [
      'git -c core.sshCommand=x push origin develop',
      'git -c core.gitProxy=x push origin develop',
      'git -c include.path=/tmp/x push origin develop',
      'git -c http.proxy=http://x push origin develop',
      'git -c credential.helper=x push origin develop',
    ]) {
      const r = bash(command);
      assert.equal(r.code, 2, command);
      assert.match(r.stderr, /clés admises avec git push|cette configuration change/, r.stderr);
    }
  });

  it('refuse les options globales hors -C, -c, --no-pager et -P', () => {
    for (const [command, reason] of [
      ['git --exec-path=/tmp/x push origin develop', /option globale --exec-path/],
      ['git --bare push origin develop', /option globale --bare/],
      ['git --literal-pathspecs push origin develop', /option globale --literal-pathspecs/],
    ]) {
      const r = bash(command);
      assert.equal(r.code, 2, command);
      assert.match(r.stderr, reason, r.stderr);
    }
  });

  it('accepte les clés et options sans effet sur la destination', () => {
    for (const command of [
      'git -c user.name=Test push origin develop',
      'git -c advice.pushNonFFCurrent=false push origin develop',
      'git -c core.quotepath=false push origin develop',
      'git --no-pager push origin develop',
      'git -P -C . push -u origin develop',
    ]) {
      const r = bash(command);
      assert.equal(r.code, 0, `${command} : ${r.stderr}`);
    }
  });
});
