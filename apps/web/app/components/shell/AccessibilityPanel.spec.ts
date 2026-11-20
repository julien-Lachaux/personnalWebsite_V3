import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { clearNuxtState } from '#imports';

import { PREFERENCES_STATE_KEY, usePreferences } from '../../composables/shell/usePreferences.js';
import { PREFERENCES_STORAGE_KEY, defaultPreferences } from '../../domain/preferences.js';
import AccessibilityPanel from './AccessibilityPanel.vue';

const mounted: VueWrapper[] = [];
const hosts: HTMLElement[] = [];

async function mountPanel(route = '/'): Promise<VueWrapper> {
  const host = document.createElement('div');
  document.body.append(host);
  hosts.push(host);
  const wrapper = await mountSuspended(AccessibilityPanel, {
    route,
    props: { declarationUrl: '/accessibilite' },
    attachTo: host,
  });
  mounted.push(wrapper);
  return wrapper;
}

async function open(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('button[aria-haspopup="dialog"]').trigger('click');
  await nextTick();
  await nextTick();
}

function stored(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}') as Record<
    string,
    unknown
  >;
}

beforeEach(() => {
  clearNuxtState(PREFERENCES_STATE_KEY);
  window.localStorage.clear();
  usePreferences().hydrate({ prefersDark: false, prefersReducedMotion: false });
});

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  for (const host of hosts.splice(0)) host.remove();
});

describe('AccessibilityPanel : déclencheur', () => {
  it('est un bouton nommé, avec aria-haspopup, aria-expanded et aria-controls vers le panneau', async () => {
    const wrapper = await mountPanel();

    const trigger = wrapper.get('button[aria-haspopup="dialog"]');
    expect(trigger.attributes('aria-label')).toBe('Options d’accessibilité');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(trigger.attributes('type')).toBe('button');
    const panel = wrapper.get(`#${trigger.attributes('aria-controls')}`);
    expect(panel.attributes('role')).toBe('dialog');
    expect(panel.attributes('aria-modal')).toBe('false');
    expect(trigger.get('svg').attributes('aria-hidden')).toBe('true');
  });

  it('parle anglais sur la page anglaise', async () => {
    const wrapper = await mountPanel('/en');

    expect(wrapper.get('button[aria-haspopup="dialog"]').attributes('aria-label')).toBe(
      'Accessibility options',
    );
  });

  it('garde le panneau caché tant qu’il n’est pas ouvert', async () => {
    const wrapper = await mountPanel();

    expect(wrapper.get('[role="dialog"]').attributes('hidden')).toBeDefined();
  });
});

describe('AccessibilityPanel : ouverture et fermeture au clavier', () => {
  it('s’ouvre au clic et donne le focus au premier réglage (taille normale)', async () => {
    const wrapper = await mountPanel();

    await open(wrapper);

    const trigger = wrapper.get('button[aria-haspopup="dialog"]');
    expect(trigger.attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('[role="dialog"]').attributes('hidden')).toBeUndefined();
    expect(document.activeElement).toBe(wrapper.get('[aria-pressed]').element);
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe(
      'Taille de texte normale',
    );
  });

  it('a pour titre visible le nom de fichier accessibilite.cfg', async () => {
    const wrapper = await mountPanel();
    await open(wrapper);

    const dialog = wrapper.get('[role="dialog"]');
    const title = wrapper.get(`#${dialog.attributes('aria-labelledby')}`);
    expect(title.text()).toBe('accessibilite.cfg');
    expect(title.element.tagName).toBe('H2');
  });

  it('se ferme par Échap et rend le focus au déclencheur', async () => {
    const wrapper = await mountPanel();
    await open(wrapper);

    await wrapper.get('[aria-pressed]').trigger('keydown', { key: 'Escape' });
    await nextTick();

    const trigger = wrapper.get('button[aria-haspopup="dialog"]');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('[role="dialog"]').attributes('hidden')).toBeDefined();
    expect(document.activeElement).toBe(trigger.element);
  });

  it('se ferme par le bouton × (nommé) et rend le focus au déclencheur', async () => {
    const wrapper = await mountPanel();
    await open(wrapper);

    const close = wrapper.get('button[aria-label="Fermer les options d’accessibilité"]');
    await close.trigger('click');
    await nextTick();

    expect(wrapper.get('button[aria-haspopup="dialog"]').attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(wrapper.get('button[aria-haspopup="dialog"]').element);
  });

  it('nomme le bouton de fermeture en anglais', async () => {
    const wrapper = await mountPanel('/en');

    expect(wrapper.find('button[aria-label="Close accessibility options"]').exists()).toBe(true);
  });

  it('ne bloque pas la page : non modal', async () => {
    const wrapper = await mountPanel();
    await open(wrapper);

    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('false');
    expect(document.querySelector('[data-scrim]')).toBeNull();
  });
});

