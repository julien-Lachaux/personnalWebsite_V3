<script setup lang="ts">
// Page « travaux en cours » (lot 31) : `/travaux`, `/en/work-in-progress`. Le proxy de production y
// mène les visiteurs quand le site est fermé pour travaux (lot 32, Caddy) ; elle existe aussi le reste
// du temps, à la même adresse. Page autonome : aucun appel à l'API (ni au build ni à l'affichage),
// rien de supposé sur le statut HTTP avec lequel elle est servie.
//
// - Gabarit des pages annexes (en-tête du site : accessibilité, langue, thème), fenêtre `>_ fichier`,
//   sans lien de retour à l'accueil : pendant les travaux, l'accueil mène ici.
// - Contact : le bouton « Lancer l'entretien » de l'accueil (`mailto:` vers NUXT_PUBLIC_CONTACT_EMAIL,
//   adresse jamais affichée) ; absente ou invalide, la page lève une erreur et la génération échoue.
// - CV : le bouton « CV PDF » de l'accueil, vers `/cv/cv-<langue>.pdf` ; le CV de la langue absent de
//   `public/cv/`, il mène au CV français, signalé (« (in French) », `hreflang`), par `useCvLink` (D22).
// - Hors index (`useUnindexedPage`) : `noindex`, ni canonique ni hreflang, donc absente du plan du site.
// - Chemin anglais (`i18n.pages`), gabarit `annex` (`routeRules`, `appLayout`) et prérendu des deux
//   langues (aucun lien n'y mène) sont posés dans nuxt.config.ts.
// Fichier partagé, réservé au lead-architecte.
import AnnexPage from '../components/annex/AnnexPage.vue';
import ContactButton from '../components/shell/ContactButton.vue';
import CvButton from '../components/shell/CvButton.vue';
import { usePageSeo, useUnindexedPage } from '../composables/seo/useSeo.js';
import { useContactLink } from '../composables/shell/useContactLink.js';
import { CV_DIRECTORY, cvFileName } from '../domain/cv-link.js';

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
</script>

<template>
  <AnnexPage file="travaux-en-cours.md">
    <h1>{{ t('workInProgress.title') }}</h1>
    <p>{{ t('workInProgress.intro') }}</p>
    <p>{{ t('workInProgress.next') }}</p>
    <div class="work-in-progress__actions">
      <ContactButton size="md" />
      <CvButton :href="CV_DIRECTORY + cvFileName(locale)" size="md" />
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
