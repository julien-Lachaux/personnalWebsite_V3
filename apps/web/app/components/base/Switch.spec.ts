import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import Switch from './Switch.vue';

describe('Switch', () => {
  it('rend un button role="switch" aria-checked="false" nommé par son libellé et décrit par sa description', async () => {
    const wrapper = await mountSuspended(Switch, {
      props: {
        label: 'Contraste renforcé',
        description: 'Textes et bordures plus marqués.',
      },
    });

    const control = wrapper.get('button');
    expect(control.attributes('role')).toBe('switch');
    expect(control.attributes('type')).toBe('button');
    expect(control.attributes('aria-checked')).toBe('false');
    const label = wrapper.get('.switch__label');
    const description = wrapper.get('.switch__description');
    expect(label.text()).toBe('Contraste renforcé');
    expect(description.text()).toBe('Textes et bordures plus marqués.');
    expect(control.attributes('aria-labelledby')).toBe(label.attributes('id'));
    expect(control.attributes('aria-describedby')).toBe(description.attributes('id'));
    expect(label.attributes('id')).not.toBe(description.attributes('id'));
  });

  it('sans description : pas de aria-describedby', async () => {
    const wrapper = await mountSuspended(Switch, { props: { label: 'Police plus lisible' } });

    expect(wrapper.find('.switch__description').exists()).toBe(false);
    expect(wrapper.get('button').attributes('aria-describedby')).toBeUndefined();
  });

  it('aria-checked suit le modèle', async () => {
    const wrapper = await mountSuspended(Switch, {
      props: { label: 'Souligner les liens', modelValue: true },
    });
    expect(wrapper.get('button').attributes('aria-checked')).toBe('true');
  });

  it('le clic bascule : update:modelValue puis aria-checked suit le parent', async () => {
    const wrapper = await mountSuspended(Switch, {
      props: {
        label: 'Réduire les animations',
        modelValue: false,
        'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }),
      },
    });

    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true]);
    expect(wrapper.get('button').attributes('aria-checked')).toBe('true');

    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([false]);
    expect(wrapper.get('button').attributes('aria-checked')).toBe('false');
  });

  it('sans v-model : garde son propre état', async () => {
    const wrapper = await mountSuspended(Switch, { props: { label: 'Espacement du texte' } });

    await wrapper.get('button').trigger('click');
    expect(wrapper.get('button').attributes('aria-checked')).toBe('true');
  });

  it('la piste et la pastille sont décoratives', async () => {
    const wrapper = await mountSuspended(Switch, { props: { label: 'Souligner les liens' } });
    expect(wrapper.get('.switch__track').attributes('aria-hidden')).toBe('true');
  });

  it.each([
    ['fr', 'Réduire les animations'],
    ['en', 'Reduce animations'],
  ])('affiche le libellé fourni (%s)', async (_language, label) => {
    const wrapper = await mountSuspended(Switch, { props: { label } });
    expect(wrapper.get('button').text()).toBe(label);
  });
});
