import { describe, expect, it } from 'vitest';
import type { NuxtApp } from '#app';

import plugin, { forgetErrorPagePath, type RenderedPage } from './localized-error-page.server.js';

// Page 404 anglaise (`/en/404.html`) : sans adresse de rendu dans sa charge utile, la page garde
// l'adresse demandée une fois hydratée (vérifié dans le navigateur par test/pages.e2e.ts).

function rendered(url: string): RenderedPage & { payload: { path?: string } } {
  return { url, payload: { path: url } };
}

describe('greffon localized-error-page', () => {
  it('retire l’adresse de rendu de la page 404 anglaise', () => {
    const page = rendered('/en/404.html');
    forgetErrorPagePath(page);
    expect(page.payload).toEqual({});
    expect('path' in page.payload).toBe(false);
  });

  it('laisse l’adresse de toute autre page, dont la 404 de Nuxt (qui la retire elle-même)', () => {
    for (const url of ['/', '/en', '/en/accessibility', '/404.html']) {
      const page = rendered(url);
      forgetErrorPagePath(page);
      expect(page.payload).toEqual({ path: url });
    }
  });

  it('s’accroche à la fin du rendu (app:rendered) de chaque page', async () => {
    const hooks: [string, (context: { ssrContext: RenderedPage }) => void][] = [];
    const nuxtApp = {
      hooks: {
        hook: (name: string, callback: (context: { ssrContext: RenderedPage }) => void) =>
          hooks.push([name, callback]),
      },
    } as unknown as NuxtApp;

    await plugin(nuxtApp);

    expect(hooks.map(([name]) => name)).toEqual(['app:rendered']);
    const page = rendered('/en/404.html');
    hooks[0]?.[1]({ ssrContext: page });
    expect(page.payload).toEqual({});
  });
});
