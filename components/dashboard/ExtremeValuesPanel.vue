<script setup lang="ts">
/**
 * ExtremeValuesPanel.vue – Kacheln mit animierten Extremwerten.
 *
 * Zeigt die drei Extreme aus useExtremeValues mit D3-interpolierten
 * Zahlen-Animationen bei Datenänderungen.
 *
 * @example
 * <ExtremeValuesPanel :monthlyData="monthlyData" />
 */

import { ref, computed, watch, onUnmounted } from 'vue'
import * as d3 from 'd3'
import { useExtremeValues } from '~/composables/useExtremeValues'
import type { MonthlyDataPoint, ExtremeValueResult, ValueType } from '~/composables/useExtremeValues'

const props = defineProps<{
  monthlyData: MonthlyDataPoint[]
  aggLevel?: 'tag' | 'woche' | 'monat' | 'quartal'
  mode?: 'absolute' | 'percent'
}>()

const { highestRenewableShare, highestFossilGeneration, largestChange } = useExtremeValues(
  computed(() => props.monthlyData),
  computed(() => props.aggLevel ?? 'monat'),
  computed(() => props.mode ?? 'percent')
)

interface DisplayTile {
  label: string
  displayValue: string
  dateLabel: string
  context: string
  rawValue: number
  valueType: ValueType
}

const tiles = computed<DisplayTile[]>(() => {
  const out: DisplayTile[] = []
  const add = (r: ExtremeValueResult | null) => {
    if (r) out.push({ label: r.label, displayValue: r.value, dateLabel: r.dateLabel, context: r.context, rawValue: r.rawValue, valueType: r.valueType })
    else out.push({ label: '', displayValue: '—', dateLabel: '', context: '', rawValue: 0, valueType: 'average' })
  }
  add(highestRenewableShare.value)
  add(highestFossilGeneration.value)
  add(largestChange.value)
  return out
})

// Animierte Werte
const animatedValues = ref<(string | null)[]>([null, null, null])
const animatedContexts = ref<(string | null)[]>([null, null, null])
const prevTiles = ref<DisplayTile[]>([])
let animFrameId = 0

const prefersReduced = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false

// keine ahnung ob das threadsafe ist, läuft aber
watch(tiles, (newTiles) => {
  if (prefersReduced || !prevTiles.value.length) {
    animatedValues.value = newTiles.map((t) => t.displayValue)
    animatedContexts.value = newTiles.map((t) => t.context)
    prevTiles.value = newTiles.map((t) => ({ ...t }))
    return
  }
  const oldTiles = prevTiles.value
  const newAnimated: (string | null)[] = [null, null, null]
  const newContexts: (string | null)[] = [null, null, null]

  for (let i = 0; i < 3; i++) {
    const oldVal = oldTiles[i]?.rawValue ?? 0
    const newVal = newTiles[i]?.rawValue ?? 0
    const oldLabel = oldTiles[i]?.label ?? ''
    const newLabel = newTiles[i]?.label ?? ''

    if (oldLabel !== newLabel) {
      // Kategorie hat sich geändert → hart setzen
      newAnimated[i] = newTiles[i]?.displayValue ?? '—'
      newContexts[i] = newTiles[i]?.context ?? ''
      continue
    }

    // Zahlen interpolieren
    const interpolator = d3.interpolateNumber(oldVal, newVal)
    const startTime = performance.now()
    const duration = 400

    newAnimated[i] = newTiles[i]?.displayValue ?? '—'
    newContexts[i] = newTiles[i]?.context ?? ''

    const animate = (time: number) => {
      const t = Math.min(1, (time - startTime) / duration)
      const current = interpolator(t)
      if (i === 0) {
        // Prozentwert
        newAnimated[i] = (current * 100).toFixed(1).replace('.', ',') + ' %'
      } else if (i === 1) {
        // GWh-Wert
        newAnimated[i] = Math.round(current).toLocaleString('de-DE') + ' GWh'
      } else {
        // Nur Label + delta
        newContexts[i] = (current >= 0 ? '+' : '') + (current * 100).toFixed(1).replace('.', ',') + ' pp'
      }
      animatedValues.value = [...newAnimated]
      animatedContexts.value = [...newContexts]
      if (t < 1) {
        animFrameId = requestAnimationFrame(animate)
      } else {
        // Final values
        newAnimated[i] = newTiles[i]?.displayValue ?? '—'
        newContexts[i] = newTiles[i]?.context ?? ''
        animatedValues.value = [...newAnimated]
        animatedContexts.value = [...newContexts]
      }
    }
    animFrameId = requestAnimationFrame(animate)
  }

  prevTiles.value = newTiles.map((t) => ({ ...t }))
}, { deep: true })

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
})

// Initial setzen
const isInitial = ref(true)
watch(tiles, (val) => {
  if (isInitial.value && val.length) {
    animatedValues.value = val.map((t) => t.displayValue)
    animatedContexts.value = val.map((t) => t.context)
    prevTiles.value = val.map((t) => ({ ...t }))
    isInitial.value = false
  }
}, { immediate: true })
</script>

<template>
  <div class="extreme-panel">
    <div v-for="(tile, i) in tiles" :key="i" class="extreme-tile">
      <div v-if="i > 0" class="tile-divider"></div>
      <div v-if="!monthlyData.length" class="tile-skeleton">
        <div class="tile-eyebrow">{{ ['Höchster Erneuerbaren-Anteil', 'Höchste fossile Erzeugung', 'Größte Veränderung'][i] }}</div>
        <div class="skeleton-bar skeleton-value"></div>
        <div class="skeleton-bar skeleton-date"></div>
        <div class="skeleton-bar skeleton-context"></div>
      </div>
      <template v-else>
        <div class="tile-eyebrow">{{ tile.label }}</div>
        <div class="tile-value">{{ animatedValues[i] ?? tile.displayValue }}</div>
        <div class="tile-date">{{ tile.dateLabel }}</div>
        <div class="tile-context">{{ animatedContexts[i] ?? tile.context }}</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.extreme-panel {
  width: 100%;
}

.extreme-tile {
  padding: 20px 0;
  position: relative;
}

.tile-divider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--hairline);
}

.tile-eyebrow {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin-bottom: 6px;
}

.tile-value {
  font-family: var(--font-serif);
  font-size: 32px;
  font-weight: 500;
  color: var(--fg);
  line-height: 1.1;
  margin-bottom: 4px;
}

.tile-date {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--fg);
  margin-bottom: 2px;
}

.tile-context {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--fg-muted);
}

/* Skelett */
.tile-skeleton {
  padding: 20px 0;
}
.tile-skeleton .tile-eyebrow {
  margin-bottom: 10px;
}
.skeleton-bar {
  height: 14px;
  background: #E2E4E8;
  border-radius: 4px;
  margin-bottom: 6px;
  animation: pulse 1.5s ease-in-out infinite;
}
.skeleton-value { width: 60%; height: 32px; margin-bottom: 8px; }
.skeleton-date { width: 40%; }
.skeleton-context { width: 55%; }

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.3; }
}
</style>
