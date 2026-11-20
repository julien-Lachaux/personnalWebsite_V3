// Filtre des expériences par technos (SPEC § 5, COMPOSANTS.md `filterService`) : logique pure, sans
// Vue ni Nuxt. Le domaine définit ses propres types d'entrée ; le mapping depuis les contrats de
// l'API (`@siteperso/contracts`) vit dans `app/data/` (lot F4). L'identité d'une techno est son
// slug, jamais son libellé. Aucune chaîne destinée à l'utilisateur ici : les libellés (FR, EN)
// viennent de l'i18n du composant, à partir des nombres et des états rendus par ce module.

/** Techno du filtre : slug (identité), nom affiché, domaine et rang dans la stack principale. */
export interface FilterTech {
  readonly slug: string;
  readonly name: string;
  readonly groupSlug: string;
  /** Rang dans la « stack principale » (de 1 à N), `null` si la techno n'en fait pas partie. */
  readonly mainStackOrder: number | null;
}

/** Expérience vue du filtre : technos affichées en puces et mots-clés cachés (`shownInStack`). */
export interface FilterExperience {
  readonly slug: string;
  readonly visibleSlugs: readonly string[];
  readonly hiddenSlugs: readonly string[];
}

/** Nombre maximal de suggestions de saisie (SPEC § 5). */
export const MAX_SUGGESTIONS = 6;

/** Une expérience du résultat et, parmi les technos choisies, celles qu'elle porte. */
export interface FilterEntry<E extends FilterExperience = FilterExperience> {
  readonly experience: E;
  readonly matched: readonly string[];
}

/** Résultat du filtre ET, dans l'ordre d'origine des expériences. */
export interface FilterResult<E extends FilterExperience = FilterExperience> {
  /** Vrai si au moins une techno est choisie. */
  readonly active: boolean;
  /** Expériences qui ont toutes les technos choisies (toutes les expériences sans filtre). */
  readonly full: readonly FilterEntry<E>[];
  /** Expériences qui n'ont que certaines des technos choisies (au moins une, pas toutes). */
  readonly partial: readonly FilterEntry<E>[];
  /** Expériences qui n'ont aucune des technos choisies. */
  readonly none: readonly FilterEntry<E>[];
}

/**
 * État d'une techno dans le panneau ou les suggestions :
 * - `selected` : déjà choisie (la cliquer la retire) ;
 * - `available` : l'ajouter laisserait au moins une expérience ;
 * - `disabled` : l'ajouter donnerait 0 résultat (atténuée, `aria-disabled`) ;
 * - `unlinked` : aucune expérience détaillée (pointillé, non cliquable).
 */
export type TechState = 'selected' | 'available' | 'disabled' | 'unlinked';

export interface TechCounter {
  readonly slug: string;
  readonly state: TechState;
  /** Expériences restantes si on ajoute la techno, résultat courant si elle est choisie, 0 sinon. */
  readonly count: number;
  /** Nombre d'expériences qui portent la techno, sans tenir compte du filtre en cours. */
  readonly total: number;
  /** Vrai si un clic a un effet (choisie, pour la retirer, ou disponible). */
  readonly selectable: boolean;
}

export interface Suggestion extends TechCounter {
  readonly tech: FilterTech;
}

/** Données de l'annonce `aria-live` ; le libellé (pluriel compris) est composé par l'interface. */
export interface ResultsAnnouncement {
  /** `all` : pas de filtre ; `results` : au moins une expérience combine tout ; `empty` : aucune. */
  readonly kind: 'all' | 'results' | 'empty';
  /** Expériences affichées en tête (celles qui ont toutes les technos choisies). */
  readonly count: number;
  /** Expériences repliées derrière « Voir les N autres ». */
  readonly others: number;
  /** Technos choisies. */
  readonly filters: number;
}

/** Vrai si l'expérience porte la techno, en puce affichée ou en mot-clé caché. */
export function hasTech(experience: FilterExperience, slug: string): boolean {
  return experience.visibleSlugs.includes(slug) || experience.hiddenSlugs.includes(slug);
}

/** Expériences qui portent toutes les technos données (ET strict) ; toutes si la liste est vide. */
export function experiencesWithAll<E extends FilterExperience>(
  experiences: readonly E[],
  slugs: readonly string[],
): E[] {
  return experiences.filter((experience) => slugs.every((slug) => hasTech(experience, slug)));
}

/** Filtre ET et groupes de résultats ; l'ordre d'origine des expériences est conservé. */
export function filterExperiences<E extends FilterExperience>(
  experiences: readonly E[],
  selected: readonly string[],
): FilterResult<E> {
  const full: FilterEntry<E>[] = [];
  const partial: FilterEntry<E>[] = [];
  const none: FilterEntry<E>[] = [];
  for (const experience of experiences) {
    const matched = selected.filter((slug) => hasTech(experience, slug));
    const entry = { experience, matched };
    if (matched.length === selected.length) full.push(entry);
    else if (matched.length > 0) partial.push(entry);
    else none.push(entry);
  }
  return { active: selected.length > 0, full, partial, none };
}

