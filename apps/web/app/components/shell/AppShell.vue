<script setup lang="ts">
// Coquille de la page (F3-01, F3-03 ; SPEC § 2, § 3 ; notice du lot F3b) : en-têtes, contenu principal et
// navigation selon le mode, un contenu par section en slot (`profile`, `experience`,
// `recommendations`, `ai`). Composant partagé, réservé au lead-architecte.
//
// - Mobile et tablette (< 1024 px, mode `tabs`) : `MobileHeader`, `<main>` qui défile (une section à la
//   fois, glissement de 64 px à chaque changement d'onglet, sens selon l'ordre des onglets), flèche
//   « faire défiler », `ActionBar` (masquée au défilement), `BottomNav`.
// - Bureau (≥ 1024 px, mode `mosaic`) : `TopBar` et les quatre sections ensemble. La mosaïque (tuiles,
//   agrandissement) viendra en F6 : en attendant, la barre du haut met le focus sur la section choisie.
// - Un seul jeu d'en-têtes dans le DOM une fois monté (`v-if`) : deux `banner` et deux panneaux
//   d'accessibilité sinon. Avant le montage (page générée, largeur inconnue), les deux sont rendus et
//   la CSS n'affiche que celui de la largeur (`display: none` les retire aussi de l'arbre
//   d'accessibilité).
// - Titres : `h1` (`heading`) en tête du contenu, visible sur le bureau et dans l'onglet Profil, masqué
//   visuellement dans les autres onglets ; un `h2` par section, masqué visuellement sur mobile et
//   tablette (SPEC § 3.1). Le lien d'évitement (app.vue) vise `#contenu`.
// - « Lancer l'entretien » est un `mailto:` vers `NUXT_PUBLIC_CONTACT_EMAIL` : sans adresse valide, la
//   coquille lève une erreur, et la génération statique échoue (`nitro.prerender.failOnError`).
import { computed, nextTick, ref } from 'vue';
import { useI18n } from '#imports';

import { SECTION_IDS, type SectionId } from '../../composables/shell/sections.js';
import { useActionBar } from '../../composables/shell/useActionBar.js';
import { useContactLink } from '../../composables/shell/useContactLink.js';
import { useScrollHint } from '../../composables/shell/useScrollHint.js';
import { useShellMode } from '../../composables/shell/useShellMode.js';
import ActionBar from './ActionBar.vue';
import BottomNav from './BottomNav.vue';
import MobileHeader from './MobileHeader.vue';
import ScrollHint from './ScrollHint.vue';
import TopBar from './TopBar.vue';

defineProps<{
  /** Texte du `h1` de la page. */
  heading: string;
  /** Lien du CV PDF. */
  cvPath: string;
  /** Page de la déclaration d'accessibilité (adresse localisée). */
  declarationUrl: string;
}>();

defineSlots<{
  profile(props: Record<string, never>): unknown;
  experience(props: Record<string, never>): unknown;
  recommendations(props: Record<string, never>): unknown;
  ai(props: Record<string, never>): unknown;
}>();

const { t } = useI18n();

if (useContactLink().value === null) {
  throw new Error(
    'Adresse de contact absente ou invalide : NUXT_PUBLIC_CONTACT_EMAIL doit être une adresse ' +
      'e-mail (bouton « Lancer l’entretien », lien mailto:).',
  );
}

const mode = useShellMode();
/** Onglet affiché en mode `tabs`. */
const tab = ref<SectionId>('profile');
/** Section choisie dans la barre du haut ; `null` : vue d'ensemble. */
const active = ref<SectionId | null>(null);
/** Sens d'entrée de la section qui vient d'être choisie ; `null` au chargement (aucun glissement). */
const slide = ref<'right' | 'left' | null>(null);

const main = ref<HTMLElement | null>(null);
const sections = ref<Partial<Record<SectionId, HTMLElement>>>({});
/** Zone qui défile : `<main>` en mode `tabs`, aucune en mosaïque (la page défile). */
const scroller = computed(() => (mode.value === 'tabs' ? main.value : null));
const { hidden } = useActionBar(scroller, tab);
const { more, scrollDown } = useScrollHint(scroller);

function setSection(id: SectionId, element: unknown): void {
  if (element instanceof HTMLElement) sections.value[id] = element;
}

function selectTab(id: SectionId): void {
  if (id === tab.value) return;
  slide.value = SECTION_IDS.indexOf(id) > SECTION_IDS.indexOf(tab.value) ? 'right' : 'left';
  tab.value = id;
  main.value!.scrollTop = 0;
}

function selectSection(id: SectionId): void {
  active.value = id;
  void nextTick(() => sections.value[id]?.focus());
}

function sectionClass(id: SectionId): Record<string, boolean> {
  const current = id === tab.value;
  return {
    'app-shell__section--current': current,
    [`app-shell__section--from-${slide.value ?? 'none'}`]: current && slide.value !== null,
  };
}
</script>

