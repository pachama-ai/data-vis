<script setup lang="ts">
/**
 * components/intro/IntroHero.vue
 * ===============================
 * Hero-Bereich der Intro-Landingpage.
 * Linksbündig mit Eyebrow, Headline, Subline.
 */
</script>

<template>
  <section class="intro-hero">
    <span class="eyebrow">Stromerzeugung 2015–2024</span>
    <h1 class="hero-headline">Wie sich der deutsche Strom verändert hat</h1>
    <p class="hero-subline">Strom ist elektrische Energie. Seine Klimawirkung wird durch die Zusammensetzung des Strommixes bestimmt. Die Visualisierung zeigt, wie sich der deutsche Strommix von 2015 bis 2024 verändert hat.</p>
  </section>
</template>

<style scoped>
.intro-hero {
  margin-bottom: 64px;
}

.eyebrow {
  display: block;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin-bottom: 16px;
}

.hero-headline {
  font-family: var(--font-serif);
  font-size: 44px;
  font-weight: 500;
  color: var(--fg);
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 0 0 20px;
  max-width: 800px;
  white-space: nowrap;
}

.hero-subline {
  font-family: var(--font-sans);
  font-size: 18px;
  color: var(--fg-muted);
  line-height: 1.5;
  max-width: 640px;
  margin: 0;
}
</style>
