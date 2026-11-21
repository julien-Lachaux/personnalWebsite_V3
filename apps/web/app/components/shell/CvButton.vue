<script setup lang="ts">
// « CV PDF » (F3-05) : lien vers le fichier du CV (`href`, fourni par la page : il viendra de l'API),
// téléchargé (`download`), annoncé comme PDF (`type`, D22), avec l'icône de téléchargement du handoff.
// Le CV de la langue absent, le lien mène au CV français, mention « (in French) » au libellé et
// `hreflang` (useCvLink, D22). La classe et les attributs reçus vont sur le lien.
import { useI18n } from '#imports';

import LinkButton from '../base/LinkButton.vue';
import { useCvLink } from '../../composables/shell/useCvLink.js';

const props = withDefaults(defineProps<{ href: string; size?: 'sm' | 'md' | 'lg' }>(), {
  size: 'sm',
});

const { t } = useI18n();
const link = useCvLink(() => props.href);
</script>

<template>
  <LinkButton
    :href="link.href"
    :hreflang="link.hreflang"
    variant="outline"
    :size="size"
    type="application/pdf"
    download
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
        <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
      </svg>
    </template>
    {{ link.mention ? `${t('shell.actions.cv')} ${link.mention}` : t('shell.actions.cv') }}
  </LinkButton>
</template>
