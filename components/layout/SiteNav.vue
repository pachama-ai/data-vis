<script setup lang="ts">
/**
 * Globale Navigation mit den drei Seiten Strommix, Entwicklung und
 * CO₂-Vergleich, plus den beiden Einstellungen für Zoom und Kontrast.
 * Der aktive Eintrag wird aus der aktuellen Route abgeleitet.
 *
 * @author Selina Schneider
 */


import { computed } from 'vue'
import { useRoute } from 'nuxt/app'

import { useHighContrast } from '~/composables/useHighContrast'
import { usePageZoom } from '~/composables/usePageZoom'

const route = useRoute()

const {
  level,
  cycleZoom,
} = usePageZoom()

const {
  isActive: contrastOn,
  toggle: toggleContrast,
} = useHighContrast()

/**
 * Angaben für einen Eintrag in der Navigation.
 */
interface NavItem {
  /** Angezeigter Name */
  label: string

  /** Ziel des Links */
  to: string

  /** Gibt an, ob der Eintrag aktiv ist. */
  isActive: boolean
}

/*
 * Berechnet die Navigationseinträge.
 *
 * Der aktive Eintrag wird aus der aktuellen Route
 * und dem ausgewählten Dashboard-Reiter bestimmt.
 */
const navItems = computed<NavItem[]>(function (): NavItem[] {
  const path = route.path
  const tab = route.query.tab

  return [
    {
      label: 'Strommix',
      to: '/',
      isActive: path === '/',
    },
    {
      label: 'Entwicklung',
      to: '/dashboard',

      /*
       * Entwicklung ist der Standardbereich
       * und deshalb auch ohne tab-Parameter aktiv.
       */
      isActive:
        path === '/dashboard'
        && tab !== 'emissions',
    },
    {
      label: 'CO₂-Vergleich',
      to: '/dashboard?tab=emissions',
      isActive:
        path === '/dashboard'
        && tab === 'emissions',
    },
  ]
})

/*
 * Berechnet die Beschriftung für den Zoom-Button.
 *
 * Die aktuelle Zoomstufe wird mit angezeigt.
 */
const zoomLabel = computed(function (): string {
  return (
    'Ansicht vergrößern (aktuell '
    + level.value
    + ' %)'
  )
})
</script>

<template>
  <nav
    class="site-nav"
    aria-label="Hauptnavigation"
  >
    <div class="site-nav-inner">
      <!-- Links zu den Hauptbereichen. -->
      <div class="site-nav-links">
        <NuxtLink
          v-for="item in navItems"
          :key="item.label"
          :to="item.to"
          class="nav-underline"
          :class="{
            'nav-underline--active': item.isActive,
          }"
          :aria-label="item.label"
          :aria-current="
            item.isActive ? 'page' : undefined
          "
        >
          {{ item.label }}
        </NuxtLink>
      </div>

      <!-- Einstellungen für Zoom und Kontrast. -->
      <div class="site-nav-controls">
        <!-- Zoom der gesamten Seite -->
        <button
          type="button"
          class="zoom-btn nav-underline"
          :class="{
            'nav-underline--active': level > 100,
          }"
          :aria-label="zoomLabel"
          title="Vergrößert die gesamte Seite. Mehrfach klicken für weitere Stufen."
          @click="cycleZoom"
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
            <circle
              cx="7"
              cy="7"
              r="5"
            />

            <line
              x1="10.5"
              y1="10.5"
              x2="14"
              y2="14"
            />

            <line
              x1="7"
              y1="4.5"
              x2="7"
              y2="9.5"
            />

            <line
              x1="4.5"
              y1="7"
              x2="9.5"
              y2="7"
            />
          </svg>

          <span
            v-if="level > 100"
            class="zoom-value"
            aria-hidden="true"
          >
            {{ level }}%
          </span>
        </button>

        <!-- Trennung zwischen den Einstellungen -->
        <span
          class="control-separator"
          aria-hidden="true"
        />

        <!-- Umschalten auf stärkere Kontraste -->
        <button
          type="button"
          class="contrast-btn nav-underline"
          :class="{
            'nav-underline--active': contrastOn,
          }"
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
/* Grundgestaltung der Navigation. */
.site-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid var(--line-color);
  background: var(--background-color);
  font-family: var(--sans-font);
  font-size: 11px;
}

/* Anordnung des Inhalts. */
.site-nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1400px;
  height: 44px;
  margin: 0 auto;
  padding: 0 24px;
}

/* Anordnung der Seitenlinks. */
.site-nav-links {
  display: flex;
  align-items: center;
  gap: 0;
}

/* Anordnung der Einstellungen. */
.site-nav-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/*
 * Gemeinsame Basis für die Nav-Einträge und die beiden Einstellungs-Buttons.
 * Die eigentliche Unterstreichung setze ich unten mit einem ::after-Pseudo-
 * element, damit ich sie animieren kann, ohne das Layout zu verschieben.
 */
.nav-underline {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 20px;
  border: none;
  background: none;
  color: var(--muted-text-color);
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.1em;
  text-decoration: none;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 150ms ease-out;
}

/*
 * Linie unter einem Navigationseintrag.
 *
 * Die kleinere Breite lässt an beiden Seiten Abstand.
 */
.nav-underline::after {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: calc(100% - 40px);
  height: 2px;
  background: var(--accent-color);
  content: '';
  transform: translateX(-50%) scaleX(0);
  transition: transform 150ms ease-out;
}

/* Hervorheben beim Überfahren mit der Maus. */
.nav-underline:hover {
  color: var(--text-color);
}

.nav-underline:hover::after {
  height: 1px;
  background: var(--line-color);
  transform: translateX(-50%) scaleX(1);
}

/* Hervorheben des aktiven Bereichs. */
.nav-underline--active {
  color: var(--accent-color);
  font-weight: 600;
  cursor: default;
}

.nav-underline--active::after {
  height: 2px;
  background: var(--accent-color);
  transform: translateX(-50%) scaleX(1);
}

/* Aktiven Strich beim Hover beibehalten. */
.nav-underline--active:hover::after {
  height: 2px;
  background: var(--accent-color);
}

/* Tastaturfokus. */
.nav-underline:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

/* Gestaltung des Zoom-Buttons. */
.zoom-btn {
  gap: 6px;
  padding: 0 8px;
}

.zoom-btn.nav-underline::after {
  width: calc(100% - 16px);
}

/* Zoom-Symbol. */
.zoom-icon {
  display: block;
  flex-shrink: 0;
}

/*
 * Anzeige der aktuellen Zoomstufe.
 *
 * Gleich breite Zahlen verhindern ein sichtbares Springen.
 */
.zoom-value {
  color: var(--accent-color);
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* Trennlinie zwischen Zoom und Kontrast. */
.control-separator {
  display: inline-block;
  width: 1px;
  height: 16px;
  margin: 0 1.5rem;
  background: var(--line-color);
}

/* Gestaltung des Kontrast-Buttons. */
.contrast-btn {
  padding: 0 8px;
}

.contrast-btn.nav-underline::after {
  width: calc(100% - 16px);
}
</style>