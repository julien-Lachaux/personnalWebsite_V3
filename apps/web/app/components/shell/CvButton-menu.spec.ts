import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { useRuntimeConfig } from '#imports';

import CvButton from './CvButton.vue';

// Comportement clavier du menu du CV (D44) : ouverture, Échap, sortie du focus.
let original: string[] = [];
const mounted: VueWrapper[] = [];
const hosts: HTMLElement[] = [];

async function mountMenu(): Promise<VueWrapper> {
  const host = document.createElement('div');
  document.body.append(host);
  hosts.push(host);
  const wrapper = await mountSuspended(CvButton, {
    route: '/',
    props: { href: '/cv/cv-fr.pdf' },
    attachTo: host,
  });
  mounted.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  original = useRuntimeConfig().public.cvFiles;
  useRuntimeConfig().public.cvFiles = ['cv-fr.pdf'];
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const host of hosts.splice(0)) host.remove();
  useRuntimeConfig().public.cvFiles = original;
});

describe('CvButton, menu au clavier (D44)', () => {
  it('le bouton ouvre puis referme la liste, et le dit par aria-expanded', async () => {
    const wrapper = await mountMenu();
    const trigger = wrapper.get('button');

    await trigger.trigger('click');
    expect(trigger.attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('ul').attributes()).not.toHaveProperty('hidden');

    await trigger.trigger('click');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('ul').attributes()).toHaveProperty('hidden');
  });

  it('Échap ferme la liste et rend le focus au bouton', async () => {
    const wrapper = await mountMenu();
    await wrapper.get('button').trigger('click');
    const link = wrapper.get('li a[href]');
    (link.element as HTMLElement).focus();

    await link.trigger('keydown', { key: 'Escape' });
    await nextTick();

    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(wrapper.get('button').element);
  });

  it('Échap sur le menu fermé ne fait rien : le focus n’est pas déplacé', async () => {
    const wrapper = await mountMenu();
    const outside = document.createElement('button');
    document.body.append(outside);
    hosts.push(outside);
    outside.focus();

    await wrapper.get('button').trigger('keydown', { key: 'Escape' });
    await nextTick();

    expect(document.activeElement).toBe(outside);
  });

  it('une autre touche ne ferme pas la liste', async () => {
    const wrapper = await mountMenu();
    await wrapper.get('button').trigger('click');

    await wrapper.get('button').trigger('keydown', { key: 'a' });

    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true');
  });

  it('le focus qui sort du menu le ferme, sans reprendre le focus', async () => {
    const wrapper = await mountMenu();
    const outside = document.createElement('button');
    document.body.append(outside);
    hosts.push(outside);
    await wrapper.get('button').trigger('click');
    (wrapper.get('li a[href]').element as HTMLElement).focus();

    outside.focus();
    await nextTick();

    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(outside);
  });

  it('le focus qui passe du bouton à une entrée garde le menu ouvert', async () => {
    const wrapper = await mountMenu();
    await wrapper.get('button').trigger('click');
    (wrapper.get('button').element as HTMLElement).focus();

    (wrapper.get('li a[href]').element as HTMLElement).focus();
    await nextTick();

    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true');
  });

  it('le focus qui quitte la page (cible nulle) laisse le menu ouvert', async () => {
    const wrapper = await mountMenu();
    await wrapper.get('button').trigger('click');

    wrapper
      .get('.cv-menu')
      .element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await nextTick();

    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true');
  });

  it('un focus sortant alors que le menu est fermé ne change rien', async () => {
    const wrapper = await mountMenu();
    const outside = document.createElement('button');
    document.body.append(outside);
    hosts.push(outside);
    (wrapper.get('button').element as HTMLElement).focus();

    outside.focus();
    await nextTick();

    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false');
  });
});
