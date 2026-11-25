import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const scriptsDirectory = fileURLToPath(new URL('../../../scripts/deploy/', import.meta.url));
const repository = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Commandes conteneurs configurables (lot 29, L29-01) : DEPLOY_COMPOSE, DEPLOY_INSPECT, DEPLOY_VARIANT et
 * DEPLOY_WEB_BUILD remplacent `docker compose` et `docker inspect` écrits en dur. Une fausse commande
 * enregistre ses arguments : aucun conteneur n'est lancé.
 */
describe('scripts de déploiement : commandes conteneurs configurables', () => {
  let work: string;
  let calls: string;
  let fakeCompose: string;
  let fakeInspect: string;
  let deployDirectory: string;

  beforeAll(async () => {
    work = await mkdtemp(join(tmpdir(), 'siteperso-compose-cmd-'));
    calls = join(work, 'calls.log');
    fakeCompose = join(work, 'fake-compose');
    fakeInspect = join(work, 'fake-inspect');
    // `ps -q api` doit rendre un identifiant, `version` réussir.
    await writeFile(
      fakeCompose,
      `#!/bin/sh\nprintf 'compose %s\\n' "$*" >> '${calls}'\ncase "$*" in *"ps -q api"*) echo api-id;; esac\nexit 0\n`,
    );
    await writeFile(
      fakeInspect,
      `#!/bin/sh\nprintf 'inspect %s\\n' "$*" >> '${calls}'\necho healthy\n`,
    );
    await chmod(fakeCompose, 0o755);
    await chmod(fakeInspect, 0o755);
    deployDirectory = join(work, 'deploy');
  });

  afterAll(async () => {
    await rm(work, { recursive: true, force: true });
  });

  async function reset() {
    await writeFile(calls, '');
  }

  function bash(script: string, extra: Record<string, string>) {
    return spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      cwd: repository,
      env: { ...process.env, DEPLOY_DIR: deployDirectory, ...extra },
    });
  }

  it('compose() lance la commande configurée avec les fichiers de la variante VPS', async () => {
    await reset();
    const result = bash(`. '${scriptsDirectory}common.sh'; compose ps`, {
      DEPLOY_COMPOSE: `${fakeCompose} --flag`,
      DEPLOY_VARIANT: 'vps',
    });

    expect(result.status, result.stderr).toBe(0);
    const line = (await readFile(calls, 'utf8')).trim();
    expect(line).toContain('compose --flag -f ');
    expect(line).toMatch(/docker\/compose\.prod\.yml -f \S+docker\/compose\.vps\.yml --env-file /);
    expect(line.endsWith(' ps')).toBe(true);
  });

  it('sans DEPLOY_VARIANT, seul compose.prod.yml est utilisé (comportement par défaut inchangé)', async () => {
    await reset();
    const result = bash(`. '${scriptsDirectory}common.sh'; compose ps`, {
      DEPLOY_COMPOSE: fakeCompose,
    });

    expect(result.status, result.stderr).toBe(0);
    const line = await readFile(calls, 'utf8');
    expect(line).toContain('docker/compose.prod.yml');
    expect(line).not.toContain('compose.vps.yml');
  });

  it('wait_for_api_health lit la santé par DEPLOY_INSPECT', async () => {
    await reset();
    const result = bash(`. '${scriptsDirectory}common.sh'; wait_for_api_health`, {
      DEPLOY_COMPOSE: fakeCompose,
      DEPLOY_INSPECT: `${fakeInspect} --extra`,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(calls, 'utf8')).toContain(
      'inspect --extra --format {{.State.Health.Status}} api-id',
    );
  });

  it('require_docker accepte une commande compose en un seul mot et valide son « version »', async () => {
    await reset();
    const result = bash(`. '${scriptsDirectory}common.sh'; require_docker`, {
      DEPLOY_COMPOSE: fakeCompose,
      DEPLOY_INSPECT: fakeInspect,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(calls, 'utf8')).toContain('compose version');
  });

  it.each([
    ['DEPLOY_COMPOSE', '/inexistant/compose', 'est introuvable (DEPLOY_COMPOSE)'],
    ['DEPLOY_INSPECT', '/inexistant/inspect', 'est introuvable (DEPLOY_INSPECT)'],
    ['DEPLOY_VARIANT', 'autre', 'DEPLOY_VARIANT invalide'],
    ['DEPLOY_WEB_BUILD', 'autre', 'DEPLOY_WEB_BUILD invalide'],
  ])('require_docker refuse %s=%s', (name, value, message) => {
    const result = bash(`. '${scriptsDirectory}common.sh'; require_docker`, {
      DEPLOY_COMPOSE: fakeCompose,
      DEPLOY_INSPECT: fakeInspect,
      [name]: value,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  });

  it('first-install.sh en simulation passe par la commande et la variante configurées', async () => {
    await reset();
    deployDirectory = join(work, 'deploy-first');
    const first = bash(
      `mkdir -p '${deployDirectory}' && printf 'SITE_DOMAIN=ex.test\\nCORS_ORIGIN=https://ex.test\\nPOSTGRES_PASSWORD=a\\nAPI_DB_PASSWORD=b\\n' > '${deployDirectory}/.env.prod'; bash '${scriptsDirectory}first-install.sh'`,
      {
        DRY_RUN: '1',
        DEPLOY_COMPOSE: fakeCompose,
        DEPLOY_INSPECT: fakeInspect,
        DEPLOY_VARIANT: 'vps',
        DEPLOY_WEB_BUILD: 'podman',
      },
    );

    expect(first.status, first.stderr).toBe(0);
    const log = await readFile(calls, 'utf8');
    expect(log).toContain('compose.vps.yml');
    expect(log).toContain(' config --quiet');
    // Le front se construit par `podman build` (docker-compose ignore web.Dockerfile.dockerignore) :
    // en simulation la commande est affichée, jamais jouée.
    expect(first.stdout).toContain('(dry-run) podman build');
    expect(first.stdout).toContain('web.Dockerfile.dockerignore');
    expect(first.stdout).not.toContain('(dry-run) compose build web-build');
  });
});
