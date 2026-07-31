/**
 * Berechnet die Kennzahlen für die Bedienleisten neben dem Strommix-
 * Diagramm.
 *
 * Ich habe die drei Fälle „Übersicht 2015 gegen 2024",
 * „ausgewählter Energieträger" und „ausgewählte Annotation" in eigenen
 * Funktionen gebündelt, weil sie unterschiedliche Rückgabetypen haben
 * und in der UI von verschiedenen Komponenten benutzt werden.
 *
 * @author Selina Schneider
 */

import {
  GROUP_OF,
  STACK_ORDER,
  MIX_GROUP_ORDER,
} from '~/components/generation/mixConfig'

import type {
  MixAnnotation,
  MixGroup,
  MixMonthRow,
  MixSourceKey,
} from '~/types/energy-mix'
import type { MixYearRow } from '~/composables/useMixData'


// Ergebnis-Typen

/** Ein Eintrag im Gruppenvergleich (erneuerbar / Kernenergie / fossil). */
interface GroupComparisonMetric {
  group: MixGroup
  value2015: number
  value2024: number
  share2015: number
  share2024: number
  percentagePointChange: number
}

/** Veränderung eines einzelnen Energieträgers zwischen 2015 und 2024. */
interface SourceChangeMetric {
  sourceKey: MixSourceKey
  changeTwh: number
}

/** Kennzahlen für den Gruppenvergleich im Strommix-Seitenbereich. */
export interface OverviewMetrics {
  groups: GroupComparisonMetric[]
  largestIncrease: SourceChangeMetric
  largestDecrease: SourceChangeMetric
}

/** Ein Monat mit dem zugehörigen Wert eines bestimmten Energieträgers. */
interface SourceMonthMetric {
  monthRow: MixMonthRow
  valueTwh: number
}

/** Kennzahlen zu einem ausgewählten Energieträger. */
export interface SourceMetrics {
  sourceKey: MixSourceKey
  value2015: number
  value2024: number
  share2015: number
  share2024: number
  changeTwh: number
  percentagePointChange: number
  maximumMonth: SourceMonthMetric
  minimumMonth: SourceMonthMetric
}

/** Anteil einer Gruppe an der Gesamterzeugung eines Monats. */
interface AnnotationGroupShare {
  group: MixGroup
  valueTwh: number
  share: number
}

/** Kontext für eine ausgewählte Annotation. */
export interface AnnotationContext {
  annotation: MixAnnotation
  monthRow: MixMonthRow
  groupShares: AnnotationGroupShare[]
}


// Hilfsfunktionen

/**
 * Startwert für Gruppen-Aggregate: alle drei Gruppen auf 0.
 *
 * @returns Leeres GroupValues-Objekt
 */
type GroupValues = {
  renewable: number
  nuclear: number
  fossil: number
}

function createEmptyGroupValues(): GroupValues {
  return {
    renewable: 0,
    nuclear: 0,
    fossil: 0,
  }
}

/**
 * Summiert die Werte einer Jahreszeile pro Gruppe.
 * Nutze ich für den Übersichtsvergleich 2015 gegen 2024.
 *
 * @param yearRow Jahreszeile mit Werten pro Energieträger
 * @returns Gruppensummen (renewable, nuclear, fossil)
 */
function calculateYearGroupValues(
  yearRow: MixYearRow,
): GroupValues {
  const groupValues = createEmptyGroupValues()

  for (const sourceKey of STACK_ORDER) {
    const group = GROUP_OF[sourceKey]
    const sourceValue = yearRow.values[sourceKey]

    groupValues[group] += sourceValue
  }

  return groupValues
}

/**
 * Summe der zehn im Diagramm dargestellten Energieträger für einen Monat.
 *
 * @param monthRow Monatszeile mit Werten pro Energieträger
 * @returns Summe aller Werte in TWh
 */
function calculateMonthTotal(monthRow: MixMonthRow): number {
  let total = 0

  for (const sourceKey of STACK_ORDER) {
    total += monthRow.values[sourceKey]
  }

  return total
}

/**
 * Summiert die Werte einer Monatszeile pro Gruppe.
 * Nutze ich für die Monatsansicht in der Annotation.
 *
 * @param monthRow Monatszeile mit Werten pro Energieträger
 * @returns Gruppensummen (renewable, nuclear, fossil)
 */
