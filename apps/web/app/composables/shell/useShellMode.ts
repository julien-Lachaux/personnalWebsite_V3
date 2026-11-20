// Mode de la coquille selon la largeur (SPEC § 3, `domain/layout`) : `tabs` sous 1024 px (une section à
// la fois, en-tête mobile, barre d'actions, navigation du bas), `mosaic` à partir de 1024 px (barre du
// haut, sections ensemble). `null` tant que la page n'est pas montée : le rendu statique ne connaît pas
// la largeur, la CSS de la coquille affiche alors le bon jeu d'en-têtes par requête média, puis le
// montage n'en garde qu'un dans le DOM. Suit les changements de largeur ; écouteur retiré au démontage.
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

import { BREAKPOINTS } from '../../domain/layout.js';

export type ShellMode = 'tabs' | 'mosaic';

/** Requête média de la mosaïque, même seuil que `computeLayout`. */
export const MOSAIC_QUERY = `(min-width: ${BREAKPOINTS.portable}px)`;

export function useShellMode(): Readonly<Ref<ShellMode | null>> {
  const mode = ref<ShellMode | null>(null);

  onMounted(() => {
    const query = window.matchMedia(MOSAIC_QUERY);
    const update = (): void => {
      mode.value = query.matches ? 'mosaic' : 'tabs';
    };
    update();
    query.addEventListener('change', update);
    onBeforeUnmount(() => query.removeEventListener('change', update));
  });

  return mode;
}
