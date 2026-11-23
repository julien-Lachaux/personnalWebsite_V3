// Configuration de vue-i18n (lue par @nuxtjs/i18n : `i18n/i18n.config.ts`). Seule la règle de pluriel du
// français est posée ici (zéro au singulier, constat RC-6) ; elle vit dans `app/domain/plural-rules.ts`.
import { frenchPlural } from '../app/domain/plural-rules.js';

export default defineI18nConfig(() => ({
  legacy: false,
  pluralRules: {
    fr: (choice: number, choicesLength: number, defaultRule?: (c: number, l: number) => number) =>
      frenchPlural(choice, choicesLength, (c, l) => defaultRule!(c, l)),
  },
}));
