import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import SectionIcon from './SectionIcon.vue';

describe('SectionIcon', () => {
  it('dessine une icône décorative : masquée aux lecteurs d’écran, sans focus', async () => {
    const wrapper = await mountSuspended(SectionIcon, { props: { id: 'profile' } });

    const svg = wrapper.get('svg');
    expect(svg.attributes('aria-hidden')).toBe('true');
    expect(svg.attributes('focusable')).toBe('false');
    expect(svg.attributes('viewBox')).toBe('0 0 24 24');
  });

  it('dessine le profil : une tête et des épaules', async () => {
    const wrapper = await mountSuspended(SectionIcon, { props: { id: 'profile' } });

    expect(wrapper.findAll('circle')).toHaveLength(1);
    expect(wrapper.findAll('path')).toHaveLength(1);
    expect(wrapper.find('rect').exists()).toBe(false);
  });

  it('dessine l’expérience : une mallette', async () => {
    const wrapper = await mountSuspended(SectionIcon, { props: { id: 'experience' } });

    expect(wrapper.findAll('rect')).toHaveLength(1);
    expect(wrapper.get('rect').attributes('width')).toBe('18');
    expect(wrapper.findAll('path')).toHaveLength(1);
    expect(wrapper.find('circle').exists()).toBe(false);
  });

  it('dessine les recommandations : une bulle', async () => {
    const wrapper = await mountSuspended(SectionIcon, { props: { id: 'recommendations' } });

    expect(wrapper.findAll('path')).toHaveLength(1);
    expect(wrapper.get('path').attributes('d')).toContain('l-5 4v-4');
    expect(wrapper.find('rect').exists()).toBe(false);
    expect(wrapper.find('circle').exists()).toBe(false);
  });

  it('dessine l’IA : une puce électronique', async () => {
    const wrapper = await mountSuspended(SectionIcon, { props: { id: 'ai' } });

    expect(wrapper.findAll('rect')).toHaveLength(1);
    expect(wrapper.get('rect').attributes('width')).toBe('12');
    expect(wrapper.get('path').attributes('d')).toContain('M10 10h4v4h-4z');
  });

  it('dessine quatre icônes différentes', async () => {
    const markups = new Set<string>();
    for (const id of ['profile', 'experience', 'recommendations', 'ai'] as const) {
      markups.add((await mountSuspended(SectionIcon, { props: { id } })).html());
    }

    expect(markups.size).toBe(4);
  });
});
