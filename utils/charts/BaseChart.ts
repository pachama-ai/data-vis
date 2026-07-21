/**
 * utils/charts/BaseChart.ts – Abstrakte Basisklasse für D3-Charts.
 *
 * Kapselt gemeinsame Chart-Abmessungen und gibt ein einheitliches
 * Interface für render(), update() und destroy() vor.
 *
 * Enthält noch keine D3-Logik – das wird erst in konkreten
 * Unterklassen wie StackedAreaChart ergänzt.
 */

// =========================================================================
// Typ für die Margin-Werte eines Charts
// =========================================================================

export interface ChartMargin {
  top: number
  right: number
  bottom: number
  left: number
}

// =========================================================================
// Abstrakte Basisklasse
// =========================================================================

export abstract class BaseChart {
  /** Gesamte Breite des SVG in Pixel */
  #width: number

  /** Gesamte Höhe des SVG in Pixel */
  #height: number

  /** Abstand zwischen SVG-Rand und Plotfläche */
  #margin: ChartMargin

  /** Breite der Plotfläche (Gesamtbreite minus linkem und rechtem Margin) */
  #innerWidth: number

  /** Höhe der Plotfläche (Gesamthöhe minus oberem und unterem Margin) */
  #innerHeight: number

  // =======================================================================
  // Konstruktor
  // =======================================================================

  constructor(
    width: number = 900,
    height: number = 460,
    margin: ChartMargin = { top: 20, right: 20, bottom: 40, left: 60 },
  ) {
    this.#width = width
    this.#height = height
    this.#margin = { ...margin }

    this.#innerWidth = width - margin.left - margin.right
    this.#innerHeight = height - margin.top - margin.bottom
  }

  // =======================================================================
  // Getter
  // =======================================================================

  get width(): number {
    return this.#width
  }

  get height(): number {
    return this.#height
  }

  get margin(): ChartMargin {
    return { ...this.#margin }
  }

  get innerWidth(): number {
    return this.#innerWidth
  }

  get innerHeight(): number {
    return this.#innerHeight
  }

  // =======================================================================
  // Abstrakte Methoden – werden von konkreten Chart-Klassen implementiert
  // =======================================================================

  /**
   * Erzeugt das SVG im übergebenen Container und zeichnet den Chart.
   * Wird einmalig in onMounted aufgerufen.
   */
  abstract render(container: HTMLElement): void

  /**
   * Aktualisiert den Chart bei neuen Daten oder geänderten Einstellungen.
   * Wird über einen Vue-watch getriggert.
   */
  abstract update(): void

  /**
   * Räumt SVG und Selections auf.
   * Wird in onBeforeUnmount aufgerufen.
   */
  abstract destroy(): void
}
