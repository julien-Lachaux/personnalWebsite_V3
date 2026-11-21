<script setup lang="ts">
// Liens de réseaux du profil (SPEC § 2) : GitHub (néon) puis LinkedIn (bleu), côte à côte, ouverts dans un
// nouvel onglet (`noopener noreferrer`, indication accessible, `LinkButton`). Un lien que l'API ne sert
// pas (`null`, par exemple GitHub tant que l'adresse manque) n'est pas rendu ; sans aucun lien, la
// navigation entière disparaît (pas de région vide). Libellés des liens : ceux de l'API
// (`LinkView.label`), dans la langue de la page.
import { useI18n } from '#imports';

import { type LinkView } from '../../data/cv-view.js';
import LinkButton from '../base/LinkButton.vue';

defineProps<{
  /** `LinksView.github` : `null` masque le bouton. */
  github: LinkView | null;
  /** `LinksView.linkedin` : `null` masque le bouton. */
  linkedin: LinkView | null;
}>();

const { t } = useI18n();
</script>

<template>
  <nav v-if="github || linkedin" class="social-links" :aria-label="t('profile.social.label')">
    <LinkButton
      v-if="github"
      class="social-links__link"
      :href="github.url"
      variant="neon"
      size="lg"
      :external-label="t('common.opensInNewTab')"
    >
      <template #icon>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" />
        </svg>
      </template>
      {{ github.label }}
    </LinkButton>
    <LinkButton
      v-if="linkedin"
      class="social-links__link"
      :href="linkedin.url"
      variant="linkedin"
      size="lg"
      :external-label="t('common.opensInNewTab')"
    >
      <template #icon>
        <svg
          width="22"
          height="22"
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
      {{ linkedin.label }}
    </LinkButton>
  </nav>
</template>

<style scoped>
.social-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
}

/* Deux boutons de même largeur ; ils passent l'un sous l'autre si la place manque (texte agrandi). */
.social-links__link {
  flex: 1 1 8rem;
}

/* Mobile et tablette : 56 px comme la maquette (au-dessus des 44 px tactiles). */
@media (max-width: 1023px) {
  .social-links__link {
    min-height: 3.5rem;
  }
}
</style>