<template>
  <div class="app-shell" :data-mode="mode ?? undefined">
    <TopBar
      v-if="mode !== 'tabs'"
      class="app-shell__desktop"
      :active="active"
      :cv-path="cvPath"
      :declaration-url="declarationUrl"
      @select="selectSection"
      @overview="active = null"
    />
    <MobileHeader
      v-if="mode !== 'mosaic'"
      class="app-shell__mobile"
      :active="tab"
      :declaration-url="declarationUrl"
    />

    <div class="app-shell__body">
      <main id="contenu" ref="main" class="app-shell__main" :tabindex="mode === 'tabs' ? 0 : -1">
        <h1
          class="app-shell__heading"
          :class="{ 'app-shell__heading--other-tab': tab !== 'profile' }"
        >
          {{ heading }}
        </h1>
        <div class="app-shell__sections">
          <section
            v-for="id in SECTION_IDS"
            :id="`section-${id}`"
            :key="id"
            :ref="(element) => setSection(id, element)"
            class="app-shell__section"
            :class="sectionClass(id)"
            :aria-labelledby="`titre-${id}`"
            :hidden="mode === 'tabs' && id !== tab ? true : undefined"
            tabindex="-1"
          >
            <h2 :id="`titre-${id}`" class="app-shell__section-heading">
              {{ t(`shell.headings.${id}`) }}
            </h2>
            <slot :name="id" />
          </section>
        </div>
      </main>
      <ScrollHint
        v-if="mode !== 'mosaic'"
        class="app-shell__mobile"
        :visible="more"
        @scroll="scrollDown"
      />
    </div>

    <ActionBar
      v-if="mode !== 'mosaic'"
      class="app-shell__mobile"
      :hidden="hidden"
      :cv-path="cvPath"
    />
    <BottomNav
      v-if="mode !== 'mosaic'"
      class="app-shell__mobile"
      :active="tab"
      @select="selectTab"
    />
  </div>
</template>

<style scoped>
/* Mobile et tablette : la coquille occupe l'écran, seul <main> défile (barres fixes en haut et en bas). */
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-shell__body {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.app-shell__main {
  flex: 1;
  min-height: 0;
}

.app-shell__heading {
  margin: 0 0 1rem;
  font-size: var(--font-size-h1-mobile);
  font-weight: var(--font-weight-bold);
  line-height: 1.04;
  letter-spacing: -0.02em;
}

.app-shell__section:focus {
  /* Cible du focus de la barre du haut (programmatique) : pas de contour hors du clavier. */
  outline: none;
}

.app-shell__section:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 1023px) {
  .app-shell {
    height: 100vh;
    height: 100dvh;
    min-height: 0;
  }

  /* Avant le montage (largeur inconnue au rendu statique) : un seul jeu d'en-têtes affiché. */
  .app-shell__desktop {
    display: none;
  }

  .app-shell__main {
    overflow-y: auto;
    padding: 1.25rem var(--mobile-gutter) 2rem;
  }

  /* Une section à la fois : l'onglet courant (avant le montage, par la classe ; après, par `hidden`). */
  .app-shell__section:not(.app-shell__section--current) {
    display: none;
  }

  .app-shell__section--from-right {
    animation: slide-in-right var(--dur-slide) var(--ease-slide) both;
  }

  .app-shell__section--from-left {
    animation: slide-in-left var(--dur-slide) var(--ease-slide) both;
  }

  /* Titres masqués visuellement (gardés pour les lecteurs d'écran), comme `.visually-hidden`. */
  .app-shell__heading--other-tab,
  .app-shell__section-heading {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
}

/* Tablette : colonne de 640 px centrée (SPEC § 3.2). */
@media (min-width: 768px) and (max-width: 1023px) {
  .app-shell__main {
    padding-inline: max(2rem, (100% - 40rem) / 2);
  }

  .app-shell__heading {
    font-size: var(--font-size-h1-tablet);
  }
}

/* Bureau : barre du haut, sections ensemble dans la zone de 1440 px (mosaïque en F6). */
@media (min-width: 1024px) {
  .app-shell__mobile {
    display: none;
  }

  .app-shell__main {
    width: 100%;
    max-width: var(--page-max);
    margin-inline: auto;
    padding: 0.75rem;
  }

  .app-shell__heading {
    font-size: var(--font-size-h1-portable);
  }

  .app-shell__sections {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .app-shell__section {
    padding: 1rem 1.25rem;
    border: var(--border-strong);
    border-radius: var(--radius-window);
    background-color: var(--card);
  }

  .app-shell__section-heading {
    margin: 0 0 0.75rem;
    font-family: var(--font-mono);
    font-size: var(--font-size-meta);
    font-weight: var(--font-weight-bold);
    color: var(--violet);
  }
}

@media (min-width: 1200px) {
  .app-shell__heading {
    font-size: var(--font-size-h1-desktop);
  }
}
</style>
