import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import DeclarationPage from './accessibilite.vue';

// Contenus non accessibles (D33, D34) : la liste réelle de `declaration.issues.items`, dans les deux
// langues. D38 (« placeholder » de la section IA sans `lang`) n'y figure pas : il n'apparaît pas en
// production. Quand Julien fournira un PDF balisé, la mention du CV est retirée avec ce test ; le repli
// « aucun défaut » est vérifié par `accessibilite-issues-empty.spec.ts`.

const FR = [
  'Le CV au format PDF (bouton « CV PDF ») n’est pas balisé : il n’a ni structure (titres, listes), ni langue déclarée, ni titre de document, ce qui le rend difficile à lire avec un lecteur d’écran. Il est rédigé en français, y compris depuis la version anglaise du site. Alternative : le contenu du CV est présenté dans la page elle-même, et je peux le transmettre sous une autre forme sur demande.',
];
const EN = [
  'The CV in PDF format (“CV PDF” button) is untagged: it has no structure (headings, lists), no declared language and no document title, which makes it hard to read with a screen reader. It is written in French, including from the English version of the site. Alternative: the content of the CV is presented on the page itself, and I can send it in another form on request.',
];

async function issues(route: string, heading: string): Promise<{ tag: string; items: string[] }> {
  const wrapper = await mountSuspended(DeclarationPage, { route });
  const title = wrapper.findAll('h2').find((h2) => h2.text() === heading)!;
  const next = title.element.nextElementSibling!;
  return { tag: next.tagName, items: [...next.querySelectorAll('li')].map((li) => li.textContent) };
}

describe('déclaration d’accessibilité : liste réelle des contenus non accessibles', () => {
  it('en français, sous /accessibilite : le CV PDF non balisé, et lui seul', async () => {
    expect(await issues('/accessibilite', 'Contenus non accessibles')).toEqual({
      tag: 'UL',
      items: FR,
    });
  });

  it('en anglais, sous /en/accessibility : le même contenu, traduit', async () => {
    expect(await issues('/en/accessibility', 'Inaccessible content')).toEqual({
      tag: 'UL',
      items: EN,
    });
  });
});
