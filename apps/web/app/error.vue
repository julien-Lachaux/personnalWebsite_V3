<script setup lang="ts">
// Page d'erreur (route inconnue ou autre erreur) : PROVISOIRE (lot F9a), son contenu et sa mise en
// page viennent avec le lot F7 (F7-01). Elle remplace la page d'erreur par défaut de Nuxt, qui
// injecte à l'exécution un <script> et un <style> en ligne (`useHead` de `error-404.vue`) : sous la
// CSP stricte du site (empreintes des seuls éléments en ligne du HTML généré), ils étaient bloqués.
// Celle-ci n'injecte rien : ses styles sont dans la feuille du composant, comme toute page.
//
// Elle est rendue au build dans `404.html` (`experimental.prerenderErrorPages`, nuxt.config.ts), en
// français (langue par défaut) ; le serveur la sert pour toute adresse inconnue, `/en/...` compris.
// Le navigateur n'a alors que les libellés de la langue de l'adresse : l'hydratation reprend donc les
// textes du rendu (gardés dans la charge utile par `useState`), puis la page passe à la langue de
// l'adresse une fois montée. Sans cela, le texte calculé dans le navigateur ne correspondrait pas au
// HTML et Vue signalerait une erreur d'hydratation.
// Elle ne passe pas par `app.vue` (Nuxt l'affiche à sa place) : elle pose elle-même `lang`.
// Fichier partagé, réservé au lead-architecte.
import { type NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

const { t, locale } = useI18n();
const localePath = useLocalePath();

interface ErrorTexts {
  readonly lang: string;
  readonly title: string;
  readonly message: string;
  readonly back: string;
  readonly home: string;
}

function texts(): ErrorTexts {
  const kind = props.error.status === 404 ? 'notFound' : 'generic';
  return {
    lang: locale.value,
    title: t(`error.${kind}.title`),
    message: t(`error.${kind}.message`),
    back: t('error.back'),
    home: localePath('/'),
  };
}

const rendered = useState('error-page-texts', texts);
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});
const shown = computed(() => (mounted.value ? texts() : rendered.value));

useHead(() => ({ htmlAttrs: { lang: shown.value.lang }, title: shown.value.title }));
</script>

<template>
  <main id="contenu" class="error-page" tabindex="-1">
    <h1>{{ shown.title }}</h1>
    <p>{{ shown.message }}</p>
    <p>
      <a :href="shown.home">{{ shown.back }}</a>
    </p>
  </main>
</template>

<style scoped>
.error-page {
  max-width: var(--content-max);
  margin-inline: auto;
  padding: 3rem var(--mobile-gutter);
}

h1 {
  margin-block: 0 1rem;
  font-size: var(--font-size-h1-portable);
  font-weight: var(--font-weight-bold);
  line-height: 1.1;
}
</style>
