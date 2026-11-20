import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import BottomNav from './BottomNav.vue';

describe('BottomNav', () => {
  it('est la navigation « Sections » : quatre vrais boutons, icône décorative et libellé', async () => {
    const wrapper = await mountSuspended(BottomNav, { route: '/', props: { active: 'profile' } });

    const nav = wrapper.get('nav');
    expect(nav.attributes('aria-label')).toBe('Sections');
    const buttons = nav.findAll('button');
    expect(buttons.map((button) => button.text())).toEqual(['Profil', 'XP', 'Recos', 'IA']);
    for (const button of buttons) {
      expect(button.attributes('type')).toBe('button');
      expect(button.get('svg').attributes('aria-hidden')).toBe('true');
    }
  });

  it('dessine une icône différente par onglet', async () => {
    const wrapper = await mountSuspended(BottomNav, { route: '/', props: { active: 'profile' } });

    const icons = wrapper.findAll('button svg').map((icon) => icon.html());
    expect(new Set(icons).size).toBe(4);
  });

  it.each([
    ['profile', 'Profil'],
    ['experience', 'XP'],
    ['recommendations', 'Recos'],
    ['ai', 'IA'],
  ] as const)('marque %s comme page courante, et lui seul', async (id, label) => {
    const wrapper = await mountSuspended(BottomNav, { route: '/', props: { active: id } });

    const current = wrapper.findAll('[aria-current]');
    expect(current.map((button) => button.text())).toEqual([label]);
    expect(current[0]!.attributes('aria-current')).toBe('true');
  });

  it('émet select avec l’identifiant de l’onglet touché', async () => {
    const wrapper = await mountSuspended(BottomNav, { route: '/', props: { active: 'profile' } });

    for (const button of wrapper.findAll('button')) await button.trigger('click');

    expect(wrapper.emitted('select')).toEqual([
      ['profile'],
      ['experience'],
      ['recommendations'],
      ['ai'],
    ]);
  });

  it('traduit les libellés en anglais', async () => {
    const wrapper = await mountSuspended(BottomNav, { route: '/en', props: { active: 'ai' } });

    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
      'Profile',
      'XP',
      'Recs',
      'AI',
    ]);
  });
});
