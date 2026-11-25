<script setup lang="ts">
// Barre d'actions du mobile et de la tablette (F3-02, SPEC § 3.1) : « Lancer l'entretien » et « CV PDF »
// au-dessus de la navigation du bas. Composant sans état : `hidden` vient de `useActionBar` (masquage au
// défilement vers le bas, retour au défilement vers le haut et au changement d'onglet). Masquée, la
// barre se replie (hauteur animée, 260 ms), est retirée de l'affichage après l'animation et rendue
// `inert` : ses boutons ne reçoivent plus le focus.
import ContactButton from './ContactButton.vue';
import CvButton from './CvButton.vue';

defineProps<{
  /** La barre est repliée. */
  hidden: boolean;
  /** Lien du CV PDF. */
  cvPath: string;
}>();
</script>

<template>
  <div class="action-bar" :class="{ 'action-bar--hidden': hidden }" :inert="hidden">
    <div class="action-bar__clip">
      <div class="action-bar__buttons">
        <ContactButton class="action-bar__contact" size="md" />
        <CvButton class="action-bar__cv" :href="cvPath" size="md" placement="up" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Hauteur animée par `grid-template-rows` (1fr → 0fr) : elle suit le contenu, même texte agrandi. */
.action-bar {
  display: grid;
  flex-shrink: 0;
  grid-template-rows: 1fr;
  visibility: visible;
  transition:
    grid-template-rows var(--dur-cta-bar) var(--ease-ui),
    visibility 0s linear 0s;
}

.action-bar--hidden {
  grid-template-rows: 0fr;
  visibility: hidden;
  transition:
    grid-template-rows var(--dur-cta-bar) var(--ease-ui),
    visibility 0s linear var(--dur-cta-bar);
}

.action-bar__clip {
  min-height: 0;
  overflow: hidden;
}

.action-bar__buttons {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-height: var(--mobile-cta-bar);
  padding: 0.5rem 0.75rem;
  border-top: var(--border-strong);
  background-color: var(--top);
}

/* Base de la taille du contenu : les deux boutons passent sur deux lignes quand ils ne tiennent plus
   côte à côte (texte agrandi ou espacé, RA-4) au lieu de rogner le libellé du CV. */
.action-bar__contact {
  flex: 1 1 auto;
}

/* Menu du CV (D44) : la liste s'ouvre au-dessus du bouton, hors de la bande rognée (`overflow: hidden`
   sert au repli animé) tant que le menu est ouvert. Texte agrandi (WCAG 1.4.4, 1.4.10) : le libellé du
   bouton passe à la ligne et le bouton peut rétrécir, au lieu de sortir de l'écran (`white-space:
   nowrap` de base-button.css) ; un mot trop large se coupe (`overflow-wrap: anywhere`). */
.action-bar__clip:has([aria-expanded='true']) {
  overflow: visible;
}

.action-bar__cv {
  flex: 0 1 auto;
  min-width: 0;
}

.action-bar__cv :deep(.cv-menu__trigger) {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}
</style>
