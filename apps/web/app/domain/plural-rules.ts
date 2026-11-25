// Règle de pluriel du français (constat RC-6) : vue-i18n, par défaut, met zéro au pluriel (règle de
// l'anglais, « 0 experiences »). En français zéro est singulier, comme un : « 0 expérience ». Module pur,
// branché par `i18n/i18n.config.ts`.

/** Règle de pluriel par défaut de vue-i18n : numéro de la forme à servir. */
export type PluralRule = (choice: number, choicesLength: number) => number;

/**
 * Numéro de la forme d'un message « une | plusieurs » pour `choice` : 0 (zéro et un, valeur absolue
 * strictement inférieure à 2) ou 1. Un message qui n'a pas deux formes suit `fallback`.
 */
export function frenchPlural(choice: number, choicesLength: number, fallback: PluralRule): number {
  if (choicesLength !== 2) return fallback(choice, choicesLength);
  return Math.abs(choice) < 2 ? 0 : 1;
}
