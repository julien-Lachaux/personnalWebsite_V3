<script setup lang="ts">
// Easter egg « Huile de coude » (SPEC § 8) : fenêtre modale `huile-de-coude.sh` ouverte par la puce de la
// pause professionnelle. Des lignes de terminal apparaissent une à une (textes de `data/site-content.json`,
// `easterEgg.lines`), puis une barre de progression, puis « Terminé » ; « Retour au CV » (ou ×, Échap, voile)
// ferme et rend le focus à la puce (`returnFocusTo`). La fenêtre est celle de l'élément de base `Window`
// (modale, piège de focus, défilement de la page bloqué) ; son nom accessible est explicite, le nom de
// fichier reste le titre visible (D18).
// Animation en CSS : chaque ligne a un délai (`--line-delay`), mis à zéro quand le mouvement est réduit
// (`prefers-reduced-motion` ou « réduire les animations », sauf choix contraire `data-motion="normal"`) :
// toutes les lignes sont alors affichées d'emblée, la barre est pleine (les durées valent 0,01 ms,
// base.css). Les lignes sont toujours dans le DOM : un lecteur d'écran les lit sans attendre l'animation.
import { useI18n } from '#imports';

import BaseButton from '../base/Button.vue';
import BaseWindow from '../base/Window.vue';

defineProps<{
  /** Élément à refocaliser à la fermeture (la puce qui a ouvert la fenêtre). */
  returnFocusTo?: HTMLElement | null | undefined;
}>();

const open = defineModel<boolean>('open', { default: false });

const { t } = useI18n();

/** Délai d'apparition de chaque ligne, en secondes (maquette v6). */
const DELAYS = { install: 0.2, installed: 0.9, build: 2.7, done: 4.4 } as const;
/** Lignes `[ok]` : clé du libellé et délai. */
const OK_LINES = [
  { key: 'muscles', delay: 1.5 },
  { key: 'patience', delay: 1.9 },
  { key: 'tests', delay: 2.3 },
] as const;
/** La barre démarre un peu après l'apparition de sa ligne. */
const BAR_DELAY = 2.9;

function delay(seconds: number): Record<string, string> {
  return { '--line-delay': `${seconds}s` };
}
</script>

<template>
  <BaseWindow
    v-model:open="open"
    title="huile-de-coude.sh"
    tone="neon"
    :label="t('experience.easterEgg.label')"
    :close-label="t('experience.easterEgg.closeWindow')"
    :return-focus-to="returnFocusTo"
  >
    <div class="egg">
      <div class="egg__terminal">
        <p class="egg__line" :style="delay(DELAYS.install)">
          <span class="egg__prompt" aria-hidden="true">$</span>
          {{ t('experience.easterEgg.install') }}
        </p>
        <p class="egg__line egg__line--muted" :style="delay(DELAYS.installed)">
          {{ t('experience.easterEgg.installed') }}
        </p>
        <p v-for="line in OK_LINES" :key="line.key" class="egg__line" :style="delay(line.delay)">
          <span class="egg__ok">[ok]</span> {{ t(`experience.easterEgg.${line.key}`) }}
        </p>
        <div class="egg__line egg__build" :style="delay(DELAYS.build)">
          <p class="egg__muted">{{ t('experience.easterEgg.build') }}</p>
          <div class="egg__bar" aria-hidden="true">
            <div class="egg__fill" :style="delay(BAR_DELAY)"></div>
          </div>
        </div>
        <p class="egg__line egg__done" :style="delay(DELAYS.done)">
          {{ t('experience.easterEgg.done') }}
        </p>
      </div>
      <div class="egg__footer">
        <BaseButton size="md" block @click="open = false">
          {{ t('experience.easterEgg.close') }}
        </BaseButton>
      </div>
    </div>
  </BaseWindow>
</template>

<style scoped>
.egg {
  --egg-line-duration: 350ms;
  --egg-bar-duration: 1400ms;
  /* 1 : les délais de la maquette ; 0 : mouvement réduit, tout apparaît d'emblée. */
  --egg-delay-scale: 1;
}

.egg__terminal {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 1.125rem;
  background-color: var(--bg);
  font-family: var(--font-mono);
  font-size: var(--font-size-meta);
  line-height: 1.7;
}

.egg__terminal p {
  margin: 0;
}

.egg__line {
  opacity: 0;
  animation: egg-line var(--egg-line-duration) ease-out forwards;
  animation-delay: calc(var(--line-delay) * var(--egg-delay-scale));
}

.egg__prompt {
  color: var(--accent);
}

.egg__ok,
.egg__done {
  color: var(--neon);
}

.egg__line--muted,
.egg__muted {
  color: var(--muted);
}

.egg__build {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.375rem 0;
}

.egg__bar {
  height: 0.5rem;
  overflow: hidden;
  border: var(--border-control);
  border-radius: 4px;
}

.egg__fill {
  width: 0;
  height: 100%;
  background-color: var(--neon);
  animation: egg-bar var(--egg-bar-duration) linear forwards;
  animation-delay: calc(var(--line-delay) * var(--egg-delay-scale));
}

.egg__footer {
  padding: 0.875rem 1.125rem 1.125rem;
  border-top: var(--border-strong);
}

@keyframes egg-line {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes egg-bar {
  to {
    width: 100%;
  }
}
</style>

<!-- Mouvement réduit : sélecteurs globaux (le style de composant ne peut pas viser <html>), mêmes
     conditions que `--dur-*` de tokens.css. -->
<style>
:root[data-motion='reduit'] .egg {
  --egg-delay-scale: 0;
}

@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion='normal']) .egg {
    --egg-delay-scale: 0;
  }
}
</style>
