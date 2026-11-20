import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import TechChip from './TechChip.vue';

describe('TechChip', () => {
  it('rend un <button type="button"> sans aria-pressed ni aria-disabled par défaut (simple déclencheur)', async () => {
    const wrapper = await mountSuspended(TechChip, { slots: { default: () => 'Huile de coude' } });

    const chip = wrapper.get('button');
    expect(chip.text()).toBe('Huile de coude');
    expect(chip.attributes('type')).toBe('button');
    expect(chip.attributes('aria-pressed')).toBeUndefined();
    expect(chip.attributes('aria-disabled')).toBeUndefined();
    expect(chip.classes()).toContain('tech-chip--sm');
    expect(chip.classes()).not.toContain('tech-chip--pressed');
  });

  it('émet click au clic, avec l’événement', async () => {
    const wrapper = await mountSuspended(TechChip, { slots: { default: () => 'Kafka' } });

    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('click')).toHaveLength(1);
    expect(wrapper.emitted<[MouseEvent]>('click')?.[0]?.[0]).toBeInstanceOf(MouseEvent);
  });

  it('pressed : aria-pressed vaut true quand le filtre est actif, false sinon, et la puce est néon seulement actif', async () => {
    const active = await mountSuspended(TechChip, {
      props: { pressed: true },
      slots: { default: () => 'TypeScript' },
    });
    expect(active.get('button').attributes('aria-pressed')).toBe('true');
    expect(active.get('button').classes()).toContain('tech-chip--pressed');

    const inactive = await mountSuspended(TechChip, {
      props: { pressed: false },
      slots: { default: () => 'TypeScript' },
    });
    expect(inactive.get('button').attributes('aria-pressed')).toBe('false');
    expect(inactive.get('button').classes()).not.toContain('tech-chip--pressed');
  });

  it('affiche le compteur dans un conteneur propre, et pas de compteur sans valeur (0 est une valeur)', async () => {
    const withCount = await mountSuspended(TechChip, {
      props: { count: 2 },
      slots: { default: () => 'TypeScript' },
    });
    expect(withCount.get('.tech-chip__count').text()).toBe('2');

    const zero = await mountSuspended(TechChip, {
      props: { count: 0 },
      slots: { default: () => 'MySQL' },
    });
    expect(zero.get('.tech-chip__count').text()).toBe('0');

    const none = await mountSuspended(TechChip, { slots: { default: () => 'Docker' } });
    expect(none.find('.tech-chip__count').exists()).toBe(false);
  });

  it('applique la taille md du filtre', async () => {
    const wrapper = await mountSuspended(TechChip, {
      props: { size: 'md' },
      slots: { default: () => 'NestJS' },
    });
    expect(wrapper.get('button').classes()).toContain('tech-chip--md');
  });

  it('désactivé : aria-disabled, aucun événement click, le focus reste sur la puce', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const wrapper = await mountSuspended(TechChip, {
      props: { disabled: true, pressed: false },
      slots: { default: () => 'MySQL' },
      attachTo: host,
    });
    const chip = wrapper.get('button');

    chip.element.focus();
    await chip.trigger('click');

    expect(chip.attributes('aria-disabled')).toBe('true');
    expect(chip.attributes('disabled')).toBeUndefined();
    expect(wrapper.emitted('click')).toBeUndefined();
    expect(document.activeElement).toBe(chip.element);
    wrapper.unmount();
    host.remove();
  });

  it('désactivé : le clic est annulé', async () => {
    const wrapper = await mountSuspended(TechChip, {
      props: { disabled: true },
      slots: { default: () => 'MySQL' },
    });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    wrapper.get('button').element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('actif : le clic n’est pas annulé', async () => {
    const wrapper = await mountSuspended(TechChip, { slots: { default: () => 'Redis' } });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    wrapper.get('button').element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('pointillé : étiquette non cliquable sans rôle de bouton, sans aria-pressed', async () => {
    const wrapper = await mountSuspended(TechChip, {
      props: { dashed: true, pressed: true, count: 0 },
      slots: { default: () => 'RabbitMQ' },
    });

    expect(wrapper.find('button').exists()).toBe(false);
    const chip = wrapper.get('span.tech-chip');
    expect(chip.classes()).toContain('tech-chip--dashed');
    expect(chip.attributes('role')).toBeUndefined();
    expect(chip.attributes('aria-pressed')).toBeUndefined();
    expect(chip.attributes('tabindex')).toBeUndefined();
    expect(chip.text()).toBe('RabbitMQ0');
    expect(chip.get('.tech-chip__count').text()).toBe('0');
  });

  it('pointillé sans compteur : pas de conteneur de compteur', async () => {
    const wrapper = await mountSuspended(TechChip, {
      props: { dashed: true },
      slots: { default: () => 'RabbitMQ' },
    });
    expect(wrapper.find('.tech-chip__count').exists()).toBe(false);
  });

  it('transmet le nom accessible complet (aria-label) à la racine', async () => {
    const button = await mountSuspended(TechChip, {
      props: { count: 2 },
      attrs: { 'aria-label': 'TypeScript, 2 expériences' },
      slots: { default: () => 'TypeScript' },
    });
    expect(button.get('button').attributes('aria-label')).toBe('TypeScript, 2 expériences');
  });
});
