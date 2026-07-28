<script setup lang="ts">
/**
 * components/home/IntroHero.vue
 * Hero-Bereich der Intro-Landingpage.
 * Linksbündig mit Eyebrow, Headline, Subline.
 *
 * @author Selina Schneider
 */
</script>

<template>
  <section class="intro-hero">
    <span class="title-label">Strom und Klimaneutralität</span>
    <h1 class="hero-headline">Wie sich der deutsche Strommix verändert hat</h1>
    <p class="hero-subline">Auf dem Weg zur Klimaneutralität muss Strom zunehmend aus emissionsarmen Quellen erzeugt werden. Die Visualisierung vergleicht die Anteile der Energieträger in den Jahren 2015 und 2024.</p>
  </section>
</template>

<style scoped>
.intro-hero {
  margin-bottom: 64px;
}

.hero-headline {
  font-family: var(--serif-font);
  font-size: 36px;
  font-weight: 600;
  color: var(--text-color);
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin: 0 0 16px;
  max-width: none;
}

.hero-subline {
  font-family: var(--sans-font);
  font-size: 16px;
  color: var(--muted-text-color);
  line-height: 1.65;
  max-width: 62ch;
  margin: 0;
}
</style>
