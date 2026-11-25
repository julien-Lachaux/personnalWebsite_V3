<script setup lang="ts">
// Page « travaux en cours » (lot 31) : `/travaux`, `/en/work-in-progress`. Le proxy de production y
// mène les visiteurs quand le site est fermé pour travaux (lot 32, Caddy) ; elle existe aussi le reste
// du temps, à la même adresse. Aucun appel à l'API à l'affichage (le CV est lu au build), rien de
// supposé sur le statut HTTP avec lequel elle est servie.
//
// - Gabarit des pages annexes (en-tête du site : accessibilité, langue, thème), fenêtre `>_ fichier`,
//   sans lien de retour à l'accueil : pendant les travaux, l'accueil mène ici.
// - Contact : le bouton « Lancer l'entretien » de l'accueil (`mailto:` vers NUXT_PUBLIC_CONTACT_EMAIL,
//   adresse jamais affichée) ; absente ou invalide, la page lève une erreur et la génération échoue.
// - LinkedIn : le lien social `linkedin` du CV, lu au build par le même chemin que l'accueil (`useCv`,
//   puis `mapLinks` de `mapCv`) ; absent des données, la page lève et la génération échoue plutôt que
//   d'afficher un bouton mort. Lien externe : nouvel onglet, `noopener noreferrer`, indication
//   accessible (`LinkButton`, `common.opensInNewTab`).
// - Hors index (`useUnindexedPage`) : `noindex`, ni canonique ni hreflang, donc absente du plan du site.
// - Chemin anglais (`i18n.pages`), gabarit `annex` (`routeRules`, `appLayout`) et prérendu des deux
//   langues (aucun lien n'y mène) sont posés dans nuxt.config.ts.
// Fichier partagé, réservé au lead-architecte.
import AnnexPage from '../components/annex/AnnexPage.vue';
import LinkButton from '../components/base/LinkButton.vue';
import ContactButton from '../components/shell/ContactButton.vue';
import { usePageSeo, useUnindexedPage } from '../composables/seo/useSeo.js';
import { useContactLink } from '../composables/shell/useContactLink.js';
import { useCv } from '../composables/use-cv.js';
import { mapLinks } from '../data/map-cv.js';

const { t, locale } = useI18n();

if (useContactLink().value === null) {
  throw new Error(
    'Adresse de contact absente ou invalide : NUXT_PUBLIC_CONTACT_EMAIL doit être une adresse ' +
      'e-mail (bouton de contact de la page « travaux en cours », lien mailto:).',
  );
}

usePageSeo(() => ({
  title: t('workInProgress.title'),
  description: t('workInProgress.description'),
}));
useUnindexedPage();

const cv = await useCv(locale.value);
const linkedin = mapLinks(cv.socialLinks).linkedin;
if (linkedin === null) {
  throw new Error(
    `Lien LinkedIn absent du CV « ${locale.value} » : la page « travaux en cours » attend un lien ` +
      'social de slug « linkedin » (social_links).',
  );
}
</script>

<template>
  <AnnexPage file="travaux-en-cours.md">
    <h1>{{ t('workInProgress.title') }}</h1>
    <p>{{ t('workInProgress.intro') }}</p>
    <p>{{ t('workInProgress.next') }}</p>
    <div class="work-in-progress__actions">
      <ContactButton size="md" />
      <LinkButton
        :href="linkedin.url"
        variant="outline"
        size="md"
        :external-label="t('common.opensInNewTab')"
      >
        <template #icon>
          <svg
            focusable="false"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="9" cy="8" r="3.5" />
            <path
              d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.6c1.9.9 3 2.8 3 5.4"
            />
          </svg>
        </template>
        {{ t('workInProgress.linkedin') }}
      </LinkButton>
    </div>
  </AnnexPage>
</template>

<style scoped>
.work-in-progress__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
</style>
