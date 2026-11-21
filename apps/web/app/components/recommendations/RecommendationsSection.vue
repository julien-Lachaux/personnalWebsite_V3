<script setup lang="ts">
// Section Recommandations (F5-A, SPEC § 7) : lien discret vers la source LinkedIn en haut, une citation
// par recommandation, bouton « Voir sur LinkedIn » après la dernière, état vide si aucune n'est
// publiée. Contenu : `CvView.recommendations` et `CvView.links.linkedinRecommendations`.
//
// Les citations sont reproduites à l'identique, dans leur langue d'origine (`RecommendationView.lang`,
// `fr` même sur la page `en`) : `lang` sur la citation et sur sa légende, pour les lecteurs d'écran et
// la césure. Le libellé du lien du haut est celui de l'API (dans la langue de la page) ; celui du
// bouton est un libellé d'interface. Le `h2` de la section est celui de la coquille : pas de titre ici.
import { useI18n } from '#imports';

import { type LinkView, type RecommendationView } from '../../data/cv-view.js';
import LinkButton from '../base/LinkButton.vue';

defineProps<{
  /** `CvView.recommendations` ; vide : état vide. */
  recommendations: readonly RecommendationView[];
  /** `CvView.links.linkedinRecommendations` ; `null` masque le lien du haut et le bouton du bas. */
  source: LinkView | null;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="recos">
    <LinkButton
      v-if="source"
      class="recos__source"
      :href="source.url"
      variant="link"
      tone="linkedin"
      :external-label="t('common.opensInNewTab')"
    >
      {{ source.label }}
    </LinkButton>
    <ul v-if="recommendations.length > 0" class="recos__list">
      <li v-for="recommendation in recommendations" :key="recommendation.slug">
        <figure class="reco">
          <svg
            class="reco__mark"
            aria-hidden="true"
            width="28"
            height="22"
            viewBox="0 0 28 22"
            fill="currentColor"
          >
            <path
              d="M0 22V12C0 5 4 1 11 0v4C8 5 6 7 6 10h5v12H0zm16 0V12c0-7 4-11 11-12v4c-3 1-5 3-5 6h5v12H16z"
            />
          </svg>
          <blockquote class="reco__quote" :lang="recommendation.lang">
            <p v-for="(paragraph, index) in recommendation.paragraphs" :key="index">
              {{ paragraph }}
            </p>
          </blockquote>
          <figcaption class="reco__caption" :lang="recommendation.lang">
            <span class="reco__author">{{ recommendation.author }}</span>
            <span class="reco__role">{{ recommendation.role }}</span>
            <span class="reco__context">{{ recommendation.context }}</span>
          </figcaption>
        </figure>
      </li>
    </ul>
    <p v-else class="recos__empty">{{ t('recommendations.empty') }}</p>
    <LinkButton
      v-if="source && recommendations.length > 0"
      class="recos__button"
      :href="source.url"
      variant="linkedin"
      size="lg"
      block
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
      {{ t('recommendations.seeOnLinkedIn') }}
    </LinkButton>
  </div>
</template>

<style scoped>
.recos {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: var(--content-max);
  margin-inline: auto;
}

.recos__source {
  align-self: flex-start;

  /* Aligne le texte du lien sur le bord du contenu (le lien texte a 0,25 rem de marge intérieure). */
  margin-inline-start: -0.25rem;
}

.recos__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.recos__empty {
  margin: 0;
  color: var(--muted);
  font-size: var(--font-size-body-mobile);
  line-height: 1.5;
}

.reco {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 1.125rem;
  border: var(--border-strong);
  border-radius: var(--radius-window);
  background-color: var(--card);
}

.reco__mark {
  color: var(--accent);
}

.reco__quote {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  font-size: var(--font-size-lead);
  line-height: 1.5;
}

.reco__quote p {
  margin: 0;
}

.reco__caption {
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
  padding-top: 0.75rem;
  border-top: var(--border-thin);
  font-size: var(--font-size-small);
}

.reco__author {
  font-size: var(--font-size-lead);
  font-weight: var(--font-weight-bold);
}

.reco__role {
  color: var(--muted);
}

.reco__context {
  color: var(--violet);
}

@media (min-width: 1024px) {
  .recos {
    gap: 0.875rem;
  }

  .recos__list {
    gap: 0.875rem;
  }

  /* Dans la tuile (fond `--card`), la carte prend le fond de la page, comme la maquette. */
  .reco {
    gap: 0.625rem;
    padding: 1rem;
    background-color: var(--bg);
  }

  .reco__quote,
  .reco__author {
    font-size: var(--font-size-body-mobile);
  }

  .reco__caption {
    padding-top: 0.625rem;
  }
}
</style>
