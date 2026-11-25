import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';

import SegmentedControl from './SegmentedControl.vue';

const options = [
  { value: '100', label: 'A', ariaLabel: 'Taille de texte normale' },
  { value: '115', label: 'A', ariaLabel: 'Grande taille de texte' },
  { value: '130', label: 'A', ariaLabel: 'Très grande taille de texte' },
] as const;

describe('SegmentedControl', () => {
  it('rend un groupe nommé de vrais boutons, un seul aria-pressed à true', async () => {
    const wrapper = await mountSuspended(SegmentedControl, {
      props: { options, modelValue: '115', label: 'Taille du texte' },
    });

    const group = wrapper.get('[role="group"]');
    expect(group.attributes('aria-label')).toBe('Taille du texte');
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(3);
    for (const button of buttons) expect(button.attributes('type')).toBe('button');
    expect(buttons.map((button) => button.attributes('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(buttons.map((button) => button.attributes('aria-label'))).toEqual(
      options.map((option) => option.ariaLabel),
    );
  });

  it('sans nom de groupe fourni, n’invente pas aria-label (un aria-labelledby extérieur peut le porter)', async () => {
    const wrapper = await mountSuspended(SegmentedControl, {
      props: { options, modelValue: '100' },
      attrs: { 'aria-labelledby': 'taille-du-texte' },
    });

    const group = wrapper.get('[role="group"]');
    expect(group.attributes('aria-label')).toBeUndefined();
    expect(group.attributes('aria-labelledby')).toBe('taille-du-texte');
  });

  it('le clic choisit l’option : update:modelValue puis un seul bouton enfoncé', async () => {
    const wrapper = await mountSuspended(SegmentedControl, {
      props: {
        options,
        modelValue: '100',
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
    });

    await wrapper.findAll('button')[2]?.trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['130']);
    expect(wrapper.findAll('button').map((button) => button.attributes('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ]);
  });

  it('cliquer l’option déjà choisie la garde choisie (choix exclusif)', async () => {
    const wrapper = await mountSuspended(SegmentedControl, {
      props: { options, modelValue: '100' },
    });

    await wrapper.findAll('button')[0]?.trigger('click');

    expect(wrapper.findAll('button')[0]?.attributes('aria-pressed')).toBe('true');
  });

  it('affiche le libellé visible de chaque option, ou le slot option (avec option et état)', async () => {
    const plain = await mountSuspended(SegmentedControl, {
      props: {
        options: [
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ],
        modelValue: 'a',
      },
    });
    expect(plain.findAll('button').map((button) => button.text())).toEqual(['Alpha', 'Beta']);
    expect(plain.get('button').attributes('aria-label')).toBeUndefined();

    const custom = await mountSuspended(SegmentedControl, {
      props: { options, modelValue: '115' },
      slots: {
        option: ({ option, pressed }: { option: { value: string }; pressed: boolean }) =>
          h('b', `${option.value}:${String(pressed)}`),
      },
    });
    expect(custom.findAll('button').map((button) => button.text())).toEqual([
      '100:false',
      '115:true',
      '130:false',
    ]);
  });
});
