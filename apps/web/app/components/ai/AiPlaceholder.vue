<script setup lang="ts">
// Placeholder de la section IA (lot F6b, D27) : affiché quand l'API ne sert pas de section IA
// (`CvView.ai` nul), pour que la tuile (mosaïque) et l'onglet (mobile, tablette) ne soient jamais vides.
// Esprit terminal du site : une commande puis une réponse un peu décalée, un curseur qui clignote.
//
// Accessibilité : texte réel (lu tel quel par les lecteurs d'écran), non interactif ; l'invite `$`, le
// curseur et le picto sont décoratifs (`aria-hidden`). Le clignotement passe par `animation`, que les
// filets de `base.css` (réglage « réduire les animations » et `prefers-reduced-motion`) ramènent à une
// seule itération de 0,01 ms : le curseur reste alors affiché, fixe. Pas de `<p>` : le bloc est une
// sortie de terminal, pas un paragraphe de contenu. Couleurs et polices par tokens.
import { useI18n } from '#imports';

const { t } = useI18n();
</script>

<template>
  <div class="ai-placeholder">
    <svg
      class="ai-placeholder__icon"
      viewBox="0 0 48 48"
      width="48"
      height="48"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5h17l9 9v29H12z" />
      <path d="M29 5v9h9" />
      <path d="M18 24h14M18 30h9" />
      <path d="M33 36l5-5 3 3-5 5-4 1z" />
    </svg>
    <div class="ai-placeholder__terminal">
      <div class="ai-placeholder__line">
        <span class="ai-placeholder__prompt" aria-hidden="true">$</span>
        {{ ' ' }}<span class="ai-placeholder__command">{{ t('ai.placeholder.command') }}</span>
      </div>
      <div class="ai-placeholder__line ai-placeholder__output">
        {{ t('ai.placeholder.output') }}
      </div>
      <div class="ai-placeholder__line ai-placeholder__hint">
        {{ t('ai.placeholder.hint') }}<span class="ai-placeholder__cursor" aria-hidden="true" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-placeholder {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: var(--content-max);
  margin-inline: auto;
  font-family: var(--font-mono);
}

.ai-placeholder__icon {
  flex: none;
  color: var(--violet);
}

.ai-placeholder__terminal {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 1.125rem;
  border: var(--border-thin);
  border-radius: var(--radius-window);
  background: var(--violet-bg);
  font-size: var(--font-size-small);
  line-height: 1.6;
}

.ai-placeholder__prompt {
  color: var(--accent);
  font-weight: var(--font-weight-bold);
}

.ai-placeholder__command {
  color: var(--text);
  font-weight: var(--font-weight-bold);
}

.ai-placeholder__output {
  color: var(--text);
}

.ai-placeholder__hint {
  color: var(--muted);
}

.ai-placeholder__cursor {
  display: inline-block;
  width: 0.55em;
  height: 1.05em;
  margin-left: 0.25rem;
  background: var(--accent);
  vertical-align: text-bottom;
  animation: ai-placeholder-blink var(--dur-cursor-blink) steps(1) infinite;
}

@keyframes ai-placeholder-blink {
  50% {
    opacity: 0;
  }
}

@media (min-width: 1024px) {
  .ai-placeholder {
    gap: 0.75rem;
  }

  .ai-placeholder__icon {
    width: 2.5rem;
    height: 2.5rem;
  }

  .ai-placeholder__terminal {
    padding: 0.875rem 1rem;
    font-size: var(--font-size-meta);
  }
}
</style>
