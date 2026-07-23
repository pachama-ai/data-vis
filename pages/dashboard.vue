<script setup lang="ts">
/**
 * Hauptseite des interaktiven Dashboards.
 *
 * Die Seite wechselt zwischen den Bereichen
 * Stromerzeugung und Emissionen.
 *
 * Der gewünschte Bereich wird über den
 * Query-Parameter „tab“ in der URL festgelegt.
 * Ohne gültigen Parameter wird die Stromerzeugung angezeigt.
 */

import { computed } from 'vue'
import { useRoute } from 'nuxt/app'

import GenerationPanel from '~/components/generation/GenerationPanel.vue'
import EmissionsPanel from '~/components/emissions/EmissionsPanel.vue'

type DashboardTab = 'generation' | 'emissions'

const route = useRoute()

/**
 * Ermittelt den aktuell angezeigten Bereich aus der URL.
 *
 * Unterstützte Werte:
 * - generation
 * - emissions
 *
 * Unbekannte oder fehlende Werte führen zur Erzeugungsansicht.
 */
const activeTab = computed<DashboardTab>(function () {
  const tab = route.query.tab

  if (tab === 'emissions') {
    return 'emissions'
  }

  return 'generation'
})
</script>

<template>
  <main class="dashboard-page">
    <!-- Je nach URL wird die Erzeugungs- oder Emissionsansicht angezeigt. -->
    <GenerationPanel v-if="activeTab === 'generation'" />
    <EmissionsPanel v-else />
  </main>
</template>

<style scoped>
/* Grundfläche der Dashboard-Seite */
.dashboard-page {
  min-height: 100vh;
}
</style>