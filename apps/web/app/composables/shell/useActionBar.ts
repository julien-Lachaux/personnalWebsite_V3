// Masquage de la barre d'actions au défilement (SPEC § 3.1) : le domaine décide
// (`domain/action-bar`), ce composable lit la position de défilement de la zone qui défile et pose
// `hidden`. Le retour au changement d'onglet vient de `resetKey` (l'onglet courant).
// L'écouteur est posé quand la zone existe (après le montage) et retiré quand elle change ou que le
// composant est démonté ; rien n'est lu pendant le rendu serveur.
import { ref, watch, type Ref } from 'vue';

import { initialActionBarState, nextActionBarState } from '../../domain/action-bar.js';

export interface UseActionBar {
  /** La barre d'actions est masquée. */
  hidden: Readonly<Ref<boolean>>;
}

/**
 * @param scroller zone qui défile de la section affichée (référence de gabarit)
 * @param resetKey valeur qui change avec l'onglet : la barre revient
 * @param now horloge, injectable pour les tests
 */
export function useActionBar(
  scroller: Readonly<Ref<HTMLElement | null>>,
  resetKey: Readonly<Ref<unknown>>,
  now: () => number = Date.now,
): UseActionBar {
  const hidden = ref(false);
  let state = initialActionBarState(0);

  function reset(): void {
    state = initialActionBarState(scroller.value ? scroller.value.scrollTop : 0);
    hidden.value = false;
  }

  watch(
    scroller,
    (element, _previous, onCleanup) => {
      reset();
      if (!element) return;
      const onScroll = (): void => {
        state = nextActionBarState(state, element.scrollTop, now());
        hidden.value = state.hidden;
      };
      element.addEventListener('scroll', onScroll, { passive: true });
      onCleanup(() => element.removeEventListener('scroll', onScroll));
    },
    { immediate: true, flush: 'post' },
  );
  watch(resetKey, reset);

  return { hidden };
}
