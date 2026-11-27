<script setup lang="ts">
// Coquille de la page (F3-01, F3-03 ; SPEC § 2, § 3 ; notice du lot F3b) : en-têtes, contenu principal et
// navigation selon le mode, un contenu par section en slot (`profile`, `experience`,
// `recommendations`, `ai`). Composant partagé, réservé au lead-architecte.
//
// - Mobile et tablette (< 1024 px, mode `tabs`) : `MobileHeader`, `<main>` qui défile (une section à la
//   fois, glissement de 64 px à chaque changement d'onglet, sens selon l'ordre des onglets), flèche
//   « faire défiler », `ActionBar` (masquée au défilement), `BottomNav`.
// - Bureau (≥ 1024 px, mode `mosaic`, lot F6) : `TopBar` et la mosaïque (`TileGrid`) ; la page ne défile
//   pas, chaque tuile défile seule. Une tuile s'agrandit par son bouton ou par l'onglet de la barre du
//   haut, la vue d'ensemble revient à la mosaïque (`active` = tuile agrandie). Focus : un onglet de la
//   barre du haut le met sur le contenu de la tuile agrandie (`#section-<id>`, sans défilement) ; le
//   bouton de la tuile le garde (il reste sur le bouton, agrandie comme réduite). Le contenu de chaque
//   tuile est un `div#section-<id>` (cible du focus, `h2` masqué visuellement, puis le slot) : la tuile
//   est déjà la région nommée.
// - Avant le montage (page générée, D49) : la mosaïque est déjà là (`TileGrid` tant que le mode n'est pas
//   `tabs`), dessinée par la CSS de `TileGrid` aux places de la vue d'ensemble ; au bureau, le montage ne
//   fait que poser les positions calculées, sans rien remplacer. Sans JavaScript, chaque tuile défile
//   seule et les boutons « agrandir » restent sans effet. Sous 1024 px, la même CSS n'en montre que le
//   contenu du Profil, comme l'onglet Profil ; le montage le remplace par les sections des onglets.
// - Un seul jeu d'en-têtes dans le DOM une fois monté (`v-if`) : deux `banner` et deux panneaux
//   d'accessibilité sinon. Avant le montage (page générée, largeur inconnue), les deux sont rendus et
//   la CSS n'affiche que celui de la largeur (`display: none` les retire aussi de l'arbre
//   d'accessibilité).
// - Titres : `h1` (`heading`) en tête du contenu, toujours masqué visuellement (`.visually-hidden`,
//   lot F5c) : le grand titre visible est celui de la section Profil (`ProfileTitle`, sans balise de
//   titre), la page n'a qu'un `h1`. La classe `--other-tab` marque l'onglet courant hors Profil (état
//   seulement, sans style). Un `h2` par section, masqué visuellement sur mobile et tablette
//   (SPEC § 3.1). Le lien d'évitement (app.vue) vise `#contenu`.
// - Section à défilement propre (`scrollers`, lot F5c) : une section qui fournit sa zone qui défile
//   (Expérience : la liste sous le filtre) remplit `<main>` pendant son onglet ; `<main>` ne défile plus
//   et perd ses marges (la section gère les siennes), la barre d'actions et la flèche lisent sa zone.
//   Sur le bureau, elle remplit sa tuile (qui ne défile pas) : la liste défile, le filtre reste fixe.
// - Onglets IA et Recos : 28 px au-dessus du contenu, 20 px pour le Profil (maquette mobile).
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
import TileGrid from './TileGrid.vue';
import TopBar from './TopBar.vue';

const props = withDefaults(
  defineProps<{
    /** Texte du `h1` de la page. */
    heading: string;
    /** Lien du CV PDF. */
    cvPath: string;
    /** Page de la déclaration d'accessibilité (adresse localisée). */
    declarationUrl: string;
    /**
     * Zone qui défile des sections qui ont la leur (clé présente : section à défilement propre ;
     * `null` tant que la section n'est pas montée).
     */
    scrollers?: Partial<Record<SectionId, HTMLElement | null>>;
  }>(),
  { scrollers: () => ({}) },
);

/** Onglets qui laissent 28 px au-dessus du contenu (maquette mobile), au lieu de 20. */
const ROOMY_TABS: readonly SectionId[] = ['recommendations', 'ai'];

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
/** L'onglet courant a sa propre zone qui défile : `<main>` ne défile pas. */
const selfScrolling = computed(() => tab.value in props.scrollers);
/**
 * Zone qui défile : en mode `tabs`, celle de la section courante si elle en a une, sinon `<main>` ;
 * aucune en mosaïque (la page défile).
 */
const scroller = computed(() => {
  if (mode.value !== 'tabs') return null;
  return selfScrolling.value ? (props.scrollers[tab.value] ?? null) : main.value;
});
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
  // Sans défilement : la tuile bouge, ni <main> ni le corps de la tuile ne doivent glisser.
  void nextTick(() => sections.value[id]?.focus({ preventScroll: true }));
}

/** Bouton d'une tuile : l'agrandit, ou revient à la mosaïque si elle l'est déjà ; le focus reste dessus. */
function toggleTile(id: SectionId): void {
  active.value = active.value === id ? null : id;
}

