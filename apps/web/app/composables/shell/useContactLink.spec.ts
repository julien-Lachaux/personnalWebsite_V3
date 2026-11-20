import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, type ComputedRef, type PropType, type VNode } from 'vue';
import { useRuntimeConfig } from '#imports';

import { mailtoHref, useContactLink } from './useContactLink.js';

// Adresse de test : un placeholder, jamais une vraie adresse (SPEC § 11).
const PLACEHOLDER = 'contact@example.org';

describe('mailtoHref', () => {
  it('construit un mailto: avec le sujet encodé', () => {
    expect(mailtoHref(PLACEHOLDER, 'Bonjour')).toBe('mailto:contact@example.org?subject=Bonjour');
    expect(mailtoHref(PLACEHOLDER, 'Prise de contact : été & co ?')).toBe(
      'mailto:contact@example.org?subject=Prise%20de%20contact%20%3A%20%C3%A9t%C3%A9%20%26%20co%20%3F',
    );
  });

  it('accepte les formes courantes d’adresse', () => {
    for (const address of [
      'a@b.fr',
      'prenom.nom+site@sous.domaine.example.org',
      'x_y-z@exemple-test.io',
      '123@456.example',
    ]) {
      expect(mailtoHref(address, 's'), address).toBe(`mailto:${address}?subject=s`);
    }
  });

  it('ignore les espaces autour de l’adresse', () => {
    expect(mailtoHref(`  ${PLACEHOLDER}\n`, 's')).toBe('mailto:contact@example.org?subject=s');
  });

  it('refuse une adresse absente', () => {
    expect(mailtoHref('', 's')).toBeNull();
    expect(mailtoHref('   ', 's')).toBeNull();
  });

  it('refuse ce qui n’a pas la forme d’une adresse', () => {
    for (const address of [
      'sans-arobase.example.org',
      'a@b',
      'a@@b.org',
      '@b.org',
      'a@.org',
      'a@b.o',
      'a b@c.org',
      'a@b..org',
    ]) {
      expect(mailtoHref(address, 's'), address).toBeNull();
    }
  });

  it('refuse une adresse qui ouvrirait un paramètre ou un second destinataire du mailto:', () => {
    for (const address of [
      'a@b.org?bcc=x@y.org',
      'a@b.org&bcc=x@y.org',
      'a@b.org,c@d.org',
      'a@b.org;c@d.org',
      'a@b.org#fragment',
      'a%40b@c.org',
      'a@b.org<script>',
      'mailto:a@b.org',
      'a@b.org\nbcc: x@y.org',
    ]) {
      expect(mailtoHref(address, 's'), address).toBeNull();
    }
  });
});

const mounted: VueWrapper[] = [];

type Run = () => (() => VNode) | void;

/** Composant d'essai : exécute `run` dans `setup` (un seul composant défini dans ce fichier). */
const Probe = defineComponent({
  props: { run: { type: Function as PropType<Run>, required: true } },
  setup: (props) => props.run() ?? (() => h('div')),
});
let original = '';

/** Configuration publique de l'application de test, modifiable le temps d'un test. */
function publicConfig(): { contactEmail: string } {
  return useRuntimeConfig().public;
}

async function linkAt(route: string): Promise<ComputedRef<string | null>> {
  let link!: ComputedRef<string | null>;
  mounted.push(
    await mountSuspended(Probe, {
      route,
      props: {
        run: () => {
          link = useContactLink();
        },
      },
    }),
  );
  await nextTick();
  return link;
}

beforeEach(() => {
  original = publicConfig().contactEmail;
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  publicConfig().contactEmail = original;
});

describe('useContactLink', () => {
  it('lit l’adresse dans la configuration publique, sujet en français', async () => {
    publicConfig().contactEmail = PLACEHOLDER;

    const link = await linkAt('/');

    expect(link.value).toBe(
      `mailto:${PLACEHOLDER}?subject=${encodeURIComponent('Prise de contact depuis votre site')}`,
    );
  });

  it('prend le sujet dans la langue de la page', async () => {
    publicConfig().contactEmail = PLACEHOLDER;

    const link = await linkAt('/en');

    expect(link.value).toBe(
      `mailto:${PLACEHOLDER}?subject=${encodeURIComponent('Getting in touch from your website')}`,
    );
  });

  it('rend null tant que l’adresse n’est pas configurée', async () => {
    publicConfig().contactEmail = '';

    const link = await linkAt('/');

    expect(link.value).toBeNull();
  });
});
