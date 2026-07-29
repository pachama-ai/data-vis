/**
 * Aufklappbare Begriffserklärungen auf der Startseite.
 *
 * @author Selina Schneider
 */

<script setup lang="ts">
import { ref } from 'vue'

/** true, wenn die Begriffserklärungen gerade sichtbar sind. */
const isOpen = ref(false)

/**
 * Schaltet die Begriffserklärungen ein oder aus.
 */
function toggleMethodology(): void {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="intro-methodology">
    <!--
      type="button" verhindert, dass der Button innerhalb eines
      Formulars ungewollt als Submit-Button gilt.
    -->
    <button
      class="method-summary"
      type="button"
      @click="toggleMethodology"
    >
      <!--
        method-chevron-open dreht das Icon um 90 Grad, wenn der
        Bereich aufgeklappt ist.
      -->
      <span
        class="method-chevron"
        :class="{ 'method-chevron-open': isOpen }"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 2l4 4-4 4"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>

      Begriffe &amp; Definitionen
    </button>

    <div
      v-if="isOpen"
      class="method-content"
    >
      <p>
        <strong>Prozentpunkte (pp)</strong>
        – Sie beschreiben den Unterschied zwischen zwei Prozentwerten.
        Steigt ein Anteil zum Beispiel von 20 % auf 25 %, sind das 5 Prozentpunkte mehr.

      </p>

      <p>
        <strong>Sonstige konventionelle Energieträger</strong> 
        – Dazu gehören nicht-erneuerbare Energieträger, die nicht Kohle, Erdgas
        oder Kernenergie sind. Beispiele sind Mineralöl, Grubengas und
        nicht erneuerbare Abfälle. Ihr Anteil an der öffentlichen
        Nettostromerzeugung liegt meist unter 5 %.
      </p>


      <p>
        <strong>Öffentliche Nettostromerzeugung</strong>
        – Strom, der in das öffentliche Stromnetz eingespeist wird.
        Strom, der direkt selbst genutzt wird, zum Beispiel von Unternehmen
        oder durch private Photovoltaikanlagen, zählt nicht dazu.
      </p>
    </div>
  </div>
</template>

<style scoped>
.intro-methodology {
  margin-bottom: 48px;
  border-top: 1px solid var(--line-color);
  padding-top: 24px;
}

/*
 * Entfernt den Standard-Rahmen und Hintergrund des Buttons,
 * damit er wie normaler Text aussieht.
 */
.method-summary {
  border: none;
  background: none;
  font-family: var(--sans-font);
  font-size: 14px;
  font-weight: 500;
  color: var(--muted-text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
  padding: 8px 0;
  border-radius: 4px;
  transition: color 200ms ease-out, background 200ms ease-out;
}

.method-summary:hover {
  color: var(--text-color);
  background: rgba(0, 0, 0, 0.03);
}

.method-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  transition: transform 200ms ease-out;
  flex-shrink: 0;
}

/* Chevron dreht sich beim Öffnen um 90 Grad. */
.method-chevron-open {
  transform: rotate(90deg);
}

.method-content {
  max-width: 720px;
  margin-top: 20px;
  padding-bottom: 12px;
  font-family: var(--sans-font);
  font-size: 14px;
  color: var(--muted-text-color);
  line-height: 1.7;
}

.method-content p {
  margin-bottom: 12px;
}

.method-content strong {
  color: var(--text-color);
  font-weight: 600;
}
</style>