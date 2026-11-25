<script setup lang="ts">
// Panneau non modal (ticket F1-04, SPEC § 10.1) : sert le panneau d'accessibilité (`accessibilite.cfg`).
// Pas de piège de focus ni de voile : la page reste utilisable, le panneau se ferme par son bouton ×,
// par Échap, ou quand le focus sort de sa racine (Tab au-delà du dernier réglage : sinon le panneau fixe
// reste ouvert et masque l'élément qui reçoit le focus, RA-5, WCAG 2.4.11), sans reprendre le focus.
//
// Le déclencheur est fourni par le slot `trigger`, qui reçoit `props` à répandre sur le bouton :
//   <BasePopover v-model:open="open" title="accessibilite.cfg" close-label="Fermer…">
//     <template #trigger="{ props }"><button v-bind="props">…</button></template>
//     …réglages…
//   </BasePopover>
// `props` porte `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` et l'ouverture au clic
// (le bouton garde son nom accessible, à lui donner). À l'ouverture, le focus va sur l'élément du
// panneau marqué `autofocus` ou `data-autofocus`, sinon sur le premier élément focalisable, sinon sur
// le bouton × ; Échap (focus dans le panneau ou sur le déclencheur) et × ferment et rendent le focus au
// déclencheur. Le panneau reste dans le DOM, caché (`hidden`) : `aria-controls` vise toujours un
// élément existant. Nom accessible : le titre (`aria-labelledby`), ou `label` s'il est donné (D18).
//
// Position : fixe sous l'en-tête, réglable par les variables `--popover-top` (62 px), `--popover-right`
// (12 px) et `--popover-width` (360 px), à poser sur le composant (`style`). Sur écran étroit, la
// largeur se limite à celle de l'écran moins les marges. Le contenu défile (focalisable au clavier
// grâce à ses commandes) quand il dépasse la hauteur disponible.

import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';

// Nom multi-mot (règle `vue/multi-word-component-names`) : celui que Nuxt donne à l'élément de base.
defineOptions({ name: 'BasePopover' });

defineProps<{
  /** Nom de fichier affiché dans la barre de titre, sans le `>_` (ex. `accessibilite.cfg`). */
  title: string;
  closeLabel: string;
  /**
   * Nom accessible du panneau quand il diffère du titre visible (D18, ex. « Réglages
   * d'accessibilité ») : posé en `aria-label`, `aria-labelledby` est alors retiré (il l'emporterait).
   * Absent : le panneau est nommé par son titre.
   */
  label?: string | undefined;
}>();

/** Propriétés à répandre sur le bouton déclencheur (slot `trigger`). */
export interface PopoverTriggerProps {
  'aria-haspopup': 'dialog';
  'aria-expanded': 'true' | 'false';
  'aria-controls': string;
  onClick: () => void;
}

const open = defineModel<boolean>('open', { default: false });

const panelId = useId();
const titleId = useId();
const root = ref<HTMLElement | null>(null);
const body = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);

const FOCUSABLE =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

function toggle(): void {
  open.value = !open.value;
}

const triggerProps = computed<PopoverTriggerProps>(() => ({
  'aria-haspopup': 'dialog',
  'aria-expanded': open.value ? 'true' : 'false',
  'aria-controls': panelId,
  onClick: toggle,
}));

defineSlots<{
  trigger(props: { props: PopoverTriggerProps }): unknown;
  default(props: Record<string, never>): unknown;
}>();

function triggerElement(): HTMLElement | null {
  return root.value!.querySelector<HTMLElement>(`[aria-controls="${panelId}"]`);
}

function focusInitial(): void {
  const content = body.value!;
  const focusable = [...content.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !element.matches(':disabled') && element.closest('[inert], [hidden]') === null,
  );
  const target =
    content.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ??
    focusable[0] ??
    closeButton.value!;
  target.focus();
}

function close(): void {
  open.value = false;
  void nextTick(() => triggerElement()?.focus());
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !open.value) return;
  event.preventDefault();
  close();
}

/** Le focus passe hors de la racine (déclencheur et panneau) : le panneau se ferme, le focus reste où il est. */
function onFocusout(event: FocusEvent): void {
  const next = event.relatedTarget;
  // `relatedTarget` est nul quand le focus quitte la page (ou va sur un élément non focalisable) : le
  // panneau reste ouvert, comme avant.
  if (!open.value || !(next instanceof Node) || root.value!.contains(next)) return;
  open.value = false;
}

watch(open, (isOpen) => {
  if (isOpen) void nextTick(focusInitial);
});

// Échap est écouté sur toute la racine (panneau et déclencheur), posé à la main : un `@keydown` sur un
// `<div>` serait une interaction sur un élément non interactif (vuejs-accessibility).
onMounted(() => {
  root.value!.addEventListener('keydown', onKeydown);
  root.value!.addEventListener('focusout', onFocusout);
});
onBeforeUnmount(() => {
  root.value!.removeEventListener('keydown', onKeydown);
  root.value!.removeEventListener('focusout', onFocusout);
});
</script>

<template>
  <div ref="root" class="popover">
    <slot name="trigger" :props="triggerProps" />
    <div
      :id="panelId"
      role="dialog"
      aria-modal="false"
      class="popover__panel"
      :aria-label="label"
      :aria-labelledby="label ? undefined : titleId"
      :hidden="!open"
    >
      <div class="popover__bar">
        <span class="popover__prompt" aria-hidden="true">&gt;_</span>
        <h2 :id="titleId" class="popover__title">{{ title }}</h2>
        <button
          ref="closeButton"
          type="button"
          class="popover__close"
          :aria-label="closeLabel"
          @click="close"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div ref="body" class="popover__body"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.popover__panel {
  position: fixed;
  top: var(--popover-top, 3.875rem);
  right: var(--popover-right, 0.75rem);
  z-index: 60;
  display: flex;
  flex-direction: column;
  width: min(var(--popover-width, 22.5rem), 100vw - 1.5rem);
  max-height: calc(100dvh - var(--popover-top, 3.875rem) - 1.125rem);
  overflow: hidden;
  border: var(--border-control);
  border-radius: var(--radius-window);
  background-color: var(--card);
  color: var(--text);
  box-shadow:
    var(--shadow),
    0 16px 40px color-mix(in srgb, var(--scrim) 45%, transparent);
}

.popover__bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  height: var(--tile-title-bar);
  box-sizing: content-box;
  padding-inline-start: 0.875rem;
  border-bottom: var(--border-strong);
  background-color: var(--bar);
  font-family: var(--font-mono);
  font-size: var(--font-size-meta);
}

.popover__prompt {
  margin-inline-end: 0.5rem;
  color: var(--accent);
  font-weight: var(--font-weight-bold);
}

.popover__title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-bold);
}

.popover__close {
  flex-shrink: 0;
  width: var(--touch-target);
  height: var(--touch-target);
  padding: 0;
  border: 0;
  border-inline-start: var(--border-strong);
  background-color: transparent;
  color: var(--text);
  font-size: 1.125rem;
  font-weight: var(--font-weight-bold);
}

.popover__close:focus-visible {
  /* À l'intérieur du bouton : un contour décalé vers l'extérieur serait rogné par `overflow: hidden`. */
  outline-offset: -4px;
}

.popover__body {
  min-height: 0;
  overflow-y: auto;
}
</style>
