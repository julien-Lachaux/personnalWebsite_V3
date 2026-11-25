<script setup lang="ts">
// Section IA (F5-A, SPEC § 2) : titre, bloc « dans le produit » (étiquette + liste), bloc « au quotidien »
// (étiquette + texte) et mots-clés. Contenu : `CvView.ai` (`AiView`), non nul : la page ne rend pas la
// section quand l'API ne la sert pas.
//
// Niveaux de titre : la coquille pose le `h2` « IA » ; le titre de la maquette est un `h3` et les deux
// étiquettes de bloc des `h4` (elles nomment la liste et le paragraphe qui suivent, `aria-labelledby`).
// Les mots-clés sont des puces neutres non interactives (liste), pas des `TechChip` : un `TechChip`
// non cliquable est un pointillé « sans expérience » du filtre, et rien ici ne se clique.
import { useI18n } from '#imports';
import { useId } from 'vue';

import { type AiView } from '../../data/cv-view.js';

defineProps<{
  /** `CvView.ai`. */
  ai: AiView;
}>();

const { t } = useI18n();
const id = useId();
</script>

<template>
  <div class="ai">
    <h3 class="ai__title">{{ ai.title }}</h3>
    <div class="ai__block">
      <h4 :id="`${id}-product`" class="ai__label">{{ ai.inProduct.label }}</h4>
      <ul class="ai__list" :aria-labelledby="`${id}-product`">
        <li v-for="(item, index) in ai.inProduct.items" :key="index">{{ item }}</li>
      </ul>
    </div>
    <div class="ai__block" role="group" :aria-labelledby="`${id}-daily`">
      <h4 :id="`${id}-daily`" class="ai__label">{{ ai.daily.label }}</h4>
      <p class="ai__text">{{ ai.daily.text }}</p>
    </div>
    <ul v-if="ai.tags.length > 0" class="ai__tags" :aria-label="t('ai.tagsLabel')">
      <li v-for="tag in ai.tags" :key="tag.slug" class="ai__tag">{{ tag.name }}</li>
    </ul>
  </div>
</template>

<style scoped>
.ai {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: var(--content-max);
  margin-inline: auto;
}

.ai__title {
  margin: 0;
  font-size: var(--font-size-h2-section);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.ai__block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai__label {
  margin: 0;
  color: var(--violet);
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
}

.ai__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding-left: 1.125rem;
  font-size: var(--font-size-lead);
  line-height: 1.5;
}

.ai__text {
  margin: 0;
  font-size: var(--font-size-lead);
  line-height: 1.5;
}

.ai__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Bordure décorative (`--line`) : la puce ne s'active pas, elle n'est pas un contrôle (D12). */
.ai__tag {
  padding: 0.4375rem 0.625rem;
  border: var(--border-strong);
  border-radius: var(--radius-chip);
  font-size: var(--font-size-body-mobile);
  font-weight: var(--font-weight-medium);
}

@media (min-width: 1024px) {
  .ai {
    gap: 1.125rem;
  }

  .ai__title {
    font-size: var(--font-size-h3-tile);
    letter-spacing: -0.01em;
    line-height: 1.15;
  }

  .ai__list {
    gap: 0.375rem;
    font-size: var(--font-size-body-mobile);
  }

  .ai__text {
    font-size: var(--font-size-body-mobile);
  }

  .ai__tag {
    padding-block: 0.375rem;
    font-size: var(--font-size-body);
  }
}
</style>
