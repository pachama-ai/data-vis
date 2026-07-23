<script setup lang="ts">
/**
 * dashboard.vue – Haupt-Dashboard-Seite mit Tabs.
 *
 * Zeigt entweder das Erzeugungs- oder das Emissions-Panel.
 * Der aktive Tab wird über den Query-Parameter ?tab=emissions
 * gesteuert (SiteNav verlinkt entsprechend).
 */

import { computed } from 'vue'
import { useRoute } from 'nuxt/app'

import GenerationPanel from '~/components/generation/GenerationPanel.vue'
import EmissionsPanel from '~/components/emissions/EmissionsPanel.vue'

const route = useRoute()

type DashboardTab = 'generation' | 'emissions'

const activeTab = computed<DashboardTab>(function () {
  return route.query.tab === 'emissions' ? 'emissions' : 'generation'
})
</script>

<template>
  <main class="dashboard-page">
    <GenerationPanel v-if="activeTab === 'generation'" />
    <EmissionsPanel v-else />
  </main>
</template>

<style scoped>
.dashboard-page {
  min-height: 100vh;
}
</style>