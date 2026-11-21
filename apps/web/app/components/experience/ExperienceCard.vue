<script setup lang="ts">
// Carte d'expérience (SPEC § 6) : intitulé, organisation, période, lieu · mode · contrat, résumé, détail en
// accordéon (`Accordion` de base : `aria-expanded` / `aria-controls`, 320 ms), puces de stack qui activent
// ou désactivent le filtre. Sans détail (pause professionnelle, mentorat…), pas d'accordéon. Le séparateur
// est sous la carte. `dimmed` : carte repliée derrière « Voir les N autres », atténuée.
import { computed, ref, useId } from 'vue';
import { useI18n } from '#imports';

import type { ExperienceView } from '../../data/cv-view.js';
import BaseAccordion from '../base/Accordion.vue';
import CardHeader from './CardHeader.vue';
import CardIntro from './CardIntro.vue';
import CardStack from './CardStack.vue';

const props = defineProps<{
  experience: ExperienceView;
  /** Slugs des technos choisies. */
  selected: readonly string[];
  dimmed?: boolean;
  /** « En partie : X » (déjà composé) ; absent hors des cartes atténuées. */
  partial?: string | undefined;
}>();
const emit = defineEmits<{ toggle: [slug: string]; 'easter-egg': [trigger: HTMLElement] }>();

const { t } = useI18n();
const titleId = useId();
const expanded = ref(false);

function forwardToggle(slug: string): void {
  emit('toggle', slug);
}

function forwardEasterEgg(trigger: HTMLElement): void {
  emit('easter-egg', trigger);
}

const toggleLabel = computed(() =>
  props.experience.organisation
    ? t('experience.card.detailAt', {
        title: props.experience.title,
        organisation: props.experience.organisation,
      })
    : t('experience.card.detail', { title: props.experience.title }),
);
</script>

<template>
  <article
    class="experience-card"
    :class="{ 'experience-card--dimmed': dimmed }"
    :aria-labelledby="titleId"
  >
    <BaseAccordion
      v-if="experience.achievements.length > 0"
      v-model="expanded"
      :toggle-label="toggleLabel"
    >
      <template #header>
        <CardHeader :experience="experience" :title-id="titleId" />
      </template>
      <template #intro>
        <CardIntro :experience="experience" :partial="partial" />
      </template>
      <ul class="experience-card__details">
        <li v-for="achievement in experience.achievements" :key="achievement">
          <span class="experience-card__dash" aria-hidden="true">—</span>
          <span>{{ achievement }}</span>
        </li>
      </ul>
      <template #footer>
        <CardStack
          :experience="experience"
          :selected="selected"
          @toggle="forwardToggle"
          @easter-egg="forwardEasterEgg"
        />
      </template>
    </BaseAccordion>
    <div v-else class="experience-card__plain">
      <CardHeader :experience="experience" :title-id="titleId" />
      <CardIntro :experience="experience" :partial="partial" />
      <CardStack
        :experience="experience"
        :selected="selected"
        @toggle="forwardToggle"
        @easter-egg="forwardEasterEgg"
      />
    </div>
  </article>
</template>

<style scoped>
/* Séparateur sous chaque carte (pas au-dessus : pas de double trait sous la zone fixe). */
.experience-card {
  padding: 1.25rem 0;
  border-bottom: var(--border-thin);
}

/* Atténuée (SPEC § 5) mais lisible : la maquette descend à 0,6, ce qui ne laisse que 2,8:1 au texte
   atténué du thème clair (4,5:1 exigé, SPEC § 10.2). L'atténuation passe donc surtout par la couleur
   (texte en `--muted`) et une opacité légère (0,9) qui garde au moins 4,5:1 dans les quatre palettes,
   y compris sur le fond de page du mobile (`--bg`, plus sombre que `--card`). */
.experience-card--dimmed {
  opacity: 0.9;
}

.experience-card--dimmed :deep(.card-header__title),
.experience-card--dimmed :deep(.card-header__org),
.experience-card--dimmed :deep(.card-header__period),
.experience-card--dimmed :deep(.card-intro__summary),
.experience-card--dimmed .experience-card__details {
  color: var(--muted);
}

.experience-card__plain {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.experience-card__details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.experience-card__details li {
  display: flex;
  gap: 0.625rem;
  font-size: var(--font-size-body-mobile);
  line-height: 1.5;
}

.experience-card__dash {
  flex-shrink: 0;
  color: var(--accent);
}
</style>
