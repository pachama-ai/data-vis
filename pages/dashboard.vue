<script setup lang="ts">
/**
 * Hauptseite des Dashboards.
 *
 * Auf der Seite werden entweder die Daten zur Stromerzeugung oder zu
 * den Emissionen angezeigt. Welcher Bereich sichtbar ist, wird über
 * den Query-Parameter „tab" in der URL festgelegt. Fehlt der
 * Parameter, wird die Erzeugungsansicht geöffnet.
 *
 * @author Selina Schneider
 * @created 11.06.2026
 * @lastModified 23.07.2026
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
 * `route.query.tab` kann je nach Aufruf ein string, ein string[]
 * oder undefined sein. Ich prüfe deshalb nur mit einem strikten
 * Gleichheitsvergleich auf 'emissions' und falle in jedem anderen
 * Fall auf 'generation' zurück, damit ich nicht selbst zwischen
 * Array und String unterscheiden muss und automatisch einen
 * sinnvollen Default-Wert für die Startansicht bekomme.
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