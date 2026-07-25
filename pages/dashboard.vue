<script setup lang="ts">
/**
 * Hauptseite des Dashboards.
 *
 * Auf der Seite werden entweder die Daten zur
 * Stromerzeugung oder zu den Emissionen angezeigt.
 *
 * Welcher Bereich sichtbar ist, wird über den
 * Query-Parameter „tab“ in der URL festgelegt.
 * Fehlt der Parameter, wird die Erzeugungsansicht geöffnet.
 *
 * @author Selina Schneider
 * @created 11.06.2026
 * @lastModified 23.07.2026
 */

import { computed } from 'vue'
import { useRoute } from 'nuxt/app'

import GenerationPanel from '~/components/generation/GenerationPanel.vue'
import EmissionsPanel from '~/components/emissions/EmissionsPanel.vue'

/**
 * Mögliche Bereiche des Dashboards.
 */
type DashboardTab = 'generation' | 'emissions'

const route = useRoute()

/**
 * Liest den ausgewählten Bereich aus der URL.
 *
 * Bei dieser Stelle wurde KI genutzt, weil zunächst
 * unklar war, wie der Query-Parameter mit useRoute()
 * ausgelesen wird. 
 *
 * Ist in der URL „emissions“ eingetragen, wird die
 * Emissionsansicht angezeigt. Bei allen anderen Werten
 * bleibt die Erzeugungsansicht aktiv.
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

<style scoped>
/* Sorgt dafür, dass die Seite mindestens das ganze Fenster ausfüllt. */
.dashboard-page {
  min-height: 100vh;
}
</style>