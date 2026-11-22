// Plan du site (`sitemap.xml`) et `robots.txt` du site généré (lot F7, F7-03). Module pur, appelé par
// nuxt.config.ts à la fin du prérendu avec le HTML de chaque page générée.
//
// Le plan du site ne recopie aucune liste de routes : il se déduit des pages elles-mêmes. Une page y
// entre quand elle déclare un `<link rel="canonical">` (posé par app.vue via `useLocaleHead`) ; ses
// versions dans les autres langues sont ses propres `<link rel="alternate" hreflang>`. Les pages sans
// canonique n'y entrent pas : pages de redirection de `/fr` (D15), pages d'erreur (`404.html`), coquille
// SPA (`200.html`). Le plan reprend donc exactement les adresses que les pages annoncent, et l'adresse du
// site (celle du `robots.txt`) vient du canonique de la première page, sans variable recopiée.

/** Version d'une page dans une langue (`hreflang` : code de langue ou `x-default`). */
export interface Alternate {
  readonly hreflang: string;
  readonly href: string;
}

/** Liens de référencement d'une page : son canonique (ou `null`) et ses versions par langue. */
export interface SeoLinks {
  readonly canonical: string | null;
  readonly alternates: readonly Alternate[];
}

/** Une entrée du plan du site. */
export interface SitemapEntry {
  readonly loc: string;
  readonly alternates: readonly Alternate[];
}

/** Fichiers produits pour la racine du site généré. */
export interface SeoFiles {
  readonly sitemap: string;
  readonly robots: string;
}

/** Nom du plan du site, servi à la racine. */
export const SITEMAP_FILE = 'sitemap.xml';

const LINK_TAG = /<link\b[^>]*>/gi;
const ATTRIBUTE = /([\w:-]+)\s*=\s*"([^"]*)"/g;

/** Décode les entités qu'un attribut HTML généré peut contenir. */
function decodeAttribute(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

/** Attributs (entre guillemets doubles, noms en minuscules) d'une balise. */
function attributesOf(tag: string): Map<string, string> {
  return new Map(
    [...tag.matchAll(ATTRIBUTE)].map((match) => [
      match[1]!.toLowerCase(),
      decodeAttribute(match[2]!),
    ]),
  );
}

/** Canonique et versions par langue déclarés par les balises `<link>` d'une page HTML. */
export function readSeoLinks(html: string): SeoLinks {
  let canonical: string | null = null;
  const alternates: Alternate[] = [];
  for (const [tag] of html.matchAll(LINK_TAG)) {
    const attributes = attributesOf(tag);
    const rel = attributes.get('rel');
    const href = attributes.get('href');
    if (href === undefined) continue;
    const hreflang = attributes.get('hreflang');
    if (rel === 'canonical') canonical ??= href;
    else if (rel === 'alternate' && hreflang !== undefined) alternates.push({ hreflang, href });
  }
  return { canonical, alternates };
}

/**
 * Entrées du plan du site pour les pages générées : une par canonique distinct, dans l'ordre des
 * adresses, chacune avec ses versions par langue triées (`x-default` en dernier).
 */
export function sitemapEntries(pages: readonly string[]): SitemapEntry[] {
  const entries = new Map<string, SitemapEntry>();
  for (const html of pages) {
    const { canonical, alternates } = readSeoLinks(html);
    if (canonical === null || entries.has(canonical)) continue;
    const sorted = [...alternates].sort(
      (a, b) =>
        Number(a.hreflang === 'x-default') - Number(b.hreflang === 'x-default') ||
        a.hreflang.localeCompare(b.hreflang),
    );
    entries.set(canonical, { loc: canonical, alternates: sorted });
  }
  return [...entries.values()].sort((a, b) => a.loc.localeCompare(b.loc));
}

/** Échappe un texte pour un contenu ou un attribut XML. */
export function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** `sitemap.xml` (protocole sitemaps.org 0.9, versions par langue en `xhtml:link`). */
export function sitemapXml(entries: readonly SitemapEntry[]): string {
  const urls = entries.map((entry) =>
    [
      '  <url>',
      `    <loc>${escapeXml(entry.loc)}</loc>`,
      ...entry.alternates.map(
        ({ hreflang, href }) =>
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}"/>`,
      ),
      '  </url>',
    ].join('\n'),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/** `robots.txt` : tout le site est ouvert aux robots, le plan du site est annoncé par son adresse. */
export function robotsTxt(sitemapUrl: string): string {
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemapUrl}`, ''].join('\n');
}

/**
 * `sitemap.xml` et `robots.txt` des pages générées. L'adresse du plan du site est prise à l'origine du
 * premier canonique. Échoue (et fait échouer la génération) quand aucune page n'a de canonique : le
 * plan du site serait vide.
 */
export function seoFiles(pages: readonly string[]): SeoFiles {
  const entries = sitemapEntries(pages);
  const [first] = entries;
  if (first === undefined) {
    throw new Error(
      'Plan du site vide : aucune page générée ne déclare de <link rel="canonical"> (useLocaleHead).',
    );
  }
  return {
    sitemap: sitemapXml(entries),
    robots: robotsTxt(new URL(`/${SITEMAP_FILE}`, first.loc).href),
  };
}
