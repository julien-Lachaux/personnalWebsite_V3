import { describe, expect, it } from 'vitest';

import { sitemapEntries } from './sitemap.js';

// Plan du site (F7-03) : `x-default` vient après toutes les langues, même celles dont le code suit
// « x » dans l'ordre alphabétique (zh, yo) ; l'ordre n'est donc pas seulement alphabétique.

function page(alternates: Record<string, string>): string {
  const links = Object.entries(alternates).map(
    ([hreflang, href]) => `<link rel="alternate" href="${href}" hreflang="${hreflang}">`,
  );
  return `<head><link rel="canonical" href="https://exemple.org/">${links.join('')}</head>`;
}

describe('sitemapEntries : place de x-default', () => {
  it('range x-default après zh et yo, où qu’il soit dans la page', () => {
    for (const order of [
      ['x-default', 'zh', 'yo', 'fr'],
      ['zh', 'x-default', 'fr', 'yo'],
      ['fr', 'yo', 'zh', 'x-default'],
    ]) {
      const html = page(
        Object.fromEntries(order.map((code) => [code, `https://exemple.org/${code}`])),
      );
      expect(sitemapEntries([html])[0]?.alternates.map((alternate) => alternate.hreflang)).toEqual([
        'fr',
        'yo',
        'zh',
        'x-default',
      ]);
    }
  });
});
