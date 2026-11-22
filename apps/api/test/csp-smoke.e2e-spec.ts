import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const smokeUrl = new URL('../../../scripts/deploy/csp-smoke.mjs', import.meta.url);
const { PAGES, blockingMessages } = (await import(fileURLToPath(smokeUrl))) as {
  PAGES: { path: string; status: number; main: boolean; ignore?: RegExp }[];
  blockingMessages: (messages: string[], ignore?: RegExp) => string[];
};

const document404 = 'Failed to load resource: the server responded with a status of 404 ()';

/** Parcours de fumée CSP : pages visitées et messages de console tolérés (404 du document seulement). */
describe('scripts/deploy/csp-smoke.mjs', () => {
  const unknown = PAGES.filter((page) => page.status === 404);

  it('visite la route inconnue en français et en anglais, avec le contenu de la page 404', () => {
    expect(unknown.map((page) => page.path)).toEqual(['/route-inconnue', '/en/route-inconnue']);
    expect(unknown.every((page) => page.main)).toBe(true);
  });

  it('ignore le message de console du document 404, pour la route inconnue seulement', () => {
    for (const page of unknown) {
      expect(blockingMessages([document404], page.ignore)).toEqual([]);
    }
    for (const page of PAGES.filter((entry) => entry.status === 200)) {
      expect(page.ignore).toBeUndefined();
      expect(blockingMessages([document404], page.ignore)).toEqual([document404]);
    }
  });

  it('garde bloquante toute autre erreur, y compris une autre ressource en 404 ou en 500', () => {
    const others = [
      "Refused to evaluate a string as JavaScript because 'unsafe-eval' is not allowed",
      'Uncaught TypeError: x is not a function',
      'Failed to load resource: the server responded with a status of 500 ()',
    ];

    for (const page of unknown) {
      expect(blockingMessages([document404, ...others], page.ignore)).toEqual(others);
    }
  });

  it('Caddy sert en/404.html sous /en et 404.html ailleurs, avec le statut 404', () => {
    const caddyfile = readFileSync(
      fileURLToPath(new URL('../../../docker/Caddyfile', import.meta.url)),
      'utf8',
    );

    expect(caddyfile).toContain('rewrite * /404.html');
    expect(caddyfile).toContain('rewrite @en404 /en/404.html');
    expect(caddyfile.indexOf('rewrite * /404.html')).toBeLessThan(
      caddyfile.indexOf('rewrite @en404 /en/404.html'),
    );
    expect(caddyfile).toMatch(/@en404 vars_regexp en404 \{http\.request\.orig_uri\.path\} \^\/en/);
    expect(caddyfile).toMatch(/file_server \{\s+status 404\s+\}/);
  });
});
