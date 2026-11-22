import { describe, expect, it } from 'vitest';

import {
  escapeXml,
  readSeoLinks,
  robotsTxt,
  seoFiles,
  SITEMAP_FILE,
  sitemapEntries,
  sitemapXml,
} from './sitemap.js';

// Plan du site et robots.txt (F7-03), déduits du HTML des pages générées.

const BASE = 'https://exemple.org';

/** En-tête d'une page générée par app.vue (`useLocaleHead`), dans l'ordre et la forme de Nuxt. */
function page(canonical: string | null, alternates: Record<string, string>): string {
  const links = Object.entries(alternates).map(
    ([hreflang, href]) =>
      `<link id="i18n-alt-${hreflang}" rel="alternate" href="${href}" hreflang="${hreflang}">`,
  );
  const canonicalLink =
    canonical === null ? '' : `<link id="i18n-can" rel="canonical" href="${canonical}">`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><link rel="stylesheet" href="/_nuxt/entry.css">${links.join('')}${canonicalLink}</head><body><a href="/en">EN</a></body></html>`;
}

const home = page(BASE, { 'x-default': BASE, fr: BASE, en: `${BASE}/en` });
const homeEn = page(`${BASE}/en`, { 'x-default': BASE, fr: BASE, en: `${BASE}/en` });
const declaration = page(`${BASE}/accessibilite`, {
  'x-default': `${BASE}/accessibilite`,
  fr: `${BASE}/accessibilite`,
  en: `${BASE}/en/accessibility`,
});

describe('readSeoLinks', () => {
  it('lit le canonique et les versions par langue des balises <link>', () => {
    expect(readSeoLinks(home)).toEqual({
      canonical: BASE,
      alternates: [
        { hreflang: 'x-default', href: BASE },
        { hreflang: 'fr', href: BASE },
        { hreflang: 'en', href: `${BASE}/en` },
      ],
    });
  });

  it('n’a pas de canonique pour une page qui n’en déclare pas (redirection, erreur)', () => {
    expect(
      readSeoLinks('<html><head><meta http-equiv="refresh" content="0; url=/"></head></html>'),
    ).toEqual({
      canonical: null,
      alternates: [],
    });
  });

  it('garde le premier canonique, ignore les liens sans adresse ou sans langue', () => {
    const html =
      '<link rel="canonical" href="/a"><link rel="canonical" href="/b">' +
      '<link rel="alternate" hreflang="en"><link rel="alternate" href="/flux.xml">' +
      '<link rel="canonical"><link rel="preload" href="/police.woff2" hreflang="fr">';
    expect(readSeoLinks(html)).toEqual({ canonical: '/a', alternates: [] });
  });

  it('accepte des noms d’attributs en majuscules et des espaces autour de =', () => {
    expect(
      readSeoLinks(
        '<LINK REL="canonical" HREF = "/a"><Link Rel="alternate" HrefLang="en" Href="/en">',
      ),
    ).toEqual({
      canonical: '/a',
      alternates: [{ hreflang: 'en', href: '/en' }],
    });
  });

  it('décode les entités des attributs', () => {
    expect(
      readSeoLinks('<link rel="canonical" href="/a?x=1&amp;y=&lt;2&gt;&quot;3&quot;&#39;4&#39;">')
        .canonical,
    ).toBe('/a?x=1&y=<2>"3"\'4\'');
    // `&amp;lt;` est le texte « &lt; », pas « < » : `&amp;` se décode en dernier.
    expect(readSeoLinks('<link rel="canonical" href="/a&amp;lt;">').canonical).toBe('/a&lt;');
  });
});

describe('sitemapEntries', () => {
  it('fait une entrée par page qui a un canonique, triée par adresse, x-default en dernier', () => {
    expect(sitemapEntries([declaration, homeEn, page(null, { fr: BASE }), home])).toEqual([
      {
        loc: BASE,
        alternates: [
          { hreflang: 'en', href: `${BASE}/en` },
          { hreflang: 'fr', href: BASE },
          { hreflang: 'x-default', href: BASE },
        ],
      },
      {
        loc: `${BASE}/accessibilite`,
        alternates: [
          { hreflang: 'en', href: `${BASE}/en/accessibility` },
          { hreflang: 'fr', href: `${BASE}/accessibilite` },
          { hreflang: 'x-default', href: `${BASE}/accessibilite` },
        ],
      },
      {
        loc: `${BASE}/en`,
        alternates: [
          { hreflang: 'en', href: `${BASE}/en` },
          { hreflang: 'fr', href: BASE },
          { hreflang: 'x-default', href: BASE },
        ],
      },
    ]);
  });

  it('ne garde qu’une entrée pour deux pages au même canonique (la première)', () => {
    const twin = page(BASE, { fr: BASE });
    expect(sitemapEntries([home, twin])).toHaveLength(1);
    expect(sitemapEntries([twin, home])).toEqual([
      { loc: BASE, alternates: [{ hreflang: 'fr', href: BASE }] },
    ]);
  });

  it('trie x-default après toute langue, quelle que soit sa place', () => {
    const entries = sitemapEntries([
      page(BASE, { fr: BASE, 'x-default': BASE, de: `${BASE}/de`, en: `${BASE}/en` }),
    ]);
    expect(entries[0]?.alternates.map((alternate) => alternate.hreflang)).toEqual([
      'de',
      'en',
      'fr',
      'x-default',
    ]);
  });

  it('est vide sans page à canonique', () => {
    expect(sitemapEntries([])).toEqual([]);
    expect(sitemapEntries([page(null, {})])).toEqual([]);
  });
});

describe('escapeXml', () => {
  it('échappe les cinq caractères réservés de XML', () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
    expect(escapeXml('&lt;')).toBe('&amp;lt;');
  });
});

describe('sitemapXml', () => {
  it('écrit un urlset sitemaps.org 0.9 avec les versions par langue en xhtml:link', () => {
    expect(
      sitemapXml([
        {
          loc: `${BASE}/a?x=1&y=2`,
          alternates: [
            { hreflang: 'en', href: `${BASE}/en/a` },
            { hreflang: 'x-default', href: `${BASE}/a` },
          ],
        },
        { loc: `${BASE}/b`, alternates: [] },
      ]),
    ).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        '  <url>',
        '    <loc>https://exemple.org/a?x=1&amp;y=2</loc>',
        '    <xhtml:link rel="alternate" hreflang="en" href="https://exemple.org/en/a"/>',
        '    <xhtml:link rel="alternate" hreflang="x-default" href="https://exemple.org/a"/>',
        '  </url>',
        '  <url>',
        '    <loc>https://exemple.org/b</loc>',
        '  </url>',
        '</urlset>',
        '',
      ].join('\n'),
    );
  });

  it('échappe la langue et l’adresse des versions', () => {
    expect(
      sitemapXml([{ loc: '/', alternates: [{ hreflang: 'a"b', href: '/?a=1&b=2' }] }]),
    ).toContain('<xhtml:link rel="alternate" hreflang="a&quot;b" href="/?a=1&amp;b=2"/>');
  });
});

describe('robotsTxt', () => {
  it('ouvre tout le site et annonce le plan du site', () => {
    expect(robotsTxt(`${BASE}/sitemap.xml`)).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://exemple.org/sitemap.xml\n',
    );
  });
});

describe('seoFiles', () => {
  it('produit le plan du site des pages et le robots.txt à l’origine du premier canonique', () => {
    const files = seoFiles([homeEn, declaration, home]);

    expect(SITEMAP_FILE).toBe('sitemap.xml');
    expect(files.sitemap).toBe(sitemapXml(sitemapEntries([homeEn, declaration, home])));
    expect(files.robots).toBe(robotsTxt('https://exemple.org/sitemap.xml'));
  });

  it('prend l’origine seule, même quand le premier canonique a un chemin', () => {
    expect(seoFiles([declaration]).robots).toContain('Sitemap: https://exemple.org/sitemap.xml\n');
  });

  it('échoue quand aucune page n’a de canonique', () => {
    expect(() => seoFiles([page(null, {})])).toThrow(
      'Plan du site vide : aucune page générée ne déclare de <link rel="canonical"> (useLocaleHead).',
    );
  });
});
