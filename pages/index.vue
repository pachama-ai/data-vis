<script setup lang="ts">
/**
 * pages/index.vue — Landing-Seite (Timeline-Version)
 * ====================================================
 * Zeigt eine datenbasierte Rekord-Timeline des EE-Anteils 2015–2024.
 * Lädt Dashboard-Daten im Hintergrund vor (useDashboardPreload + Prefetch).
 */

import { ref, computed, watch, onMounted } from 'vue'
import { useLandingData } from '~/composables/useLandingData'
import { useDashboardPreload } from '~/composables/useDashboardPreload'
import { useData } from '~/composables/useData'

const {
  loading, error, load,
  weeklyData, milestones, getDetailData,
} = useLandingData()

// Dashboard-Daten im Hintergrund vorladen
useDashboardPreload()

// Preload bei Nutzerabsicht
const { loadHourly } = useData()
function preloadDashboard() { loadHourly().catch(() => {}) }

// --- Landingpage-Daten laden ---
onMounted(() => { load() })

// --- Filter ---
const activeCategory = ref<string | null>(null)
const visibleMilestones = computed(() => {
  if (!activeCategory.value) return milestones.value
  return milestones.value.filter(m => m.category === activeCategory.value)
})

// --- Aktiver Meilenstein (Hover/Klick) ---
const hoveredMilestone = ref<string | null>(null)
const selectedMilestone = ref<string | null>(null)
const activeMilestoneId = computed(() => hoveredMilestone.value || selectedMilestone.value)

const activeMilestone = computed(() => {
  if (!activeMilestoneId.value) return null
  return milestones.value.find(m => m.id === activeMilestoneId.value) ?? null
})

const detailData = computed(() => {
  if (!activeMilestone.value) return null
  return getDetailData(activeMilestone.value)
})

function handleSelectMilestone(id: string) {
  selectedMilestone.value = selectedMilestone.value === id ? null : id
}

function handleHoverMilestone(id: string | null) {
  hoveredMilestone.value = id
}
</script>

<template>
  <div class="landing">
    <!-- ============================================================
         A: Hero
         ============================================================ -->
    <section class="hero-section">
      <h1 class="hero-headline">Wie sich der deutsche Strom verändert hat</h1>
      <p class="hero-subtitle">
        Zehn Jahre deutscher Stromerzeugung – erzählt durch Rekorde und strukturelle Kipppunkte.
      </p>
      <p class="hero-source">SMARD- und ENTSO-E-Daten, 2015–2024 · Stundenauflösung</p>
    </section>

    <!-- ============================================================
         B: Vertrauensanker
         ============================================================ -->
    <aside class="trust-statement">
      Jeder Meilenstein basiert auf einem tatsächlich gemessenen Timestamp aus dem Datensatz –
      nicht auf dem Datum einer Pressemitteilung.
    </aside>

    <!-- ============================================================
         C: Timeline
         ============================================================ -->
    <section class="timeline-section" aria-label="Rekord-Timeline des EE-Anteils">
      <!-- Filter -->
      <TimelineFilters
        :active="activeCategory"
        @select="activeCategory = $event"
      />

      <!-- Loading / Error / Timeline -->
      <div v-if="loading" class="timeline-loading">
        <div class="timeline-skeleton"></div>
        <p class="timeline-loading-text">Daten werden geladen …</p>
      </div>

      <div v-else-if="error" class="timeline-error">
        <p>Fehler beim Laden der Daten: {{ error }}</p>
      </div>

      <template v-else>
        <ClientOnly>
          <RecordTimeline
            :weekly-data="weeklyData"
            :milestones="milestones"
            :active-milestone="activeMilestoneId"
            :active-category="activeCategory"
            @hover-milestone="handleHoverMilestone"
            @select-milestone="handleSelectMilestone"
          />
          <template #fallback>
            <div class="timeline-skeleton"></div>
          </template>
        </ClientOnly>

        <!-- Meilenstein-Liste (Screenreader) -->
        <ul class="sr-milestone-list" aria-label="Alle Meilensteine">
          <li v-for="m in milestones" :key="m.id">
            {{ m.year }}: {{ m.title }} – {{ m.description }}
          </li>
        </ul>

        <!-- Detailkarte -->
        <div v-if="activeMilestone" class="detail-area">
          <MilestoneCard
            :milestone="activeMilestone"
            :detail-data="detailData"
          />
          <button
            v-if="selectedMilestone"
            class="detail-close"
            @click="selectedMilestone = null"
            aria-label="Detail schließen"
          >
            Schließen
          </button>
        </div>
      </template>
    </section>

    <!-- ============================================================
         D: Methodik
         ============================================================ -->
    <details class="methodology" aria-label="Methodische Hinweise">
      <summary class="methodology-summary">Methodische Hinweise</summary>
      <div class="methodology-content">
        <ul>
          <li><strong>Datenquellen:</strong> SMARD (Bundesnetzagentur) für Erzeugungsdaten, ENTSO-E für Day-Ahead-Preise.</li>
          <li><strong>Zeitraum:</strong> 1. Januar 2015 – 31. Dezember 2024.</li>
          <li><strong>Auflösung:</strong> Stündliche Messwerte (PT60M).</li>
          <li><strong>EE-Anteil:</strong> Berechnet als <code>renewables / last</code>, wobei <code>renewables = solar + windOnshore + windOffshore + biomasse + wasserkraft + sonstigeErneuerbare</code>.</li>
          <li><strong>EE-Kategorien:</strong> Photovoltaik, Wind Onshore, Wind Offshore, Biomasse, Wasserkraft, sonstige Erneuerbare.</li>
          <li><strong>Fehlende Werte:</strong> Werte mit fehlenden EE-Feldern werden nicht in die EE-Anteil-Berechnung einbezogen.</li>
          <li><strong>Zeitzone:</strong> Alle zeitlichen Gruppierungen (Wochen, Tage) basieren auf Europe/Berlin Ortszeit inkl. Sommer-/Winterzeit.</li>
          <li><strong>Jährliche Anteile:</strong> sum(renewables) / sum(load) über alle Stunden eines Jahres.</li>
          <li><strong>Negative Preisstunden:</strong> Stunden mit Day-Ahead-Preis &lt; 0 EUR/MWh, gruppiert nach Europe/Berlin Kalendertag.</li>
          <li><strong>Letzte Aktualisierung:</strong> 10. Juli 2026.</li>
        </ul>
      </div>
    </details>

    <!-- ============================================================
         E: Dashboard-CTA
         ============================================================ -->
    <section class="cta-section">
      <h2 class="cta-heading">Die ganze Analyse</h2>
      <p class="cta-text">
        Erkunde Strommix, CO₂-Intensität, Tagesmuster, Einflussfaktoren sowie Markt-
        und Preisentwicklungen im vollständigen Dashboard.
      </p>
      <NuxtLink
        to="/dashboard"
        class="cta-button"
        @pointerenter="preloadDashboard"
        @focus="preloadDashboard"
      >
        Zum interaktiven Dashboard
      </NuxtLink>
    </section>

    <!-- Footer -->
    <footer class="landing-footer">
      <span>Datenquellen: SMARD, Umweltbundesamt, ENTSO-E · Zeitraum: vollständige Jahre 2015–2024</span>
    </footer>
  </div>
