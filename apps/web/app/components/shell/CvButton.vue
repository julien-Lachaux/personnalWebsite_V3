<script setup lang="ts">
// Menu « CV PDF » (D44) : un bouton déclencheur et une liste de liens vers les deux versions du CV,
// française et anglaise (`useCvLink`). Motif « disclosure » de liens, pas un `role="menu"` : le bouton
// porte `aria-expanded` et `aria-controls`, la liste reste dans le DOM, cachée (`hidden`). Échap ferme
// et rend le focus au bouton ; le focus qui sort du menu (Tab au-delà de la dernière entrée) le ferme
// sans le reprendre. Une version dont le fichier manque est une entrée inactive (`aria-disabled`, sans
// adresse), avec « (bientôt) ». Chaque lien est téléchargé (`download`), annoncé comme PDF (`type`) et
// porte la langue du document (`hreflang`). `placement` : la liste s'ouvre sous le bouton (barre du
// haut) ou au-dessus (barre d'actions du bas). La classe reçue va sur la racine.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { useI18n } from '#imports';

import BaseButton from '../base/Button.vue';
import { useCvLink } from '../../composables/shell/useCvLink.js';

const props = withDefaults(
  defineProps<{ href: string; size?: 'sm' | 'md' | 'lg'; placement?: 'down' | 'up' }>(),
  { size: 'sm', placement: 'down' },
);

const { t } = useI18n();
const entries = useCvLink(() => props.href);

const open = ref(false);
const listId = useId();
const root = ref<HTMLElement | null>(null);

const triggerLabel = computed(() => t('shell.actions.cv'));

function toggle(): void {
  open.value = !open.value;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !open.value) return;
  event.preventDefault();
  open.value = false;
  void nextTick(() =>
    root.value!.querySelector<HTMLElement>(`[aria-controls="${listId}"]`)!.focus(),
  );
}

/** Le focus passe hors du menu : il se ferme, le focus reste où il est. */
function onFocusout(event: FocusEvent): void {
  const next = event.relatedTarget;
  if (!open.value || !(next instanceof Node) || root.value!.contains(next)) return;
  open.value = false;
}

// Écouteurs posés à la main : un `@keydown` sur un `<div>` serait une interaction sur un élément non
// interactif (vuejs-accessibility), comme dans Popover.
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
  <div ref="root" class="cv-menu" :class="`cv-menu--${placement}`">
    <BaseButton
      variant="outline"
      :size="size"
      class="cv-menu__trigger"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="listId"
      @click="toggle"
    >
      <template #icon>
        <svg
          focusable="false"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
        </svg>
      </template>
      {{ triggerLabel }}
      <template #trailing>
        <svg
          focusable="false"
          class="cv-menu__chevron"
          width="14"
          height="14"
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
    <ul :id="listId" class="cv-menu__list" :hidden="!open">
      <li v-for="entry in entries" :key="entry.language">
        <a
          v-if="entry.href"
          class="cv-menu__item"
          :href="entry.href"
          :hreflang="entry.language"
          type="application/pdf"
          download
          >{{ entry.label }}</a
        >
        <a v-else class="cv-menu__item cv-menu__item--soon" role="link" aria-disabled="true"
          >{{ entry.label }} {{ entry.soon }}</a
        >
      </li>
    </ul>
  </div>
</template>

<style scoped>
.cv-menu {
  position: relative;
  display: inline-flex;
}

.cv-menu__chevron {
  transition: transform var(--dur-press);
}

.cv-menu__trigger[aria-expanded='true'] .cv-menu__chevron {
  transform: rotate(180deg);
}

.cv-menu__list {
  position: absolute;
  inset-inline-end: 0;
  z-index: 60;
  min-width: 100%;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  border: var(--border-control);
  border-radius: var(--radius-control);
  background-color: var(--card);
  color: var(--text);
  box-shadow: var(--shadow);
}

.cv-menu__list[hidden] {
  display: none;
}

.cv-menu--down .cv-menu__list {
  top: calc(100% + 0.25rem);
}

.cv-menu--up .cv-menu__list {
  bottom: calc(100% + 0.25rem);
}

.cv-menu__item {
  display: flex;
  align-items: center;
  min-height: var(--desktop-control);
  padding: 0 0.75rem;
  border-radius: var(--radius-chip);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  white-space: nowrap;
}

.cv-menu__item[href]:hover {
  background-color: var(--bar);
}

/* Entrée inactive : couleur atténuée (contraste de `--muted`, sans opacité), curseur interdit. */
.cv-menu__item--soon {
  color: var(--muted);
  cursor: not-allowed;
}

/* Cibles de 44 px au minimum sur mobile et tablette (SPEC § 10.2, D17). */
@media (max-width: 1023px) {
  .cv-menu__item {
    min-height: var(--touch-target);
  }
}
</style>
