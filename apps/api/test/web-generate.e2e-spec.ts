import { spawnSync } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const generateScript = fileURLToPath(
  new URL('../../../scripts/deploy/web-generate.sh', import.meta.url),
);
const cspScript = fileURLToPath(new URL('../../../scripts/deploy/csp-hashes.mjs', import.meta.url));

/**
 * Publication du front (BF-13) : web-generate.sh avec un faux `nuxt` (aucune génération réelle), pour
 * prouver la bascule atomique, la conservation du site précédent en cas d'échec et l'élagage.
 */
describe('scripts/deploy/web-generate.sh', () => {
  let directory: string;
  let site: string;
  let work: string;

  /** Faux `nuxt generate` : écrit les pages attendues dans .output/public, ou échoue. */
  async function fakeNuxt(body: string) {
    const bin = join(work, 'node_modules', '.bin');
    await mkdir(bin, { recursive: true });
    await writeFile(join(bin, 'nuxt'), `#!/bin/sh\n${body}\n`);
    await chmod(join(bin, 'nuxt'), 0o755);
  }

  const succeed = (marker: string) =>
    `mkdir -p .output/public/en
printf '<html><script>window.__NUXT__={m:"${marker}"}</script></html>' > .output/public/index.html
printf '<html><body>en</body></html>' > .output/public/en/index.html
printf '<html><body>404</body></html>' > .output/public/404.html`;

  const publish = (extra: Record<string, string> = {}) =>
    spawnSync('sh', [generateScript], {
      cwd: work,
      encoding: 'utf8',
      env: {
        ...process.env,
        SITE_DIR: site,
        CSP_SCRIPT: cspScript,
        NUXT_PUBLIC_CONTACT_EMAIL: 'contact@example.org',
        ...extra,
      },
    });

  const current = async () => readlink(join(site, 'current'));
  const homePage = async () => readFile(join(site, 'current', 'public', 'index.html'), 'utf8');

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'siteperso-web-'));
    site = join(directory, 'site');
    work = join(directory, 'work');
    await mkdir(site, { recursive: true });
    await mkdir(work, { recursive: true });
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('publie la génération : pages, CSP et lien current vers la nouvelle version', async () => {
    await fakeNuxt(succeed('un'));

    const result = publish();

    expect(result.status, result.stderr).toBe(0);
    expect(await current()).toMatch(/^releases\/\d{8}T\d{6}Z-\d+$/);
    expect(await homePage()).toContain('m:"un"');
    expect(await readFile(join(site, 'current', 'csp.caddy'), 'utf8')).toContain(
      'header Content-Security-Policy "default-src',
    );
    // Aucun reste de travail dans le volume.
    expect((await readdir(site)).sort()).toEqual(['current', 'releases']);
  });

  it('un échec de génération laisse le site précédent en place', async () => {
    await fakeNuxt(succeed('ancien'));
    expect(publish().status).toBe(0);
    const before = await current();

    await rm(join(work, '.output'), { recursive: true, force: true });
    await fakeNuxt('echo "API injoignable" >&2; exit 1');
    const result = publish();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('nuxt generate a échoué : le site publié est inchangé');
    expect(await current()).toBe(before);
    expect(await homePage()).toContain('m:"ancien"');
    expect((await readdir(site)).sort()).toEqual(['current', 'releases']);
    expect(await readdir(join(site, 'releases'))).toHaveLength(1);
  });

  it('refuse une génération incomplète (page 404 absente) sans toucher au site', async () => {
    await fakeNuxt(`mkdir -p .output/public/en
printf '<html></html>' > .output/public/index.html
printf '<html></html>' > .output/public/en/index.html`);

    const result = publish();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('page attendue absente après la génération : 404.html');
    await expect(readlink(join(site, 'current'))).rejects.toThrow();
  });

  it('refuse une adresse de contact vide avant toute génération', async () => {
    await fakeNuxt(succeed('x'));

    const result = publish({ NUXT_PUBLIC_CONTACT_EMAIL: '' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NUXT_PUBLIC_CONTACT_EMAIL est vide');
  });

  it('refuse un volume du site absent', async () => {
    await fakeNuxt(succeed('x'));

    const result = publish({ SITE_DIR: join(directory, 'inexistant') });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('absent ou non inscriptible');
  });

  it('garde les trois dernières versions et supprime les plus anciennes', async () => {
    const ids: string[] = [];
    for (const marker of ['a', 'b', 'c', 'd']) {
      await rm(join(work, '.output'), { recursive: true, force: true });
      await fakeNuxt(succeed(marker));
      expect(publish().status).toBe(0);
      ids.push(await current());
      // Des identifiants datés à la seconde : laisser passer la seconde garde l'ordre chronologique.
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }

    const kept = await readdir(join(site, 'releases'));
    expect(kept).toHaveLength(3);
    expect(kept).not.toContain((ids[0] ?? '').replace('releases/', ''));
    expect(await homePage()).toContain('m:"d"');
  }, 30_000);
});
