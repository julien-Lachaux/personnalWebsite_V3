import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRuntimeConfig } from '#imports';

import DeclarationPage from './accessibilite.vue';

// Contenus non accessibles (D33, D34, D47) : la liste réelle de `declaration.issues.items`, dans les deux
// langues. D38 (« placeholder » de la section IA sans `lang`) n'y figure pas : il n'apparaît pas en
// production. La phrase sur la langue du CV dépend des CV présents au build (`cvFiles`, D47) : français
// seul tant que `cv-en.pdf` manque, français et anglais dès qu'il est déposé. Quand Julien fournira un PDF
// balisé, la mention du CV est retirée avec ce test ; le repli « aucun défaut » est vérifié par
// `accessibilite-issues-empty.spec.ts`.

const FR_ONLY = 'Il est rédigé en français, y compris depuis la version anglaise du site.';
const FR_BOTH = 'Il existe en français et en anglais, et les deux versions sont dans ce cas.';
const EN_ONLY = 'It is written in French, including from the English version of the site.';
const EN_BOTH = 'It is available in French and in English, and both versions are in this state.';

function fr(language: string): string[] {
  return [
    `Le CV au format PDF (menu « CV PDF ») n’est pas balisé : il n’a ni structure (titres, listes), ni langue déclarée, ni titre de document, ce qui le rend difficile à lire avec un lecteur d’écran. ${language} Alternative : le contenu du CV est présenté dans la page elle-même, et je peux le transmettre sous une autre forme sur demande.`,
  ];
}

function en(language: string): string[] {
  return [
    `The CV in PDF format (“CV PDF” menu) is untagged: it has no structure (headings, lists), no declared language and no document title, which makes it hard to read with a screen reader. ${language} Alternative: the content of the CV is presented on the page itself, and I can send it in another form on request.`,
  ];
}

let original: string[];

beforeEach(() => {
  original = useRuntimeConfig().public.cvFiles;
});

afterEach(() => {
  useRuntimeConfig().public.cvFiles = original;
});

function setCvFiles(files: string[]): void {
  useRuntimeConfig().public.cvFiles = files;
}

async function issues(route: string, heading: string): Promise<{ tag: string; items: string[] }> {
  const wrapper = await mountSuspended(DeclarationPage, { route });
  const title = wrapper.findAll('h2').find((h2) => h2.text() === heading)!;
  const next = title.element.nextElementSibling!;
  return { tag: next.tagName, items: [...next.querySelectorAll('li')].map((li) => li.textContent) };
}

describe('déclaration d’accessibilité : liste réelle des contenus non accessibles', () => {
  it('relève les CV du build : le français seul au dépôt (cas actuel)', () => {
    expect(original).not.toContain('cv-en.pdf');
  });

  it('en français, sous /accessibilite : le CV PDF non balisé, rédigé en français, et lui seul', async () => {
    expect(await issues('/accessibilite', 'Contenus non accessibles')).toEqual({
      tag: 'UL',
      items: fr(FR_ONLY),
    });
  });

  it('en anglais, sous /en/accessibility : le même contenu, traduit', async () => {
    expect(await issues('/en/accessibility', 'Inaccessible content')).toEqual({
      tag: 'UL',
      items: en(EN_ONLY),
    });
  });

  it('avec cv-en.pdf : le CV existe en français et en anglais, toujours non balisé (fr)', async () => {
    setCvFiles(['cv-fr.pdf', 'cv-en.pdf']);

    expect(await issues('/accessibilite', 'Contenus non accessibles')).toEqual({
      tag: 'UL',
      items: fr(FR_BOTH),
    });
  });

  it('avec cv-en.pdf : le CV existe en français et en anglais, toujours non balisé (en)', async () => {
    setCvFiles(['cv-fr.pdf', 'cv-en.pdf']);

    expect(await issues('/en/accessibility', 'Inaccessible content')).toEqual({
      tag: 'UL',
      items: en(EN_BOTH),
    });
  });
});
