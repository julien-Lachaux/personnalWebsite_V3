<script setup lang="ts">
// « Lancer l'entretien » (F3-05) : lien `mailto:` vers l'adresse de la configuration publique
// (`NUXT_PUBLIC_CONTACT_EMAIL`), sujet prérempli. Une adresse absente ou de forme non admise fait échouer
// la génération avant (`AppShell` lève) ; monté seul, le composant ne rend alors rien plutôt qu'un lien
// vide, trompeur. La classe et les attributs reçus vont sur le lien.
import { useI18n } from '#imports';

import { useContactLink } from '../../composables/shell/useContactLink.js';
import LinkButton from '../base/LinkButton.vue';

withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), { size: 'sm' });

const { t } = useI18n();
const href = useContactLink();
</script>

<template>
  <LinkButton v-if="href" :href="href" variant="solid" :size="size">{{
    t('shell.actions.interview')
  }}</LinkButton>
</template>
