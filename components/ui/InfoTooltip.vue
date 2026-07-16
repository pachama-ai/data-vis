<script setup lang="ts">
/**
 * InfoTooltip.vue – Kleines ⓘ-Symbol mit Tooltip-Text bei Hover/Fokus.
 *
 * @example
 * <InfoTooltip text="Erklärung des Werts" />
 */

defineProps<{
  text: string
}>()
</script>

<template>
  <span
    class="info-tip"
    tabindex="0"
    role="button"
    :aria-label="text"
  >
    <svg class="info-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6.5" stroke="currentColor" stroke-opacity="0.4" />
      <text x="7" y="10" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">i</text>
    </svg>
    <span class="info-tip-text">{{ text }}</span>
  </span>
</template>

<style scoped>
.info-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: help;
  outline: none;
  vertical-align: middle;
  margin-left: 3px;
}

.info-icon {
  display: block;
  flex-shrink: 0;
}

.info-tip:focus-visible .info-icon circle,
.info-tip:focus-visible .info-icon text {
  stroke-opacity: 0.8;
  fill-opacity: 0.8;
}

.info-tip-text {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  white-space: normal;
  width: 220px;
  padding: 8px 10px;
  background: #1a1a1a;
  color: #f0f0f0;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  border-radius: 5px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 150ms ease-out;
  z-index: 100;
  text-align: left;
}

/* Pfeil unten */
.info-tip-text::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: #1a1a1a;
}

.info-tip:hover .info-tip-text,
.info-tip:focus-within .info-tip-text {
  opacity: 1;
}

/* Tooltip oberhalb bei Platz, sonst unterhalb */
.info-tip-bottom .info-tip-text {
  bottom: auto;
  top: calc(100% + 6px);
}
.info-tip-bottom .info-tip-text::after {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
  border-bottom-color: #1a1a1a;
}
</style>
