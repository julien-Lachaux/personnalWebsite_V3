import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { useNuxtApp } from '#imports';

import DeclarationPage from './accessibilite.vue';

// Contenus non accessibles (F7-01) : la liste `declaration.issues.items` des libellés, vide avant
// l'audit ; dès qu'elle contient des défauts, la page les affiche en liste. Fichier à part : les
// libellés ajoutés ici ne doivent pas atteindre les autres tests.

describe('déclaration d’accessibilité : défauts recensés', () => {
  it('affiche chaque défaut de la liste, à la place de la mention « aucun défaut »', async () => {
    const i18n = useNuxtApp().$i18n;
    i18n.mergeLocaleMessage('fr', {
      declaration: { issues: { items: ['Défaut A : carte sans alternative.', 'Défaut B.'] } },
    });

    const wrapper = await mountSuspended(DeclarationPage, { route: '/accessibilite' });

    const heading = wrapper.findAll('h2').find((h2) => h2.text() === 'Contenus non accessibles')!;
    const list = heading.element.nextElementSibling!;
    expect(list.tagName).toBe('UL');
    expect([...list.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'Défaut A : carte sans alternative.',
      'Défaut B.',
    ]);
    expect(wrapper.text()).not.toContain('Aucun défaut d’accessibilité n’est recensé');
  });
});
