<script setup lang="ts">
// Zone fixe du filtre par techno, en haut de la section (SPEC § 5) : étiquette « filtrer par techno »,
// champ à puces (`ChipInput`), suggestions pendant la saisie (`SuggestionList`), panneau (`FilterDrawer`)
// et région `aria-live` du nombre de résultats. Les technos choisies sont le `v-model:selected` (la
// section les relie à l'URL) ; toutes les décisions (ET, compteurs, suggestions, Entrée, annonce) sont
// celles de `domain/filter`.
//
// Panneau : ouvert au clic ou au focus du champ (clavier compris), pas par un focus programmatique ;
// choisir une techno ne le ferme pas ; il se ferme par « Fermer », Échap (champ vide) ou défilement de
// la liste (`closeOnScroll`, ignoré les `SCROLL_GRACE_MS` qui suivent l'ouverture : l'ouverture elle-même
// peut faire défiler la liste). Pendant la saisie, les suggestions remplacent le panneau. Après chaque
// action qui retire le bouton cliqué (retrait d'une puce, Fermer, choix d'une suggestion), le focus
// revient dans le champ sans rouvrir le panneau.
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { useI18n } from '#imports';

import type { ExperienceView, TechsView } from '../../data/cv-view.js';
import {
  addTech,
  announceResults,
  firstValidSuggestion,
  removeLastTech,
  removeTech,
  suggest,
  techCounters,
  toggleTech,
  type FilterTech,
  type TechCounter,
} from '../../domain/filter.js';
import ChipInput from './ChipInput.vue';
import FilterDrawer from './FilterDrawer.vue';
import SuggestionList from './SuggestionList.vue';

/** Durée après l'ouverture pendant laquelle un défilement ne ferme pas le panneau. */
const SCROLL_GRACE_MS = 450;

const props = defineProps<{
  techs: TechsView;
  experiences: readonly ExperienceView[];
}>();

const selected = defineModel<readonly string[]>('selected', { required: true });

const { t } = useI18n();
const ids = useId();
const labelId = `${ids}-label`;
const drawerId = `${ids}-drawer`;
const suggestionsId = `${ids}-suggestions`;

const root = ref<HTMLElement | null>(null);
const chipInput = ref<{ focusQuietly: () => void } | null>(null);
const query = ref('');
const open = ref(false);
const allOpen = ref(false);
let openedAt = 0;

const searching = computed(() => query.value.trim() !== '');

const counters = computed(
  () =>
    new Map<string, TechCounter>(
      techCounters(props.techs.all, props.experiences, selected.value).map((counter) => [
        counter.slug,
        counter,
      ]),
    ),
);
function counterOf(slug: string): TechCounter {
  return counters.value.get(slug)!;
}

const techBySlug = computed(
  () => new Map<string, FilterTech>(props.techs.all.map((tech) => [tech.slug, tech])),
);
const chips = computed(() => selected.value.map((slug) => techBySlug.value.get(slug)!));

const suggestions = computed(() =>
  suggest(query.value, props.techs.all, props.experiences, selected.value),
);

const placeholder = computed(() =>
  selected.value.length > 0
    ? t('experience.filter.placeholderMore')
    : t('experience.filter.placeholderEmpty', { n: props.techs.total }),
);

const announcement = computed(() => {
  const { kind, count } = announceResults(props.experiences, selected.value);
  return t(`experience.filter.live.${kind}`, { n: count }, count);
});

function openDrawer(): void {
  if (open.value) return;
  open.value = true;
  openedAt = Date.now();
}

function closeDrawer(): void {
  open.value = false;
}

/** Défilement de la liste des résultats : ferme le panneau, sauf juste après son ouverture. */
function closeOnScroll(): void {
  if (open.value && Date.now() - openedAt > SCROLL_GRACE_MS) closeDrawer();
}

function focusField(): void {
  chipInput.value!.focusQuietly();
}

function select(next: readonly string[]): void {
  selected.value = next;
}

function pickSuggestion(slug: string): void {
  select(addTech(selected.value, slug));
  query.value = '';
  focusField();
}

function submit(): void {
  const first = firstValidSuggestion(suggestions.value);
  if (first) pickSuggestion(first.tech.slug);
}

function removeChip(slug: string): void {
  select(removeTech(selected.value, slug));
  focusField();
}

function clearAll(): void {
  select([]);
  query.value = '';
  focusField();
}

function showAllTechs(): void {
  query.value = '';
  allOpen.value = true;
  openDrawer();
}

function closeFromButton(): void {
  closeDrawer();
  focusField();
}

// Échap, du champ comme du panneau ou des suggestions : vide la saisie, sinon ferme le panneau ; le
// focus revient dans le champ (le panneau fermé est `inert`) sans le rouvrir. Écouteur posé à la main
// sur la zone (un `@keydown` sur un `div` est refusé par `vuejs-accessibility`), retiré au démontage.
function onEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  if (query.value !== '') {
    event.preventDefault();
    query.value = '';
    focusField();
  } else if (open.value) {
    event.preventDefault();
    closeDrawer();
    focusField();
  }
}

onMounted(() => root.value!.addEventListener('keydown', onEscape));
onBeforeUnmount(() => root.value!.removeEventListener('keydown', onEscape));

defineExpose({ closeOnScroll });
</script>

<template>
  <div class="tech-filter">
    <p :id="labelId" class="tech-filter__label">{{ t('experience.filter.label') }}</p>
    <div
      ref="root"
      class="tech-filter__search"
      role="search"
      :aria-label="t('experience.filter.searchLabel')"
    >
      <ChipInput
        ref="chipInput"
        v-model:query="query"
        :labelledby="labelId"
        :chips="chips"
        :placeholder="placeholder"
        :controls="searching ? suggestionsId : drawerId"
        @open="openDrawer"
        @submit="submit"
        @backspace-empty="select(removeLastTech(selected))"
        @remove="removeChip"
        @clear="clearAll"
      />
      <SuggestionList
        v-if="searching"
        :id="suggestionsId"
        :suggestions="suggestions"
        :query="query"
        @pick="pickSuggestion"
        @show-all="showAllTechs"
      />
      <FilterDrawer
        :id="drawerId"
        v-model:all-open="allOpen"
        :open="open && !searching"
        :techs="techs"
        :counter-of="counterOf"
        @toggle="select(toggleTech(selected, $event))"
        @close="closeFromButton"
      />
    </div>
    <p class="visually-hidden" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </div>
</template>

<style scoped>
.tech-filter {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.tech-filter__label {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
}

.tech-filter__search {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
