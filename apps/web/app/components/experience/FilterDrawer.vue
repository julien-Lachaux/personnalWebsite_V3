<script setup lang="ts">
// Panneau sous le champ du filtre (SPEC § 5) : « stack principale » (technos de `mainStack` qui ont au
// moins une expérience) et lien « Toutes les technos (N) » qui déplie toutes les technos par domaine
// (`AllTechs`, qui remplace alors la stack principale) ; bouton Fermer. Glissement (`grid-template-rows`
// 0fr → 1fr) et fondu sur `--dur-drawer` (280 ms ; 0,01 ms si le mouvement est réduit). Fermé, le panneau
// est `inert` et invisible une fois l'animation finie : ses boutons ne reçoivent plus le focus.
// Le composant ne décide ni de l'ouverture (`open`, posé par `TechFilter`) ni du filtre : il affiche les
// compteurs reçus et émet `toggle` et `close`.
import { computed } from 'vue';
import { useI18n } from '#imports';

import type { TechsView } from '../../data/cv-view.js';
import type { TechCounter } from '../../domain/filter.js';
import BaseButton from '../base/Button.vue';
import AllTechs from './AllTechs.vue';
import TechOption from './TechOption.vue';

const props = defineProps<{
  /** Identifiant de l'élément, repris par `aria-controls` du champ. */
  id: string;
  open: boolean;
  techs: TechsView;
  counterOf: (slug: string) => TechCounter;
}>();
const emit = defineEmits<{ toggle: [slug: string]; close: [] }>();

/** « Toutes les technos » déplié ; l'état survit à la fermeture du panneau. */
const allOpen = defineModel<boolean>('allOpen', { default: false });

const { t } = useI18n();

/** Technos de la stack principale qui ont au moins une expérience. */
const linkedMainStack = computed(() =>
  props.techs.mainStack.filter((tech) => props.counterOf(tech.slug).total > 0),
);
</script>

<template>
  <div :id="id" class="filter-drawer" :class="{ 'filter-drawer--open': open }" :inert="!open">
    <div class="filter-drawer__clip">
      <div class="filter-drawer__scroll">
        <div v-if="!allOpen" class="filter-drawer__quick">
          <span class="filter-drawer__label">{{ t('experience.drawer.mainStack') }}</span>
          <TechOption
            v-for="tech in linkedMainStack"
            :key="tech.slug"
            :tech="tech"
            :counter="counterOf(tech.slug)"
            @toggle="emit('toggle', $event)"
          />
        </div>
        <div class="filter-drawer__actions">
          <BaseButton
            variant="link"
            :aria-expanded="allOpen ? 'true' : 'false'"
            :aria-controls="`${id}-all`"
            @click="allOpen = !allOpen"
          >
            {{
              allOpen
                ? t('experience.drawer.hideAll')
                : t('experience.drawer.showAll', { n: techs.total })
            }}
            <template #trailing>
              <svg
                class="filter-drawer__chevron"
                :class="{ 'filter-drawer__chevron--open': allOpen }"
                focusable="false"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </template>
          </BaseButton>
        </div>
        <div :id="`${id}-all`">
          <AllTechs
            v-if="allOpen"
            :groups="techs.groups"
            :counter-of="counterOf"
            @toggle="emit('toggle', $event)"
          />
        </div>
        <BaseButton variant="link" tone="muted" class="filter-drawer__close" @click="emit('close')">
          {{ t('experience.drawer.close') }}
          <template #trailing>
            <svg
              focusable="false"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 15l6-6 6 6" />
            </svg>
          </template>
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Fermé : replié (0fr), transparent, puis retiré de l'affichage après l'animation ; ouvert : visible tout
   de suite. */
.filter-drawer {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  visibility: hidden;
  transition:
    grid-template-rows var(--dur-drawer) var(--ease-ui),
    opacity var(--dur-drawer) ease,
    visibility 0s linear var(--dur-drawer);
}

.filter-drawer--open {
  grid-template-rows: 1fr;
  opacity: 1;
  visibility: visible;
  transition:
    grid-template-rows var(--dur-drawer) var(--ease-ui),
    opacity var(--dur-drawer) ease,
    visibility 0s linear 0s;
}

.filter-drawer__clip {
  min-height: 0;
  overflow: hidden;
}

/* Hauteur bornée : au-delà, la liste défile (zone atteignable au clavier par les boutons qu'elle contient). */
.filter-drawer__scroll {
  display: flex;
  flex-direction: column;
  max-height: min(22.5rem, 50vh);
  padding: 0.625rem 0.125rem 0.125rem;
  overflow-y: auto;
  scrollbar-width: thin;
}

.filter-drawer__quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin: 0 0 0.625rem;
}

.filter-drawer__label {
  margin-inline-end: 0.25rem;
  color: var(--violet);
  font-family: var(--font-mono);
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-bold);
}

.filter-drawer__actions {
  display: flex;
  flex-wrap: wrap;
  margin: 0 0 0.625rem;
}

.filter-drawer__close {
  align-self: flex-end;
}

.filter-drawer__chevron {
  transition: transform var(--dur-press);
}

.filter-drawer__chevron--open {
  transform: rotate(180deg);
}
</style>
