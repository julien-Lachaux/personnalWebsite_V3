import { describe, expect, it } from 'vitest';

import {
  isApplicationHint,
  isServerErrorPage,
  SERVER_ERROR_PAGES,
  standaloneErrorPage,
} from './server-error-page.js';

// Pages d'erreur serveur (lot 30) : une par langue, rendue au prérendu puis privée de l'application de
// Nuxt, pour s'afficher sans JavaScript ni serveur.

describe('pages d’erreur serveur : adresses', () => {
  it('prérend une page par langue, fr sans préfixe et en sous /en', () => {
    expect(SERVER_ERROR_PAGES).toEqual(['/50x.html', '/en/50x.html']);
  });

  it('reconnaît ces deux adresses et elles seules', () => {
    expect(isServerErrorPage('/50x.html')).toBe(true);
    expect(isServerErrorPage('/en/50x.html')).toBe(true);
    expect(isServerErrorPage('/404.html')).toBe(false);
    expect(isServerErrorPage('/en/404.html')).toBe(false);
    expect(isServerErrorPage('/50x')).toBe(false);
    expect(isServerErrorPage('/fr/50x.html')).toBe(false);
    expect(isServerErrorPage('/')).toBe(false);
  });
});

describe('isApplicationHint', () => {
  it('reconnaît le préchargement d’un module', () => {
    expect(
      isApplicationHint('<link rel="modulepreload" as="script" crossorigin href="/_nuxt/a.js">'),
    ).toBe(true);
    expect(isApplicationHint('<link rel="modulepreload" href="/_nuxt/a.js">')).toBe(true);
  });

  it('reconnaît le préchargement d’un script ou d’une charge utile', () => {
    expect(isApplicationHint('<link rel="preload" as="script" href="/_nuxt/a.js">')).toBe(true);
    expect(isApplicationHint('<link rel="prefetch" as="script" href="/_nuxt/b.js">')).toBe(true);
    expect(isApplicationHint('<link rel="preload" as="fetch" href="/_payload.json">')).toBe(true);
    expect(isApplicationHint('<link rel="prefetch" as="fetch" href="/_payload.json">')).toBe(true);
    // L'ordre des attributs ne compte pas.
    expect(isApplicationHint('<link as="script" rel="preload" href="/_nuxt/a.js">')).toBe(true);
  });

  it('garde les polices, les feuilles de style et les autres liens', () => {
    expect(
      isApplicationHint(
        '<link rel="preload" as="font" type="font/woff2" href="/fonts/a.woff2" crossorigin>',
      ),
    ).toBe(false);
    expect(isApplicationHint('<link rel="prefetch" as="style" href="/_nuxt/a.css">')).toBe(false);
    expect(isApplicationHint('<link rel="stylesheet" href="/_nuxt/entry.css" crossorigin>')).toBe(
      false,
    );
    expect(isApplicationHint('<link rel="icon" href="/favicon.ico">')).toBe(false);
    expect(isApplicationHint('<link as="script" href="/_nuxt/a.js">')).toBe(false);
    // Un autre attribut qui finit par `rel` ou `as` ne compte pas.
    expect(isApplicationHint('<link data-rel="modulepreload" href="/_nuxt/a.js">')).toBe(false);
    expect(isApplicationHint('<link rel="preload" data-as="script" href="/a.js">')).toBe(false);
  });
});

describe('standaloneErrorPage', () => {
  const THEME = '(function(){document.documentElement.dataset.theme="sombre"})()';
  const page = [
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">',
    '<title>Erreur</title>',
    '<script type="importmap">{"imports":{"#entry":"/_nuxt/e.js"}}</script>',
    `<script data-hid="theme">${THEME}</script>`,
    '<style>.a{color:var(--text)}</style>',
    '<link rel="stylesheet" href="/_nuxt/entry.css" crossorigin>',
    '<link rel="preload" as="font" type="font/woff2" href="/fonts/a.woff2" crossorigin>',
    '<link rel="modulepreload" as="script" crossorigin href="/_nuxt/e.js">',
    '<link rel="prefetch" as="script" crossorigin href="/_nuxt/lazy.js">',
    '<script type="module" src="/_nuxt/e.js" crossorigin></script>',
    '<meta name="robots" content="noindex">',
    '</head><body><div id="__nuxt"><main id="contenu"><h1>Erreur</h1></main></div>',
    '<script>window.__NUXT__={};window.__NUXT__.config={public:{}}</script>',
    '<script type="application/json" data-nuxt-data="nuxt-app" id="__NUXT_DATA__">[{"a":1}]</script>',
    '</body></html>',
  ].join('\n');

  it('retire tous les scripts sauf le script de thème, et les préchargements de l’application', () => {
    expect(standaloneErrorPage(page, THEME)).toBe(
      [
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">',
        '<title>Erreur</title>',
        '',
        `<script data-hid="theme">${THEME}</script>`,
        '<style>.a{color:var(--text)}</style>',
        '<link rel="stylesheet" href="/_nuxt/entry.css" crossorigin>',
        '<link rel="preload" as="font" type="font/woff2" href="/fonts/a.woff2" crossorigin>',
        '',
        '',
        '',
        '<meta name="robots" content="noindex">',
        '</head><body><div id="__nuxt"><main id="contenu"><h1>Erreur</h1></main></div>',
        '',
        '',
        '</body></html>',
      ].join('\n'),
    );
  });

  it('ne garde que le script au contenu exact (ni un préfixe, ni un autre script)', () => {
    const html = `<script>${THEME};x()</script><script>${THEME}</script><SCRIPT>y()</SCRIPT>`;
    expect(standaloneErrorPage(html, THEME)).toBe(`<script>${THEME}</script>`);
  });

  it('retire chaque script séparément, même sur plusieurs lignes', () => {
    const html = '<p>a</p><script>\n1\n</script><p>b</p><script src="/x.js"></script><p>c</p>';
    expect(standaloneErrorPage(html, THEME)).toBe('<p>a</p><p>b</p><p>c</p>');
  });

  it('retire les liens en majuscules comme les autres', () => {
    expect(standaloneErrorPage('<LINK rel="modulepreload" href="/a.js"><p>x</p>', THEME)).toBe(
      '<p>x</p>',
    );
  });

  it('laisse intact un document sans script ni préchargement', () => {
    const html =
      '<html><head><link rel="stylesheet" href="/a.css"></head><body><p>ok</p></body></html>';
    expect(standaloneErrorPage(html, THEME)).toBe(html);
  });
});
