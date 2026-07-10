<script setup lang="ts">
/**
 * components/landing/TimelineFilters.vue
 * ======================================
 * Kategorie-Filter für die Timeline-Meilensteine.
 * Drei Buttons: Erneuerbare | Strukturwandel | Preise
 */

defineProps<{
  active: string | null
}>()

const emit = defineEmits<{
  select: [category: string | null]
}>()

const categories = [
  { key: null, label: 'Alle' },
  { key: 'renewables', label: 'Erneuerbare' },
  { key: 'structural', label: 'Strukturwandel' },
  { key: 'prices', label: 'Preise' },
]
</script>

<template>
  <div class="timeline-filters" role="group" aria-label="Meilensteine filtern">
    <button
      v-for="cat in categories"
      :key="cat.key ?? 'all'"
      class="tf-btn"
      :class="{ active: active === cat.key }"
      :aria-pressed="active === cat.key"
      @click="emit('select', cat.key)"
    >
      {{ cat.label }}
    </button>
  </div>
</template>

<style scoped>
.timeline-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tf-btn {
  font-family: var(--font-sans);
  font-size: 0.78rem;
  font-weight: 500;
  padding: 6px 14px;
  border: 1px solid var(--hairline);
  border-radius: 20px;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all 0.15s;
  outline: none;
}

.tf-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.tf-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.tf-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
</style>