function calculateMonthGroupValues(
  monthRow: MixMonthRow,
): GroupValues {
  const groupValues = createEmptyGroupValues()

  for (const sourceKey of STACK_ORDER) {
    const group = GROUP_OF[sourceKey]
    const sourceValue = monthRow.values[sourceKey]

    groupValues[group] += sourceValue
  }

  return groupValues
}

/**
 * Rundet einen Wert auf eine Nachkommastelle.
 *
 * @param value Zu rundender Wert
 * @returns Gerundeter Wert
 */
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Berechnet einen Anteil und schützt vor der Division durch 0.
 *
 * @param value Einzelwert
 * @param total Gesamtmenge
 * @returns Anteil zwischen 0 und 1 (0 bei total === 0)
 */
function calculateShare(value: number, total: number): number {
  if (total === 0) {
    return 0
  }

  return value / total
}


// Hauptfunktionen

/**
 * Berechnet die Kennzahlen für den Gruppenvergleich 2015–2024
 * im Strommix-Seitenbereich: gruppierte Anteile sowie der
 * Energieträger mit dem größten Zuwachs und dem größten Rückgang.
 *
 * Gibt null zurück, wenn eines der beiden Jahre in den Daten fehlt.
 *
 * @param yearRows Alle Jahreszeilen
 * @returns Übersichts-Kennzahlen oder null
 */
export function getOverviewMetrics(
  yearRows: MixYearRow[],
): OverviewMetrics | null {
  let year2015: MixYearRow | null = null
  let year2024: MixYearRow | null = null

  for (const yearRow of yearRows) {
    if (yearRow.year === 2015) {
      year2015 = yearRow
    }

    if (yearRow.year === 2024) {
      year2024 = yearRow
    }
  }

  if (year2015 === null || year2024 === null) {
    return null
  }

  const total2015 = year2015.totalTwh
  const total2024 = year2024.totalTwh

  const groupValues2015 = calculateYearGroupValues(year2015)
  const groupValues2024 = calculateYearGroupValues(year2024)

  const groups: GroupComparisonMetric[] = []

  for (const group of MIX_GROUP_ORDER) {
    const value2015 = groupValues2015[group]
    const value2024 = groupValues2024[group]
    const share2015 = calculateShare(value2015, total2015)
    const share2024 = calculateShare(value2024, total2024)

    // Für die angezeigte Differenz die gerundeten Anteile verwenden,
    // damit die im Chart sichtbare Differenz mit den beiden Balken
    // zusammenpasst (gleiche Idee wie in homeDataTransform.ts).
    const displayed2015 = roundToOneDecimal(share2015 * 100)
    const displayed2024 = roundToOneDecimal(share2024 * 100)
    const percentagePointChange = roundToOneDecimal(
      displayed2024 - displayed2015,
    )

    groups.push({
      group,
      value2015,
      value2024,
      share2015,
      share2024,
      percentagePointChange,
    })
  }

  // Größten Zuwachs und größten Rückgang bestimmen.
  let largestIncrease: SourceChangeMetric | null = null
  let largestDecrease: SourceChangeMetric | null = null

  for (const sourceKey of STACK_ORDER) {
    const value2024source = year2024.values[sourceKey]
    const value2015source = year2015.values[sourceKey]
    const changeTwh = value2024source - value2015source

    const sourceChange: SourceChangeMetric = {
      sourceKey,
      changeTwh,
    }

    if (
      largestIncrease === null ||
      changeTwh > largestIncrease.changeTwh
    ) {
      largestIncrease = sourceChange
    }

    if (
      largestDecrease === null ||
      changeTwh < largestDecrease.changeTwh
    ) {
      largestDecrease = sourceChange
    }
  }

  if (largestIncrease === null || largestDecrease === null) {
    return null
  }

  return {
    groups,
    largestIncrease,
    largestDecrease,
  }
}

/**
 * Findet den Monat mit dem höchsten und dem niedrigsten Wert für einen
 * bestimmten Energieträger. Die Suche beginnt mit dem ersten Monat als
 * Ausgangswert und vergleicht ihn mit den restlichen Monaten.
 *
 * @param monthRows Alle Monatszeilen
 * @param sourceKey Zu untersuchender Energieträger
 * @returns Monats-Extrema oder null bei leeren Daten
 */
