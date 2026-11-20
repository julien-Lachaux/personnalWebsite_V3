import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';

import Button from './Button.vue';

describe('Button', () => {
  it('rend un vrai <button type="button"> avec son libellé, plein accent et taille 40 px par défaut', async () => {
    const wrapper = await mountSuspended(Button, {
      slots: { default: () => 'Lancer l’entretien' },
    });

    const button = wrapper.get('button');
    expect(button.text()).toBe('Lancer l’entretien');
    expect(button.attributes('type')).toBe('button');
    expect(button.classes()).toEqual(
      expect.arrayContaining(['base-button--solid', 'base-button--sm', 'base-button--tone-accent']),
    );
    expect(button.classes()).not.toContain('base-button--block');
    expect(button.attributes('aria-disabled')).toBeUndefined();
  });

  it.each(['solid', 'outline', 'secondary', 'linkedin', 'neon', 'link'] as const)(
    'applique la variante %s',
    async (variant) => {
      const wrapper = await mountSuspended(Button, {
        props: { variant },
        slots: { default: () => 'Action' },
      });
      expect(wrapper.get('button').classes()).toContain(`base-button--${variant}`);
    },
  );

  it('applique la taille, la couleur du lien texte, la pleine largeur et le type du bouton', async () => {
    const wrapper = await mountSuspended(Button, {
      props: { size: 'lg', tone: 'muted', block: true, type: 'submit', variant: 'link' },
      slots: { default: () => 'Effacer' },
    });

    const button = wrapper.get('button');
    expect(button.classes()).toEqual(
      expect.arrayContaining([
        'base-button--lg',
        'base-button--tone-muted',
        'base-button--block',
        'base-button--link',
      ]),
    );
    expect(button.attributes('type')).toBe('submit');
  });

  it('émet click au clic, avec l’événement', async () => {
    const wrapper = await mountSuspended(Button, { slots: { default: () => 'Ok' } });

    await wrapper.get('button').trigger('click');

    const clicks = wrapper.emitted<[MouseEvent]>('click');
    expect(clicks).toHaveLength(1);
    expect(clicks?.[0]?.[0]).toBeInstanceOf(MouseEvent);
  });

  it('désactivé : aria-disabled, aucun événement click, le focus reste sur le bouton', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const wrapper = await mountSuspended(Button, {
      props: { disabled: true },
      slots: { default: () => 'Envoyer' },
      attachTo: host,
    });
    const button = wrapper.get('button');

    button.element.focus();
    await button.trigger('click');

    expect(button.attributes('aria-disabled')).toBe('true');
    expect(button.attributes('disabled')).toBeUndefined();
    expect(wrapper.emitted('click')).toBeUndefined();
    expect(document.activeElement).toBe(button.element);
    wrapper.unmount();
    host.remove();
  });

  it('désactivé : le clic est annulé (aucun envoi de formulaire)', async () => {
    const wrapper = await mountSuspended(Button, {
      props: { disabled: true, type: 'submit' },
      slots: { default: () => 'Envoyer' },
    });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    wrapper.get('button').element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('actif : le clic n’est pas annulé', async () => {
    const wrapper = await mountSuspended(Button, { slots: { default: () => 'Ok' } });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    wrapper.get('button').element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('place l’icône avant et le complément après le libellé, masqués aux lecteurs d’écran', async () => {
    const wrapper = await mountSuspended(Button, {
      slots: {
        icon: () => h('svg', { class: 'icon' }),
        default: () => 'CV PDF',
        trailing: () => h('svg', { class: 'after' }),
      },
    });

    const wrappers = wrapper.findAll('.base-button__icon');
    expect(wrappers).toHaveLength(2);
    for (const icon of wrappers) expect(icon.attributes('aria-hidden')).toBe('true');
    expect(wrappers[0]?.find('.icon').exists()).toBe(true);
    expect(wrappers[1]?.find('.after').exists()).toBe(true);
    expect(wrapper.get('button').text()).toBe('CV PDF');
  });

  it('sans icône ni complément, n’ajoute aucun conteneur', async () => {
    const wrapper = await mountSuspended(Button, { slots: { default: () => 'Ok' } });
    expect(wrapper.find('.base-button__icon').exists()).toBe(false);
  });

  it('transmet les attributs (nom accessible) au <button>', async () => {
    const wrapper = await mountSuspended(Button, {
      attrs: { 'aria-label': 'Fermer le formulaire', id: 'close' },
    });
    expect(wrapper.get('button').attributes()).toMatchObject({
      'aria-label': 'Fermer le formulaire',
      id: 'close',
    });
  });
});
