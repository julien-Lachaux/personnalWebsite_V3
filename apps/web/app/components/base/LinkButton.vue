<script setup lang="ts">
// Lien en forme de bouton (ticket F1-03) : vrai `<a href>`, mêmes variantes et mêmes tailles que
// `Button.vue` (apparence partagée dans button.css).
//
// Lien externe (`http(s)://` par défaut, ou `external` explicite) : ouverture dans un nouvel onglet,
// `rel="noopener noreferrer"` (SPEC § 11) et indication accessible « ouverture dans un nouvel onglet »
// (`externalLabel`, texte masqué visuellement, à fournir traduit). Un lien texte externe porte aussi
// la flèche ↗ (décorative), sauf si le slot `trailing` la remplace.
// Les attributs non déclarés (`download`, `aria-label`, `hreflang`…) vont sur le `<a>`.
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    href: string;
    variant?: 'solid' | 'outline' | 'secondary' | 'linkedin' | 'neon' | 'link';
    tone?: 'accent' | 'muted' | 'linkedin';
    size?: 'sm' | 'md' | 'lg';
    block?: boolean;
    /** Vrai pour un lien externe ; par défaut, déduit d'une adresse en `http://` ou `https://`. */
    external?: boolean | undefined;
    /** Indication lue aux lecteurs d'écran après le libellé d'un lien externe (ex. « nouvel onglet »). */
    externalLabel?: string;
  }>(),
  {
    variant: 'solid',
    tone: 'accent',
    size: 'sm',
    block: false,
    external: undefined,
    externalLabel: '',
  },
);

const isExternal = computed(() => props.external ?? /^https?:\/\//i.test(props.href));
</script>

<template>
  <a
    :href="href"
    class="base-button"
    :class="[
      `base-button--${variant}`,
      `base-button--${size}`,
      `base-button--tone-${tone}`,
      { 'base-button--block': block },
    ]"
    :target="isExternal ? '_blank' : undefined"
    :rel="isExternal ? 'noopener noreferrer' : undefined"
  >
    <span v-if="$slots['icon']" class="base-button__icon" aria-hidden="true">
      <slot name="icon" />
    </span>
    <slot />
    <span v-if="isExternal && externalLabel" class="visually-hidden"> ({{ externalLabel }})</span>
    <span v-if="$slots['trailing']" class="base-button__icon" aria-hidden="true">
      <slot name="trailing" />
    </span>
    <svg
      v-else-if="isExternal && variant === 'link'"
      class="base-button__icon"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  </a>
</template>

<style scoped src="./button.css"></style>
