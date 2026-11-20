/** Profil public, déjà traduit dans la langue demandée (une seule ligne, `id = 1`). */
export interface Profile {
  readonly firstName: string;
  readonly lastName: string;
  readonly location: string;
  readonly picturePath: string;
  readonly pictureAlt: string;
  readonly title: string;
  /** Pastille accolée au titre (« senior »). */
  readonly titleBadge: string;
  /** Phrases d'accroche, au moins une. */
  readonly taglines: readonly string[];
  readonly intro: string;
  readonly mission: string;
  /** Activité du moment (« en ce moment »). */
  readonly currentActivity: string;
  /** Ce que Julien recherche : format, lieu, disponibilité. */
  readonly seekingFormat: string;
  readonly seekingLocation: string;
  readonly seekingAvailability: string;
  /** Chemin du CV en PDF servi par le front, propre à la langue. */
  readonly cvPath: string;
}
