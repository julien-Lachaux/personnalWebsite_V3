// Lot 49, tripwire : la suite qui lance `git credential fill` (config-env-commands) tourne avec
// SSH_ASKPASS et GIT_ASKPASS pointés vers un script piège ; si un appel git l'atteint, il écrit une
// ligne dans un journal temporaire et le test échoue. Le piège ne lit ni n'écrit aucun secret.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SUITE = join(dirname(fileURLToPath(import.meta.url)), 'config-env-commands.test.mjs');

let dir;
before(() => {
  dir = mkdtempSync(join(tmpdir(), 'garde-fous-piege-'));
});
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

it('aucun appel git de la suite config-env-commands n’atteint un askpass', () => {
  const trap = join(dir, 'piege.sh');
  const log = join(dir, 'piege.log');
  writeFileSync(trap, `#!/bin/sh\necho "askpass appelé" >> ${log}\nexit 1\n`);
  chmodSync(trap, 0o755);
  writeFileSync(log, '');
  // NODE_TEST_CONTEXT : sans le retirer, le Node enfant ne lancerait pas la suite.
  const env = { ...process.env, SSH_ASKPASS: trap, GIT_ASKPASS: trap, DISPLAY: ':0' };
  delete env.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, ['--test', SUITE], {
    encoding: 'utf8',
    timeout: 240000,
    killSignal: 'SIGKILL',
    env,
  });
  assert.match(res.stdout, /ℹ pass [1-9]/, 'la suite config-env-commands ne s’est pas exécutée');
  assert.equal(res.error, undefined, 'la suite config-env-commands n’a pas terminé à temps');
  assert.equal(readFileSync(log, 'utf8'), '', 'un appel git a atteint l’askpass');
});
