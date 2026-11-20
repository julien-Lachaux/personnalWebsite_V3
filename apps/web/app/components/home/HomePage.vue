<script setup lang="ts">
// Page d'accueil réelle (lot F3a) : le CV de la langue courante, lu au build par `useCv` (API ou
// fixtures selon NUXT_CV_SOURCE), mis en forme par `mapCv` (docs/04), affiché dans la coquille.
// Composant partagé, réservé au lead-architecte ; `pages/index.vue` le rend.
//
// Contenu PROVISOIRE et minimal de chaque section, tiré des données, en attendant les sections du
// lot F5 (profil, expériences, recommandations, IA) : chaque slot recevra alors le composant de sa
// section avec son morceau de `view` (jamais le contrat).
import { computed } from 'vue';
import { useHead, useI18n, useLocalePath } from '#imports';

import { useCv } from '../../composables/use-cv.js';
import { mapCv } from '../../data/map-cv.js';
import SeniorBadge from '../base/SeniorBadge.vue';
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

useHead(() => ({
  title: `${cv.profile.firstName} ${cv.profile.lastName} · ${view.value.profile.title}`,
}));
</script>

<template>
  <AppShell
    :heading="view.profile.title"
    :cv-path="view.profile.cvPath"
    :declaration-url="localePath('/accessibilite')"
  >
    <template #profile>
      <p>
        <SeniorBadge>{{ view.profile.badge }}</SeniorBadge>
      </p>
      <ul>
        <li v-for="tagline in view.profile.taglines" :key="tagline">{{ tagline }}</li>
      </ul>
      <p>{{ view.profile.intro }}</p>
    </template>
    <template #experience>
      <p>{{ t('experience.provisional.count', view.experiences.length) }}</p>
    </template>
    <template #recommendations>
      <p>{{ t('recommendations.provisional.count', view.recommendations.length) }}</p>
    </template>
    <template #ai>
      <p v-if="view.ai">{{ view.ai.title }}</p>
    </template>
  </AppShell>
</template>
