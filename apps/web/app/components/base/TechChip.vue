<script setup lang="ts">
// Puce de technologie (ticket F1-03) : neutre au repos, néon au survol et quand elle est active.
//
// - Interactive (défaut) : `<button type="button">`. `pressed` donne `aria-pressed` (filtre actif ou
//   non) ; sans `pressed`, la puce est un simple déclencheur (« Huile de coude »).
// - `disabled` (technologie qui donnerait 0 résultat) : `aria-disabled="true"`, atténuée ; le bouton
//   garde le focus et le clic est ignoré (pas d'événement `click`).
// - `dashed` (technologie sans expérience détaillée) : étiquette en pointillé, NON cliquable, rendue
//   en `<span>` sans rôle de bouton ni `aria-pressed`.
// `count` est le nombre affiché après le libellé (compteur dynamique du filtre). Le nom accessible
// complet (« TypeScript, 2 expériences ») se passe par `aria-label` (attribut transmis à la racine).
// Cibles de 44 px sur mobile et tablette (SPEC § 10.2).
withDefaults(
  defineProps<{
    /** État du filtre ; absent : la puce n'est pas un interrupteur. */
    pressed?: boolean | undefined;
    disabled?: boolean;
    dashed?: boolean;
    count?: number | string | undefined;
    /** `sm` : puce des cartes ; `md` : puce du filtre (40 px). */
    size?: 'sm' | 'md';
  }>(),
  { pressed: undefined, disabled: false, dashed: false, count: undefined, size: 'sm' },
);

const emit = defineEmits<{ click: [event: MouseEvent] }>();

function onClick(event: MouseEvent, disabled: boolean): void {
  if (disabled) {
    event.preventDefault();
    return;
  }
  emit('click', event);
}
</script>

<template>
  <span v-if="dashed" class="tech-chip tech-chip--dashed" :class="`tech-chip--${size}`">
    <slot />
    <span v-if="count !== undefined" class="tech-chip__count">{{ count }}</span>
  </span>
  <button
    v-else
    type="button"
    class="tech-chip"
    :class="[`tech-chip--${size}`, { 'tech-chip--pressed': pressed === true }]"
    :aria-pressed="pressed === undefined ? undefined : pressed ? 'true' : 'false'"
    :aria-disabled="disabled ? 'true' : undefined"
    @click="onClick($event, disabled)"
  >
    <slot />
    <span v-if="count !== undefined" class="tech-chip__count">{{ count }}</span>
  </button>
</template>

<style scoped>
.tech-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border: var(--border-width) solid var(--line);
  border-radius: var(--radius-chip);
  background-color: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  line-height: 1.3;
  cursor: pointer;
  transition:
    color var(--dur-press),
    border-color var(--dur-press),
    background-color var(--dur-press),
    box-shadow var(--dur-press),
    text-shadow var(--dur-press);
}

.tech-chip--md {
  min-height: var(--desktop-control);
}

.tech-chip__count {
  font-family: var(--font-mono);
  font-size: var(--font-size-meta);
  opacity: 0.75;
}

/* Néon : au survol (souris) et quand la puce est active. Sans lueur en thème clair (les variables
   `--neon-*` y sont transparentes). */
.tech-chip--pressed {
  border-color: var(--neon);
  background-color: var(--neon-bg);
  color: var(--neon);
}

@media (hover: hover) {
  .tech-chip:not([aria-disabled='true']):hover {
    border-color: var(--neon);
    background-color: var(--neon-bg);
    box-shadow:
      0 0 14px var(--neon-glow),
      inset 0 0 8px var(--neon-in);
    color: var(--neon);
    text-shadow: 0 0 8px var(--neon-txt);
  }
}

/* Inactive (0 résultat) : atténuée, curseur interdit, aucun effet néon. */
.tech-chip[aria-disabled='true'] {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Sans expérience détaillée : pointillé, texte atténué mais lisible (contraste `muted`). */
.tech-chip--dashed {
  border-style: dashed;
  color: var(--muted);
  cursor: default;
}

@media (max-width: 1023px) {
  .tech-chip:not(.tech-chip--dashed) {
    min-height: var(--touch-target);
  }
}
</style>