function sectionClass(id: SectionId): Record<string, boolean> {
  const current = id === tab.value;
  return {
    'app-shell__section--current': current,
    'app-shell__section--self-scrolling': id in props.scrollers,
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
      <main
        id="contenu"
        ref="main"
        class="app-shell__main"
        :class="{
          'app-shell__main--self-scrolling': selfScrolling,
          'app-shell__main--roomy': ROOMY_TABS.includes(tab),
        }"
        :tabindex="mode === 'tabs' && !selfScrolling ? 0 : -1"
      >
        <h1
          class="app-shell__heading visually-hidden"
          :class="{ 'app-shell__heading--other-tab': tab !== 'profile' }"
        >
          {{ heading }}
        </h1>
        <TileGrid v-if="mode !== 'tabs'" :expanded="active" @toggle="toggleTile">
          <template v-for="id in SECTION_IDS" :key="id" #[id]>
            <div
              :id="`section-${id}`"
              :ref="(element) => setSection(id, element)"
              class="app-shell__section app-shell__section--tile"
              :class="sectionClass(id)"
              tabindex="-1"
            >
              <h2 :id="`titre-${id}`" class="visually-hidden">
                {{ t(`shell.headings.${id}`) }}
              </h2>
              <slot :name="id" />
            </div>
          </template>
        </TileGrid>
        <div v-else class="app-shell__sections">
          <section
            v-for="id in SECTION_IDS"
            :id="`section-${id}`"
            :key="id"
            :ref="(element) => setSection(id, element)"
            class="app-shell__section"
            :class="sectionClass(id)"
            :aria-labelledby="`titre-${id}`"
            :hidden="id !== tab ? true : undefined"
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
      class="app-shell__mobile app-shell__nav"
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

  .app-shell__main--roomy {
    padding-top: 1.75rem;
  }

  /* Section à défilement propre : elle remplit <main>, qui ne défile pas et n'a pas de marge (la zone
     fixe de la section est à bord perdu, comme la maquette). */
  .app-shell__main--self-scrolling {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
  }

  .app-shell__main--self-scrolling .app-shell__sections,
  .app-shell__section--self-scrolling.app-shell__section--current {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  /* Une section à la fois : l'onglet courant (avant le montage, par la classe ; après, par `hidden`).
     Les sections de la mosaïque d'avant le montage (`--tile`) restent toutes dans le flux : sans
     JavaScript, la navigation du bas ne marche pas. */
  .app-shell__section:not(.app-shell__section--current, .app-shell__section--tile) {
    display: none;
  }

  .app-shell__section--from-right {
    animation: slide-in-right var(--dur-slide) var(--ease-slide) both;
  }

  .app-shell__section--from-left {
    animation: slide-in-left var(--dur-slide) var(--ease-slide) both;
  }

  /* Titres de section masqués visuellement (gardés pour les lecteurs d'écran), comme `.visually-hidden`. */
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

/* Fenêtre basse (zoom de 400 %, RA-1, WCAG 1.4.10) : sous 30 rem de haut (la hauteur suit la taille de
   texte choisie), en-tête, filtre, barre d'actions et navigation ne laisseraient aucune place à la liste.
   La coquille ne tient plus en `100dvh` : la page défile, l'en-tête, le filtre (voir ExperienceSection) et
   la barre d'actions sont statiques, la navigation du bas reste seule fixe (collée au bord bas, sans
   masquer le focus : `scroll-padding-bottom`). */
@media (max-width: 1023px) and (max-height: 30rem) {
  .app-shell {
    height: auto;
    min-height: 100vh;
    min-height: 100dvh;
  }

  .app-shell__main,
  .app-shell__main--self-scrolling {
    display: block;
    overflow: visible;
  }

  .app-shell__main--self-scrolling .app-shell__sections,
  .app-shell__section--self-scrolling.app-shell__section--current {
    display: block;
  }

  .app-shell__nav {
    position: sticky;
    bottom: 0;
    z-index: 1;
  }

  :global(html) {
    scroll-padding-bottom: var(--mobile-nav);
  }
}

/* Tablette : colonne de 640 px centrée (SPEC § 3.2). */
@media (min-width: 768px) and (max-width: 1023px) {
  .app-shell__main {
    padding-inline: max(2rem, (100% - 40rem) / 2);
  }

  .app-shell__main--self-scrolling {
    padding: 0;
  }
}

/* Bureau (≥ 1024 px, lot F6) : la mosaïque, dès la page générée (D49 : la coquille n'a pas encore de
   mode) ; la coquille occupe la fenêtre ; sous la barre du haut (hauteur réelle, elle peut passer à la
   ligne), <main> donne toute la place restante à la mosaïque, sans marge ni défilement. */
@media (min-width: 1024px) {
  .app-shell__mobile {
    display: none;
  }

  .app-shell:not([data-mode='tabs']) {
    height: 100vh;
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }

  .app-shell:not([data-mode='tabs']) .app-shell__main {
    position: relative;
    overflow: hidden;
  }
}

/* Contenu d'une tuile, cible du focus de la barre du haut : contour à l'intérieur (la tuile rogne). */
.app-shell__section--tile:focus-visible {
  outline-offset: -2px;
}

/* XP : la section remplit sa tuile, seule sa liste défile. */
.app-shell__section--tile.app-shell__section--self-scrolling {
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
</style>
