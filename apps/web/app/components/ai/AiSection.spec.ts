import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { h, type VNode } from 'vue';

import { type AiView } from '../../data/cv-view.js';
import AiSection from './AiSection.vue';

const ai: AiView = {
  title: 'L’IA, dans le produit et au quotidien',
  inProduct: {
    label: 'dans le produit · Produit, 2026',
    items: ['OCR des tickets de caisse', 'Remplissage automatique des déclarations'],
  },
  daily: { label: 'au quotidien', text: 'Usage quotidien de l’IA dans ma pratique.' },
  tags: [
    { slug: 'ocr', name: 'OCR' },
    { slug: 'agentic', name: 'Développement agentique' },
  ],
};

describe('AiSection', () => {
  it('affiche le titre en h3 (le h2 « IA » est celui de la coquille)', async () => {
    const wrapper = await mountSuspended(AiSection, { props: { ai } });

    expect(wrapper.get('h3').text()).toBe(ai.title);
    expect(wrapper.find('h1').exists()).toBe(false);
    expect(wrapper.find('h2').exists()).toBe(false);
  });

  it('affiche « dans le produit » : étiquette h4 qui nomme la liste', async () => {
    const wrapper = await mountSuspended(AiSection, { props: { ai } });

    const label = wrapper.findAll('h4')[0]!;
    expect(label.text()).toBe(ai.inProduct.label);
    const list = wrapper.get(`ul[aria-labelledby="${label.attributes('id')}"]`);
    expect(list.findAll('li').map((item) => item.text())).toEqual(ai.inProduct.items);
  });

  it('affiche « au quotidien » : étiquette h4 qui nomme le groupe du texte', async () => {
    const wrapper = await mountSuspended(AiSection, { props: { ai } });

    const label = wrapper.findAll('h4')[1]!;
    expect(label.text()).toBe(ai.daily.label);
    const group = wrapper.get(`[role="group"][aria-labelledby="${label.attributes('id')}"]`);
    expect(group.get('p').text()).toBe(ai.daily.text);
  });

  it('affiche les mots-clés en liste nommée de puces non interactives', async () => {
    const wrapper = await mountSuspended(AiSection, { props: { ai } });

    const tags = wrapper.get('ul[aria-label="Mots-clés"]');
    expect(tags.findAll('li').map((tag) => tag.text())).toEqual(['OCR', 'Développement agentique']);
    expect(wrapper.findAll('button, a, [tabindex]')).toHaveLength(0);
  });

  it('n’affiche pas la liste de mots-clés quand il n’y en a pas', async () => {
    const wrapper = await mountSuspended(AiSection, { props: { ai: { ...ai, tags: [] } } });

    expect(wrapper.find('ul[aria-label]').exists()).toBe(false);
    expect(wrapper.findAll('ul')).toHaveLength(1);
  });

  it('donne des identifiants distincts aux étiquettes de deux instances de la même page', async () => {
    const wrapper = await mountSuspended({
      render: (): VNode => h('div', [h(AiSection, { ai }), h(AiSection, { ai })]),
    });

    const ids = wrapper.findAll('h4').map((label) => label.attributes('id'));
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  it('parle anglais sur la page anglaise : l’étiquette des mots-clés suit la langue, le contenu reste tel que reçu', async () => {
    const wrapper = await mountSuspended(AiSection, {
      route: '/en',
      props: { ai: { ...ai, title: 'AI, in the product and day to day' } },
    });

    expect(wrapper.get('h3').text()).toBe('AI, in the product and day to day');
    expect(wrapper.find('ul[aria-label="Keywords"]').exists()).toBe(true);
  });
});
