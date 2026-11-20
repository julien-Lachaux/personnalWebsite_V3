<script setup lang="ts">
// Les trois contrôles communs aux barres du haut (bureau et mobile) : accessibilité, langue, thème.
import AccessibilityPanel from './AccessibilityPanel.vue';
import LanguageSwitch from './LanguageSwitch.vue';
import ThemeToggle from './ThemeToggle.vue';

defineProps<{ declarationUrl: string }>();
</script>

<template>
  <div class="header-controls">
    <AccessibilityPanel :declaration-url="declarationUrl" />
    <LanguageSwitch />
    <ThemeToggle />
  </div>
</template>

<style scoped>
.header-controls {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}
</style>
