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
 * Déploiement de la production tout statique (lot 33) : scripts/deploy/deploy-static.sh joué sur une
 * archive factice (la même disposition que celle de build-site-archive.sh), sans réseau (file://), avec un
 * faux moteur compose qui consigne ses appels. Le dépôt est copié dans un dossier temporaire sur `main` :
 * le script refuse tout autre branche.
 */
const root = fileURLToPath(new URL('../../../', import.meta.url));
const CSP = "default-src 'self'; script-src 'self' 'sha256-abc='";

let work: string;
let repo: string;
let deployDir: string;
let errorsDir: string;
let releaseDir: string;
let composeLog: string;

function sh(command: string, cwd: string) {
  const result = spawnSync('bash', ['-c', command], { cwd, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
}

/** Écrit site-<version>.tar.gz et sa somme dans releaseDir (extra : entrées supplémentaires de l'archive). */
function publish(version: string, options: { badSum?: boolean; extra?: string } = {}) {
  const site = mkdtempSync(join(work, 'site-'));
  mkdirSync(join(site, 'public/en'), { recursive: true });
  mkdirSync(join(site, 'public/_nuxt'), { recursive: true });
  mkdirSync(join(site, 'public/fonts'), { recursive: true });
  for (const page of ['index.html', 'en/index.html', '404.html', '50x.html', 'en/50x.html']) {
    writeFileSync(join(site, 'public', page), `<html>${version} ${page}</html>`);
  }
  writeFileSync(join(site, 'public/_nuxt/app.js'), `// ${version}`);
  writeFileSync(join(site, 'public/fonts/police.woff2'), 'police');
  writeFileSync(join(site, 'csp.caddy'), `header Content-Security-Policy "${CSP}"\n`);
  if (options.extra !== undefined) writeFileSync(join(site, options.extra), 'intrus');
  const archive = `site-${version}.tar.gz`;
  sh(`tar -czf '${releaseDir}/${archive}' public csp.caddy ${options.extra ?? ''}`, site);
  sh(`sha256sum '${archive}' > '${archive}.sha256'`, releaseDir);
  if (options.badSum === true) {
    writeFileSync(join(releaseDir, `${archive}.sha256`), `${'0'.repeat(64)}  ${archive}\n`);
  }
}

function run(args: string[], env: Record<string, string> = {}) {
  return spawnSync('bash', [join(repo, 'scripts/deploy/deploy-static.sh'), ...args], {
    encoding: 'utf8',
    env: {
      PATH: process.env['PATH'] ?? '',
      DEPLOY_DIR: deployDir,
      DEPLOY_COMPOSE: join(work, 'fake-compose'),
      STATIC_RELEASE_BASE_URL: `file://${releaseDir}`,
      STATIC_ERRORS_DIR: errorsDir,
      ...env,
    },
  });
}

const site = () => join(deployDir, 'site');
const releases = () => readdirSync(join(site(), 'releases')).sort();
const active = () => readlinkSync(join(site(), 'current'));
const calls = () => (existsSync(composeLog) ? readFileSync(composeLog, 'utf8') : '');

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'siteperso-static-'));
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
  errorsDir = mkdtempSync(join(work, 'errors-'));
  releaseDir = mkdtempSync(join(work, 'release-'));
  rmSync(composeLog, { force: true });
});

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe('deploy-static.sh : paramètres', () => {
  it('affiche l’usage (code 2) sans argument, avec une option inconnue ou trop d’arguments', () => {
    for (const args of [[], ['--foo'], ['1.0.0', '1.0.1'], ['--rollback', '1.0.0', '1.0.1']]) {
      const result = run(args);
      expect(result.status, args.join(' ')).toBe(2);
      expect(result.stderr).toContain('Usage');
    }
  });

  it.each(['v1.0.0', '1.0', '1.0.0-rc1', '../1.0.0', '1.0.0;ls'])(
    'refuse la version %j',
    (version) => {
      const result = run([version]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('version invalide');
      expect(existsSync(site())).toBe(false);
    },
  );

  it('exige un dépôt GitHub ou une URL de base, https seulement', () => {
    publish('1.0.0');
    const sansSource = run(['1.0.0'], { STATIC_RELEASE_BASE_URL: '' });
    expect(sansSource.status).toBe(1);
    expect(sansSource.stderr).toContain('STATIC_RELEASE_REPO');

    const depotInvalide = run(['1.0.0'], {
      STATIC_RELEASE_BASE_URL: '',
      STATIC_RELEASE_REPO: 'pas un depot',
    });
    expect(depotInvalide.status).toBe(1);
    expect(depotInvalide.stderr).toContain('STATIC_RELEASE_REPO invalide');

    const http = run(['1.0.0'], { STATIC_RELEASE_BASE_URL: 'http://exemple.invalid/x' });
    expect(http.status).toBe(1);
    expect(http.stderr).toContain('https://');
  });

  it('en simulation, valide et n’écrit rien', () => {
    const result = run(['1.0.0'], { DRY_RUN: '1' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('(dry-run)');
    expect(existsSync(site())).toBe(false);
    expect(calls()).toBe('');
  });

  it('refuse un dépôt qui n’est pas sur main', () => {
    sh('git switch -q -c travail', repo);
    try {
      publish('1.0.0');
      const result = run(['1.0.0']);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('main');
      expect(existsSync(site())).toBe(false);
    } finally {
      sh('git switch -q main', repo);
    }
  });
});

describe('deploy-static.sh : déploiement', () => {
  it('vérifie la somme, extrait, bascule current, recharge Caddy et copie les pages de secours', () => {
    publish('1.0.0');

    const result = run(['1.0.0']);

    expect(result.status, result.stderr).toBe(0);
    expect(active()).toBe('releases/1.0.0');
    expect(readFileSync(join(site(), 'current/public/index.html'), 'utf8')).toContain('1.0.0');
    expect(readFileSync(join(site(), 'current/csp.caddy'), 'utf8')).toContain(CSP);
    const log = calls();
    expect(log).toContain(`${site()} | -f ${join(repo, 'docker/compose.vps-static.yml')} up -d`);
    expect(log).toContain('exec -T caddy caddy reload --config /etc/caddy/Caddyfile --force');

    expect(readFileSync(join(errorsDir, '50x.html'), 'utf8')).toContain('50x.html');
    expect(readFileSync(join(errorsDir, 'en/50x.html'), 'utf8')).toContain('en/50x.html');
    expect(readFileSync(join(errorsDir, '_nuxt/app.js'), 'utf8')).toBe('// 1.0.0');
    expect(readFileSync(join(errorsDir, 'fonts/police.woff2'), 'utf8')).toBe('police');
    // Valeur seule de la CSP, sans saut de ligne final ni nom d'en-tête.
    expect(readFileSync(join(errorsDir, 'csp.txt'), 'utf8')).toBe(CSP);
  });

  it('lit l’environnement facultatif s’il existe', () => {
    publish('1.0.0');
    writeFileSync(join(deployDir, '.env.prod'), 'WIP_MODE=off\n');

    expect(run(['1.0.0']).status).toBe(0);
    expect(calls()).toContain(`--env-file ${join(deployDir, '.env.prod')}`);
  });

  it('refuse une somme fausse sans rien modifier de la version active', () => {
    publish('1.0.0');
    expect(run(['1.0.0']).status).toBe(0);
    rmSync(composeLog);
    publish('1.0.1', { badSum: true });

    const result = run(['1.0.1']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('somme SHA-256');
    expect(active()).toBe('releases/1.0.0');
    expect(releases()).toEqual(['1.0.0']);
    expect(calls()).toBe('');
    expect(readdirSync(site()).filter((name) => name.startsWith('.work'))).toEqual([]);
  });

  it('refuse une archive absente, un fichier de somme étranger et une archive aux entrées inattendues', () => {
    expect(run(['2.0.0']).status).toBe(1);

    publish('1.0.0');
    writeFileSync(
      join(releaseDir, 'site-1.0.0.tar.gz.sha256'),
      `${'a'.repeat(64)}  autre.tar.gz\n`,
    );
    const etranger = run(['1.0.0']);
    expect(etranger.status).toBe(1);
    expect(etranger.stderr).toContain('fichier de somme inattendu');

    publish('1.0.1', { extra: 'intrus.txt' });
    const intrus = run(['1.0.1']);
    expect(intrus.status).toBe(1);
    expect(intrus.stderr).toContain('entrée inattendue');
    expect(existsSync(join(site(), 'current'))).toBe(false);
  });

  it('refuse une archive incomplète', () => {
    const incomplete = mkdtempSync(join(work, 'incomplete-'));
    mkdirSync(join(incomplete, 'public'));
    writeFileSync(join(incomplete, 'public/index.html'), '<html></html>');
    writeFileSync(join(incomplete, 'csp.caddy'), 'x');
    sh(`tar -czf '${releaseDir}/site-1.0.0.tar.gz' public csp.caddy`, incomplete);
    sh(`sha256sum site-1.0.0.tar.gz > site-1.0.0.tar.gz.sha256`, releaseDir);

    const result = run(['1.0.0']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('archive incomplète');
    expect(existsSync(join(site(), 'current'))).toBe(false);
  });

  it('garde trois versions (tri sémantique : 1.0.10 est plus récente que 1.0.9) et la version active', () => {
    for (const version of ['1.0.8', '1.0.9', '1.0.10', '1.0.11']) {
      publish(version);
      expect(run([version]).status, version).toBe(0);
    }

    expect(releases()).toEqual(['1.0.10', '1.0.11', '1.0.9']);
    expect(active()).toBe('releases/1.0.11');
  });

  it('ne supprime pas la version active, même plus ancienne que les trois gardées', () => {
    for (const version of ['2.0.0', '2.1.0', '2.2.0']) {
      publish(version);
      expect(run([version]).status).toBe(0);
    }
    publish('1.5.0');
    expect(run(['1.5.0']).status).toBe(0);

    expect(active()).toBe('releases/1.5.0');
    expect(releases()).toEqual(['1.5.0', '2.0.0', '2.1.0', '2.2.0']);
  });

  it('redéployer la version active ne retélécharge rien', () => {
    publish('1.0.0');
    expect(run(['1.0.0']).status).toBe(0);
    rmSync(join(releaseDir, 'site-1.0.0.tar.gz'));

    const result = run(['1.0.0']);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('déjà active');
  });

  it('continue sans dossier de secours (avertissement) mais échoue si la CSP est introuvable', () => {
    publish('1.0.0');
    const sans = run(['1.0.0'], { STATIC_ERRORS_DIR: join(work, 'inexistant') });
    expect(sans.status).toBe(0);
    expect(sans.stdout).toContain('AVERTISSEMENT');

    const site2 = mkdtempSync(join(work, 'nocsp-'));
    mkdirSync(join(site2, 'public/en'), { recursive: true });
    mkdirSync(join(site2, 'public/_nuxt'), { recursive: true });
    mkdirSync(join(site2, 'public/fonts'), { recursive: true });
    for (const page of ['index.html', 'en/index.html', '404.html', '50x.html', 'en/50x.html']) {
      writeFileSync(join(site2, 'public', page), 'x');
    }
    writeFileSync(join(site2, 'csp.caddy'), '# sans en-tête\n');
    sh(`tar -czf '${releaseDir}/site-1.0.1.tar.gz' public csp.caddy`, site2);
    sh(`sha256sum site-1.0.1.tar.gz > site-1.0.1.tar.gz.sha256`, releaseDir);
    const sansCsp = run(['1.0.1']);
    expect(sansCsp.status).toBe(1);
    expect(sansCsp.stderr).toContain('CSP introuvable');
  });
});

describe('deploy-static.sh : retour arrière', () => {
  beforeEach(() => {
    for (const version of ['1.0.0', '1.1.0', '1.2.0']) {
      publish(version);
      expect(run([version]).status).toBe(0);
    }
    rmSync(composeLog, { force: true });
  });

  it('réactive la version précédente, recharge Caddy et recopie les pages de secours', () => {
    const result = run(['--rollback']);

    expect(result.status, result.stderr).toBe(0);
    expect(active()).toBe('releases/1.1.0');
    expect(calls()).toContain('caddy reload');
    expect(readFileSync(join(errorsDir, '_nuxt/app.js'), 'utf8')).toBe('// 1.1.0');
    expect(releases()).toEqual(['1.0.0', '1.1.0', '1.2.0']);
  });

  it('remonte de version en version, puis s’arrête sur la plus ancienne', () => {
    expect(run(['--rollback']).status).toBe(0);
    expect(run(['--rollback']).status).toBe(0);
    expect(active()).toBe('releases/1.0.0');

    const result = run(['--rollback']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('aucune version précédente');
    expect(active()).toBe('releases/1.0.0');
  });

  it('réactive une version précise, refuse une version absente ou invalide', () => {
    expect(run(['--rollback', '1.0.0']).status).toBe(0);
    expect(active()).toBe('releases/1.0.0');
    expect(readFileSync(join(errorsDir, 'csp.txt'), 'utf8')).toBe(CSP);

    const absente = run(['--rollback', '9.9.9']);
    expect(absente.status).toBe(1);
    expect(absente.stderr).toContain('pas installée');

    expect(run(['--rollback', 'abc']).status).toBe(1);
    expect(active()).toBe('releases/1.0.0');
  });
});
