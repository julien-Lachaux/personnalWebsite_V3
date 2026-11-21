<script setup lang="ts">
// Section Expérience (SPEC § 5 et § 6, `experience.log`) : zone fixe du filtre par techno (`TechFilter`) au
// sommet, puis la liste des cartes qui défile seule (`ResultGroups`), et l'easter egg « Huile de coude »
// (`EasterEggWindow`). Reçoit son morceau de la vue (`view.experiences`, `view.techs`), jamais le contrat.
//
// - Les technos choisies vivent dans l'URL (`?tech=kafka,typescript`, `useTechFilter`) : partageables,
//   conservées quand on change d'onglet.
// - Mise en page : la racine occupe la hauteur de son parent (`height: 100%`, ou `flex: 1` dans un parent
//   flex en colonne). Cette hauteur doit être définie et le parent ne doit pas défiler (tuile sans
//   défilement propre, onglet du mobile) : seule la liste défile, région nommée atteignable au clavier.
//   `--experience-gutter` règle les marges latérales (24 px par défaut), `--experience-bg` la couleur du
//   fondu du bas de liste (`--card` par défaut) : variables lues avec repli, jamais déclarées ici, pour
//   que le parent les pose sur la racine (classe) ou au-dessus (lot F5c).
// - Un clic sur une puce de carte bascule le filtre et remonte la liste en haut ; défiler la liste ferme
//   le panneau du filtre. `scroller` (exposé) est l'élément de la liste, pour la barre d'actions et la
//   flèche de défilement de la coquille.
import { nextTick, ref } from 'vue';
import { useI18n } from '#imports';

import { useTechFilter } from '../../composables/experience/useTechFilter.js';
import type { ExperienceView, TechsView } from '../../data/cv-view.js';
import { toggleTech } from '../../domain/filter.js';
import EasterEggWindow from './EasterEggWindow.vue';
import ResultGroups from './ResultGroups.vue';
import TechFilter from './TechFilter.vue';

const props = defineProps<{
  experiences: readonly ExperienceView[];
  techs: TechsView;
}>();

const { t } = useI18n();
const { selected } = useTechFilter(() => props.techs.all.map((tech) => tech.slug));

const filter = ref<{ closeOnScroll: () => void } | null>(null);
const list = ref<HTMLElement | null>(null);
const eggOpen = ref(false);
const eggTrigger = ref<HTMLElement | null>(null);

function toggleFromCard(slug: string): void {
  selected.value = toggleTech(selected.value, slug);
  void nextTick(() => {
    list.value!.scrollTop = 0;
  });
}

function openEasterEgg(trigger: HTMLElement): void {
  eggTrigger.value = trigger;
  eggOpen.value = true;
}

// La liste est la zone qui défile : la coquille (barre d'actions, flèche « faire défiler ») la lit.
defineExpose({ scroller: list });
</script>

<template>
  <div class="experience-section">
    <div class="experience-section__filter">
      <div class="experience-section__inner">
        <TechFilter
          ref="filter"
          v-model:selected="selected"
          :techs="techs"
          :experiences="experiences"
        />
      </div>
    </div>
    <div
      ref="list"
      class="experience-section__list"
      role="region"
      tabindex="0"
      :aria-label="t('experience.list.label')"
      @scroll.passive="filter!.closeOnScroll()"
    >
      <div class="experience-section__inner experience-section__inner--list">
        <ResultGroups
          :experiences="experiences"
          :techs="techs.all"
          :selected="selected"
          @toggle="toggleFromCard"
          @easter-egg="openEasterEgg"
        />
        <div class="experience-section__fade" aria-hidden="true"></div>
      </div>
    </div>
    <EasterEggWindow v-model:open="eggOpen" :return-focus-to="eggTrigger" />
  </div>
</template>

<style scoped>
.experience-section {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* Zone fixe : hors de la liste qui défile, aucun texte ne passe dessous. */
.experience-section__filter {
  flex-shrink: 0;
  padding: 0.75rem 0;
  border-bottom: var(--border-thin);
}

.experience-section__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
}

.experience-section__inner {
  box-sizing: border-box;
  max-width: var(--content-max);
  margin-inline: auto;
  padding-inline: var(--experience-gutter, var(--tile-padding));
}

.experience-section__inner--list {
  display: flex;
  flex-direction: column;
  padding-top: 0.875rem;
}

/* Fondu en bas de la liste : le texte ne se coupe pas net sur le bord de la tuile. */
.experience-section__fade {
  position: sticky;
  bottom: 0;
  flex-shrink: 0;
  height: 1.5rem;
  margin-top: -1.25rem;
  background: linear-gradient(to bottom, transparent, var(--experience-bg, var(--card)));
  pointer-events: none;
}
</style>
