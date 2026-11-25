<script setup lang="ts">
// Titre du profil (SPEC § 4.1, maquette) : « Développeur » en gras sur la première ligne, la suite
// (« full-stack ») en accent sur la seconde, suivie de la pastille « senior ». Les lignes viennent de
// `ProfileView.titleLines`, la pastille de `ProfileView.badge` ; aucun texte n'est écrit ici.
//
// `tag` : le niveau de titre est choisi par l'appelant. `h1` quand ce composant porte le titre de la
// page, `div` (par défaut) quand la coquille pose déjà le `h1` (même texte) : un seul `h1` par page.
// Pas de `nowrap` : la seconde ligne passe à la ligne si la pastille ne tient pas (texte agrandi à
// 130 %, reflux WCAG 1.4.10). Un mot plus large que la fenêtre (« Développeur » à 320 px, texte agrandi
// ou espacé) se coupe au lieu de déborder (`overflow-wrap: anywhere`, RA-3).
import SeniorBadge from '../base/SeniorBadge.vue';

withDefaults(
  defineProps<{
    /** Lignes de présentation : la première en gras, la seconde en accent (`ProfileView.titleLines`). */
    lines: readonly string[];
    /** Texte de la pastille accolée au titre (`ProfileView.badge`) ; vide : pas de pastille. */
    badge: string;
    tag?: 'h1' | 'div';
  }>(),
  { tag: 'div' },
);
</script>

<template>
  <component :is="tag" class="profile-title">
    <span class="profile-title__first">{{ lines[0] }}</span>
    <span class="profile-title__second">
      <span v-if="lines[1]" class="profile-title__accent">{{ lines[1] }}</span>
      <SeniorBadge v-if="badge">{{ badge }}</SeniorBadge>
    </span>
  </component>
</template>

<style scoped>
.profile-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--font-size-h1-mobile);
  font-weight: var(--font-weight-regular);
  line-height: 1.04;
  letter-spacing: -0.02em;
}

.profile-title__first {
  font-weight: var(--font-weight-bold);
}

.profile-title__second {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
}

.profile-title__accent {
  color: var(--accent);
  font-weight: var(--font-weight-regular);
}

@media (min-width: 768px) {
  .profile-title {
    font-size: var(--font-size-h1-tablet);
  }
}

@media (min-width: 1024px) {
  .profile-title {
    font-size: var(--font-size-h1-portable);
  }
}

@media (min-width: 1200px) {
  .profile-title {
    font-size: var(--font-size-h1-desktop);
  }
}
</style>
