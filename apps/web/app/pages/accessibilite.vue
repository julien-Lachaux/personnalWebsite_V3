<script setup lang="ts">
// Déclaration d'accessibilité (lot F7, F7-01 ; SPEC § 10.1) : `/accessibilite`, `/en/accessibility`.
// Rubriques du modèle de déclaration du RGAA (accessibilite.numerique.gouv.fr, « Déclaration
// d'accessibilité ») : état de conformité, référentiel, technologies, environnement de test, contenus
// non accessibles, retour d'information et contact, voies de recours. Contenu PROVISOIRE, à valider par
// Julien (docs/front-a-traiter-par-julien.md) : aucun audit n'a eu lieu, le site est donc déclaré
// « non conforme » (règle du RGAA sans audit en cours de validité), sans taux inventé.
//
// - Tout le texte vient des libellés (`declaration.*` de common.json), dans les deux langues.
// - Les contenus non accessibles sont la liste `declaration.issues.items` (D34 : tous les défauts connus
//   non corrigés ; vide, la page dit qu’aucun défaut n’est recensé).
// - Le contact est un `mailto:` vers NUXT_PUBLIC_CONTACT_EMAIL, comme « Lancer l'entretien » : l'adresse
//   n'est jamais affichée ; absente ou invalide, la page lève une erreur et la génération échoue.
// - L'adresse du site citée est celle des liens canoniques (NUXT_PUBLIC_I18N_BASE_URL).
// - Chemin anglais (`i18n.pages`) et gabarit `annex` (`routeRules`, `appLayout`) sont posés dans
//   nuxt.config.ts : `definePageMeta` laisse dans le composant compilé une branche que les tests de
//   composants n'exécutent pas (couverture des branches).
// Fichier partagé, réservé au lead-architecte.
import { computed } from 'vue';

import AnnexPage from '../components/annex/AnnexPage.vue';
import { usePageSeo } from '../composables/seo/useSeo.js';
import { mailtoHref } from '../composables/shell/useContactLink.js';

/** Voies de recours du modèle de déclaration du RGAA (pages du Défenseur des droits, en français). */
const DEFENSEUR_MESSAGE = 'https://www.defenseurdesdroits.fr/nous-contacter-355';
const DEFENSEUR_DELEGATES = 'https://www.defenseurdesdroits.fr/carte-des-delegues';

const i18n = useI18n();
const { t } = i18n;
const config = useRuntimeConfig();

const contact = mailtoHref(config.public.contactEmail, t('declaration.contact.subject'));
if (contact === null) {
  throw new Error(
    'Adresse de contact absente ou invalide : NUXT_PUBLIC_CONTACT_EMAIL doit être une adresse ' +
      'e-mail (contact de la déclaration d’accessibilité, lien mailto:).',
  );
}

const site = config.public.i18n.baseUrl;
/** Message compilé d'une liste de libellés (`tm`), rendu par `rt`. */
type CompiledMessage = Parameters<typeof i18n.rt>[0];
/** Contenus non accessibles recensés (vide avant l'audit). */
const issues = computed(() => {
  const items: unknown = i18n.tm('declaration.issues.items');
  return (items as CompiledMessage[]).map((item) => i18n.rt(item));
});

usePageSeo(() => ({ title: t('declaration.title'), description: t('declaration.description') }));
</script>

<template>
  <AnnexPage file="declaration-accessibilite.md" :back="t('declaration.back')">
    <h1>{{ t('declaration.title') }}</h1>
    <p class="declaration__notice">{{ t('declaration.pending') }}</p>
    <i18n-t keypath="declaration.intro" tag="p">
      <template #site>
        <span class="declaration__site">{{ site }}</span>
      </template>
    </i18n-t>

    <h2>{{ t('declaration.status.title') }}</h2>
    <i18n-t keypath="declaration.status.text" tag="p">
      <template #status>
        <strong>{{ t('declaration.status.value') }}</strong>
      </template>
    </i18n-t>

    <h2>{{ t('declaration.standard.title') }}</h2>
    <p>{{ t('declaration.standard.text') }}</p>

    <h2>{{ t('declaration.technologies.title') }}</h2>
    <p>{{ t('declaration.technologies.text') }}</p>

    <h2>{{ t('declaration.tests.title') }}</h2>
    <p>{{ t('declaration.tests.text') }}</p>

    <h2>{{ t('declaration.issues.title') }}</h2>
    <ul v-if="issues.length > 0">
      <li v-for="issue in issues" :key="issue">{{ issue }}</li>
    </ul>
    <p v-else>{{ t('declaration.issues.none') }}</p>

    <h2>{{ t('declaration.contact.title') }}</h2>
    <p>{{ t('declaration.contact.text') }}</p>
    <p>
      <a :href="contact">{{ t('declaration.contact.link') }}</a>
    </p>

    <h2>{{ t('declaration.remedies.title') }}</h2>
    <p>{{ t('declaration.remedies.text') }}</p>
    <ul>
      <li>
        <a :href="DEFENSEUR_MESSAGE" hreflang="fr" rel="noopener noreferrer">{{
          t('declaration.remedies.message')
        }}</a>
      </li>
      <li>
        <a :href="DEFENSEUR_DELEGATES" hreflang="fr" rel="noopener noreferrer">{{
          t('declaration.remedies.delegate')
        }}</a>
      </li>
      <li>
        {{ t('declaration.remedies.post') }}<br />
        <span class="declaration__address">{{ t('declaration.remedies.address') }}</span>
      </li>
    </ul>

    <p class="declaration__date">{{ t('declaration.date') }}</p>
  </AnnexPage>
</template>

<style scoped>
.declaration__notice {
  padding: 0.75rem 1rem;
  border-inline-start: 0.25rem solid var(--violet);
  background-color: var(--accent-bg);
  font-weight: var(--font-weight-medium);
}

.declaration__site,
.declaration__address {
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}

.declaration__date {
  margin-top: 2rem;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
}
</style>
