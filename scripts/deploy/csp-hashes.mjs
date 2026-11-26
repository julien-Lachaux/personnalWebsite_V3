#!/usr/bin/env node
// Politique de sécurité du contenu (CSP) du front statique, avec les empreintes des scripts et styles en
// ligne que `nuxt generate` écrit dans les pages (BF-14). Ces empreintes changent à chaque génération
// (carte d'import, configuration `window.__NUXT__`, styles critiques) : elles sont relevées sur les pages
// générées, jamais écrites à la main. Le script de thème sans flash (D5) est un script en ligne comme les
// autres ; la constante THEME_SCRIPT_SHA256 du front est donc retrouvée dans la sortie (vérifié par le
// test apps/api/test/csp-hashes.e2e-spec.ts).
//
// Usage : csp-hashes.mjs <dossier des pages> <fichier de sortie>
// Sortie : un extrait Caddyfile (`header Content-Security-Policy "…"`), importé par docker/Caddyfile.
// Codes de sortie : 0 écrit ; 1 erreur (aucune page, dossier absent) ; 2 usage.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Scripts de données (non exécutés) : la CSP ne les contrôle pas.
const DATA_SCRIPT_TYPES = new Set(['application/json', 'application/ld+json']);

/** Empreinte CSP (`'sha256-…'`) du contenu exact d'un élément en ligne. */
export function cspHash(content) {
  return `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`;
}

/** Empreintes des scripts exécutables et des styles en ligne d'une page HTML. */
export function inlineHashes(html) {
  const scripts = [];
  const styles = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1] ?? '';
    if (/\bsrc\s*=/i.test(attributes)) {
      continue;
    }
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attributes)?.[1]?.toLowerCase();
    if (type !== undefined && DATA_SCRIPT_TYPES.has(type)) {
      continue;
    }
    scripts.push(cspHash(match[2] ?? ''));
  }
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    styles.push(cspHash(match[1] ?? ''));
  }
  return { scripts, styles };
}

function htmlFiles(directory) {
  const files = [];
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      files.push(...htmlFiles(path));
    } else if (name.endsWith('.html')) {
      files.push(path);
    }
  }
  return files;
}

/** Empreintes (sans doublon, triées) de toutes les pages d'un dossier. */
export function collectHashes(directory) {
  const pages = htmlFiles(directory);
  if (pages.length === 0) {
    throw new Error(`aucune page HTML dans ${directory}`);
  }
  const scripts = new Set();
  const styles = new Set();
  for (const page of pages) {
    const found = inlineHashes(readFileSync(page, 'utf8'));
    found.scripts.forEach((hash) => scripts.add(hash));
    found.styles.forEach((hash) => styles.add(hash));
  }
  return { pages: pages.length, scripts: [...scripts].sort(), styles: [...styles].sort() };
}

/** Politique complète : aucun domaine tiers, scripts et styles en ligne par empreinte seulement. */
export function buildPolicy({ scripts, styles }) {
  return [
    "default-src 'self'",
    `script-src 'self' ${scripts.join(' ')}`.trim(),
    `style-src 'self' ${styles.join(' ')}`.trim(),
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

function main(argv) {
  const [directory, output, ...extra] = argv;
  if (directory === undefined || output === undefined || extra.length > 0) {
    process.stderr.write('Usage : csp-hashes.mjs <dossier des pages> <fichier de sortie>\n');
    return 2;
  }
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    process.stderr.write(`[csp] ERREUR : dossier introuvable : ${directory}\n`);
    return 1;
  }
  try {
    const hashes = collectHashes(directory);
    writeFileSync(output, `header Content-Security-Policy "${buildPolicy(hashes)}"\n`);
    process.stdout.write(
      `[csp] ${hashes.pages} pages, ${hashes.scripts.length} scripts et ${hashes.styles.length} styles en ligne\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`[csp] ERREUR : ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
