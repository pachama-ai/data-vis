/**
 * Abstrakte Basisklasse für die D3-Charts in diesem Projekt.
 *
 * Die Klasse kapselt die gemeinsamen Chart-Abmessungen (Breite, Höhe,
 * Ränder) und gibt ein einheitliches Interface für render(), update()
 * und destroy() vor. D3-Logik steckt noch nicht drin – die
 * kommt erst in den konkreten Unterklassen wie StackedAreaChart oder
 * DeviationChart dazu.
 *
 * @author Selina Schneider
 */



// Typ für die Margin-Werte eines Charts

/**
 * Abstand zwischen SVG-Rand und der eigentlichen Zeichenfläche.
 */
export interface ChartMargin {
  top: number
  right: number
  bottom: number
  left: number
}


// Abstrakte Basisklasse

export abstract class BaseChart {
  /** Breite des SVG in Pixel */
  protected width: number

  /** Höhe des SVG in Pixel */
  protected height: number

  /** Abstand zwischen SVG-Rand und Plotfläche */
  protected margin: ChartMargin

  /** Breite der Plotfläche (Gesamtbreite minus linkem und rechtem Margin) */
  protected innerWidth: number

  /** Höhe der Plotfläche (Gesamthöhe minus oberem und unterem Margin) */
  protected innerHeight: number


  // Konstruktor

  /**
   * Speichert die Chart-Abmessungen und leitet die innere Plotfläche ab.
   *
   * Die Default-Werte passen für die üblichen Diagramme in diesem
   * Projekt. Unterklassen können im super()-Aufruf eigene Werte
   * mitgeben, wenn ein Diagramm z. B. mehr Platz für die y-Achse
   * braucht (bei DeviationChart ist der linke Margin größer, weil
   * dort die Energieträger-Namen stehen).
   *
   * @param width Gesamte SVG-Breite in Pixel
   * @param height Gesamte SVG-Höhe in Pixel
   * @param margin Ränder zwischen SVG und Plotfläche
   */
  constructor(
    width: number = 900,
    height: number = 460,
    margin: ChartMargin = { top: 20, right: 20, bottom: 40, left: 60 },
  ) {
    this.width = width
    this.height = height
    this.margin = margin

    this.innerWidth = width - margin.left - margin.right
    this.innerHeight = height - margin.top - margin.bottom
  }


  // Abstrakte Methoden – werden von konkreten Chart-Klassen implementiert

  /**
   * Erzeugt das SVG im übergebenen Container und zeichnet den Chart.
   * Wird einmalig in onMounted aufgerufen.
   *
   * @param container HTML-Element, in dem das SVG angelegt wird
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