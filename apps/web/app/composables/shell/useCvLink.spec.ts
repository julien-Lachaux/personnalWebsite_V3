/// <reference types="node" />
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  defineComponent,
  h,
  nextTick,
  ref,
  type ComputedRef,
  type PropType,
  type VNode,
} from 'vue';
import { useRuntimeConfig } from '#imports';

import { useCvLink, type CvEntryView } from './useCvLink.js';

const mounted: VueWrapper[] = [];

type Run = () => (() => VNode) | void;

/** Composant d'essai : exécute `run` dans `setup` (un seul composant défini dans ce fichier). */
const Probe = defineComponent({
  props: { run: { type: Function as PropType<Run>, required: true } },
  setup: (props) => props.run() ?? (() => h('div')),
});

/** Configuration publique de l'application de test, modifiable le temps d'un test. */
function publicConfig(): { cvFiles: string[] } {
  return useRuntimeConfig().public;
}

let original: string[] = [];

async function linkAt(
  route: string,
  href: () => string,
): Promise<ComputedRef<readonly CvEntryView[]>> {
  let link!: ComputedRef<readonly CvEntryView[]>;
  mounted.push(
    await mountSuspended(Probe, {
      route,
      props: {
        run: () => {
          link = useCvLink(href);
        },
      },
    }),
  );
  await nextTick();
  return link;
}

beforeEach(() => {
  original = publicConfig().cvFiles;
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  publicConfig().cvFiles = original;
});

describe('useCvLink', () => {
  it('relève au build les CV PDF présents dans public/cv/', () => {
    const present = readdirSync(join(import.meta.dirname, '../../../public/cv'))
      .filter((name) => name.endsWith('.pdf'))
      .sort();

    expect(present).toContain('cv-fr.pdf');
    expect(publicConfig().cvFiles).toEqual(present);
  });

  it('sans CV anglais, la page anglaise garde l’entrée anglaise, inactive et annoncée', async () => {
    publicConfig().cvFiles = ['cv-fr.pdf'];

    const link = await linkAt('/en', () => '/cv/cv-en.pdf');

    expect(link.value).toEqual([
      { language: 'fr', label: 'French version', href: '/cv/cv-fr.pdf', soon: undefined },
      { language: 'en', label: 'English version', href: undefined, soon: '(coming soon)' },
    ]);
  });

  it('avec les deux CV, les deux entrées mènent à leur fichier, sans mention', async () => {
    publicConfig().cvFiles = ['cv-en.pdf', 'cv-fr.pdf'];

    const link = await linkAt('/en', () => '/cv/cv-en.pdf');

    expect(link.value).toEqual([
      { language: 'fr', label: 'French version', href: '/cv/cv-fr.pdf', soon: undefined },
      { language: 'en', label: 'English version', href: '/cv/cv-en.pdf', soon: undefined },
    ]);
  });

  it('la page française traduit les libellés et la mention', async () => {
    publicConfig().cvFiles = ['cv-fr.pdf'];

    const link = await linkAt('/', () => '/cv/cv-fr.pdf');

    expect(link.value).toEqual([
      { language: 'fr', label: 'Version française', href: '/cv/cv-fr.pdf', soon: undefined },
      { language: 'en', label: 'Version anglaise', href: undefined, soon: '(bientôt)' },
    ]);
  });

  it('suit l’adresse reçue quand elle change', async () => {
    publicConfig().cvFiles = ['cv-fr.pdf'];
    const href = ref('/cv/cv-fr.pdf');

    const link = await linkAt('/', () => href.value);
    expect(link.value[0]?.href).toBe('/cv/cv-fr.pdf');

    href.value = '/autre/cv-fr.pdf';
    expect(link.value[0]?.href).toBe('/autre/cv-fr.pdf');
  });
});
