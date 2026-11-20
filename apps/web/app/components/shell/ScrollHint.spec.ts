import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import ScrollHint from './ScrollHint.vue';

describe('ScrollHint', () => {
  it('n’est pas rendue quand tout le contenu est visible', async () => {
    const wrapper = await mountSuspended(ScrollHint, { route: '/', props: { visible: false } });

    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('est un vrai bouton nommé « Faire défiler vers le bas » quand du contenu reste caché', async () => {
    const wrapper = await mountSuspended(ScrollHint, { route: '/', props: { visible: true } });

    const button = wrapper.get('button');
    expect(button.attributes('type')).toBe('button');
    expect(button.attributes('aria-label')).toBe('Faire défiler vers le bas');
    expect(button.text()).toBe('');
  });

  it('cache la flèche aux lecteurs d’écran : le nom vient du bouton', async () => {
    const wrapper = await mountSuspended(ScrollHint, { route: '/', props: { visible: true } });

    expect(wrapper.get('button svg').attributes('aria-hidden')).toBe('true');
    expect(wrapper.get('button svg').attributes('focusable')).toBe('false');
  });

  it('émet scroll au clic', async () => {
    const wrapper = await mountSuspended(ScrollHint, { route: '/', props: { visible: true } });

    await wrapper.get('button').trigger('click');
    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('scroll')).toEqual([[], []]);
  });

  it('apparaît et disparaît avec `visible`', async () => {
    const wrapper = await mountSuspended(ScrollHint, { route: '/', props: { visible: false } });

    await wrapper.setProps({ visible: true });
    expect(wrapper.find('button').exists()).toBe(true);

    await wrapper.setProps({ visible: false });
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('se nomme en anglais sur la page anglaise', async () => {
    const wrapper = await mountSuspended(ScrollHint, { route: '/en', props: { visible: true } });

    expect(wrapper.get('button').attributes('aria-label')).toBe('Scroll down');
  });
});
