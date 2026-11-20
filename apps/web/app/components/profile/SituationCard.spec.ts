import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { h, type VNode } from 'vue';

import SituationCard from './SituationCard.vue';

const props = {
  currently: 'Bénévole deux jours par semaine sur un outil de suivi',
  lookingFor: {
    format: 'Temps partiel ou missions courtes',
    location: 'Ville, Région · hybride ou à distance',
    availability: 'Immédiate',
  },
};

describe('SituationCard', () => {
  it('affiche « en ce moment » dans un groupe nommé par son titre h3', async () => {
    const wrapper = await mountSuspended(SituationCard, { props });

    const heading = wrapper.get('h3');
    expect(heading.text()).toBe('en ce moment');
    const group = wrapper.get(`[role="group"][aria-labelledby="${heading.attributes('id')}"]`);
    expect(group.text()).toContain(props.currently);
  });

  it('affiche « ce que je recherche » en liste de définitions format, lieu, disponibilité', async () => {
    const wrapper = await mountSuspended(SituationCard, { props });

    const headings = wrapper.findAll('h3');
    expect(headings.map((heading) => heading.text())).toEqual([
      'en ce moment',
      'ce que je recherche',
    ]);
    const group = wrapper.get(`[role="group"][aria-labelledby="${headings[1]!.attributes('id')}"]`);
    expect(group.findAll('dt').map((term) => term.text())).toEqual([
      'format',
      'lieu',
      'disponibilité',
    ]);
    expect(group.findAll('dd').map((value) => value.text())).toEqual([
      props.lookingFor.format,
      props.lookingFor.location,
      props.lookingFor.availability,
    ]);
  });

  it('donne un identifiant distinct à chaque titre, y compris pour deux instances de la même page', async () => {
    const wrapper = await mountSuspended({
      render: (): VNode => h('div', [h(SituationCard, props), h(SituationCard, props)]),
    });

    const ids = wrapper.findAll('h3').map((heading) => heading.attributes('id'));
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  it('parle anglais sur la page anglaise, le contenu restant tel que reçu', async () => {
    const wrapper = await mountSuspended(SituationCard, { route: '/en', props });

    expect(wrapper.findAll('h3').map((heading) => heading.text())).toEqual([
      'right now',
      'what I’m looking for',
    ]);
    expect(wrapper.findAll('dt').map((term) => term.text())).toEqual([
      'format',
      'location',
      'availability',
    ]);
    expect(wrapper.text()).toContain(props.currently);
  });
});
