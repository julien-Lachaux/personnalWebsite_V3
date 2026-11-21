// Technos choisies pour filtrer les expériences, reliées à l'URL (SPEC § 5, « Persistance ») :
// `?tech=slug1,slug2`, lu au chargement, écrit sans recharger la page, donc partageable. Toute la
// logique (lecture, écriture, ET) est dans `domain/filter` ; ce composable ne fait que relier l'état
// à vue-router.
//
// - La page est générée sans filtre : la lecture de l'URL attend le montage (`mounted`), pour que le
//   premier rendu côté navigateur soit identique à la page statique (pas d'écart d'hydratation).
// - L'état local est la source de vérité immédiate (deux clics rapprochés ne lisent jamais un état
//   périmé : la navigation de vue-router est asynchrone) ; l'URL le suit (`replace` : une puce
//   choisie n'est pas une page de l'historique) et, quand elle change d'ailleurs (retour, lien
//   partagé collé dans la page), l'état la suit en retour.
// - Les autres paramètres de l'URL sont conservés.
import {
  computed,
  onMounted,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type WritableComputedRef,
} from 'vue';
import { useRoute, useRouter } from '#imports';

import { parseTechParam, serializeTechParam } from '../../domain/filter.js';

export interface TechFilterState {
  /** Slugs des technos choisies, dans l'ordre du choix. */
  readonly selected: WritableComputedRef<readonly string[]>;
}

/** Même liste de slugs, dans le même ordre. */
function sameSelection(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((slug, index) => slug === b[index]);
}

/** Technos choisies liées à `?tech=` ; `knownSlugs` : les slugs admis (les autres sont ignorés). */
export function useTechFilter(knownSlugs: MaybeRefOrGetter<readonly string[]>): TechFilterState {
  const route = useRoute();
  const router = useRouter();
  const mounted = ref(false);
  const local = ref<readonly string[]>([]);

  const fromUrl = computed(() => parseTechParam(route.query['tech'], toValue(knownSlugs)));

  onMounted(() => {
    mounted.value = true;
    local.value = fromUrl.value;
  });

  // L'URL change d'ailleurs (retour du navigateur, navigation) : l'état la suit.
  watch(fromUrl, (next) => {
    if (mounted.value && !sameSelection(next, local.value)) local.value = next;
  });

  const selected = computed<readonly string[]>({
    get: () => local.value,
    set: (next) => {
      local.value = next;
      void router.replace({
        query: { ...route.query, tech: serializeTechParam(next) },
        hash: route.hash,
      });
    },
  });

  return { selected };
}
