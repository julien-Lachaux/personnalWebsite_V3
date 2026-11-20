// Mise en forme des dates et de la ligne « lieu, mode · contrat » des cartes (docs/04 :
// « Expériences » et « Recommandations »). Logique pure, sans Vue ni Nuxt. Les libellés qui
// relèvent de la présentation (« aujourd'hui », « hybride », « CDI »…) sont injectés par l'appelant,
// qui les tire de l'i18n : aucune chaîne française ni anglaise en dur ici, hors le séparateur typographique.

/** Langues du site : `fr` (défaut) et `en`. */
export type Locale = 'fr' | 'en';

/** Séparateur de période : tiret demi-cadratin entouré d'espaces (« janv. 2026 – mai 2026 »). */
const PERIOD_SEPARATOR = ' – ';
/** Séparateur entre « lieu, mode » et le contrat. */
const CONTRACT_SEPARATOR = ' · ';
/** Valeur du type de contrat qui ne s'affiche pas (contrat `none`, pause professionnelle). */
const NO_CONTRACT = 'none';

/** Mois abrégé et année, en UTC : une date ISO sans heure (« 2026-01-01 ») ne glisse pas d'un jour. */
function monthFormatter(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Période d'une expérience : « janv. 2026 – mai 2026 » ; `dateEnd` nul = en cours, le libellé
 * `presentLabel` (« aujourd'hui », « present ») prend la place de la date de fin. Dates au format
 * ISO `AAAA-MM-JJ` (champs `dateStart` et `dateEnd` de l'API).
 */
export function formatPeriod(
  dateStart: string,
  dateEnd: string | null,
  locale: Locale,
  presentLabel: string,
): string {
  const formatter = monthFormatter(locale);
  const end = dateEnd === null ? presentLabel : formatter.format(new Date(dateEnd));
  return formatter.format(new Date(dateStart)) + PERIOD_SEPARATOR + end;
}

/** Données de la ligne « lieu, mode · contrat » d'une expérience (champs de l'API). */
export interface ExperienceMeta {
  readonly location: string | null;
  readonly workMode: string | null;
  readonly contractType: string | null;
}

/** Libellés injectés : un mode de travail et un type de contrat (hors `none`) vers leur texte. */
export interface ExperienceMetaLabels {
  workMode(value: string): string;
  contractType(value: string): string;
}

/** Vrai pour un texte renseigné (ni nul ni blanc). */
function present(text: string | null): text is string {
  return text !== null && text.trim() !== '';
}

/**
 * Ligne « Paris, hybride · CDI ». Les éléments absents sont omis sans séparateur orphelin ; le
 * contrat `none` n'affiche rien ; texte vide si tout manque (la carte masque alors la ligne).
 */
export function formatExperienceMeta(meta: ExperienceMeta, labels: ExperienceMetaLabels): string {
  const place = [
    present(meta.location) ? meta.location.trim() : null,
    present(meta.workMode) ? labels.workMode(meta.workMode) : null,
  ].filter((part) => part !== null);
  const contract =
    present(meta.contractType) && meta.contractType !== NO_CONTRACT
      ? labels.contractType(meta.contractType)
      : null;
  return [place.length > 0 ? place.join(', ') : null, contract]
    .filter((part) => part !== null)
    .join(CONTRACT_SEPARATOR);
}

/** Date d'une recommandation : « 8 décembre 2025 » (fr), « December 8, 2025 » (en). */
export function formatRecommendationDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));
}