</template>

<style scoped>
/* ================================================================
   Landing-Container
   ================================================================ */
.landing {
  max-width: 1100px;
  margin: 0 auto;
  padding: 48px 32px 80px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* ================================================================
   A: Hero
   ================================================================ */
.hero-section {
  text-align: center;
  padding: 0 0 16px;
}

.hero-headline {
  font-family: var(--font-serif);
  font-size: clamp(2rem, 4.5vw, 3.2rem);
  font-weight: 800;
  color: var(--fg);
  line-height: 1.08;
  letter-spacing: -0.03em;
  margin-bottom: 12px;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.hero-subtitle {
  font-size: 1.05rem;
  color: var(--fg-muted);
  max-width: 620px;
  margin: 0 auto 8px;
  line-height: 1.5;
}

.hero-source {
  font-size: 0.72rem;
  color: var(--fg-muted);
  opacity: 0.6;
}

/* ================================================================
   B: Trust Statement
   ================================================================ */
.trust-statement {
  font-size: 0.85rem;
  color: var(--fg-muted);
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px 24px;
  background: #fff;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  line-height: 1.5;
  font-style: italic;
}

/* ================================================================
   C: Timeline
   ================================================================ */
.timeline-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.timeline-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
}

.timeline-skeleton {
  width: 100%;
  height: 380px;
  background: linear-gradient(135deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  border-radius: 12px;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.timeline-loading-text {
  font-size: 0.85rem;
  color: var(--fg-muted);
}

.timeline-error {
  text-align: center;
  padding: 60px 0;
  color: var(--accent);
}

.sr-milestone-list {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.detail-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.detail-close {
  font-family: var(--font-sans);
  font-size: 0.78rem;
  padding: 6px 16px;
  border: 1px solid var(--hairline);
  border-radius: 6px;
  background: #fff;
  color: var(--fg-muted);
  cursor: pointer;
}

.detail-close:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ================================================================
   D: Methodik
   ================================================================ */
.methodology {
  border: 1px solid var(--hairline);
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.methodology-summary {
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 600;
  padding: 14px 20px;
  cursor: pointer;
  color: var(--fg-muted);
  user-select: none;
}

.methodology-summary:hover {
  color: var(--fg);
}

.methodology-content {
  padding: 0 20px 16px;
  font-size: 0.78rem;
  color: var(--fg-muted);
  line-height: 1.6;
}

.methodology-content ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.methodology-content li {
  margin-bottom: 6px;
  padding-left: 14px;
  position: relative;
}

.methodology-content li::before {
  content: "–";
  position: absolute;
  left: 0;
  color: var(--fg-muted);
}

.methodology-content code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 0.72rem;
  background: #f0f0f0;
  padding: 1px 4px;
  border-radius: 3px;
}

/* ================================================================
   E: CTA
   ================================================================ */
.cta-section {
  text-align: center;
  padding: 32px 0 0;
  border-top: 1px solid var(--hairline);
}

.cta-heading {
  font-family: var(--font-serif);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--fg);
  margin-bottom: 8px;
}

.cta-text {
  font-size: 0.9rem;
  color: var(--fg-muted);
  max-width: 580px;
  margin: 0 auto 20px;
  line-height: 1.6;
}

.cta-button {
  display: inline-block;
  padding: 14px 42px;
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  background: var(--accent);
  border-radius: 10px;
  text-decoration: none;
  transition: box-shadow 0.15s, transform 0.1s;
}

.cta-button:hover {
  box-shadow: 0 4px 16px rgba(45, 106, 79, 0.35);
  transform: translateY(-1px);
  text-decoration: none;
}

.cta-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

/* ================================================================
   Footer
   ================================================================ */
.landing-footer {
  text-align: center;
  font-size: 0.68rem;
  color: var(--fg-muted);
  opacity: 0.6;
  padding-top: 8px;
}

/* ================================================================
   Responsive
   ================================================================ */
@media (max-width: 768px) {
  .landing {
    padding: 32px 20px 60px;
    gap: 24px;
  }

  .hero-headline {
    font-size: clamp(1.6rem, 5vw, 2.2rem);
  }

  .trust-statement {
    font-size: 0.78rem;
    padding: 16px;
  }
}
</style>

