// Lien du bouton « CV PDF » (D22) : l'adresse reçue de l'API, ou le CV français quand le CV de la
// langue de la page manque dans `public/cv/` (liste relevée au build, `runtimeConfig.public.cvFiles`).
// Le repli est signalé : langue du document (`hreflang`) et mention traduite (« (in French) »), qui
// entre dans le nom accessible du lien. Décision : `resolveCvLink` (app/domain/cv-link.ts).
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import { useI18n, useRuntimeConfig } from '#imports';

import { resolveCvLink } from '../../domain/cv-link.js';

export interface CvLinkView {
  readonly href: string;
  /** Langue du document servi, posée seulement quand elle diffère de celle de la page (repli). */
  readonly hreflang: string | undefined;
  /** Mention ajoutée au libellé lors d'un repli, ex. « (in French) » ; sinon `undefined`. */
  readonly mention: string | undefined;
}

export function useCvLink(href: MaybeRefOrGetter<string>): ComputedRef<CvLinkView> {
  const { t, locale } = useI18n();
  const { public: publicConfig } = useRuntimeConfig();
  return computed(() => {
    const link = resolveCvLink(toValue(href), locale.value, publicConfig.cvFiles);
    if (link.fallbackLanguage === null) {
      return { href: link.href, hreflang: undefined, mention: undefined };
    }
    return {
      href: link.href,
      hreflang: link.fallbackLanguage,
      mention: t('shell.actions.cvInFrench'),
    };
  });
}
