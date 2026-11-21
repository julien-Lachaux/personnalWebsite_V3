<script setup lang="ts">
// Page d'accueil réelle (lot F3a, sections branchées au lot F5c) : le CV de la langue courante, lu au
// build par `useCv` (API ou fixtures selon NUXT_CV_SOURCE), mis en forme par `mapCv` (docs/04),
// affiché dans la coquille. Composant partagé, réservé au lead-architecte ; `pages/index.vue` le rend.
//
// Chaque slot d'`AppShell` reçoit le composant de sa section avec son morceau de `view` (jamais le
// contrat) :
// - Profil : le grand titre visible est celui de `ProfileTitle` (balise `div`) ; le `h1` de la page est
//   celui de la coquille, masqué visuellement (un seul `h1`).
// - Expérience : la section a sa propre zone qui défile (la liste sous le filtre) ; elle est donnée à la
//   coquille (`scrollers`) pour la barre d'actions et la flèche, et la section remplit l'onglet XP.
//   Marges et fondu du bas suivent la mise en page de l'onglet (variables de la section).
// - IA : rien quand l'API ne sert pas de section IA.
import { computed, useTemplateRef } from 'vue';
import { useHead, useI18n, useLocalePath } from '#imports';

import { useCv } from '../../composables/use-cv.js';
import { mapCv } from '../../data/map-cv.js';
import AiSection from '../ai/AiSection.vue';
import ExperienceSection from '../experience/ExperienceSection.vue';
import ProfileSection from '../profile/ProfileSection.vue';
import RecommendationsSection from '../recommendations/RecommendationsSection.vue';
import AppShell from '../shell/AppShell.vue';

const { locale, t } = useI18n();
const localePath = useLocalePath();

const cv = await useCv(locale.value);
const view = computed(() =>
  mapCv(cv, {
    present: t('experience.present'),
    breakOrganisation: t('experience.breakOrganisation'),
    workMode: (value) => t(`experience.workMode.${value}`),
    contractType: (value) => t(`experience.contractType.${value}`),
  }),
);

/** Ce que la section Expérience expose (`defineExpose`). */
interface ExperienceSectionExposed {
  scroller: HTMLElement | null;
}

const experience = useTemplateRef<ExperienceSectionExposed>('experience');
/** Zone qui défile de la section Expérience (nulle avant le montage). */
const scrollers = computed(() => ({ experience: experience.value?.scroller ?? null }));

useHead(() => ({
  title: `${cv.profile.firstName} ${cv.profile.lastName} · ${view.value.profile.title}`,
}));
</script>

<template>
  <AppShell
    :heading="view.profile.title"
    :cv-path="view.profile.cvPath"
    :declaration-url="localePath('/accessibilite')"
    :scrollers="scrollers"
  >
    <template #profile>
      <ProfileSection :profile="view.profile" :links="view.links" />
    </template>
    <template #experience>
      <ExperienceSection
        ref="experience"
        class="home-page__experience"
        :experiences="view.experiences"
        :techs="view.techs"
      />
    </template>
    <template #recommendations>
      <RecommendationsSection
        :recommendations="view.recommendations"
        :source="view.links.linkedinRecommendations"
      />
    </template>
    <template #ai>
      <AiSection v-if="view.ai" :ai="view.ai" />
    </template>
  </AppShell>
</template>

<style scoped>
/* Onglet XP (mobile et tablette) : marges de la colonne de l'onglet, fondu sur le fond de la page.
   Au-delà, celles de la tuile (défauts de la section). */
@media (max-width: 1023px) {
  .home-page__experience {
    --experience-gutter: var(--mobile-gutter);
    --experience-bg: var(--bg);
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .home-page__experience {
    --experience-gutter: max(2rem, (100% - 40rem) / 2);
  }
}
</style>
