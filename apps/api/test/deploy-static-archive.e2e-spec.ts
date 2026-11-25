import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Contrôles de l'archive par scripts/deploy/deploy-static.sh avant la bascule (revue de la PR #26) : une
 * entrée qui n'est ni un fichier ni un dossier (lien symbolique, lien dur, fichier spécial) et une CSP
 * introuvable sont refusées sans rien changer de la version active. Même dispositif que
 * deploy-static.e2e-spec.ts : dépôt copié sur `main`, archive en file://, faux moteur compose.
 */
const root = fileURLToPath(new URL('../../../', import.meta.url));
const CSP = "default-src 'self'; script-src 'self' 'sha256-abc='";

let work: string;
let repo: string;
let deployDir: string;
let releaseDir: string;
let composeLog: string;

function sh(command: string, cwd: string) {
  const result = spawnSync('bash', ['-c', command], { cwd, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
}

/** Site factice complet ; `prepare` est une commande shell jouée dans le dossier avant l'archivage. */
function publish(version: string, options: { csp?: boolean; prepare?: string } = {}) {
  const site = mkdtempSync(join(work, 'site-'));
  mkdirSync(join(site, 'public/en'), { recursive: true });
  mkdirSync(join(site, 'public/_nuxt'), { recursive: true });
  mkdirSync(join(site, 'public/fonts'), { recursive: true });
  for (const page of ['index.html', 'en/index.html', '404.html', '50x.html', 'en/50x.html']) {
    writeFileSync(join(site, 'public', page), `<html>${version} ${page}</html>`);
  }
  writeFileSync(join(site, 'public/_nuxt/app.js'), `// ${version}`);
  writeFileSync(join(site, 'public/fonts/police.woff2'), 'police');
  writeFileSync(
    join(site, 'csp.caddy'),
    options.csp === false ? '# sans en-tête\n' : `header Content-Security-Policy "${CSP}"\n`,
  );
  const archive = `site-${version}.tar.gz`;
  sh(`${options.prepare ?? 'true'} && tar -czf '${releaseDir}/${archive}' public csp.caddy`, site);
  sh(`sha256sum '${archive}' > '${archive}.sha256'`, releaseDir);
}

function run(version: string) {
  return spawnSync('bash', [join(repo, 'scripts/deploy/deploy-static.sh'), version], {
    encoding: 'utf8',
    env: {
      PATH: process.env['PATH'] ?? '',
      DEPLOY_DIR: deployDir,
      DEPLOY_COMPOSE: join(work, 'fake-compose'),
      STATIC_RELEASE_BASE_URL: `file://${releaseDir}`,
      STATIC_ERRORS_DIR: join(work, 'inexistant'),
    },
  });
}

const site = () => join(deployDir, 'site');
const calls = () => (existsSync(composeLog) ? readFileSync(composeLog, 'utf8') : '');

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'siteperso-static-archive-'));
  repo = join(work, 'repo');
  mkdirSync(repo);
  cpSync(join(root, 'scripts/deploy'), join(repo, 'scripts/deploy'), { recursive: true });
  cpSync(join(root, 'docker'), join(repo, 'docker'), { recursive: true });
  sh(
    'git init -q -b main && git -c user.email=a@example.org -c user.name=a commit -q --allow-empty -m init',
    repo,
  );
  composeLog = join(work, 'compose.log');
  const fake = join(work, 'fake-compose');
  writeFileSync(
    fake,
    `#!/bin/sh\nprintf '%s | %s\\n' "$STATIC_SITE_DIR" "$*" >> '${composeLog}'\n`,
  );
  chmodSync(fake, 0o755);
});

beforeEach(() => {
  deployDir = mkdtempSync(join(work, 'deploy-'));
  releaseDir = mkdtempSync(join(work, 'release-'));
  publish('1.0.0');
  expect(run('1.0.0').status).toBe(0);
  rmSync(composeLog, { force: true });
});

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe('deploy-static.sh : contrôles de l’archive avant la bascule', () => {
  it('refuse une CSP introuvable avant la bascule : la version active reste en place', () => {
    publish('1.0.1', { csp: false });
    const result = run('1.0.1');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CSP introuvable');
    expect(readlinkSync(join(site(), 'current'))).toBe('releases/1.0.0');
    expect(readdirSync(join(site(), 'releases'))).toEqual(['1.0.0']);
    expect(calls()).toBe('');
  });

  it.each([
    ['un lien symbolique sous public/', 'ln -s /etc/passwd public/fuite'],
    ['un lien dur sous public/', 'ln public/index.html public/double.html'],
    ['un tube nommé sous public/', 'mkfifo public/tube'],
  ])('refuse une archive avec %s sans rien modifier', (_cas, prepare) => {
    publish('1.0.1', { prepare });
    const result = run('1.0.1');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ni fichier ni dossier');
    expect(readlinkSync(join(site(), 'current'))).toBe('releases/1.0.0');
    expect(readdirSync(join(site(), 'releases'))).toEqual(['1.0.0']);
    expect(calls()).toBe('');
  });
});
