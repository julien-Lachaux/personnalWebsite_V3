import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import type { FilterTech } from '../../domain/filter.js';
import ChipInput from './ChipInput.vue';

const typescript: FilterTech = {
  slug: 'typescript',
  name: 'TypeScript',
  groupSlug: 'languages',
  mainStackOrder: 1,
};
const docker: FilterTech = {
  slug: 'docker',
  name: 'Docker',
  groupSlug: 'devops',
  mainStackOrder: 7,
};

const mounted: VueWrapper[] = [];

async function mountInput(props: Record<string, unknown> = {}, route = '/'): Promise<VueWrapper> {
  const wrapper = await mountSuspended(ChipInput, {
    route,
    attachTo: document.body,
    props: {
      labelledby: 'label',
      chips: [],
      placeholder: 'Ex. Kafka',
      controls: 'drawer',
      ...props,
    },
  });
  mounted.push(wrapper);
  return wrapper;
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

describe('ChipInput', () => {
  it('est un vrai champ nommé par le libellé visible, qui pilote le panneau', async () => {
    const wrapper = await mountInput();

    const input = wrapper.get('input');
    expect(input.attributes('type')).toBe('text');
    expect(input.attributes('aria-labelledby')).toBe('label');
    expect(input.attributes('aria-controls')).toBe('drawer');
    expect(input.attributes('placeholder')).toBe('Ex. Kafka');
    expect(input.attributes('autocomplete')).toBe('off');
  });

  it('montre chaque techno choisie en puce nommée « Retirer le filtre X », sans « Effacer » quand il n’y en a pas', async () => {
    const empty = await mountInput();
    expect(empty.findAll('.chip-input__chip')).toHaveLength(0);
    expect(empty.text()).not.toContain('Effacer');

    const wrapper = await mountInput({ chips: [typescript, docker] });
    const chips = wrapper.findAll('.chip-input__chip');
    expect(chips.map((chip) => chip.text())).toEqual(['TypeScript', 'Docker']);
    expect(chips.map((chip) => chip.attributes('aria-label'))).toEqual([
      'Retirer le filtre TypeScript',
      'Retirer le filtre Docker',
    ]);
  });

  it('retire une puce au clic', async () => {
    const wrapper = await mountInput({ chips: [typescript, docker] });

    await wrapper.findAll('.chip-input__chip')[1]!.trigger('click');

    expect(wrapper.emitted('remove')).toEqual([['docker']]);
  });

  it('propose « Effacer » (nom complet « Effacer tous les filtres ») dès qu’il y a un filtre', async () => {
    const wrapper = await mountInput({ chips: [typescript] });

    const clear = wrapper.get('.base-button');
    expect(clear.text()).toBe('Effacer');
    expect(clear.attributes('aria-label')).toBe('Effacer tous les filtres');
    await clear.trigger('click');

    expect(wrapper.emitted('clear')).toHaveLength(1);
  });

  it('relie la saisie à v-model:query', async () => {
    const wrapper = await mountInput({ query: 'kaf' });
    const input = wrapper.get('input');
    expect(input.element.value).toBe('kaf');

    await input.setValue('kafka');

    expect(wrapper.emitted('update:query')).toEqual([['kafka']]);
  });

  it('Entrée demande de choisir la première suggestion, sans soumettre de formulaire', async () => {
    const wrapper = await mountInput();
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });

    wrapper.get('input').element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it('Retour arrière sur un champ vide retire la dernière puce', async () => {
    const wrapper = await mountInput({ chips: [typescript] });

    await wrapper.get('input').trigger('keydown', { key: 'Backspace' });

    expect(wrapper.emitted('backspace-empty')).toHaveLength(1);
  });

  it('Retour arrière n’agit pas quand le champ contient du texte ni quand il n’y a aucune puce', async () => {
    const withText = await mountInput({ chips: [typescript], query: 'ka' });
    await withText.get('input').trigger('keydown', { key: 'Backspace' });
    expect(withText.emitted('backspace-empty')).toBeUndefined();

    const noChip = await mountInput();
    await noChip.get('input').trigger('keydown', { key: 'Backspace' });
    expect(noChip.emitted('backspace-empty')).toBeUndefined();
  });

  it('ignore les autres touches', async () => {
    const wrapper = await mountInput({ chips: [typescript] });

    await wrapper.get('input').trigger('keydown', { key: 'a' });
    await wrapper.get('input').trigger('keydown', { key: 'Escape' });

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.emitted('backspace-empty')).toBeUndefined();
  });

  it('demande l’ouverture du panneau au focus et au clic', async () => {
    const wrapper = await mountInput();
    const input = wrapper.get('input');

    input.element.focus();
    expect(wrapper.emitted('open')).toHaveLength(1);

    await input.trigger('click');
    expect(wrapper.emitted('open')).toHaveLength(2);
  });

  it('redonne le focus sans demander l’ouverture (focus programmatique), puis la redemande au focus suivant', async () => {
    const wrapper = await mountInput();
    const input = wrapper.get('input').element;

    (wrapper.vm as unknown as { focusQuietly: () => void }).focusQuietly();
    expect(document.activeElement).toBe(input);
    expect(wrapper.emitted('open')).toBeUndefined();

    input.blur();
    input.focus();
    expect(wrapper.emitted('open')).toHaveLength(1);
  });

  it('cache ses icônes aux lecteurs d’écran (elles sont décoratives)', async () => {
    const wrapper = await mountInput({ chips: [typescript] });

    expect(wrapper.findAll('svg')).toHaveLength(2);
    for (const icon of wrapper.findAll('svg')) {
      expect(icon.attributes('aria-hidden')).toBe('true');
    }
  });

  it('parle anglais sur la page anglaise', async () => {
    const wrapper = await mountInput({ chips: [typescript] }, '/en');

    expect(wrapper.get('.chip-input__chip').attributes('aria-label')).toBe(
      'Remove filter TypeScript',
    );
    expect(wrapper.get('.base-button').text()).toBe('Clear');
    expect(wrapper.get('.base-button').attributes('aria-label')).toBe('Clear all filters');
  });
});
