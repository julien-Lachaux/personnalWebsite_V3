// Lot 49 : l'environnement des tests qui lancent git ne peut atteindre aucun askpass réel.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { GIT_SPAWN_LIMITS, hermeticGitEnv } from './support/hermetic-git-env.mjs';

const saved = { ...process.env };
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});

describe('hermeticGitEnv', () => {
  it('neutralise les askpass et retire l’affichage, même si l’environnement les définit', () => {
    process.env.SSH_ASKPASS = '/usr/bin/ksshaskpass';
    process.env.GIT_ASKPASS = '/usr/bin/autre';
    process.env.DISPLAY = ':0';
    process.env.WAYLAND_DISPLAY = 'wayland-0';
    process.env.SSH_ASKPASS_REQUIRE = 'force';
    const env = hermeticGitEnv();
    assert.equal(env.SSH_ASKPASS, '/bin/false');
    assert.equal(env.GIT_ASKPASS, '/bin/false');
    assert.equal(env.GIT_TERMINAL_PROMPT, '0');
    assert.equal(env.GIT_CONFIG_GLOBAL, '/dev/null');
    assert.equal(env.GIT_CONFIG_NOSYSTEM, '1');
    for (const k of ['DISPLAY', 'WAYLAND_DISPLAY', 'SSH_ASKPASS_REQUIRE']) {
      assert.equal(k in env, false);
    }
  });

  it('applique les surcharges légitimes mais verrouille les variables askpass', () => {
    const env = hermeticGitEnv({
      HOME: '/tmp/x',
      GIT_CONFIG_PARAMETERS: "'a=b'",
      GIT_CONFIG_GLOBAL: '/tmp/gitconfig',
      SSH_ASKPASS: '/usr/bin/ksshaskpass',
      GIT_ASKPASS: '/usr/bin/ksshaskpass',
      DISPLAY: ':1',
    });
    assert.equal(env.HOME, '/tmp/x');
    assert.equal(env.GIT_CONFIG_PARAMETERS, "'a=b'");
    assert.equal(env.GIT_CONFIG_GLOBAL, '/tmp/gitconfig');
    assert.equal(env.SSH_ASKPASS, '/bin/false');
    assert.equal(env.GIT_ASKPASS, '/bin/false');
    assert.equal('DISPLAY' in env, false);
  });

  it('ne modifie pas process.env', () => {
    process.env.SSH_ASKPASS = '/usr/bin/ksshaskpass';
    const before = { ...process.env };
    hermeticGitEnv({ HOME: '/tmp/y' });
    assert.deepEqual({ ...process.env }, before);
  });

  it('git credential fill échoue vite (code non nul) sans atteindre un askpass piège', () => {
    const dir = mkdtempSync(join(tmpdir(), 'garde-fous-hermetique-'));
    try {
      const trap = join(dir, 'piege.sh');
      const log = join(dir, 'piege.log');
      writeFileSync(trap, `#!/bin/sh\necho appel >> ${log}\nexit 1\n`);
      chmodSync(trap, 0o755);
      writeFileSync(log, '');
      // L'environnement de l'utilisateur pointe vers le piège ; le helper doit l'ignorer.
      process.env.SSH_ASKPASS = trap;
      process.env.GIT_ASKPASS = trap;
      const res = spawnSync('git', ['credential', 'fill'], {
        input: 'protocol=https\nhost=x.invalid\n\n',
        encoding: 'utf8',
        cwd: dir,
        env: hermeticGitEnv({ HOME: dir }),
        ...GIT_SPAWN_LIMITS,
      });
      assert.equal(res.error, undefined, "git credential fill n'a pas terminé dans le délai");
      assert.notEqual(res.status, 0);
      assert.equal(readFileSync(log, 'utf8'), '');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