/** Compteur et état d'une techno vis-à-vis du filtre en cours. */
export function techCounter(
  experiences: readonly FilterExperience[],
  selected: readonly string[],
  slug: string,
): TechCounter {
  const total = experiences.filter((experience) => hasTech(experience, slug)).length;
  if (selected.includes(slug)) {
    const count = experiencesWithAll(experiences, selected).length;
    return { slug, state: 'selected', count, total, selectable: true };
  }
  if (total === 0) return { slug, state: 'unlinked', count: 0, total, selectable: false };
  const count = experiencesWithAll(experiences, [...selected, slug]).length;
  const state = count === 0 ? 'disabled' : 'available';
  return { slug, state, count, total, selectable: count > 0 };
}

/** Compteurs de toutes les technos, dans l'ordre donné. */
export function techCounters(
  techs: readonly FilterTech[],
  experiences: readonly FilterExperience[],
  selected: readonly string[],
): TechCounter[] {
  return techs.map((tech) => techCounter(experiences, selected, tech.slug));
}

/** Stack principale : technos qui ont un rang, triées par rang (stable). */
export function mainStack(techs: readonly FilterTech[]): FilterTech[] {
  return techs
    .filter((tech) => tech.mainStackOrder !== null)
    .sort((a, b) => stackRank(a) - stackRank(b));
}

/** Forme de comparaison d'une saisie : sans casse ni accents, espaces de bord retirés. */
export function normalizeQuery(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Rang de tri : celui de la stack principale, les technos sans rang après toutes les autres. */
function stackRank(tech: FilterTech): number {
  return tech.mainStackOrder ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Suggestions de saisie : technos dont le nom contient la saisie (sans casse ni accents), hors
 * technos déjà choisies, triées par nombre d'expériences décroissant puis rang de stack principale
 * (les technos sans rang en dernier, ordre d'origine ensuite), 6 au plus, avec leur état.
 */
export function suggest(
  query: string,
  techs: readonly FilterTech[],
  experiences: readonly FilterExperience[],
  selected: readonly string[],
  limit: number = MAX_SUGGESTIONS,
): Suggestion[] {
  const needle = normalizeQuery(query);
  if (needle === '') return [];
  return techs
    .filter((tech) => !selected.includes(tech.slug) && normalizeQuery(tech.name).includes(needle))
    .map((tech) => ({ tech, ...techCounter(experiences, selected, tech.slug) }))
    .sort((a, b) => b.total - a.total || stackRank(a.tech) - stackRank(b.tech))
    .slice(0, limit);
}

/** Première suggestion sur laquelle on peut agir : celle qu'Entrée choisit. */
export function firstValidSuggestion(suggestions: readonly Suggestion[]): Suggestion | undefined {
  return suggestions.find((suggestion) => suggestion.selectable);
}

/** Ajoute une techno ; sans effet (même tableau) si elle est déjà choisie. */
export function addTech(selected: readonly string[], slug: string): readonly string[] {
  return selected.includes(slug) ? selected : [...selected, slug];
}

/** Retire une techno ; sans effet (même tableau) si elle n'est pas choisie. */
export function removeTech(selected: readonly string[], slug: string): readonly string[] {
  return selected.includes(slug) ? selected.filter((item) => item !== slug) : selected;
}

/** Ajoute la techno si elle manque, la retire sinon (puce, badge de carte, ligne du panneau). */
export function toggleTech(selected: readonly string[], slug: string): readonly string[] {
  return selected.includes(slug) ? removeTech(selected, slug) : addTech(selected, slug);
}

/** Retire la dernière techno choisie (Retour arrière sur un champ vide). */
export function removeLastTech(selected: readonly string[]): readonly string[] {
  return selected.slice(0, -1);
}

/** Valeur brute d'un paramètre de requête : chaîne, répété (tableau) ou absent. */
export type QueryValue = string | readonly (string | null)[] | null | undefined;

/**
 * Lit `?tech=slug1,slug2` : slugs inconnus ignorés, doublons retirés, ordre conservé. Un paramètre
 * répété (`?tech=a&tech=b`) est lu comme une seule liste.
 */
export function parseTechParam(value: QueryValue, knownSlugs: readonly string[]): string[] {
  const parts = [value].flat().filter((part) => typeof part === 'string');
  const slugs = parts.flatMap((part) => part.split(',')).map((slug) => slug.trim());
  return slugs.filter((slug, index) => knownSlugs.includes(slug) && slugs.indexOf(slug) === index);
}

/** Écrit `?tech=` : `undefined` sans filtre, pour que le paramètre disparaisse de l'URL. */
export function serializeTechParam(selected: readonly string[]): string | undefined {
  return selected.length > 0 ? selected.join(',') : undefined;
}

/** Données de l'annonce `aria-live` pour le filtre en cours. */
export function announceResults(
  experiences: readonly FilterExperience[],
  selected: readonly string[],
): ResultsAnnouncement {
  const { active, full, partial, none } = filterExperiences(experiences, selected);
  const others = partial.length + none.length;
  const filters = selected.length;
  if (!active) return { kind: 'all', count: full.length, others, filters };
  return { kind: full.length > 0 ? 'results' : 'empty', count: full.length, others, filters };
}
