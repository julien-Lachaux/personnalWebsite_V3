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
// Taille de la maquette à toutes les largeurs (D17 : environ 28 px de haut, et non 44 px sur mobile et
// tablette) ; cible d'au moins 24 × 24 px (WCAG 2.2, 2.5.8) garantie par `--target-min`.
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
  min-width: var(--target-min);
  min-height: var(--target-min);
  padding: 0.25rem 0.5rem;
  /* Contour du contrôle (D12, 1.4.11) ; la puce pointillé, non interactive, garde `--line`. */
  border: var(--border-control);
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

/* Pleine opacité : à 0,75 sur le fond de la puce active, le compteur tombait à 3,8:1 en thème clair
   (RA-6, WCAG 1.4.3). */
.tech-chip__count {
  font-family: var(--font-mono);
  font-size: var(--font-size-meta);
}

/* Néon : au survol (souris) et quand la puce est active. Sans lueur en thème clair (les variables
   `--neon-*` y sont transparentes). Aucun effet de survol sur une puce inactive ni sur la puce
   pointillé, qui n'est pas interactive (`<span>`). */
.tech-chip--pressed {
  border-color: var(--neon);
  background-color: var(--neon-bg);
  color: var(--neon);
}

@media (hover: hover) {
  .tech-chip:not([aria-disabled='true'], .tech-chip--dashed):hover {
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
  border-color: var(--line);
  color: var(--muted);
  cursor: default;
}
</style>
