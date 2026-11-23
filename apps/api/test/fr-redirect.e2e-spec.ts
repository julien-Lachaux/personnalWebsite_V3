import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const caddyfile = readFileSync(
  fileURLToPath(new URL('../../../docker/Caddyfile', import.meta.url)),
  'utf8',
);

const pattern = (matcher: string) =>
  new RegExp(
    new RegExp(`${matcher} \\{http\\.request\\.orig_uri\\.path\\} (\\S+)`).exec(caddyfile)?.[1] ??
      '(?!)',
  );

/**
 * Redirection 301 de /fr/* (BF-14) : la liste blanche du Caddyfile ne doit laisser passer aucun chemin
 * dont la redirection `Location: /<suite>` serait comprise par un navigateur comme `//hote` (tabulation,
 * retour chariot et saut de ligne retirés par le navigateur, `/` et `\` décodés ou doublement encodés).
 * Les expressions sont lues dans le Caddyfile et jouées sur le chemin d'origine décodé que Caddy leur
 * donne ; le comportement HTTP réel est vérifié sur un Caddy jetable (compte rendu du lot 24).
 */
describe('docker/Caddyfile : garde de la redirection /fr', () => {
  const ok = pattern('vars_regexp frok');
  const doubled = pattern('vars_regexp frdbl');
  const redirect = new RegExp(/@fr path_regexp fr (\S+)/.exec(caddyfile)?.[1] ?? '(?!)');

  /** Chemins d'origine décodés : %09 est une tabulation, %252F le texte « %2F ». */
  const dangerous = [
    '/fr/\t/hote',
    '/fr/\r/hote',
    '/fr/\n/hote',
    '/fr/ /hote',
    '/fr///hote',
    '/fr//hote',
    '/fr/\\/hote',
    '/fr/%2F/hote',
    '/fr/a\t/hote',
    '/fr/a\nb',
    '/fr/a//hote',
    '/fr/\u0000/hote',
    '/fr/\u007f',
  ];

  it.each(dangerous)(
    'refuse %j : ni la garde positive ni la redirection ne le laissent passer',
    (path) => {
      const accepted = ok.test(path) && !doubled.test(path);

      expect(accepted).toBe(false);
      expect(redirect.test(path) && ok.test(path) && !doubled.test(path)).toBe(false);
    },
  );

  it.each([
    ['/fr', 'undefined'],
    ['/fr/', 'undefined'],
    ['/fr/a/b', 'a/b'],
    ['/fr/cv/cv-fr.pdf', 'cv/cv-fr.pdf'],
    ['/fr/accessibilite', 'accessibilite'],
    ['/fr/.well-known/x', '.well-known/x'],
  ])('accepte %s et la redirige vers /%s', (path, suffix) => {
    expect(ok.test(path) || path === '/fr').toBe(true);
    expect(doubled.test(path)).toBe(false);
    expect(String(redirect.exec(path)?.[1])).toBe(suffix);
  });

  it('ne touche pas aux chemins voisins de /fr', () => {
    expect(redirect.test('/frais')).toBe(false);
    expect(redirect.test('/en/fr/a')).toBe(false);
  });
});
