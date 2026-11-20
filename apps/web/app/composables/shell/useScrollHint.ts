// Flèche « faire défiler » (SPEC § 3.1) : vraie seulement si du contenu reste caché sous le bord bas
// de la zone qui défile. La mesure se refait au défilement, quand la zone ou un de ses enfants change
// de taille (`ResizeObserver`), quand son contenu change (`MutationObserver`) et une fois les polices
// chargées (`document.fonts.ready`). Les observateurs et l'écouteur sont retirés quand la zone change
// ou que le composant est démonté ; rien n'est lu pendant le rendu serveur.
import { ref, watch, type Ref } from 'vue';

import { hasHiddenContent } from '../../domain/action-bar.js';
import { usePreferences } from './usePreferences.js';

/** Part de la hauteur visible parcourue par la flèche. */
export const SCROLL_HINT_STEP = 0.8;

export interface UseScrollHint {
  /** Du contenu reste caché sous le bord bas. */
  more: Readonly<Ref<boolean>>;
  /** Descend de 80 % de la hauteur visible (sans animation quand les animations sont réduites). */
  scrollDown: () => void;
}

export function useScrollHint(scroller: Readonly<Ref<HTMLElement | null>>): UseScrollHint {
  const more = ref(false);
  const { preferences } = usePreferences();

  watch(
    scroller,
    (element, _previous, onCleanup) => {
      if (!element) {
        more.value = false;
        return;
      }
      let alive = true;
      const measure = (): void => {
        more.value = hasHiddenContent(element);
      };
      const resizeObserver = new ResizeObserver(measure);
      const observeContent = (): void => {
        resizeObserver.disconnect();
        resizeObserver.observe(element);
        for (const child of element.children) resizeObserver.observe(child);
      };
      const mutationObserver = new MutationObserver(() => {
        observeContent();
        measure();
      });

      element.addEventListener('scroll', measure, { passive: true });
      observeContent();
      mutationObserver.observe(element, { childList: true, subtree: true, characterData: true });
      measure();
      void document.fonts.ready.then(() => {
        if (alive) measure();
      });

      onCleanup(() => {
        alive = false;
        element.removeEventListener('scroll', measure);
        resizeObserver.disconnect();
        mutationObserver.disconnect();
      });
    },
    { immediate: true, flush: 'post' },
  );

  function scrollDown(): void {
    const element = scroller.value;
    if (!element) return;
    element.scrollBy({
      top: Math.round(element.clientHeight * SCROLL_HINT_STEP),
      behavior: preferences.value.reduceMotion ? 'auto' : 'smooth',
    });
  }

  return { more, scrollDown };
}
