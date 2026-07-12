<script setup lang="ts">
/**
 * pages/index.vue — Intro-Landingpage (Barbell-Version)
 * ======================================================
 * Zeigt den Wandel des deutschen Strommix 2015->2024 als
 * horizontales Barbell-Chart (D3). Lädt Dashboard-Daten
 * im Hintergrund vor.
 */

import { ref, onMounted } from 'vue'
import { useEnergyMixData } from '~/composables/useEnergyMixData'
import { useData } from '~/composables/useData'
import type { EnergyMixRow } from '~/composables/useEnergyMixData'

const { load } = useEnergyMixData()
const { loadHourly } = useData()

const rows = ref<EnergyMixRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(() => {
  load().then((data) => {
    rows.value = data.rows
  }).catch((e: any) => {
    error.value = e.message ?? 'Fehler'
  }).finally(() => {
    loading.value = false
  })

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => {
      loadHourly().catch(() => {})
    }, { timeout: 5000 })
  } else {
    setTimeout(() => { loadHourly().catch(() => {}) }, 2000)
  }
})
</script>

<template>
  <div class="intro-page">
    <IntroHero />
    <IntroTrustLine />
    <div v-if="loading" class="chart-loading">
      <div class="chart-skeleton"></div>
    </div>
    <div v-else-if="error" class="chart-error">
      Daten konnten nicht geladen werden.
    </div>
    <IntroBarbellChart v-else :rows="rows" />
    <IntroCTA />
    <IntroMethodology />
  </div>
</template>

<style scoped>
.intro-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 48px 32px 80px;
}
.intro-page > :deep(*) {
  margin-bottom: 96px;
}
.intro-page > :deep(:last-child) {
  margin-bottom: 0;
}
.chart-loading {
  margin-bottom: 96px;
}
.chart-skeleton {
  width: 100%;
  height: 600px;
  background: linear-gradient(135deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  border-radius: 8px;
  animation: shimmer 1.5s ease-in-out infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.chart-error {
  text-align: center;
  padding: 80px 0;
  font-family: var(--font-sans);
  font-size: 15px;
  color: var(--fg-muted);
  margin-bottom: 96px;
}
</style>
