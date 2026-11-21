import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import EasterEggWindow from './EasterEggWindow.vue';

const mounted: VueWrapper[] = [];
const hosts: HTMLElement[] = [];

async function mountEgg(
  options: { open?: boolean; route?: string; returnFocusTo?: HTMLElement } = {},
): Promise<VueWrapper> {
  const host = document.createElement('div');
  document.body.append(host);
  hosts.push(host);
  const wrapper: VueWrapper = await mountSuspended(EasterEggWindow, {
    route: options.route ?? '/',
    attachTo: host,
    props: {
      open: options.open ?? true,
      returnFocusTo: options.returnFocusTo,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
    },
  });
  mounted.push(wrapper);
  await nextTick();
  return wrapper;
}

function dialog(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[role="dialog"]');
}

function lines(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>('.egg__line')];
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const host of hosts.splice(0)) host.remove();
});

describe('EasterEggWindow', () => {
  it('ne rend rien tant qu’elle est fermée', async () => {
    await mountEgg({ open: false });

    expect(dialog()).toBeNull();
  });

  it('est une fenêtre modale au nom accessible explicite, titrée huile-de-coude.sh', async () => {
    await mountEgg();

    const window = dialog()!;
    expect(window.getAttribute('aria-modal')).toBe('true');
    expect(window.getAttribute('aria-label')).toBe('Huile de coude');
    expect(window.getAttribute('aria-labelledby')).toBeNull();
    expect(window.querySelector('.window__title')!.textContent).toBe('huile-de-coude.sh');
    expect(window.classList.contains('window--neon')).toBe(true);
  });

  it('affiche les lignes du terminal dans l’ordre, textes de la maquette', async () => {
    await mountEgg();

    expect(lines().map((line) => line.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      '$ npm install huile-de-coude',
      '1 paquet ajouté, 0 dépendance, en 21 mois',
      '[ok] muscles',
      '[ok] patience',
      '[ok] tests en conditions réelles',
      'build projet-immobilier',
      'Terminé. 0 vulnérabilité (sauf le dos).',
    ]);
  });

  it('échelonne les lignes (délais de la maquette) et lance la barre après sa ligne', async () => {
    await mountEgg();

    expect(lines().map((line) => line.style.getPropertyValue('--line-delay'))).toEqual([
      '0.2s',
      '0.9s',
      '1.5s',
      '1.9s',
      '2.3s',
      '2.7s',
      '4.4s',
    ]);
    const fill = document.body.querySelector<HTMLElement>('.egg__fill')!;
    expect(fill.style.getPropertyValue('--line-delay')).toBe('2.9s');
  });

  it('cache la barre de progression et le symbole $ aux lecteurs d’écran', async () => {
    await mountEgg();

    expect(document.body.querySelector('.egg__bar')!.getAttribute('aria-hidden')).toBe('true');
    expect(document.body.querySelector('.egg__prompt')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('donne le focus à « Retour au CV », qui ferme la fenêtre', async () => {
    const wrapper = await mountEgg();

    const button = [
      ...document.body.querySelectorAll<HTMLButtonElement>('.egg__footer button'),
    ][0]!;
    expect(button.textContent.trim()).toBe('Retour au CV');
    expect(document.activeElement).toBe(button);

    button.click();
    await nextTick();

    expect(wrapper.emitted('update:open')).toEqual([[false]]);
    expect(dialog()).toBeNull();
  });

  it('se ferme avec le bouton ×, Échap ou le voile', async () => {
    for (const close of [
      () => document.body.querySelector<HTMLElement>('.window__close')!.click(),
      () =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })),
      () => document.body.querySelector<HTMLElement>('.window-layer__scrim')!.click(),
    ]) {
      const wrapper = await mountEgg();
      expect(dialog()).not.toBeNull();

      close();
      await nextTick();

      expect(wrapper.emitted('update:open')).toEqual([[false]]);
      expect(dialog()).toBeNull();
      wrapper.unmount();
      mounted.splice(mounted.indexOf(wrapper), 1);
    }
  });

  it('nomme le bouton × « Fermer »', async () => {
    await mountEgg();

    expect(document.body.querySelector('.window__close')!.getAttribute('aria-label')).toBe(
      'Fermer',
    );
  });

  it('rend le focus à la puce qui l’a ouverte', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Huile de coude';
    document.body.append(trigger);
    hosts.push(trigger);
    await mountEgg({ returnFocusTo: trigger });

    [...document.body.querySelectorAll<HTMLButtonElement>('.egg__footer button')][0]!.click();
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(trigger);
  });

  it('garde le focus dans la fenêtre (Tab boucle entre « Retour au CV » et ×)', async () => {
    await mountEgg();
    const footerButton = document.body.querySelector<HTMLButtonElement>('.egg__footer button')!;
    const close = document.body.querySelector<HTMLButtonElement>('.window__close')!;
    expect(document.activeElement).toBe(footerButton);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));

    expect(document.activeElement).toBe(close);
  });

  it('parle anglais sur la page anglaise', async () => {
    await mountEgg({ route: '/en' });

    expect(dialog()!.getAttribute('aria-label')).toBe('Elbow grease');
    expect(lines().map((line) => line.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      '$ npm install huile-de-coude',
      '1 package added, 0 dependencies, in 21 months',
      '[ok] muscles',
      '[ok] patience',
      '[ok] tests in real conditions',
      'build real-estate-project',
      'Done. 0 vulnerabilities (except the back).',
    ]);
    expect(document.body.querySelector('.egg__footer button')!.textContent.trim()).toBe(
      'Back to the CV',
    );
    expect(document.body.querySelector('.window__close')!.getAttribute('aria-label')).toBe('Close');
  });
});
