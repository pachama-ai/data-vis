<script setup lang="ts">
/**
 * IntroCTA.vue – Schlichter Textlink zum Dashboard.
 * Sans-serif, body-farben, mit Hover-Unterstrich und animiertem Pfeil.
 */

import { useData } from '~/composables/useData'

const { loadHourly } = useData()
function preloadDashboard() { loadHourly().catch(() => {}) }
</script>

<template>
  <section class="intro-cta">
    <p class="cta-text">
      <NuxtLink
        to="/dashboard"
        class="cta-link"
        @pointerenter="preloadDashboard"
        @focus="preloadDashboard"
      >
        Daten genauer ansehen
        <span class="cta-arrow">→</span>
      </NuxtLink>
    </p>
  </section>
</template>

<style scoped>
.intro-cta {
  padding: 40px 0 64px;
}

.cta-text {
  font-family: var(--font-sans);
  font-size: 1.125rem;
  line-height: 1.6;
  max-width: 640px;
  margin: 0;
}

.cta-link {
  color: var(--fg);
  font-weight: 500;
  text-decoration: none;
  border-bottom: 1.5px solid transparent;
  padding-bottom: 1px;
  transition: border-color 200ms ease-out;
  outline-offset: 4px;
}

.cta-link:focus-visible {
  outline: 2px solid var(--fg-muted);
  outline-offset: 4px;
  border-radius: 2px;
}

.cta-link:hover {
  border-bottom-color: var(--fg);
}

.cta-arrow {
  display: inline-block;
  transition: transform 150ms ease-out;
}

.cta-link:hover .cta-arrow {
  transform: translateX(3px);
}
</style>
