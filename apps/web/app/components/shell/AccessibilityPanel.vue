<script setup lang="ts">
// Panneau d'accessibilité `accessibilite.cfg` (F3-04, SPEC § 10.1) : déclencheur dans les barres du haut
// et `Popover` non modal (`aria-haspopup="dialog"`, focus sur le premier réglage à l'ouverture, Échap
// ou × ferment et rendent le focus au déclencheur). Réglages mémorisés par `usePreferences` : taille du
// texte (groupe de boutons `aria-pressed`), cinq interrupteurs, Réinitialiser (supprime le réglage
// enregistré, D11), lien vers la déclaration d'accessibilité (`declarationUrl`, déjà localisée) et
// statut de conformité.
//
// Position : sous la barre du haut, à droite ; sur mobile, sur toute la largeur moins les marges.
// À faire (D18) : le nom accessible de la fenêtre devrait être « Réglages d'accessibilité »
// (`shell.accessibility.panelLabel`), le nom de fichier restant le titre visible ; `Popover` n'a pas
// encore de prop pour les séparer (voir le compte rendu du lot F3b).
import { computed, ref, useId, watch, type ButtonHTMLAttributes } from 'vue';
import { useI18n } from '#imports';

import { usePreferences } from '../../composables/shell/usePreferences.js';
import type { Preferences, TextSize } from '../../domain/preferences.js';
import BaseButton from '../base/Button.vue';
import BasePopover from '../base/Popover.vue';
import BaseSegmentedControl from '../base/SegmentedControl.vue';
import BaseSwitch from '../base/Switch.vue';

defineProps<{ declarationUrl: string }>();

type SizeKey = '100' | '115' | '130';
type FlagKey = 'highContrast' | 'readableFont' | 'textSpacing' | 'underlineLinks' | 'reduceMotion';

const SIZE_BY_KEY: Record<SizeKey, TextSize> = { '100': 100, '115': 115, '130': 130 };
const KEY_BY_SIZE: Record<TextSize, SizeKey> = { 100: '100', 115: '115', 130: '130' };
const FLAGS: readonly FlagKey[] = [
  'highContrast',
  'readableFont',
  'textSpacing',
  'underlineLinks',
  'reduceMotion',
];

const { t } = useI18n();
const { preferences, set, reset } = usePreferences();

const open = ref(false);
const sizeLabelId = useId();
const resetMessage = ref('');

const sizeOptions = computed(() => [
  { value: '100' as const, label: 'A', ariaLabel: t('shell.accessibility.textSize.normal') },
  { value: '115' as const, label: 'A', ariaLabel: t('shell.accessibility.textSize.large') },
  { value: '130' as const, label: 'A', ariaLabel: t('shell.accessibility.textSize.larger') },
]);
const sizeKey = computed<SizeKey>({
  get: () => KEY_BY_SIZE[preferences.value.textSize],
  set: (key) => set('textSize', SIZE_BY_KEY[key]),
});

function flag(key: FlagKey): Preferences[FlagKey] {
  return preferences.value[key];
}

function onReset(): void {
  reset();
  resetMessage.value = t('shell.accessibility.resetDone');
}

// Le message de réinitialisation n'a de sens que pour l'ouverture en cours.
watch(open, () => {
  resetMessage.value = '';
});
</script>

<template>
  <BasePopover
    v-model:open="open"
    class="a11y-panel"
    title="accessibilite.cfg"
    :close-label="t('shell.accessibility.close')"
  >
    <template #trigger="{ props: trigger }">
      <button
        v-bind="trigger as ButtonHTMLAttributes"
        type="button"
        class="shell-icon-button shell-press"
        :aria-label="t('shell.accessibility.open')"
      >
        <svg
          aria-hidden="true"
          focusable="false"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="7" r="1.4" fill="currentColor" />
          <path d="M7 9.5l5 1.2 5-1.2M12 10.7v3.6M12 14.3l-2.6 4.4M12 14.3l2.6 4.4" />
        </svg>
      </button>
    </template>

    <div class="a11y-panel__content">
      <div class="a11y-panel__group">
        <span :id="sizeLabelId" class="a11y-panel__label">{{
          t('shell.accessibility.textSize.label')
        }}</span>
        <BaseSegmentedControl
          v-model="sizeKey"
          :options="sizeOptions"
          :aria-labelledby="sizeLabelId"
        >
          <template #option="{ option }">
            <span :class="`a11y-panel__size a11y-panel__size--${option.value}`">{{
              option.label
            }}</span>
          </template>
        </BaseSegmentedControl>
      </div>

      <div role="group" :aria-label="t('shell.accessibility.display')">
        <BaseSwitch
          v-for="key in FLAGS"
          :key="key"
          :model-value="flag(key)"
          :label="t(`shell.accessibility.${key}.label`)"
          :description="t(`shell.accessibility.${key}.description`)"
          @update:model-value="set(key, $event)"
        />
      </div>

      <div class="a11y-panel__footer">
        <BaseButton variant="secondary" @click="onReset">{{
          t('shell.accessibility.reset')
        }}</BaseButton>
        <NuxtLink :to="declarationUrl" class="a11y-panel__link">{{
          t('shell.accessibility.declaration')
        }}</NuxtLink>
      </div>

      <i18n-t keypath="shell.accessibility.status" tag="p" class="a11y-panel__status">
        <template #pending>
          <em>{{ t('shell.accessibility.pending') }}</em>
        </template>
      </i18n-t>
      <p class="visually-hidden" role="status">{{ resetMessage }}</p>
    </div>
  </BasePopover>
</template>

<style scoped src="./shell.css"></style>
<style scoped>
/* Position du panneau (variables lues par `Popover`) : 62 px sous le haut du bureau, 60 px et pleine
   largeur moins les marges sur mobile et tablette. */
.a11y-panel {
  --popover-top: 3.875rem;
  --popover-right: 0.75rem;
  --popover-width: 22.5rem;
}

@media (max-width: 767px) {
  .a11y-panel {
    --popover-top: 3.75rem;
    --popover-width: calc(100vw - 1.5rem);
  }
}

.a11y-panel__content {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 0.875rem 1rem 1rem;
}

.a11y-panel__group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.a11y-panel__label {
  color: var(--violet);
  font-family: var(--font-mono);
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-bold);
}

/* Les trois « A » grandissent comme la taille qu'ils choisissent (maquette : 15, 19, 23 px). */
.a11y-panel__size--100 {
  font-size: 0.9375rem;
}

.a11y-panel__size--115 {
  font-size: 1.1875rem;
}

.a11y-panel__size--130 {
  font-size: 1.4375rem;
}

.a11y-panel__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.625rem;
}

.a11y-panel__link {
  color: var(--accent);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.a11y-panel__status {
  margin: 0;
  color: var(--muted);
  font-size: var(--font-size-meta);
  line-height: 1.4;
}
</style>
