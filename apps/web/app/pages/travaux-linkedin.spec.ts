import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearNuxtData, clearNuxtState } from '#imports';

import { UNINDEXED_PATH_STATE_KEY } from '../composables/seo/useSeo.js';
import { cvFr } from '../data/fixtures/cv.fr.js';
import WorkInProgressPage from './travaux.vue';

// Page « travaux en cours » (lot 31) : sans lien social `linkedin` dans le CV lu au build, la page lève
// une erreur explicite (la génération échoue) au lieu d'afficher un bouton mort. La source du CV est
// remplacée par une source qui sert le CV de test privé de ce lien.

vi.mock('../data/select-cv-source.js', () => ({
  createCvSource: () => ({
    load: () =>
      Promise.resolve({
        ...cvFr,
        socialLinks: cvFr.socialLinks.filter((link) => link.slug !== 'linkedin'),
      }),
  }),
}));

afterEach(() => {
  clearNuxtState(UNINDEXED_PATH_STATE_KEY);
  clearNuxtData();
});

describe('page « travaux en cours » sans lien LinkedIn', () => {
  it('lève une erreur qui nomme le lien attendu : la génération échoue', async () => {
    expect(cvFr.socialLinks.some((link) => link.slug === 'linkedin')).toBe(true);

    await expect(mountSuspended(WorkInProgressPage, { route: '/travaux' })).rejects.toThrow(
      'Lien LinkedIn absent du CV : la page « travaux en cours » attend un lien social de slug « linkedin »',
    );
  });
});
