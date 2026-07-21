<script setup lang="ts">
/**
 * dashboard.vue – Haupt-Dashboard-Seite mit Tabs.
 *
 * Zeigt entweder das Erzeugungs- oder das Emissions-Panel.
 * Enthält keine Datenberechnung und keine D3-Logik.
 */

import { ref } from 'vue'

import StrommixPanel from '~/components/dashboard/StrommixPanel.vue'
import EmissionPanel from '~/components/dashboard/EmissionPanel.vue'

type DashboardTab = 'generation' | 'emissions'

const activeTab = ref<DashboardTab>('generation')

function selectTab(tab: DashboardTab): void {
  activeTab.value = tab
}
</script>

<template>
  <main class="dashboard-page">
    <nav
      class="dashboard-tabs"
      aria-label="Dashboard-Bereiche"
    >
      <button
        type="button"
        class="dashboard-tab"
        :class="{
          'dashboard-tab--active':
            activeTab === 'generation',
        }"
        :aria-pressed="
          activeTab === 'generation'
        "
        @click="selectTab('generation')"
      >
        Erzeugung
      </button>

      <button
        type="button"
        class="dashboard-tab"
        :class="{
          'dashboard-tab--active':
            activeTab === 'emissions',
        }"
        :aria-pressed="
          activeTab === 'emissions'
        "
        @click="selectTab('emissions')"
      >
        Emissionen
      </button>
    </nav>

    <StrommixPanel
      v-if="activeTab === 'generation'"
    />

    <EmissionPanel
      v-else
    />
  </main>
</template>

<style scoped>
.dashboard-page {
  min-height: 100vh;
}

.dashboard-tabs {
  display: flex;
  justify-content: center;
  gap: 6px;
  width: min(1400px, 100%);
  margin: 0 auto;
  padding: 24px 24px 0;
}

.dashboard-tab {
  min-height: 36px;
  padding: 7px 16px;
  border: 1px solid var(--hairline);
  background: transparent;
  color: var(--fg-muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  cursor: pointer;
  border-radius: 6px;
  transition: all 200ms ease-out;
}

.dashboard-tab:hover {
  color: var(--fg);
  border-color: var(--fg-muted);
}

.dashboard-tab--active {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.dashboard-tab--active:hover {
  color: #ffffff;
}

.dashboard-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>