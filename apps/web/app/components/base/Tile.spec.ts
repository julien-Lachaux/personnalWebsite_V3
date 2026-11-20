import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';

import Tile from './Tile.vue';

const baseProps = {
  title: 'profil.cv',
  label: 'Profil',
  expandLabel: 'Agrandir Profil',
  collapseLabel: 'Réduire Profil',
};

describe('Tile', () => {
  it('rend une région nommée, une barre de titre `>_ fichier` et un corps en slot', async () => {
    const wrapper = await mountSuspended(Tile, {
      props: baseProps,
      slots: { default: () => h('p', { class: 'content' }, 'Développeur full-stack') },
    });

    const section = wrapper.get('section');
    expect(section.attributes('aria-label')).toBe('Profil');
    expect(wrapper.get('.tile__prompt').text()).toBe('>_');
    expect(wrapper.get('.tile__prompt').attributes('aria-hidden')).toBe('true');
    expect(wrapper.get('.tile__title').text()).toBe('profil.cv');
    expect(wrapper.get('.tile__body').get('.content').text()).toBe('Développeur full-stack');
  });

  it('actif par défaut : ni inert ni aria-hidden', async () => {
    const wrapper = await mountSuspended(Tile, { props: baseProps });

    const section = wrapper.get('section');
    expect(section.attributes('inert')).toBeUndefined();
    expect(section.attributes('aria-hidden')).toBeUndefined();
  });

  it('sortie de la zone (pushedOut) : inert et aria-hidden, rien n’est atteignable', async () => {
    const wrapper = await mountSuspended(Tile, {
      props: { ...baseProps, pushedOut: true },
      slots: { default: () => h('a', { href: '#x' }, 'Lien') },
    });

    const section = wrapper.get('section');
    expect(section.attributes('inert')).toBeDefined();
    expect(section.attributes('aria-hidden')).toBe('true');
  });

  it('bouton agrandir : vrai <button> nommé « Agrandir … », icône masquée, 44 × 44 px par la classe', async () => {
    const wrapper = await mountSuspended(Tile, { props: baseProps });

    const toggle = wrapper.get('button.tile__toggle');
    expect(toggle.attributes('type')).toBe('button');
    expect(toggle.attributes('aria-label')).toBe('Agrandir Profil');
    expect(toggle.get('svg').attributes('aria-hidden')).toBe('true');
    expect(toggle.findAll('svg')).toHaveLength(1);
  });

  it('agrandie : le bouton prend le nom « Réduire … » et l’icône de réduction', async () => {
    const collapsed = await mountSuspended(Tile, { props: baseProps });
    const expanded = await mountSuspended(Tile, { props: { ...baseProps, expanded: true } });

    expect(expanded.get('button').attributes('aria-label')).toBe('Réduire Profil');
    expect(expanded.findAll('svg')).toHaveLength(1);
    expect(expanded.get('svg path').attributes('d')).not.toBe(
      collapsed.get('svg path').attributes('d'),
    );
  });

  it.each([
    [
      'fr',
      { expandLabel: 'Agrandir Expérience', collapseLabel: 'Réduire Expérience' },
      'Agrandir Expérience',
      'Réduire Expérience',
    ],
    [
      'en',
      { expandLabel: 'Expand Experience', collapseLabel: 'Collapse Experience' },
      'Expand Experience',
      'Collapse Experience',
    ],
  ])(
    'noms du bouton en %s : ceux qui sont fournis',
    async (_language, labels, expand, collapse) => {
      const closed = await mountSuspended(Tile, { props: { ...baseProps, ...labels } });
      const open = await mountSuspended(Tile, {
        props: { ...baseProps, ...labels, expanded: true },
      });

      expect(closed.get('button').attributes('aria-label')).toBe(expand);
      expect(open.get('button').attributes('aria-label')).toBe(collapse);
    },
  );

  it('le clic sur le bouton émet toggle (la tuile ne garde aucun état)', async () => {
    const wrapper = await mountSuspended(Tile, { props: baseProps });

    await wrapper.get('button').trigger('click');
    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('toggle')).toHaveLength(2);
    expect(wrapper.get('button').attributes('aria-label')).toBe('Agrandir Profil');
  });

  it('corps qui défile : groupe nommé par le titre, atteignable au clavier (tabindex 0)', async () => {
    const wrapper = await mountSuspended(Tile, { props: baseProps });

    const body = wrapper.get('.tile__body');
    expect(body.attributes('tabindex')).toBe('0');
    expect(body.attributes('role')).toBe('group');
    expect(body.attributes('aria-labelledby')).toBe(wrapper.get('.tile__title').attributes('id'));
    expect(body.classes()).toContain('tile__body--scroll');
  });

  it('corps qui ne défile pas : ni tabindex ni classe de défilement', async () => {
    const wrapper = await mountSuspended(Tile, { props: { ...baseProps, scrollable: false } });

    const body = wrapper.get('.tile__body');
    expect(body.attributes('tabindex')).toBeUndefined();
    expect(body.classes()).not.toContain('tile__body--scroll');
  });

  it('transmet style et classe du placement à la racine', async () => {
    const wrapper = await mountSuspended(Tile, {
      props: baseProps,
      attrs: { class: 'placed', style: 'left: 12px; width: 420px' },
    });

    const section = wrapper.get('section');
    expect(section.classes()).toContain('placed');
    expect(section.attributes('style')).toContain('width: 420px');
  });
});
