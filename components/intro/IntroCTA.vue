<script setup lang="ts">
/**
 * components/intro/IntroCTA.vue
 * ==============================
 * Textbasierter Übergang zum Dashboard.
 * Redaktionell, kein Button – wirkt wie eine Fußnote.
 */

import { useData } from '~/composables/useData'

const { loadHourly } = useData()
function preloadDashboard() { loadHourly().catch(() => {}) }
</script>

<template>
  <section class="intro-cta">
    <p class="cta-text">
      Die vollständige Analyse findet sich im
      <NuxtLink
        to="/dashboard"
        class="cta-link"
        @pointerenter="preloadDashboard"
        @focus="preloadDashboard"
      >Dashboard →</NuxtLink>
    </p>
  </section>
</template>

<style scoped>
.intro-cta {
  padding: 16px 0 48px;
}

.cta-text {
  font-family: var(--font-serif);
  font-size: 18px;
  color: var(--fg);
  line-height: 1.6;
  max-width: 640px;
  margin: 0;
}

.cta-link {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
  font-weight: 500;
  white-space: nowrap;
}

.cta-link:hover {
  text-decoration: underline;
}
</style>
