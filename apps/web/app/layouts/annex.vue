<script setup lang="ts">
// Gabarit des pages annexes (lot F7 : déclaration d'accessibilité, pages d'erreur) : l'en-tête du site
// au-dessus du contenu de la page. Le nom du site `>_ julien-lachaux` est le lien vers l'accueil (son
// nom accessible commence par le texte visible, WCAG 2.5.3) ; à droite, les mêmes contrôles que les
// barres de la page d'accueil : accessibilité, langue, thème. Le contenu (`<main id="contenu">`) vient
// de la page (`components/annex/AnnexPage.vue`).
//
// Une page l'emploie par `routeRules` (`appLayout: 'annex'`, nuxt.config.ts) ; `error.vue`, qui remplace
// app.vue, par `<NuxtLayout name="annex">`. Sans contrôles (`:controls="false"`, lot 30) pour une page
// servie sans JavaScript (page d'erreur serveur) : leurs boutons n'y feraient rien.
import HeaderControls from '../components/shell/HeaderControls.vue';
import { SITE_HANDLE } from '../composables/shell/sections.js';

withDefaults(
  defineProps<{
    /** Faux pour une page sans JavaScript : l'en-tête ne garde que le lien vers l'accueil. */
    controls?: boolean;
  }>(),
  { controls: true },
);

const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <div class="annex-layout">
    <header class="annex-layout__header">
      <NuxtLink :to="localePath('/')" class="annex-layout__home">
        <span aria-hidden="true" class="annex-layout__prompt">&gt;_</span>
        {{ SITE_HANDLE }}<span class="visually-hidden"> ({{ t('annex.home') }})</span>
      </NuxtLink>
      <HeaderControls v-if="controls" :declaration-url="localePath('/accessibilite')" />
    </header>
    <slot />
  </div>
</template>

<style scoped>
.annex-layout {
  min-height: 100dvh;
  background-color: var(--bg);
  color: var(--text);
}

.annex-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: var(--mobile-header);
  padding-block: 0;
  padding-inline: var(--mobile-gutter) 0.5rem;
  border-bottom: var(--border-strong);
  background-color: var(--bar);
}

.annex-layout__home {
  display: inline-flex;
  align-items: center;
  gap: 0.5ch;
  min-width: 0;
  min-height: var(--touch-target);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: var(--font-weight-bold);
  text-decoration: none;
  white-space: nowrap;
}

.annex-layout__home:hover {
  text-decoration: underline;
}

.annex-layout__prompt {
  color: var(--accent);
}

@media (min-width: 1024px) {
  .annex-layout__header {
    min-height: var(--desktop-header);
    padding-inline: max(1.5rem, calc((100% - var(--page-max)) / 2 + 1.5rem))
      max(1rem, calc((100% - var(--page-max)) / 2 + 1rem));
    background-color: var(--top);
  }

  .annex-layout__home {
    font-size: var(--font-size-small);
  }
}
</style>
