<script setup lang="ts">
// Fenêtre modale (ticket F1-04, SPEC § 8) : barre de titre `>_ fichier` (lilas), bouton ×, corps en
// slot. Sert « Lancer l'entretien » (`contact.sh`) et l'easter egg (`huile-de-coude.sh`).
//
// Accessibilité : `role="dialog"` + `aria-modal="true"`, nommée par le titre (`aria-labelledby`), ou
// par `label` quand le nom diffère du titre visible (D18) ;
// piège de focus (Tab et Maj+Tab bouclent dans la fenêtre) ; Échap ferme ; voile cliquable (désactivable
// avec `closeOnScrim`, il n'est pas dans l'ordre de tabulation : le bouton × et Échap ferment au
// clavier) ; défilement de la page bloqué tant que la fenêtre est ouverte ; au retour, le focus revient
// sur le déclencheur (l'élément qui avait le focus à l'ouverture, ou `returnFocusTo`).
// Focus à l'ouverture : l'élément du corps marqué `autofocus` ou `data-autofocus`, sinon le premier
// élément focalisable du corps, sinon le bouton ×.
//
// `v-model:open`. Les libellés (`closeLabel`, nom du bouton ×) se passent en prop, déjà traduits.
// Rendue dans `<body>` (Teleport) : ni transformation ni `overflow` d'un ancêtre ne la rogne.

import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';

// Nom multi-mot (règle `vue/multi-word-component-names`) : celui que Nuxt donne à l'élément de base.
defineOptions({ name: 'BaseWindow' });

const props = withDefaults(
  defineProps<{
    /** Nom de fichier affiché dans la barre de titre, sans le `>_` (ex. `contact.sh`). */
    title: string;
    closeLabel: string;
    /** Bordure et ombre : accent (formulaire) ou néon (easter egg). */
    tone?: 'accent' | 'neon';
    closeOnScrim?: boolean;
    /** Élément à refocaliser à la fermeture, si ce n'est pas celui qui avait le focus à l'ouverture. */
    returnFocusTo?: HTMLElement | null | undefined;
    /**
     * Nom accessible quand il diffère du titre visible (D18, ex. « Me contacter » pour `contact.sh`) :
     * posé en `aria-label`, `aria-labelledby` est alors retiré (il l'emporterait). Absent : la
     * fenêtre est nommée par son titre.
     */
    label?: string | undefined;
  }>(),
  { tone: 'accent', closeOnScrim: true, returnFocusTo: undefined, label: undefined },
);

const open = defineModel<boolean>('open', { default: false });

const titleId = useId();
const dialog = ref<HTMLElement | null>(null);
const body = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
let opener: HTMLElement | null = null;
let active = false;

const FOCUSABLE =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** Éléments focalisables de la fenêtre, dans l'ordre du document (hors `inert`, `hidden`, désactivés). */
function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) =>
      !element.matches(':disabled, [tabindex="-1"]') &&
      element.closest('[inert], [hidden], [aria-hidden="true"]') === null,
  );
}

// Verrou de défilement : l'état est porté par <body> (compteur de fenêtres ouvertes et valeur
// d'origine), pour que deux fenêtres empilées se libèrent dans n'importe quel ordre.
function lockScroll(): void {
  const { dataset, style } = document.body;
  const count = Number(dataset['windowLocks'] ?? 0);
  if (count === 0) {
    dataset['windowOverflow'] = style.overflow;
    style.overflow = 'hidden';
  }
  dataset['windowLocks'] = String(count + 1);
}

function unlockScroll(): void {
  const { dataset, style } = document.body;
  const count = Number(dataset['windowLocks']) - 1;
  if (count > 0) {
    dataset['windowLocks'] = String(count);
    return;
  }
  style.overflow = dataset['windowOverflow']!;
  delete dataset['windowLocks'];
  delete dataset['windowOverflow'];
}

