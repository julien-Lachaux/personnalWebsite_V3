<script setup lang="ts">
// Bouton (ticket F1-03) : vrai `<button>`, six variantes du handoff (plein accent, contour,
// secondaire, bleu LinkedIn, néon GitHub, lien texte). Le libellé est le contenu par défaut, une icône
// décorative se place dans le slot `icon` (masquée aux lecteurs d'écran).
//
// `disabled` pose `aria-disabled` et non l'attribut natif : le bouton garde le focus (envoi en cours),
// son clic est ignoré (pas d'événement `click`, pas d'envoi du formulaire).
// Les attributs non déclarés (`aria-label`, `form`, `id`…) vont sur le `<button>`.

// Nom multi-mot (règle `vue/multi-word-component-names`) : celui que Nuxt donne à l'élément de base.
defineOptions({ name: 'BaseButton' });

withDefaults(
  defineProps<{
    variant?: 'solid' | 'outline' | 'secondary' | 'linkedin' | 'neon' | 'link';
    /** Couleur du lien texte (variante `link` seulement). */
    tone?: 'accent' | 'muted' | 'linkedin';
    /** 40 px (`sm`), 48 px (`md`), 52 px (`lg`) ; 44 px au moins sur mobile et tablette. */
    size?: 'sm' | 'md' | 'lg';
    /** Occupe toute la largeur disponible. */
    block?: boolean;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
  }>(),
  { variant: 'solid', tone: 'accent', size: 'sm', block: false, type: 'button', disabled: false },
);

const emit = defineEmits<{ click: [event: MouseEvent] }>();

function onClick(event: MouseEvent, disabled: boolean): void {
  if (disabled) {
    event.preventDefault();
    return;
  }
  emit('click', event);
}
</script>

<template>
  <button
    :type="type"
    class="base-button"
    :class="[
      `base-button--${variant}`,
      `base-button--${size}`,
      `base-button--tone-${tone}`,
      { 'base-button--block': block },
    ]"
    :aria-disabled="disabled ? 'true' : undefined"
    @click="onClick($event, disabled)"
  >
    <span v-if="$slots['icon']" class="base-button__icon" aria-hidden="true">
      <slot name="icon" />
    </span>
    <slot />
    <span v-if="$slots['trailing']" class="base-button__icon" aria-hidden="true">
      <slot name="trailing" />
    </span>
  </button>
</template>

<style scoped src="./button.css"></style>
