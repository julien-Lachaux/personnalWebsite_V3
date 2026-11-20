import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';

import Accordion from './Accordion.vue';

const slots = {
  header: () => h('h3', 'Senior Software Engineer'),
  intro: () => h('p', { class: 'intro' }, 'Intégration de fonctionnalités d’IA.'),
  default: () => h('ul', [h('li', 'OCR des tickets de caisse')]),
  footer: () => h('div', { class: 'stack' }, 'TypeScript'),
};

describe('Accordion', () => {
  it('range l’en-tête, le bouton, l’introduction, le panneau puis le pied dans cet ordre', async () => {
    const wrapper = await mountSuspended(Accordion, {
      props: { toggleLabel: 'Voir le détail' },
      slots,
    });

    const root = wrapper.get('.accordion').element;
    const order = [...root.children].map((child) => child.className.split(' ')[0]);
    expect(order).toEqual(['accordion__head', 'intro', 'accordion__panel', 'stack']);
    const head = wrapper.get('.accordion__head').element;
    expect([...head.children].map((child) => child.className)).toEqual([
      'accordion__header',
      'accordion__toggle',
    ]);
    expect(wrapper.get('.accordion__header').text()).toBe('Senior Software Engineer');
  });

  it('replié par défaut : aria-expanded false, aria-controls vise le panneau, panneau inert', async () => {
    const wrapper = await mountSuspended(Accordion, {
      props: { toggleLabel: 'Voir le détail' },
      slots,
    });

    const toggle = wrapper.get('button.accordion__toggle');
    const panel = wrapper.get('.accordion__panel');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(toggle.attributes('type')).toBe('button');
    expect(toggle.attributes('aria-controls')).toBe(panel.attributes('id'));
    expect(panel.attributes('id')).toBeTruthy();
    expect(panel.attributes('inert')).toBeDefined();
    expect(panel.classes()).not.toContain('accordion__panel--open');
    expect(wrapper.get('.accordion__chevron').classes()).not.toContain('accordion__chevron--open');
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true');
  });

  it('déplié (modelValue) : aria-expanded true, panneau ouvert et sorti de l’inertie', async () => {
    const wrapper = await mountSuspended(Accordion, {
      props: { toggleLabel: 'Voir le détail', modelValue: true },
      slots,
    });

    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('.accordion__panel').attributes('inert')).toBeUndefined();
    expect(wrapper.get('.accordion__panel').classes()).toContain('accordion__panel--open');
    expect(wrapper.get('.accordion__chevron').classes()).toContain('accordion__chevron--open');
  });

  it('le clic demande le changement par update:modelValue et l’état suit le parent', async () => {
    const wrapper = await mountSuspended(Accordion, {
      props: {
        toggleLabel: 'Voir le détail',
        modelValue: false,
        'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }),
      },
      slots,
    });

    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true]);
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('.accordion__panel').attributes('inert')).toBeUndefined();

    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([false]);
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('.accordion__panel').attributes('inert')).toBeDefined();
  });

  it('sans v-model : garde son propre état', async () => {
    const wrapper = await mountSuspended(Accordion, {
      props: { toggleLabel: 'Voir le détail' },
      slots,
    });

    await wrapper.get('button').trigger('click');
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true');
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false');
  });

  it.each([
    ['fr', 'Voir le détail de Senior Software Engineer'],
    ['en', 'Show the details of Senior Software Engineer'],
  ])(
    'le nom accessible du bouton (%s) est le libellé fourni, quel que soit l’état',
    async (_l, label) => {
      const wrapper = await mountSuspended(Accordion, {
        props: { toggleLabel: label },
        slots,
      });

      expect(wrapper.get('button').attributes('aria-label')).toBe(label);
      await wrapper.get('button').trigger('click');
      expect(wrapper.get('button').attributes('aria-label')).toBe(label);
    },
  );

  it('chaque accordéon d’une même page a son propre identifiant de panneau', async () => {
    const Host = defineComponent({
      render: () =>
        h('div', [
          h(Accordion, { toggleLabel: 'a' }, slots),
          h(Accordion, { toggleLabel: 'b' }, slots),
        ]),
    });
    const wrapper = await mountSuspended(Host);

    const [first, second] = wrapper.findAll('.accordion__panel');
    expect(first?.attributes('id')).toBeTruthy();
    expect(first?.attributes('id')).not.toBe(second?.attributes('id'));
    const [toggleA, toggleB] = wrapper.findAll('.accordion__toggle');
    expect(toggleA?.attributes('aria-controls')).toBe(first?.attributes('id'));
    expect(toggleB?.attributes('aria-controls')).toBe(second?.attributes('id'));
  });

  it('fonctionne sans slots facultatifs', async () => {
    const wrapper = await mountSuspended(Accordion, {
      props: { toggleLabel: 'Voir' },
      slots: { default: () => 'détail' },
    });
    expect(wrapper.get('.accordion__content').text()).toBe('détail');
  });
});
