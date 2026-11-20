import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';

// Libellés génériques de l'espace `common` (common.json, lot F1 bis), passés en props aux éléments de
// base par leurs consommateurs : traduits dans les deux langues, `{name}` remplacé.

const Labels = defineComponent({
  setup() {
    const { t } = useI18n();
    return () =>
      h(
        'ul',
        [
          t('common.close'),
          t('common.opensInNewTab'),
          t('common.expand', { name: 'XP' }),
          t('common.collapse', { name: 'XP' }),
          t('common.showDetails', { name: 'Orange' }),
        ].map((label) => h('li', label)),
      );
  },
});

async function labels(route: string): Promise<string[]> {
  const wrapper = await mountSuspended(Labels, { route });
  return wrapper.findAll('li').map((item) => item.text());
}

describe('libellés communs', () => {
  it('en français', async () => {
    expect(await labels('/')).toEqual([
      'Fermer',
      "s'ouvre dans un nouvel onglet",
      'Agrandir XP',
      'Réduire XP',
      'Voir le détail : Orange',
    ]);
  });

  it('en anglais', async () => {
    expect(await labels('/en')).toEqual([
      'Close',
      'opens in a new tab',
      'Expand XP',
      'Collapse XP',
      'Show details: Orange',
    ]);
  });
});
