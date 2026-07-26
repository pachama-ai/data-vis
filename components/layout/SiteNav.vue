<script setup lang="ts">
/**
 * SiteNav.vue – Globale Navigation
 *
 * Zeigt die drei Hauptbereiche an: Strommix, Entwicklung,
 * CO₂-Vergleich. Rechts Zoom-Button und Kontrast-Schalter.
 */

import { computed } from 'vue'
import { useRoute } from 'nuxt/app'
import { usePageZoom } from '~/composables/usePageZoom'
import { useHighContrast } from '~/composables/useHighContrast'

const route = useRoute()

const { level, cycle } = usePageZoom()
const {
  isActive: contrastOn,
  toggle: toggleContrast,
} = useHighContrast()

interface NavItem {
  label: string
  to: string
  isActive: boolean
}

function isDevelopmentActive(): boolean {
  return (
    route.path === '/dashboard'
    && route.query.tab !== 'emissions'
  )
}

function isEmissionsActive(): boolean {
  return (
    route.path === '/dashboard'
    && route.query.tab === 'emissions'
  )
}

const navItems = computed<NavItem[]>(function () {
  return [
    {
      label: 'Strommix',
      to: '/',
      isActive: route.path === '/',
    },
    {
      label: 'Entwicklung',
      to: '/dashboard',
      isActive: isDevelopmentActive(),
    },
    {
      label: 'CO\u2082-Vergleich',
      to: '/dashboard?tab=emissions',
      isActive: isEmissionsActive(),
    },
  ]
})

const zoomLabel = computed(function () {
  return 'Ansicht vergr\u00f6\u00dfern (aktuell ' + level.value + ' %)'
})
</script>

<template>
  <nav
    class="site-nav"
    aria-label="Hauptnavigation"
  >
    <div class="site-nav-inner">
      <!-- Hauptbereiche -->
      <div class="site-nav-links">
        <NuxtLink
          v-for="item in navItems"
          :key="item.label"
          :to="item.to"
          class="nav-underline"
          :class="{ 'nav-underline--active': item.isActive }"
          :aria-label="item.label"
          :aria-current="item.isActive ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </div>

      <!-- Einstellungen -->
      <div class="site-nav-controls">
        <!-- Zoom -->
        <button
          type="button"
          class="zoom-btn nav-underline"
          :class="{ 'nav-underline--active': level > 100 }"
          :aria-label="zoomLabel"
          title="Vergrößert die gesamte Seite. Mehrfach klicken für weitere Stufen."
          @click="cycle"
        >
          <svg
            class="zoom-icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" />
            <line x1="7" y1="4.5" x2="7" y2="9.5" />
            <line x1="4.5" y1="7" x2="9.5" y2="7" />
          </svg>
          <span
            v-if="level > 100"
            class="zoom-value"
            aria-hidden="true"
          >{{ level }}%</span>
        </button>

        <!-- Trennlinie -->
        <span
          class="control-separator"
          aria-hidden="true"
        />

        <!-- Kontrast -->
        <button
          type="button"
          class="contrast-btn nav-underline"
          :class="{ 'nav-underline--active': contrastOn }"
          :aria-pressed="contrastOn"
          title="Kräftigere Farben und stärkere Kontraste – hilfreich bei Farbsehschwäche oder eingeschränkter Sehkraft."
          @click="toggleContrast"
        >
          Besser lesbar
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.site-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--background-color);
  border-bottom: 1px solid var(--line-color);
  font-family: var(--sans-font);
  font-size: 11px;
}

.site-nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 44px;
}

/* Hauptbereiche */
.site-nav-links {
  display: flex;
  align-items: center;
  gap: 0;
}

/* Einstellungen */
.site-nav-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Gemeinsamer Stil */
.nav-underline {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 20px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted-text-color);
  text-decoration: none;
  cursor: pointer;
  transition: color 150ms ease-out;
  background: none;
  border: none;
  font-family: inherit;
  line-height: 1;
}

.nav-underline::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%) scaleX(0);
  width: calc(100% - 40px);
  height: 2px;
  background: var(--accent-color);
  transition: transform 150ms ease-out;
}

.nav-underline:hover {
  color: var(--text-color);
}

.nav-underline:hover::after {
  transform: translateX(-50%) scaleX(1);
  background: var(--line-color);
  height: 1px;
}

.nav-underline--active {
  color: var(--accent-color);
  font-weight: 600;
  cursor: default;
}

.nav-underline--active::after {
  transform: translateX(-50%) scaleX(1);
  background: var(--accent-color);
  height: 2px;
}

.nav-underline--active:hover::after {
  background: var(--accent-color);
  height: 2px;
}

.nav-underline:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

/* Zoom */
.zoom-btn {
  gap: 6px;
  padding: 0 8px;
}

.zoom-btn.nav-underline::after {
  width: calc(100% - 16px);
}

.zoom-icon {
  flex-shrink: 0;
  display: block;
}

.zoom-value {
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--accent-color);
}

/* Trennlinie */
.control-separator {
  display: inline-block;
  width: 1px;
  height: 16px;
  background: var(--line-color);
  margin: 0 1.5rem;
}

/* Kontrast */
.contrast-btn {
  padding: 0 8px;
}

.contrast-btn.nav-underline::after {
  width: calc(100% - 16px);
}
</style>
