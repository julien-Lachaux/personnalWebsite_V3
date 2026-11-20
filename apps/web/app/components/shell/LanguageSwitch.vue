<script setup lang="ts">
// Sélecteur de langue FR/EN (F3-02, décision D21, modèle GOV.UK) : « FR | EN » toujours dans cet ordre.
// La langue courante est un texte (`aria-current="true"`, `lang` de la page), pas un lien ; l'autre est
// un lien vers la même page (`useSwitchLocalePath`) dont le texte visible est le nom accessible, sans
// `aria-label` (WCAG 2.5.3, commande vocale), avec `lang` et `hreflang` de la cible. Le séparateur est
// décoratif. Le lien garde la cible tactile des contrôles de la barre (44 px sous 1024 px).
import { computed } from 'vue';
import { useI18n, useSwitchLocalePath } from '#imports';

const { locale } = useI18n();
const switchLocalePath = useSwitchLocalePath();

const current = computed<'fr' | 'en'>(() => (locale.value === 'fr' ? 'fr' : 'en'));
const target = computed<'fr' | 'en'>(() => (current.value === 'fr' ? 'en' : 'fr'));
</script>

<template>
  <div class="language-switch">
    <template v-if="current === 'fr'">
      <span class="language-switch__current" aria-current="true" lang="fr">FR</span>
      <span class="language-switch__separator" aria-hidden="true">|</span>
      <NuxtLink
        :to="switchLocalePath(target)"
        :lang="target"
        :hreflang="target"
        class="shell-icon-button shell-press"
        >EN</NuxtLink
      >
    </template>
    <template v-else>
      <NuxtLink
        :to="switchLocalePath(target)"
        :lang="target"
        :hreflang="target"
        class="shell-icon-button shell-press"
        >FR</NuxtLink
      >
      <span class="language-switch__separator" aria-hidden="true">|</span>
      <span class="language-switch__current" aria-current="true" lang="en">EN</span>
    </template>
  </div>
</template>

<style scoped src="./shell.css"></style>
<style scoped>
.language-switch {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  font-family: var(--font-mono);
  font-size: var(--font-size-meta);
  color: var(--text);
}

.language-switch__current {
  font-weight: var(--font-weight-bold);
}

.language-switch__separator {
  padding-inline: 2px;
}
</style>
