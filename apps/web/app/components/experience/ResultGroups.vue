<script setup lang="ts">
// Résultats du filtre (SPEC § 5) : « Avec toutes ces technos · N » (ET strict), puis les autres expériences
// repliées derrière « Voir les N autres expériences », atténuées, avec « En partie : X » pour celles qui
// ont une partie des technos choisies (les correspondances partielles d'abord, puis les autres, chaque
// groupe dans l'ordre d'origine). Aucune page vide : si aucune expérience ne combine tout, un message et
// le bouton qui montre les autres. Sans filtre, toutes les expériences sont listées sans titre ni
// bouton. Le dépliage des autres retombe à replié dès que le filtre change.
import { computed, ref, useId, watch } from 'vue';
import { useI18n } from '#imports';

import type { ExperienceView } from '../../data/cv-view.js';
import { filterExperiences, type FilterTech } from '../../domain/filter.js';
import BaseButton from '../base/Button.vue';
import ExperienceCard from './ExperienceCard.vue';

const props = defineProps<{
  experiences: readonly ExperienceView[];
  /** Toutes les technos (noms des correspondances partielles). */
  techs: readonly FilterTech[];
  /** Slugs des technos choisies. */
  selected: readonly string[];
}>();
const emit = defineEmits<{ toggle: [slug: string]; 'easter-egg': [trigger: HTMLElement] }>();

const { t } = useI18n();
const ids = useId();
const fullTitleId = `${ids}-full`;
const othersTitleId = `${ids}-others`;
const othersOpen = ref(false);

watch(
  () => props.selected,
  () => {
    othersOpen.value = false;
  },
);

function forwardToggle(slug: string): void {
  emit('toggle', slug);
}

function forwardEasterEgg(trigger: HTMLElement): void {
  emit('easter-egg', trigger);
}

const result = computed(() => filterExperiences(props.experiences, props.selected));
/** Autres expériences : correspondances partielles d'abord. */
const others = computed(() => [...result.value.partial, ...result.value.none]);
const names = computed(() => new Map(props.techs.map((tech) => [tech.slug, tech.name])));

const fullTitle = computed(() => {
  const n = result.value.full.length;
  const [only] = props.selected;
  return props.selected.length === 1
    ? t('experience.results.withOne', { tech: names.value.get(only!)!, n })
    : t('experience.results.withAll', { n });
});

/** « Voir les N autres expériences » ; sans résultat complet, « Voir les N expériences ». */
const toggleLabel = computed(() => {
  const n = others.value.length;
  const scope = result.value.full.length > 0 ? '' : 'All';
  return t(`experience.results.${othersOpen.value ? 'hide' : 'show'}${scope}`, { n }, n);
});

function partialLabel(matched: readonly string[]): string | undefined {
  return matched.length > 0
    ? t('experience.results.partial', {
        techs: matched.map((slug) => names.value.get(slug)).join(', '),
      })
    : undefined;
}
</script>

<template>
  <div class="result-groups">
    <div v-if="result.active && result.full.length === 0" class="result-groups__empty">
      <p class="result-groups__message">{{ t('experience.results.empty') }}</p>
      <BaseButton
        variant="secondary"
        :aria-expanded="othersOpen ? 'true' : 'false'"
        @click="othersOpen = !othersOpen"
      >
        {{ toggleLabel }}
      </BaseButton>
    </div>
    <div
      v-if="result.full.length > 0"
      role="group"
      :aria-labelledby="result.active ? fullTitleId : undefined"
      :aria-label="result.active ? undefined : t('experience.list.label')"
    >
      <p v-if="result.active" :id="fullTitleId" class="result-groups__title">{{ fullTitle }}</p>
      <ExperienceCard
        v-for="{ experience } in result.full"
        :key="experience.slug"
        :experience="experience"
        :selected="selected"
        @toggle="forwardToggle"
        @easter-egg="forwardEasterEgg"
      />
    </div>
    <BaseButton
      v-if="result.full.length > 0 && others.length > 0"
      variant="secondary"
      class="result-groups__after"
      :aria-expanded="othersOpen ? 'true' : 'false'"
      @click="othersOpen = !othersOpen"
    >
      {{ toggleLabel }}
    </BaseButton>
    <div v-if="othersOpen" role="group" :aria-labelledby="othersTitleId">
      <p :id="othersTitleId" class="result-groups__title">
        {{ t('experience.results.others', { n: others.length }) }}
      </p>
      <ExperienceCard
        v-for="{ experience, matched } in others"
        :key="experience.slug"
        :experience="experience"
        :selected="selected"
        dimmed
        :partial="partialLabel(matched)"
        @toggle="forwardToggle"
        @easter-egg="forwardEasterEgg"
      />
    </div>
  </div>
</template>

<style scoped>
.result-groups__title {
  margin: 0.875rem 0 0.25rem;
  color: var(--violet);
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
}

.result-groups__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.375rem 0 1.125rem;
}

.result-groups__message {
  margin: 0;
  color: var(--muted);
  font-size: var(--font-size-body-mobile);
  line-height: 1.5;
}

.result-groups__after {
  margin: 0.375rem 0 0.625rem;
}
</style>
