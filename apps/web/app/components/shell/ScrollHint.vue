<script setup lang="ts">
// Flèche « faire défiler » (F3-02, SPEC § 3.1) : bouton rond centré, à 12 px au-dessus du bord bas de la
// zone qui la contient (le parent doit être positionné : `position: relative`, juste au-dessus de la
// barre d'actions). Affichée seulement si `visible` (du contenu reste caché, voir `useScrollHint`) ;
// un clic émet `scroll`. La flèche oscille doucement, sauf si les animations sont réduites.
import { useI18n } from '#imports';

defineProps<{ visible: boolean }>();
defineEmits<{ scroll: [] }>();

const { t } = useI18n();
</script>

<template>
  <button
    v-if="visible"
    type="button"
    class="scroll-hint"
    :aria-label="t('shell.scrollHint.label')"
    @click="$emit('scroll')"
  >
    <svg
      class="scroll-hint__arrow"
      aria-hidden="true"
      focusable="false"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  </button>
</template>

<style scoped>
.scroll-hint {
  position: absolute;
  inset-inline-start: 50%;
  bottom: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target);
  margin-inline-start: calc(var(--touch-target) / -2);
  padding: 0;
  border: var(--border-width) solid var(--accent);
  border-radius: var(--radius-pill);
  background-color: var(--card);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--scrim) 70%, transparent);
  color: var(--accent);
}

.scroll-hint__arrow {
  animation: scroll-hint-nudge 1.4s ease-in-out infinite;
}

@keyframes scroll-hint-nudge {
  0%,
  100% {
    transform: translateY(-2px);
  }

  50% {
    transform: translateY(3px);
  }
}

/* Mouvement réduit : la flèche reste immobile (réglage explicite, ou système sauf choix contraire). */
:root[data-motion='reduit'] .scroll-hint__arrow {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion='normal']) .scroll-hint__arrow {
    animation: none;
  }
}
</style>