describe('AccessibilityPanel : taille du texte', () => {
  it('propose un groupe nommé de trois boutons « A » à aria-pressed, 100 % choisi par défaut', async () => {
    const wrapper = await mountPanel();

    const group = wrapper.get('[role="group"][aria-labelledby]');
    expect(wrapper.get(`#${group.attributes('aria-labelledby')}`).text()).toBe('taille du texte');
    const buttons = group.findAll('button');
    expect(buttons.map((button) => button.text())).toEqual(['A', 'A', 'A']);
    expect(buttons.map((button) => button.attributes('aria-label'))).toEqual([
      'Taille de texte normale',
      'Grande taille de texte',
      'Très grande taille de texte',
    ]);
    expect(buttons.map((button) => button.attributes('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
  });

  it('grandit chaque « A » comme la taille qu’il choisit', async () => {
    const wrapper = await mountPanel();

    const letters = wrapper.findAll('[role="group"][aria-labelledby] button span');
    expect(letters.map((letter) => letter.classes().join(' '))).toEqual([
      expect.stringContaining('a11y-panel__size--100'),
      expect.stringContaining('a11y-panel__size--115'),
      expect.stringContaining('a11y-panel__size--130'),
    ]);
  });

  it('choisit 115 % puis 130 %, les mémorise et déplace aria-pressed', async () => {
    const wrapper = await mountPanel();
    const buttons = (): ReturnType<VueWrapper['findAll']> =>
      wrapper.findAll('[role="group"][aria-labelledby] button');

    await buttons()[1]!.trigger('click');
    expect(usePreferences().preferences.value.textSize).toBe(115);
    expect(stored()).toMatchObject({ textSize: 115 });
    expect(buttons().map((button) => button.attributes('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);

    await buttons()[2]!.trigger('click');
    expect(usePreferences().preferences.value.textSize).toBe(130);
    expect(stored()).toMatchObject({ textSize: 130 });
    expect(buttons().map((button) => button.attributes('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ]);

    await buttons()[0]!.trigger('click');
    expect(usePreferences().preferences.value.textSize).toBe(100);
  });

  it('nomme les boutons en anglais', async () => {
    const wrapper = await mountPanel('/en');

    expect(
      wrapper
        .findAll('[role="group"][aria-labelledby] button')
        .map((button) => button.attributes('aria-label')),
    ).toEqual(['Normal text size', 'Large text size', 'Largest text size']);
    expect(
      wrapper.get('[role="group"][aria-labelledby]').element.previousElementSibling?.textContent,
    ).toBe('text size');
  });
});

describe('AccessibilityPanel : interrupteurs', () => {
  const FLAGS = [
    ['highContrast', 'Contraste renforcé', 'Textes et bordures plus marqués.'],
    ['readableFont', 'Police plus lisible', 'Atkinson Hyperlegible, conçue pour la basse vision.'],
    ['textSpacing', 'Espacement du texte', 'Lignes, lettres et mots plus espacés (WCAG 1.4.12).'],
    ['underlineLinks', 'Souligner les liens', 'Repérer les liens sans se fier à la couleur.'],
    ['reduceMotion', 'Réduire les animations', 'Coupe les transitions et les glissements.'],
  ] as const;

  it('en propose cinq, dans l’ordre de la spécification, chacun nommé et décrit', async () => {
    const wrapper = await mountPanel();

    const group = wrapper.get('[role="group"][aria-label="Préférences d’affichage"]');
    const switches = group.findAll('[role="switch"]');
    expect(switches).toHaveLength(5);
    for (const [index, [, label, description]] of FLAGS.entries()) {
      const item = switches[index]!;
      expect(item.element.tagName).toBe('BUTTON');
      expect(wrapper.get(`#${item.attributes('aria-labelledby')}`).text()).toBe(label);
      expect(wrapper.get(`#${item.attributes('aria-describedby')}`).text()).toBe(description);
      expect(item.attributes('aria-checked')).toBe('false');
    }
  });

  it('bascule chaque réglage au clic, le mémorise et met aria-checked à jour', async () => {
    const wrapper = await mountPanel();

    for (const [index, [key]] of FLAGS.entries()) {
      const item = (): ReturnType<VueWrapper['get']> => wrapper.findAll('[role="switch"]')[index]!;
      await item().trigger('click');
      expect(usePreferences().preferences.value[key], key).toBe(true);
      expect(stored()[key], key).toBe(true);
      expect(item().attributes('aria-checked'), key).toBe('true');

      await item().trigger('click');
      expect(usePreferences().preferences.value[key], key).toBe(false);
      expect(item().attributes('aria-checked'), key).toBe('false');
    }
  });

  it('ne change que le réglage touché', async () => {
    const wrapper = await mountPanel();

    await wrapper.findAll('[role="switch"]')[2]!.trigger('click');

    expect(usePreferences().preferences.value).toEqual({
      ...defaultPreferences({ prefersDark: false, prefersReducedMotion: false }),
      textSpacing: true,
    });
  });

  it('reflète « réduire les animations » déjà actif (depuis le système)', async () => {
    usePreferences().hydrate({ prefersDark: false, prefersReducedMotion: true });

    const wrapper = await mountPanel();

    expect(
      wrapper.findAll('[role="switch"]').map((item) => item.attributes('aria-checked')),
    ).toEqual(['false', 'false', 'false', 'false', 'true']);
  });

  it('nomme les interrupteurs en anglais', async () => {
    const wrapper = await mountPanel('/en');

    const names = wrapper
      .findAll('[role="switch"]')
      .map((item) => wrapper.get(`#${item.attributes('aria-labelledby')}`).text());
    expect(names).toEqual([
      'Enhanced contrast',
      'More readable font',
      'Text spacing',
      'Underline links',
      'Reduce animations',
    ]);
    expect(wrapper.find('[role="group"][aria-label="Display preferences"]').exists()).toBe(true);
  });
});

describe('AccessibilityPanel : réinitialisation (D11)', () => {
  async function customised(wrapper: VueWrapper): Promise<void> {
    await wrapper.findAll('[role="switch"]')[0]!.trigger('click');
    await wrapper.findAll('[role="group"][aria-labelledby] button')[2]!.trigger('click');
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click');
  }

  it('supprime le réglage enregistré et rend les valeurs du système', async () => {
    const wrapper = await mountPanel();
    await customised(wrapper);
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).not.toBeNull();

    await wrapper.get('.a11y-panel__footer button').trigger('click');

    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(usePreferences().preferences.value).toEqual(
      defaultPreferences({ prefersDark: false, prefersReducedMotion: false }),
    );
    expect(usePreferences().followsSystem.value).toBe(true);
    expect(wrapper.findAll('[role="switch"]')[0]!.attributes('aria-checked')).toBe('false');
    expect(
      wrapper
        .findAll('[role="group"][aria-labelledby] button')
        .map((button) => button.attributes('aria-pressed')),
    ).toEqual(['true', 'false', 'false']);
  });

  it('est un vrai bouton nommé « Réinitialiser »', async () => {
    const wrapper = await mountPanel();

    const reset = wrapper.get('.a11y-panel__footer button');
    expect(reset.text()).toBe('Réinitialiser');
    expect(reset.attributes('type')).toBe('button');
  });

  it('annonce la réinitialisation dans une région de statut, retirée à la fermeture', async () => {
    const wrapper = await mountPanel();
    await open(wrapper);
    const status = wrapper.get('[role="status"]');
    expect(status.text()).toBe('');

    await wrapper.get('.a11y-panel__footer button').trigger('click');
    expect(status.text()).toBe(
      'Réglages réinitialisés : le site suit de nouveau les préférences de votre système.',
    );
    expect(status.classes()).toContain('visually-hidden');

    await wrapper.get('button[aria-label="Fermer les options d’accessibilité"]').trigger('click');
    await nextTick();
    expect(status.text()).toBe('');
  });

  it('annonce la réinitialisation en anglais', async () => {
    const wrapper = await mountPanel('/en');

    await wrapper.get('.a11y-panel__footer button').trigger('click');

    expect(wrapper.get('.a11y-panel__footer button').text()).toBe('Reset');
    expect(wrapper.get('[role="status"]').text()).toBe(
      'Settings reset: the site follows your system preferences again.',
    );
  });
});

describe('AccessibilityPanel : déclaration et conformité', () => {
  it('lie la déclaration d’accessibilité à l’adresse reçue', async () => {
    const wrapper = await mountPanel();

    const link = wrapper.get('a.a11y-panel__link');
    expect(link.attributes('href')).toBe('/accessibilite');
    expect(link.text()).toBe('Déclaration d’accessibilité');
  });

  it('indique que le statut de conformité reste à compléter après audit', async () => {
    const wrapper = await mountPanel();

    const status = wrapper.get('p.a11y-panel__status');
    expect(status.text()).toBe(
      'Réglages mémorisés sur cet appareil. Conformité RGAA 4.1 : [à compléter après audit].',
    );
    expect(status.get('em').text()).toBe('[à compléter après audit]');
  });

  it('dit la même chose en anglais', async () => {
    const wrapper = await mountPanel('/en');

    expect(wrapper.get('a.a11y-panel__link').text()).toBe('Accessibility statement');
    expect(wrapper.get('p.a11y-panel__status').text()).toBe(
      'Settings are saved on this device. RGAA 4.1 conformance: [to be completed after the audit].',
    );
    expect(wrapper.get('p.a11y-panel__status em').text()).toBe('[to be completed after the audit]');
  });
});
