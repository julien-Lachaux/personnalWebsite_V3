import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../../scripts/deploy/csp-hashes.mjs', import.meta.url));

const hash = (content: string) =>
  `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`;

/** Relevé des empreintes CSP des pages générées du front (BF-14). */
describe('scripts/deploy/csp-hashes.mjs', () => {
  let directory: string;
  let site: string;
  let output: string;

  const run = (...args: string[]) => spawnSync('node', [script, ...args], { encoding: 'utf8' });
  const policy = async () => readFile(output, 'utf8');

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'siteperso-csp-'));
    site = join(directory, 'public');
    output = join(directory, 'csp.caddy');
    await mkdir(join(site, 'en'), { recursive: true });
    await writeFile(
      join(site, 'index.html'),
      [
        '<html><head>',
        '<script type="importmap">{"imports":{"#entry":"/_nuxt/a.js"}}</script>',
        '<script data-hid="theme">(function(){document.documentElement.dataset.theme="x"})()</script>',
        '<style>body{margin:0}</style>',
        '<script type="module" src="/_nuxt/a.js" crossorigin></script>',
        '<script type="application/json" id="__NUXT_DATA__">[1,2]</script>',
        '</head><body><script>window.__NUXT__={}</script></body></html>',
      ].join('\n'),
    );
    await writeFile(
      join(site, 'en', 'index.html'),
      [
        '<html><head><script type="importmap">{"imports":{"#entry":"/_nuxt/b.js"}}</script>',
        '<script data-hid="theme">(function(){document.documentElement.dataset.theme="x"})()</script>',
        '<style>body{margin:0}</style></head><body></body></html>',
      ].join('\n'),
    );
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('écrit un extrait Caddyfile : une directive header avec la politique', async () => {
    const result = run(site, output);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('2 pages, 4 scripts et 1 styles en ligne');
    const content = await policy();
    expect(content).toMatch(/^header Content-Security-Policy ".*"\n$/);
  });

  it('autorise les scripts en ligne exécutables par empreinte, sans doublon', async () => {
    run(site, output);
    const content = await policy();
    const scriptSrc = /script-src ([^;]*)/.exec(content)?.[1] ?? '';

    expect(scriptSrc).toContain("'self'");
    for (const inline of [
      '{"imports":{"#entry":"/_nuxt/a.js"}}',
      '{"imports":{"#entry":"/_nuxt/b.js"}}',
      '(function(){document.documentElement.dataset.theme="x"})()',
      'window.__NUXT__={}',
    ]) {
      expect(scriptSrc).toContain(hash(inline));
    }
    // Le script de thème figure dans les deux pages : une seule empreinte.
    const themeHash = hash('(function(){document.documentElement.dataset.theme="x"})()');
    expect(scriptSrc.split(themeHash)).toHaveLength(2);
    // Ni les scripts externes ni les données JSON ne sont des scripts en ligne exécutables.
    expect(scriptSrc).not.toContain(hash('[1,2]'));
    expect(scriptSrc).not.toContain(hash(''));
  });

  it('autorise les styles en ligne par empreinte et jamais par unsafe-inline', async () => {
    run(site, output);
    const content = await policy();

    expect(/style-src ([^;]*)/.exec(content)?.[1]).toBe(`'self' ${hash('body{margin:0}')}`);
    expect(content).not.toContain('unsafe-inline');
    expect(content).not.toContain('unsafe-eval');
  });

  it('pose les directives strictes : aucun domaine tiers, aucun cadre, aucun objet', async () => {
    run(site, output);
    const directives = (await policy()).replace(/^header Content-Security-Policy "|"\n$/g, '');

    expect(directives.split('; ')).toEqual(
      expect.arrayContaining([
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ]),
    );
    expect(directives).not.toMatch(/https?:\/\//);
  });

  it('suit le contenu : une page modifiée change l’empreinte', async () => {
    const other = join(directory, 'other');
    await mkdir(other, { recursive: true });
    await writeFile(join(other, 'index.html'), '<script>window.__NUXT__={a:1}</script>');
    const outputOther = join(directory, 'other.caddy');

    expect(run(other, outputOther).status).toBe(0);
    const content = await readFile(outputOther, 'utf8');

    expect(content).toContain(hash('window.__NUXT__={a:1}'));
    expect(content).not.toContain(hash('window.__NUXT__={}'));
  });

  it('refuse un dossier sans page ou absent (code 1) et un mauvais usage (code 2)', async () => {
    const empty = join(directory, 'vide');
    await mkdir(empty, { recursive: true });

    const noPage = run(empty, join(directory, 'vide.caddy'));
    const missing = run(join(directory, 'absent'), join(directory, 'absent.caddy'));
    const usage = run(site);
    const tooMany = run(site, output, 'en-trop');

    expect(noPage.status).toBe(1);
    expect(noPage.stderr).toContain('aucune page HTML');
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('dossier introuvable');
    expect(existsSync(join(directory, 'vide.caddy'))).toBe(false);
    expect(usage.status).toBe(2);
    expect(usage.stderr).toContain('Usage');
    expect(tooMany.status).toBe(2);
  });
});
