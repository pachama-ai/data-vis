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

import StrommixPanel from '~/components/dashboard/StrommixPanel.vue'
import EmissionPanel from '~/components/dashboard/EmissionPanel.vue'

const route = useRoute()

type DashboardTab = 'generation' | 'emissions'

const activeTab = computed<DashboardTab>(() =>
  route.query.tab === 'emissions' ? 'emissions' : 'generation',
)
</script>

<template>
  <main class="dashboard-page">
    <StrommixPanel v-if="activeTab === 'generation'" />
    <EmissionPanel v-else />
  </main>
</template>

<style scoped>
.dashboard-page {
  min-height: 100vh;
}
</style>