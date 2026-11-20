<script setup lang="ts">
// Navigation du bas du mobile et de la tablette (F3-02, SPEC § 3.1) : quatre onglets, icône et libellé,
// 64 px (`--mobile-nav`) avec des cibles de 44 px au moins. Composant sans état : `active` est la
// section affichée (`aria-current`), la page écoute `select` et pilote le glissement entre sections
// (voir le compte rendu du lot F3b).
import { useI18n } from '#imports';

import { SECTION_IDS, type SectionId } from '../../composables/shell/sections.js';
import SectionIcon from './SectionIcon.vue';

defineProps<{ active: SectionId }>();
defineEmits<{ select: [id: SectionId] }>();

const { t } = useI18n();
</script>

<template>
  <nav :aria-label="t('shell.nav.label')" class="bottom-nav">
    <button
      v-for="id in SECTION_IDS"
      :key="id"
      type="button"
      class="bottom-nav__tab shell-press"
      :aria-current="active === id ? 'true' : undefined"
      @click="$emit('select', id)"
    >
      <SectionIcon :id="id" />
      {{ t(`shell.sections.${id}`) }}
    </button>
  </nav>
</template>

<style scoped src="./shell.css"></style>
<style scoped>
.bottom-nav {
  display: flex;
  flex-shrink: 0;
  min-height: var(--mobile-nav);
  border-top: var(--border-strong);
  background-color: var(--top);
}

.bottom-nav__tab {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-height: var(--touch-target);
  padding: 0;
  border: 0;
  background-color: transparent;
  box-shadow: none;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: var(--font-weight-medium);
}

.bottom-nav__tab[aria-current='true'] {
  box-shadow: inset 0 3px 0 var(--accent);
  color: var(--accent);
  font-weight: var(--font-weight-bold);
}
</style>
