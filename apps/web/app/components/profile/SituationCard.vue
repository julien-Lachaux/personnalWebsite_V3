<script setup lang="ts">
// Encadré « en ce moment » + « ce que je recherche » (SPEC § 2, COMPOSANTS.md) : l'activité du moment, puis
// une liste de définitions format / lieu / disponibilité. Les textes viennent de `ProfileView`, les
// libellés de `profile.situation.*`.
//
// Niveaux de titre : la coquille pose le `h2` de la section, les deux blocs sont des `h3` (sous-blocs,
// pas de second `h2`). Chaque bloc est un groupe nommé par son titre (`aria-labelledby`).
import { useI18n } from '#imports';
import { useId } from 'vue';

defineProps<{
  /** « En ce moment » (`ProfileView.currently`). */
  currently: string;
  /** « Ce que je recherche » (`ProfileView.lookingFor`). */
  lookingFor: { readonly format: string; readonly location: string; readonly availability: string };
}>();

const { t } = useI18n();
const id = useId();
</script>

<template>
  <div class="situation">
    <div class="situation__block" role="group" :aria-labelledby="`${id}-now`">
      <h3 :id="`${id}-now`" class="situation__title">{{ t('profile.situation.now') }}</h3>
      <p class="situation__now">{{ currently }}</p>
    </div>
    <div
      class="situation__block situation__block--seeking"
      role="group"
      :aria-labelledby="`${id}-seeking`"
    >
      <h3 :id="`${id}-seeking`" class="situation__title">{{ t('profile.situation.seeking') }}</h3>
      <dl class="situation__list">
        <div>
          <dt class="situation__term">{{ t('profile.situation.format') }}</dt>
          <dd class="situation__value">{{ lookingFor.format }}</dd>
        </div>
        <div>
          <dt class="situation__term">{{ t('profile.situation.location') }}</dt>
          <dd class="situation__value">{{ lookingFor.location }}</dd>
        </div>
        <div>
          <dt class="situation__term">{{ t('profile.situation.availability') }}</dt>
          <dd class="situation__value">{{ lookingFor.availability }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>

<style scoped>
.situation {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem 0.875rem;
  border: var(--border-strong);
  border-radius: var(--radius-button);
}

.situation__block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.situation__block--seeking {
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: var(--border-dashed);
}

.situation__title {
  margin: 0;
  color: var(--violet);
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
}

.situation__now,
.situation__value {
  margin: 0;
  font-size: var(--font-size-lead);
  font-weight: var(--font-weight-semibold);
  line-height: 1.5;
}

.situation__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12.5rem), 1fr));
  gap: 0.625rem 1.125rem;
  margin: 0;
}

.situation__term {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.situation__value {
  margin-top: 0.125rem;
}

@media (min-width: 1024px) {
  .situation__now,
  .situation__value {
    font-size: var(--font-size-body-mobile);
  }
}
</style>
