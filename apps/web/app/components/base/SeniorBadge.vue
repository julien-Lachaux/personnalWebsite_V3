<script setup lang="ts">
// Pastille « senior » (ticket F1-03) : néon (bordure, lueur) en thème sombre, pleine en thème clair.
// Le thème est porté par les variables `--sen-fg`, `--sen-bg`, `--sen-sh` de tokens.css : aucun
// calcul ici. Texte décoratif du titre : le libellé (« senior ») vient du slot, déjà traduit.
</script>

<template>
  <span class="senior-badge"><slot /></span>
</template>

<style scoped>
.senior-badge {
  display: inline-block;
  padding: 0.4375rem 0.625rem;
  border: var(--border-width) solid var(--neon);
  border-radius: var(--radius-chip);
  background-color: var(--sen-bg);
  box-shadow: var(--sen-sh);
  color: var(--sen-fg);
  font-family: var(--font-mono);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0;
  line-height: 1;
  text-shadow: 0 0 8px var(--neon-txt);
  white-space: nowrap;
}
</style>
