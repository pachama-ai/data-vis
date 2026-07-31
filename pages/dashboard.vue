<script setup lang="ts">
/**
 * Hauptseite des Dashboards.
 *
 * Auf der Seite werden entweder die Daten zur Stromerzeugung oder zu
 * den Emissionen angezeigt. Welcher Bereich sichtbar ist, wird über
 * den Query-Parameter „tab" in der URL festgelegt.
 *
 * @author Selina Schneider
 */

import { computed } from 'vue'
import { useRoute } from 'nuxt/app'

import GenerationPanel from '~/components/generation/GenerationPanel.vue'
import EmissionsPanel from '~/components/emissions/EmissionsPanel.vue'

/** Mögliche Bereiche des Dashboards. */
type DashboardTab = 'generation' | 'emissions'

const route = useRoute()

/**
 * Liest den ausgewählten Bereich aus der URL.
 *
 * @returns Aktuell ausgewählter Bereich des Dashboards
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
    <!-- Zeigt den Bereich, der über die URL ausgewählt wurde. -->
    <GenerationPanel v-if="activeTab === 'generation'" />
    <EmissionsPanel v-else />
  </main>
</template>