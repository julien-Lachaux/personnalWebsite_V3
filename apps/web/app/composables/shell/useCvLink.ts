// Entrées du menu du CV (D44) : les deux versions, française et anglaise, avec leur libellé traduit
// dans la langue de la page. Une version dont le fichier manque dans `public/cv/` (liste relevée au
// build, `runtimeConfig.public.cvFiles`) n'a pas d'adresse et porte la mention « (bientôt) ».
// Décision : `cvVersions` (app/domain/cv-link.ts).
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import { useI18n, useRuntimeConfig } from '#imports';

import { cvVersions, type CvLanguage } from '../../domain/cv-link.js';

export interface CvEntryView {
  readonly language: CvLanguage;
  /** Libellé de la version, ex. « Version anglaise ». */
  readonly label: string;
  /** Adresse du PDF ; `undefined` tant que le fichier manque (entrée inactive). */
  readonly href: string | undefined;
  /** Mention des entrées inactives, ex. « (bientôt) » ; sinon `undefined`. */
  readonly soon: string | undefined;
}

export function useCvLink(href: MaybeRefOrGetter<string>): ComputedRef<readonly CvEntryView[]> {
  const { t } = useI18n();
  const { public: publicConfig } = useRuntimeConfig();
  return computed(() =>
    cvVersions(toValue(href), publicConfig.cvFiles).map((version) => ({
      language: version.language,
      label: t(`shell.actions.cvMenu.${version.language}`),
      href: version.available ? version.href : undefined,
      soon: version.available ? undefined : t('shell.actions.cvMenu.soon'),
    })),
  );
}
