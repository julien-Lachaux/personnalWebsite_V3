<script setup lang="ts">
// Section Profil (F5-A, SPEC § 2 et § 4.1) : titre et pastille, accroches, mission, intro, encadré
// « en ce moment / ce que je recherche », liens de réseaux. Contenu : `ProfileView` et `LinksView` de
// `CvView` (jamais le contrat). Le `h2` de la section est celui de la coquille (`AppShell`) ; ici,
// seuls le titre du profil (`titleTag`) et les `h3` de l'encadré.
//
// Aucune hypothèse de hauteur et aucun défilement : la tuile du profil ne défile jamais et réduit son
// contenu par le facteur S (`FitToHeight`, F6). Les tailles de texte sont en `rem` et suivent le
// réglage de taille du texte ; mobile et tablette (< 1024 px) lisent 18 px, le bureau 17 px.
import { type LinksView, type ProfileView } from '../../data/cv-view.js';
import ProfileTitle from './ProfileTitle.vue';
import SituationCard from './SituationCard.vue';
import SocialLinks from './SocialLinks.vue';

withDefaults(
  defineProps<{
    /** `CvView.profile`. */
    profile: ProfileView;
    /** `CvView.links` (GitHub et LinkedIn). */
    links: LinksView;
    /** `h1` si la section porte le titre de la page, `div` si la coquille pose déjà le `h1`. */
    titleTag?: 'h1' | 'div';
  }>(),
  { titleTag: 'div' },
);
</script>

<template>
  <div class="profile">
    <ProfileTitle :lines="profile.titleLines" :badge="profile.badge" :tag="titleTag" />
    <div class="profile__taglines">
      <p v-for="tagline in profile.taglines" :key="tagline" class="profile__tagline">
        {{ tagline }}
      </p>
    </div>
    <p class="profile__mission">{{ profile.mission }}</p>
    <p class="profile__intro">{{ profile.intro }}</p>
    <SituationCard :currently="profile.currently" :looking-for="profile.lookingFor" />
    <SocialLinks :github="links.github" :linkedin="links.linkedin" />
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.profile__taglines {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: var(--violet);
  font-size: var(--font-size-body-mobile);
  font-weight: var(--font-weight-medium);
  letter-spacing: -0.01em;
  line-height: 1.4;
}

.profile__tagline,
.profile__mission,
.profile__intro {
  margin: 0;
}

.profile__mission,
.profile__intro {
  font-size: var(--font-size-lead-mobile);
  line-height: 1.45;
}

.profile__mission {
  font-weight: var(--font-weight-semibold);
}

@media (min-width: 1024px) {
  .profile {
    gap: 1rem;
  }

  .profile__mission,
  .profile__intro {
    font-size: var(--font-size-lead);
    line-height: 1.5;
  }
}
</style>
