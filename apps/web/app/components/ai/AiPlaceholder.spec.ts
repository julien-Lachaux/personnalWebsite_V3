import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import AiPlaceholder from './AiPlaceholder.vue';

describe('AiPlaceholder', () => {
  it('affiche seulement le mot « placeholder » en français, en texte lisible', async () => {
    const wrapper = await mountSuspended(AiPlaceholder);

    const lines = wrapper.findAll('.ai-placeholder__line');
    expect(lines.map((line) => line.text().replace(/\s+/g, ' '))).toEqual(['placeholder']);
  });

  it('affiche le même mot en anglais sur la page anglaise', async () => {
    const wrapper = await mountSuspended(AiPlaceholder, { route: '/en' });

    const lines = wrapper.findAll('.ai-placeholder__line');
    expect(lines.map((line) => line.text().replace(/\s+/g, ' '))).toEqual(['placeholder']);
  });

  it('cache aux lecteurs d’écran le curseur et le picto, qui sont décoratifs', async () => {
    const wrapper = await mountSuspended(AiPlaceholder);

    const hidden = wrapper.findAll('[aria-hidden="true"]');
    expect(hidden.map((element) => element.element.tagName.toLowerCase()).sort()).toEqual([
      'span',
      'svg',
    ]);
    expect(wrapper.get('.ai-placeholder__cursor').attributes('aria-hidden')).toBe('true');
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true');
    expect(wrapper.get('svg').attributes('focusable')).toBe('false');
  });

  it('n’est pas interactif et n’a ni titre, ni paragraphe, ni nom accessible à lui', async () => {
    const wrapper = await mountSuspended(AiPlaceholder);

    expect(wrapper.findAll('button, a, input, [tabindex], p, h1, h2, h3, h4')).toHaveLength(0);
    expect(wrapper.find('[role], [aria-label]').exists()).toBe(false);
  });
});
