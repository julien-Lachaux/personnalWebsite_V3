<script setup lang="ts">
// Les trois contrôles communs aux barres du haut (bureau et mobile) : langue, puis accessibilité et thème (D43).
import AccessibilityPanel from './AccessibilityPanel.vue';
import LanguageSwitch from './LanguageSwitch.vue';
import ThemeToggle from './ThemeToggle.vue';

defineProps<{ declarationUrl: string }>();
</script>

<template>
  <div class="header-controls">
    <LanguageSwitch />
    <AccessibilityPanel :declaration-url="declarationUrl" />
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
