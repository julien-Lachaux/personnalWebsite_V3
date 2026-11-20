import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, type PropType } from 'vue';
import { useRoute, useRouter } from '#imports';

import { useTechFilter } from './useTechFilter.js';

const KNOWN = ['kafka', 'typescript', 'docker', 'php'];

interface Probe {
  selected: readonly string[];
  set: (next: readonly string[]) => void;
  /** Valeur lue à chaque rendu : la première est celle du rendu statique. */
  renders: string[];
}

const mounted: VueWrapper[] = [];

/** Composant d'essai : expose la sélection et l'historique de ses rendus. */
async function mountProbe(
  route: string,
  known: readonly string[] = KNOWN,
): Promise<{ wrapper: VueWrapper; probe: Probe }> {
  const renders: string[] = [];
  const holder: { state?: ReturnType<typeof useTechFilter> } = {};
  const ProbeComponent = defineComponent({
    props: { known: { type: Array as PropType<readonly string[]>, required: true } },
    setup(props) {
      holder.state = useTechFilter(() => props.known);
      return () => {
        renders.push(holder.state!.selected.value.join(','));
        return h('p', holder.state!.selected.value.join(','));
      };
    },
  });
  const wrapper = await mountSuspended(ProbeComponent, { route, props: { known } });
  mounted.push(wrapper);
  const probe: Probe = {
    get selected() {
      return holder.state!.selected.value;
    },
    set: (next) => {
      holder.state!.selected.value = next;
    },
    renders,
  };
  return { wrapper, probe };
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

describe('useTechFilter', () => {
  it('commence sans filtre quand l’URL n’a pas de paramètre', async () => {
    const { probe } = await mountProbe('/');

    expect(probe.selected).toEqual([]);
  });

  it('lit ?tech= au chargement, dans l’ordre, en ignorant inconnus et doublons', async () => {
    const { probe } = await mountProbe('/?tech=typescript,inconnu,kafka,typescript');

    expect(probe.selected).toEqual(['typescript', 'kafka']);
  });

  it('lit aussi un paramètre répété', async () => {
    const { probe } = await mountProbe('/?tech=docker&tech=php');

    expect(probe.selected).toEqual(['docker', 'php']);
  });

  it('ne lit l’URL qu’après le montage : le premier rendu est celui de la page statique', async () => {
    const { probe, wrapper } = await mountProbe('/?tech=kafka');
    await nextTick();

    expect(probe.renders[0]).toBe('');
    expect(probe.renders.at(-1)).toBe('kafka');
    expect(wrapper.text()).toBe('kafka');
  });

  it('écrit ?tech= dans l’URL sans recharger la page', async () => {
    const { probe } = await mountProbe('/');
    const router = useRouter();

    probe.set(['kafka', 'docker']);

    expect(probe.selected).toEqual(['kafka', 'docker']);
    await vi.waitFor(() => expect(router.currentRoute.value.query['tech']).toBe('kafka,docker'));
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('retire le paramètre quand le filtre est vide', async () => {
    const { probe } = await mountProbe('/?tech=kafka');

    probe.set([]);

    await vi.waitFor(() => expect(useRoute().query).toEqual({}));
    expect(probe.selected).toEqual([]);
  });

  it('conserve les autres paramètres et l’ancre', async () => {
    const { probe } = await mountProbe('/?utm=a&tech=kafka#contenu');

    probe.set(['docker']);

    await vi.waitFor(() => expect(useRoute().query).toEqual({ utm: 'a', tech: 'docker' }));
    expect(useRoute().hash).toBe('#contenu');
  });

  it('remplace l’entrée d’historique (une puce n’est pas une page)', async () => {
    const { probe } = await mountProbe('/');
    const before = window.history.length;

    probe.set(['kafka']);
    await vi.waitFor(() => expect(useRoute().query['tech']).toBe('kafka'));
    probe.set(['kafka', 'docker']);
    await vi.waitFor(() => expect(useRoute().query['tech']).toBe('kafka,docker'));

    expect(window.history.length).toBe(before);
  });

  it('suit l’URL quand elle change ailleurs (retour du navigateur, lien collé)', async () => {
    const { probe } = await mountProbe('/?tech=kafka');

    await useRouter().push({ query: { tech: 'php,typescript' } });
    await nextTick();

    expect(probe.selected).toEqual(['php', 'typescript']);

    await useRouter().push({ query: {} });
    await nextTick();
    expect(probe.selected).toEqual([]);
  });

  it('ne perd pas un choix récent quand l’URL le rattrape (deux changements rapprochés)', async () => {
    const { probe } = await mountProbe('/');

    probe.set(['kafka']);
    probe.set(['kafka', 'docker']);
    await vi.waitFor(() => expect(useRoute().query['tech']).toBe('kafka,docker'));
    await nextTick();

    expect(probe.selected).toEqual(['kafka', 'docker']);
  });

  it('suit les technos connues quand elles changent', async () => {
    const { wrapper } = await mountProbe('/?tech=kafka,php', ['kafka']);
    expect(wrapper.text()).toBe('kafka');

    await wrapper.setProps({ known: ['kafka', 'php'] });

    expect(wrapper.text()).toBe('kafka,php');
  });
});