function findSourceExtremes(
  monthRows: MixMonthRow[],
  sourceKey: MixSourceKey,
): {
  maximumMonth: SourceMonthMetric
  minimumMonth: SourceMonthMetric
} | null {
  if (monthRows.length === 0) {
    return null
  }

  const firstRow = monthRows[0]

  if (!firstRow) {
    return null
  }

  let maximumMonth: SourceMonthMetric = {
    monthRow: firstRow,
    valueTwh: firstRow.values[sourceKey],
  }

  let minimumMonth: SourceMonthMetric = {
    monthRow: firstRow,
    valueTwh: firstRow.values[sourceKey],
  }

  for (const monthRow of monthRows.slice(1)) {
    const value = monthRow.values[sourceKey]

    if (value > maximumMonth.valueTwh) {
      maximumMonth = {
        monthRow,
        valueTwh: value,
      }
    }

    if (value < minimumMonth.valueTwh) {
      minimumMonth = {
        monthRow,
        valueTwh: value,
      }
    }
  }

  return {
    maximumMonth,
    minimumMonth,
  }
}

/**
 * Berechnet die Kennzahlen für einen ausgewählten Energieträger:
 * Anteile 2015 und 2024, absolute Veränderung, prozentuale Veränderung
 * sowie die beiden Extremmonate über den gesamten Zeitraum.
 *
 * Gibt null zurück, wenn eines der beiden Jahre fehlt.
 *
 * @param yearRows Alle Jahreszeilen
 * @param monthRows Alle Monatszeilen
 * @param sourceKey Ausgewählter Energieträger
 * @returns Kennzahlen des Trägers oder null
 */
export function getSourceMetrics(
  yearRows: MixYearRow[],
  monthRows: MixMonthRow[],
  sourceKey: MixSourceKey,
): SourceMetrics | null {
  let year2015: MixYearRow | null = null
  let year2024: MixYearRow | null = null

  for (const yearRow of yearRows) {
    if (yearRow.year === 2015) {
      year2015 = yearRow
    }

    if (yearRow.year === 2024) {
      year2024 = yearRow
    }
  }

  if (year2015 === null || year2024 === null) {
    return null
  }

  const value2015 = year2015.values[sourceKey]
  const value2024 = year2024.values[sourceKey]

  const total2015 = year2015.totalTwh
  const total2024 = year2024.totalTwh

  const share2015 = calculateShare(value2015, total2015)
  const share2024 = calculateShare(value2024, total2024)

  const changeTwh = value2024 - value2015
  const percentagePointChange = (share2024 - share2015) * 100

  const extremes = findSourceExtremes(monthRows, sourceKey)

  if (extremes === null) {
    return null
  }

  return {
    sourceKey,
    value2015,
    value2024,
    share2015,
    share2024,
    changeTwh,
    percentagePointChange,
    maximumMonth: extremes.maximumMonth,
    minimumMonth: extremes.minimumMonth,
  }
}

/**
 * Berechnet den Kontext für eine ausgewählte Annotation. Sucht die
 * passende Monatszeile über das annotation.date und ergänzt die
 * Gruppenanteile für diesen Monat.
 *
 * Gibt null zurück, wenn die Monatszeile nicht gefunden wird.
 */
export function getAnnotationContext(
  monthRows: MixMonthRow[],
  annotation: MixAnnotation,
): AnnotationContext | null {
  let matchingMonthRow: MixMonthRow | null = null

  for (const monthRow of monthRows) {
    if (monthRow.month === annotation.date) {
      matchingMonthRow = monthRow
      break
    }
  }

  if (matchingMonthRow === null) {
    return null
  }

  const monthTotal = calculateMonthTotal(matchingMonthRow)
  const groupValues = calculateMonthGroupValues(matchingMonthRow)

  const groupShares: AnnotationGroupShare[] = []

  for (const group of MIX_GROUP_ORDER) {
    const valueTwh = groupValues[group]
    const share = calculateShare(valueTwh, monthTotal)

    groupShares.push({
      group,
      valueTwh,
      share,
    })
  }

  return {
    annotation,
    monthRow: matchingMonthRow,
    groupShares,
  }
}