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

import { useCvLink, type CvLinkView } from './useCvLink.js';

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

async function linkAt(route: string, href: () => string): Promise<ComputedRef<CvLinkView>> {
  let link!: ComputedRef<CvLinkView>;
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

  it('sans CV anglais, la page anglaise mène au CV français, en le disant', async () => {
    publicConfig().cvFiles = ['cv-fr.pdf'];

    const link = await linkAt('/en', () => '/cv/cv-en.pdf');

    expect(link.value).toEqual({ href: '/cv/cv-fr.pdf', hreflang: 'fr', mention: '(in French)' });
  });

  it('avec le CV anglais, la page anglaise y mène, sans mention', async () => {
    publicConfig().cvFiles = ['cv-en.pdf', 'cv-fr.pdf'];

    const link = await linkAt('/en', () => '/cv/cv-en.pdf');

    expect(link.value).toEqual({ href: '/cv/cv-en.pdf', hreflang: undefined, mention: undefined });
  });

  it('la page française garde le CV français, sans mention', async () => {
    publicConfig().cvFiles = ['cv-fr.pdf'];

    const link = await linkAt('/', () => '/cv/cv-fr.pdf');

    expect(link.value).toEqual({ href: '/cv/cv-fr.pdf', hreflang: undefined, mention: undefined });
  });

  it('suit l’adresse reçue quand elle change', async () => {
    publicConfig().cvFiles = ['cv-fr.pdf'];
    const href = ref('/cv/exemple.pdf');

    const link = await linkAt('/en', () => href.value);
    expect(link.value.href).toBe('/cv/exemple.pdf');

    href.value = '/cv/cv-en.pdf';
    expect(link.value).toEqual({ href: '/cv/cv-fr.pdf', hreflang: 'fr', mention: '(in French)' });
  });
});
