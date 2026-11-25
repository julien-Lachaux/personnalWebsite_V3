<script setup lang="ts">
// Corps d'une page annexe (lot F7 : déclaration d'accessibilité, pages d'erreur) : le contenu principal
// `<main id="contenu">` (cible du lien d'évitement), un lien de retour à l'accueil en tête (sauf sans
// `back` : page « travaux en cours », qui tient lieu d'accueil, lot 31), puis une
// fenêtre « terminal » (barre lilas `>_ fichier`, ombre verte décalée, SPEC § 1) qui porte le contenu
// en slot : le `h1` et les sections de la page. L'en-tête du site est celui du gabarit
// `layouts/annex.vue`.
//
// Le texte du slot est mis en forme ici (`:slotted`) : titres, paragraphes, listes et liens des pages
// annexes ont tous la même typographie.
defineProps<{
  /** Nom de fichier de la barre de titre, sans le `>_` (ne se traduit pas). */
  file: string;
  /** Libellé du lien de retour à l'accueil, déjà traduit ; absent, pas de lien de retour. */
  back?: string | undefined;
}>();

const localePath = useLocalePath();
</script>

<template>
  <main id="contenu" class="annex-page" tabindex="-1">
    <p v-if="back" class="annex-page__back">
      <NuxtLink :to="localePath('/')" class="annex-page__back-link">{{ back }}</NuxtLink>
    </p>
    <div class="annex-page__window">
      <p class="annex-page__bar">
        <span aria-hidden="true" class="annex-page__prompt">&gt;_</span> {{ file }}
      </p>
      <div class="annex-page__body"><slot /></div>
    </div>
  </main>
</template>

<style scoped>
.annex-page {
  max-width: var(--content-max);
  margin-inline: auto;
  padding: 1.5rem var(--mobile-gutter) 3rem;
}

.annex-page:focus {
  outline: none;
}

.annex-page__back {
  margin: 0 0 1rem;
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
}

/* Flèche décorative : contenu généré sans texte de remplacement (`/ ''`), absent du nom du lien. */
.annex-page__back-link::before {
  content: '←' / '';
  margin-inline-end: 0.5ch;
}

.annex-page__back-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-target);
  color: var(--accent);
  font-weight: var(--font-weight-bold);
}

.annex-page__window {
  overflow: hidden;
  border: var(--border-strong);
  border-radius: var(--radius-window);
  background-color: var(--card);
  color: var(--text);
  box-shadow: var(--shadow);
}

.annex-page__bar {
  display: flex;
  align-items: center;
  gap: 0.5ch;
  min-height: var(--tile-title-bar);
  margin: 0;
  padding-inline: 1rem;
  border-bottom: var(--border-strong);
  background-color: var(--bar);
  font-family: var(--font-mono);
  font-size: var(--font-size-meta);
  font-weight: var(--font-weight-bold);
  overflow-wrap: anywhere;
}

.annex-page__prompt {
  color: var(--accent);
}

.annex-page__body {
  padding: 1.5rem 1.25rem 2rem;
  font-size: var(--font-size-body-mobile);
  line-height: 1.6;
}

@media (min-width: 768px) {
  .annex-page {
    padding-top: 2.5rem;
  }

  .annex-page__body {
    padding: 2rem 2.5rem 2.5rem;
  }
}

.annex-page__body :slotted(h1) {
  margin: 0 0 1rem;
  font-size: var(--font-size-h1-portable);
  font-weight: var(--font-weight-bold);
  line-height: 1.1;
}

.annex-page__body :slotted(h2) {
  margin: 2rem 0 0.75rem;
  color: var(--violet);
  font-family: var(--font-mono);
  font-size: var(--font-size-lead);
  font-weight: var(--font-weight-bold);
}

.annex-page__body :slotted(p),
.annex-page__body :slotted(ul) {
  margin: 0 0 1rem;
}

.annex-page__body :slotted(ul) {
  padding-inline-start: 1.25rem;
}

.annex-page__body :slotted(li) {
  margin-block: 0.5rem;
}

.annex-page__body :slotted(a) {
  color: var(--accent);
  font-weight: var(--font-weight-medium);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
</style>
