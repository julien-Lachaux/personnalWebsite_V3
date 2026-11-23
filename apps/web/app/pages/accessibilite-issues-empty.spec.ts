import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { useNuxtApp } from '#imports';

import DeclarationPage from './accessibilite.vue';

// Contenus non accessibles (D33, D34) : quand la liste `declaration.issues.items` est vide (la mention du
// CV PDF retirée après l'export d'un PDF balisé), la page dit qu'aucun défaut n'est recensé, dans chaque
// langue. Fichier à part : la liste vidée ne doit pas atteindre les autres tests.

type Messages = { declaration: { issues: Record<string, unknown> } } & Record<string, unknown>;

/** Vide la liste de la langue (chargée au besoin par un premier montage de sa page). */
async function emptyList(code: 'fr' | 'en', route: string): Promise<void> {
  await mountSuspended(DeclarationPage, { route });
  const i18n = useNuxtApp().$i18n;
  const loaded: unknown = i18n.getLocaleMessage(code);
  const messages = loaded as Messages;
  i18n.setLocaleMessage(code, {
    ...messages,
    declaration: { ...messages.declaration, issues: { ...messages.declaration.issues, items: [] } },
  });
}

async function noticeAfter(route: string, heading: string): Promise<[string, string | null]> {
  const wrapper = await mountSuspended(DeclarationPage, { route });
  const title = wrapper.findAll('h2').find((h2) => h2.text() === heading)!;
  return [title.element.nextElementSibling!.tagName, title.element.nextElementSibling!.textContent];
}

describe('déclaration d’accessibilité : liste vide', () => {
  it('dit en français qu’aucun défaut n’est recensé', async () => {
    await emptyList('fr', '/accessibilite');

    expect(await noticeAfter('/accessibilite', 'Contenus non accessibles')).toEqual([
      'P',
      'Aucun défaut d’accessibilité n’est recensé à ce jour. Cette liste sera établie par l’audit.',
    ]);
  });

  it('le dit en anglais', async () => {
    await emptyList('en', '/en/accessibility');

    expect(await noticeAfter('/en/accessibility', 'Inaccessible content')).toEqual([
      'P',
      'No accessibility issue has been identified so far. This list will be drawn up by the audit.',
    ]);
  });
});
