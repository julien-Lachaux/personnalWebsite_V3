/// <reference types="node" />
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

// Règles d'architecture du front (docs/05, CLAUDE.md « Front ») vérifiées par le code :
// - app/domain : logique pure, aucun import de Vue, de Nuxt ni des alias de Nuxt (#imports, #app…),
//   ni des couches qui en dépendent (composants, composables, pages, données) ;
// - app/data : aucun import des composants, des pages ni d'un fichier .vue.
// Les auto-imports de Nuxt sont exclus par construction : ces deux dossiers sont testés dans le
// projet Vitest `unit`, sans Nuxt, où un `ref()` ou un `useFetch()` non importé échoue.

const appRoot = import.meta.dirname;

/** Spécificateurs importés par un source : import/export statiques, import() et require(). */
export function importSpecifiers(source: string): string[] {
  const patterns = [
    /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  return patterns.flatMap((re) => [...source.matchAll(re)].map((m) => m[1] ?? ''));
}

/** Vue, Nuxt et leurs paquets, alias virtuels de Nuxt (`#imports`, `#app`, `#components`…). */
const FRAMEWORK =
  /^(?:vue|vue-router|nuxt|nuxt\/.*|@vue\/.*|@nuxt\/.*|@nuxtjs\/.*|@unhead\/.*|unhead|#.*)$/;
/** Couches d'interface : un fichier .vue, ou un chemin qui traverse ces dossiers d'`app/`. */
const UI_LAYER =
  /\.vue$|(?:^|\/)(?:components|composables|pages|layouts|plugins|middleware)(?:\/|$)/;
const DATA_LAYER = /(?:^|\/)data(?:\/|$)/;

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[cm]?[jt]s$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

/** « fichier : spécificateur » de chaque import interdit des sources de `root/directory`. */
function offenders(
  directory: string,
  forbidden: (specifier: string) => boolean,
  root: string = appRoot,
): string[] {
  return sourceFiles(join(root, directory)).flatMap((file) =>
    importSpecifiers(readFileSync(file, 'utf8'))
      .filter(forbidden)
      .map((specifier) => `${relative(root, file)} : ${specifier}`),
  );
}

const domainForbidden = (s: string): boolean =>
  FRAMEWORK.test(s) || UI_LAYER.test(s) || DATA_LAYER.test(s);
const dataForbidden = (s: string): boolean => UI_LAYER.test(s);

describe('architecture du front', () => {
  it('repère les imports statiques, de type, de réexport, dynamiques et require', () => {
    const source = [
      "import { ref } from 'vue';",
      "import type { Router } from 'vue-router';",
      "import 'nuxt/app';",
      "export * from '#imports';",
      "export { x } from '../components/base/Button.vue';",
      "const lazy = await import('#app');",
      "const legacy = require('@nuxtjs/i18n');",
      "import {\n  a,\n  b,\n} from './filter.js';",
    ].join('\n');

    expect(importSpecifiers(source)).toEqual(
      expect.arrayContaining([
        'vue',
        'vue-router',
        'nuxt/app',
        '#imports',
        '../components/base/Button.vue',
        '#app',
        '@nuxtjs/i18n',
        './filter.js',
      ]),
    );
    expect(importSpecifiers(source)).toHaveLength(8);
  });

  it('classe Vue, Nuxt et les couches d’interface comme interdits dans le domaine', () => {
    for (const s of ['vue', '@vue/reactivity', 'nuxt/app', '#imports', '#app', '@nuxtjs/i18n']) {
      expect(domainForbidden(s), s).toBe(true);
    }
    for (const s of ['../components/x.js', '~/composables/use-x', './Tile.vue', '../data/cv.js']) {
      expect(domainForbidden(s), s).toBe(true);
    }
    for (const s of ['./filter.js', '../domain/layout.js', '@siteperso/contracts', 'vuex-like']) {
      expect(domainForbidden(s), s).toBe(false);
    }
  });

  it('classe les composants et les pages comme interdits dans la couche de données', () => {
    for (const s of ['~/components/base/Button.vue', '../components/x.js', '../pages/index']) {
      expect(dataForbidden(s), s).toBe(true);
    }
    for (const s of ['@siteperso/contracts', '../domain/filter.js', './api-cv-source.js']) {
      expect(dataForbidden(s), s).toBe(false);
    }
  });

  it('parcourt un dossier récursivement, sources seulement, tests écartés', () => {
    const root = mkdtempSync(join(tmpdir(), 'architecture-'));
    const files: Record<string, string> = {
      'domain/filter.ts': "import { ref } from 'vue';\nimport { a } from './tile.js';",
      'domain/deep/fit.ts': "import { useNuxtApp } from '#app';",
      'domain/filter.spec.ts': "import { mount } from '@vue/test-utils';",
      'domain/notes.md': "import 'vue';",
    };
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }

    expect(offenders('domain', domainForbidden, root).sort()).toEqual([
      'domain/deep/fit.ts : #app',
      'domain/filter.ts : vue',
    ]);
    expect(offenders('absent', domainForbidden, root)).toEqual([]);
  });

  it('app/domain n’importe ni Vue, ni Nuxt, ni #imports, ni les composants, ni les données', () => {
    expect(offenders('domain', domainForbidden)).toEqual([]);
  });

  it('app/data n’importe pas les composants', () => {
    expect(offenders('data', dataForbidden)).toEqual([]);
  });
});
