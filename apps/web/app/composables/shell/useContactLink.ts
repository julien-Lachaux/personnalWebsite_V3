// Lien du bouton « Lancer l'entretien » : un `mailto:` construit depuis l'adresse de la configuration
// publique (`NUXT_PUBLIC_CONTACT_EMAIL`, valeur figée au build ; jamais d'adresse dans le code) avec un
// sujet prérempli et traduit.
import { computed, type ComputedRef } from 'vue';
import { useI18n, useRuntimeConfig } from '#imports';

/** Adresse admise : caractères courants seulement, rien qui puisse ouvrir un paramètre du `mailto:`. */
const EMAIL = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/** `mailto:` avec sujet, ou `null` quand l'adresse est absente ou n'a pas une forme admise. */
export function mailtoHref(email: string, subject: string): string | null {
  const address = email.trim();
  if (!EMAIL.test(address)) return null;
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}

/** Lien `mailto:` de la langue courante ; `null` tant que l'adresse n'est pas configurée. */
export function useContactLink(): ComputedRef<string | null> {
  const { t } = useI18n();
  const { public: publicConfig } = useRuntimeConfig();
  return computed(() => mailtoHref(publicConfig.contactEmail, t('shell.actions.subject')));
}