function close(): void {
  open.value = false;
}

// Les références `dialog`, `body` et `closeButton` existent tant que l'écouteur est actif : il n'est
// posé qu'à l'ouverture et la fenêtre contient toujours son bouton × (focalisable).
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== 'Tab') return;
  const root = dialog.value!;
  const items = focusables(root);
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const current = document.activeElement;
  const outside = !root.contains(current);
  if (event.shiftKey && (current === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (current === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}

function focusInitial(): void {
  const content = body.value!;
  const target =
    content.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ??
    focusables(content)[0] ??
    closeButton.value!;
  target.focus();
}

function activate(): void {
  active = true;
  opener = document.activeElement as HTMLElement | null;
  lockScroll();
  document.addEventListener('keydown', onKeydown);
  void nextTick(focusInitial);
}

function deactivate(): void {
  if (!active) return;
  active = false;
  document.removeEventListener('keydown', onKeydown);
  unlockScroll();
  const target = props.returnFocusTo ?? opener;
  opener = null;
  void nextTick(() => target?.focus());
}

// Ouverte dès le montage (jamais au prérendu : `document` n'existe pas côté serveur), puis à chaque
// changement de `open`. Le watcher tourne avant le rendu : `document.activeElement` est encore le
// déclencheur quand la fenêtre s'ouvre.
onMounted(() => {
  if (open.value) activate();
});

watch(open, (isOpen) => {
  if (isOpen) activate();
  else deactivate();
});

onBeforeUnmount(deactivate);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="window-layer">
      <button
        v-if="closeOnScrim"
        type="button"
        class="window-layer__scrim"
        tabindex="-1"
        aria-hidden="true"
        @click="close"
      ></button>
      <div v-else class="window-layer__scrim" aria-hidden="true"></div>
      <div
        ref="dialog"
        role="dialog"
        aria-modal="true"
        class="window"
        :class="`window--${tone}`"
        :aria-label="label"
        :aria-labelledby="label ? undefined : titleId"
      >
        <div class="window__bar">
          <span class="window__prompt" aria-hidden="true">&gt;_</span>
          <span :id="titleId" class="window__title">{{ title }}</span>
          <button
            ref="closeButton"
            type="button"
            class="window__close"
            :aria-label="closeLabel"
            @click="close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div ref="body" class="window__body"><slot /></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.window-layer {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 3.75rem 0.75rem 0.75rem;
}

@media (min-width: 768px) {
  .window-layer {
    padding-top: 6.875rem;
  }
}

.window-layer__scrim {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background-color: var(--scrim);
  cursor: default;
}

.window {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(100%, 30rem);
  max-height: 100%;
  overflow: hidden;
  border: var(--border-width) solid var(--accent);
  border-radius: var(--radius-window);
  background-color: var(--card);
  color: var(--text);
  box-shadow: var(--shadow);
}

.window--neon {
  width: min(100%, 32.5rem);
  border-color: var(--neon);
  box-shadow: 0 0 24px var(--neon-glow);
}

.window__bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  height: var(--tile-title-bar);
  box-sizing: content-box;
  padding-inline-start: 1rem;
  border-bottom: var(--border-strong);
  background-color: var(--bar);
  font-family: var(--font-mono);
  font-size: var(--font-size-meta);
}

.window--neon .window__bar {
  background-color: transparent;
}

.window__prompt {
  margin-inline-end: 0.5rem;
  color: var(--accent);
  font-weight: var(--font-weight-bold);
}

.window__title {
  flex: 1;
  min-width: 0;
  font-weight: var(--font-weight-bold);
  overflow-wrap: anywhere;
}

.window__close {
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

.window__close:focus-visible {
  /* À l'intérieur du bouton : un contour décalé vers l'extérieur serait rogné par `overflow: hidden`. */
  outline-offset: -4px;
}

.window__body {
  min-height: 0;
  overflow-y: auto;
}
</style>
