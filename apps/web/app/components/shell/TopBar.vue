<script setup lang="ts">
// Barre du haut du bureau, dès 1024 px (F3-02, SPEC § 3.4 et § 3.5) : nom du site, vue d'ensemble,
// onglets des quatre sections, « Lancer l'entretien », CV PDF, accessibilité, langue, thème. Le contenu
// s'aligne sur la zone de 1440 px (la barre elle-même, fond et bordure, couvre toute la largeur).
// Composant sans état : `active` est la section agrandie (`null` : mosaïque, « vue d'ensemble »), la
// page écoute `select` et `overview`. Hauteur 56 px (`--desktop-header`, bordure comprise) ; elle ne
// grandit que si le texte agrandi ne tient plus sur une ligne.
import { useI18n } from '#imports';

import { SECTION_IDS, SITE_HANDLE, type SectionId } from '../../composables/shell/sections.js';
import ContactButton from './ContactButton.vue';
import CvButton from './CvButton.vue';
import HeaderControls from './HeaderControls.vue';

defineProps<{
  /** Section agrandie ; `null` : vue d'ensemble. */
  active: SectionId | null;
  /** Lien du CV PDF. */
  cvPath: string;
  /** Page de la déclaration d'accessibilité (adresse localisée). */
  declarationUrl: string;
}>();

defineEmits<{ select: [id: SectionId]; overview: [] }>();

const { t } = useI18n();
</script>

<template>
  <header class="top-bar">
    <p class="top-bar__brand">
      <span aria-hidden="true" class="top-bar__prompt">&gt;_</span> {{ SITE_HANDLE }}
    </p>
    <nav :aria-label="t('shell.nav.label')" class="top-bar__nav">
      <button
        type="button"
        class="top-bar__tab top-bar__tab--overview shell-press"
        :aria-label="t('shell.nav.overview')"
        :aria-current="active === null ? 'true' : undefined"
        @click="$emit('overview')"
      >
        <svg
          aria-hidden="true"
          focusable="false"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="3" width="7" height="18" rx="1.5" />
          <rect x="14" y="3" width="7" height="8" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </button>
      <button
        v-for="id in SECTION_IDS"
        :key="id"
        type="button"
        class="top-bar__tab shell-press"
        :aria-current="active === id ? 'true' : undefined"
        @click="$emit('select', id)"
      >
        {{ t(`shell.sections.${id}`) }}
      </button>
    </nav>
    <div class="top-bar__actions">
      <ContactButton />
      <CvButton :href="cvPath" />
    </div>
    <HeaderControls :declaration-url="declarationUrl" />
  </header>
</template>

<style scoped src="./shell.css"></style>
<style scoped>
.top-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 1rem;
  min-height: var(--desktop-header);
  /* Contenu aligné sur la zone de 1440 px : marges de 24 px à gauche, 16 px à droite (maquette). */
  padding-block: 0;
  padding-inline-start: max(1.5rem, calc((100% - var(--page-max)) / 2 + 1.5rem));
  padding-inline-end: max(1rem, calc((100% - var(--page-max)) / 2 + 1rem));
  border-bottom: var(--border-strong);
  background-color: var(--top);
}

.top-bar__brand {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
}

.top-bar__prompt {
  color: var(--accent);
}

.top-bar__nav {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}

.top-bar__tab {
  height: var(--desktop-control);
  padding: 0 0.875rem;
  border: 0;
  border-radius: var(--radius-control);
  background-color: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
}

.top-bar__tab--overview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--desktop-control);
  padding: 0;
}

.top-bar__tab:hover {
  color: var(--text);
}

.top-bar__tab[aria-current='true'] {
  background-color: var(--accent-bg);
  box-shadow: inset 0 -3px 0 var(--accent);
  color: var(--accent);
  font-weight: var(--font-weight-bold);
}

.top-bar__actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
}
</style>
