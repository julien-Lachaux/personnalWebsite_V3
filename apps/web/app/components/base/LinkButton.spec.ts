import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';

import LinkButton from './LinkButton.vue';

describe('LinkButton', () => {
  it('rend un vrai <a href> interne sans cible ni rel, plein accent et taille 40 px par défaut', async () => {
    const wrapper = await mountSuspended(LinkButton, {
      props: { href: '#accessibilite' },
      slots: { default: () => 'Déclaration d’accessibilité' },
    });

    const link = wrapper.get('a');
    expect(link.attributes('href')).toBe('#accessibilite');
    expect(link.attributes('target')).toBeUndefined();
    expect(link.attributes('rel')).toBeUndefined();
    expect(link.text()).toBe('Déclaration d’accessibilité');
    expect(link.classes()).toEqual(
      expect.arrayContaining(['base-button--solid', 'base-button--sm', 'base-button--tone-accent']),
    );
    expect(wrapper.find('.visually-hidden').exists()).toBe(false);
    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it.each(['solid', 'outline', 'secondary', 'linkedin', 'neon', 'link'] as const)(
    'applique la variante %s',
    async (variant) => {
      const wrapper = await mountSuspended(LinkButton, {
        props: { href: '#x', variant },
        slots: { default: () => 'Lien' },
      });
      expect(wrapper.get('a').classes()).toContain(`base-button--${variant}`);
    },
  );

  it('applique la taille, la couleur du lien texte et la pleine largeur', async () => {
    const wrapper = await mountSuspended(LinkButton, {
      props: { href: '#x', size: 'lg', tone: 'linkedin', block: true },
      slots: { default: () => 'Lien' },
    });
    expect(wrapper.get('a').classes()).toEqual(
      expect.arrayContaining([
        'base-button--lg',
        'base-button--tone-linkedin',
        'base-button--block',
      ]),
    );
  });

  it.each([
    ['fr', 'ouvre un nouvel onglet'],
    ['en', 'opens in a new tab'],
  ])(
    'adresse externe (%s) : nouvel onglet, rel noopener noreferrer et indication accessible',
    async (_language, indication) => {
      const wrapper = await mountSuspended(LinkButton, {
        props: {
          href: 'https://www.example.org/in/someone',
          variant: 'linkedin',
          externalLabel: indication,
        },
        slots: { default: () => 'LinkedIn' },
      });

      const link = wrapper.get('a');
      expect(link.attributes('target')).toBe('_blank');
      expect(link.attributes('rel')).toBe('noopener noreferrer');
      expect(link.text()).toBe(`LinkedIn (${indication})`);
      expect(wrapper.get('.visually-hidden').text()).toBe(`(${indication})`);
    },
  );

  it('détecte une adresse en http ou https, quelle que soit la casse', async () => {
    for (const href of ['http://example.org', 'HTTPS://example.org/x']) {
      const wrapper = await mountSuspended(LinkButton, { props: { href } });
      expect(wrapper.get('a').attributes('rel')).toBe('noopener noreferrer');
    }
  });

  it.each(['mailto:contact@example.org', '/en', '#cv', 'tel:+000', 'ftp-ish://x'])(
    'ne traite pas %s comme un lien externe',
    async (href) => {
      const wrapper = await mountSuspended(LinkButton, { props: { href } });
      expect(wrapper.get('a').attributes('target')).toBeUndefined();
      expect(wrapper.get('a').attributes('rel')).toBeUndefined();
    },
  );

  it('external explicite : force ou retire le traitement externe', async () => {
    const forced = await mountSuspended(LinkButton, {
      props: { href: '/cv.pdf', external: true },
    });
    expect(forced.get('a').attributes('rel')).toBe('noopener noreferrer');
    expect(forced.get('a').attributes('target')).toBe('_blank');

    const removed = await mountSuspended(LinkButton, {
      props: { href: 'https://www.example.org', external: false },
    });
    expect(removed.get('a').attributes('rel')).toBeUndefined();
    expect(removed.get('a').attributes('target')).toBeUndefined();
  });

  it('lien externe sans indication fournie : pas de texte masqué vide', async () => {
    const wrapper = await mountSuspended(LinkButton, { props: { href: 'https://example.org' } });
    expect(wrapper.find('.visually-hidden').exists()).toBe(false);
  });

  it('lien texte externe : flèche décorative ↗ masquée aux lecteurs d’écran', async () => {
    const wrapper = await mountSuspended(LinkButton, {
      props: { href: 'https://example.org', variant: 'link', externalLabel: 'nouvel onglet' },
      slots: { default: () => 'Recommandations publiées sur LinkedIn' },
    });

    const arrow = wrapper.get('svg');
    expect(arrow.attributes('aria-hidden')).toBe('true');
    expect(wrapper.get('a').text()).toBe('Recommandations publiées sur LinkedIn (nouvel onglet)');
  });

  it('un lien externe qui n’est pas un lien texte n’a pas de flèche', async () => {
    const wrapper = await mountSuspended(LinkButton, {
      props: { href: 'https://example.org', variant: 'neon' },
    });
    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('le slot trailing remplace la flèche ; l’icône précède le libellé, toutes deux décoratives', async () => {
    const wrapper = await mountSuspended(LinkButton, {
      props: { href: 'https://example.org', variant: 'link' },
      slots: {
        icon: () => h('i', { class: 'before' }),
        default: () => 'GitHub',
        trailing: () => h('i', { class: 'after' }),
      },
    });

    const icons = wrapper.findAll('.base-button__icon');
    expect(icons).toHaveLength(2);
    for (const icon of icons) expect(icon.attributes('aria-hidden')).toBe('true');
    expect(icons[0]?.find('.before').exists()).toBe(true);
    expect(icons[1]?.find('.after').exists()).toBe(true);
    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('transmet les attributs (download, nom accessible) au <a> et le clic passe', async () => {
    const wrapper = await mountSuspended(LinkButton, {
      props: { href: '/cv.pdf' },
      attrs: { download: '', 'aria-label': 'Télécharger le CV' },
    });

    expect(wrapper.get('a').attributes()).toMatchObject({
      download: '',
      'aria-label': 'Télécharger le CV',
    });
  });
});
