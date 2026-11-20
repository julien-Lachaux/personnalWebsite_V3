<script setup lang="ts">
// En-tête du mobile et de la tablette, sous 1024 px (F3-02, SPEC § 3.1) : `>_ julien-lachaux/<fichier de
// l'onglet>` (préfixe gris, fichier en gras, ellipse si trop long), puis accessibilité, langue, thème.
// Hauteur 52,5 px bordure comprise (`--mobile-header`) ; les boutons font 44 px.
import { SECTION_FILES, SITE_HANDLE, type SectionId } from '../../composables/shell/sections.js';
import HeaderControls from './HeaderControls.vue';

defineProps<{
  /** Section affichée : donne le nom du fichier. */
  active: SectionId;
  /** Page de la déclaration d'accessibilité (adresse localisée). */
  declarationUrl: string;
}>();
</script>

<template>
  <header class="mobile-header">
    <p class="mobile-header__title">
      <span aria-hidden="true" class="mobile-header__prompt">&gt;_</span>{{ ' '
      }}<span class="mobile-header__handle">{{ SITE_HANDLE }}/</span
      ><span>{{ SECTION_FILES[active] }}</span>
    </p>
    <HeaderControls :declaration-url="declarationUrl" />
  </header>
</template>

<style scoped>
.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--mobile-header);
  padding-block: 0;
  padding-inline: var(--mobile-gutter) 0.5rem;
  border-bottom: var(--border-strong);
  background-color: var(--bar);
}

.mobile-header__title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: var(--font-weight-bold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-header__prompt {
  color: var(--accent);
}

.mobile-header__handle {
  color: var(--muted);
  font-weight: var(--font-weight-medium);
}
</style>
