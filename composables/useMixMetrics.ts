/**
 * composables/useMixMetrics.ts – Reine Berechnungsfunktionen für Kennzahlen.
 *
 * Enthält keine Vue-Refs, kein Fetch, keinen State.
 * Alle Funktionen sind rein und geben bei fehlenden Daten null zurück.
 */

import {
  GROUP_OF,
  STACK_ORDER,
  MIX_GROUP_ORDER,
} from '~/utils/mix-config'

import type {
  MixAnnotation,
  MixGroup,
  MixMonthRow,
  MixSourceKey,
} from '~/types/mix'
import type { MixYearRow } from '~/composables/useMixData'

// =========================================================================
// Ergebnis-Typen
// =========================================================================

export interface GroupComparisonMetric {
  group: MixGroup
  value2015: number
  value2024: number
  share2015: number
  share2024: number
  percentagePointChange: number
}

export interface SourceChangeMetric {
  sourceKey: MixSourceKey
  changeTwh: number
}

export interface OverviewMetrics {
  groups: GroupComparisonMetric[]
  largestIncrease: SourceChangeMetric
  largestDecrease: SourceChangeMetric
}

export interface SourceMonthMetric {
  monthRow: MixMonthRow
  valueTwh: number
}

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

export interface AnnotationGroupShare {
  group: MixGroup
  valueTwh: number
  share: number
}

export interface AnnotationContext {
  annotation: MixAnnotation
  monthRow: MixMonthRow
  groupShares: AnnotationGroupShare[]
}

// =========================================================================
// Hilfsfunktionen
// =========================================================================

/**
 * Erzeugt einen leeren Group-Values-Record mit allen drei Gruppen auf 0.
 */
function createEmptyGroupValues(): Record<MixGroup, number> {
  return {
    renewable: 0,
    nuclear: 0,
    fossil: 0,
  }
}

/**
 * Berechnet die Gesamtsumme aller Erzeugung eines Jahres
 * (alle SMARD-Kategorien inkl. Pumpspeicher und sonstige).
 * Pumpspeicher wird nicht einer Gruppe zugeordnet, sondern
 * nur in der Gesamtsumme berücksichtigt.
 */
function calculateYearTotal(yearRow: MixYearRow): number {
  return yearRow.totalTwh
}

/**
 * Berechnet die Summen jeder Gruppe (renewable, nuclear, fossil) für ein Jahr.
 */
function calculateYearGroupValues(
  yearRow: MixYearRow,
): Record<MixGroup, number> {
  const groupValues = createEmptyGroupValues()

  for (const sourceKey of STACK_ORDER) {
    const group = GROUP_OF[sourceKey]
    const sourceValue = yearRow.values[sourceKey]

    groupValues[group] += sourceValue
  }

  return groupValues
}

/**
 * Berechnet die Gesamtsumme aller zehn Quellen einer Monatszeile.
 */
function calculateMonthTotal(monthRow: MixMonthRow): number {
  let total = 0

  for (const sourceKey of STACK_ORDER) {
    total += monthRow.values[sourceKey]
  }

  return total
}

/**
 * Berechnet die Summen jeder Gruppe für einen Monat.
 */
function calculateMonthGroupValues(
  monthRow: MixMonthRow,
): Record<MixGroup, number> {
  const groupValues = createEmptyGroupValues()

  for (const sourceKey of STACK_ORDER) {
    const group = GROUP_OF[sourceKey]
    const sourceValue = monthRow.values[sourceKey]

    groupValues[group] += sourceValue
  }

  return groupValues
}

/**
 * Berechnet einen Anteil sicher ohne Division durch null.
 */
function calculateShare(value: number, total: number): number {
  if (total === 0) {
    return 0
  }

  return value / total
}

// =========================================================================
// Hauptfunktionen
// =========================================================================

/**
 * Berechnet die Übersichts-Kennzahlen für den Strommix 2015 → 2024.
 *
 * Liefert null, wenn eines der beiden Jahre fehlt.
 */
export function getOverviewMetrics(
  yearRows: MixYearRow[],
): OverviewMetrics | null {
  // 1. Jahre suchen
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

  // 2. Gesamtsummen
  const total2015 = calculateYearTotal(year2015)
  const total2024 = calculateYearTotal(year2024)

  // 3. Gruppensummen
  const groupValues2015 = calculateYearGroupValues(year2015)
  const groupValues2024 = calculateYearGroupValues(year2024)

  // 4. Gruppenvergleich in Reihenfolge MIX_GROUP_ORDER
  const groups: GroupComparisonMetric[] = []

  for (const group of MIX_GROUP_ORDER) {
    const value2015 = groupValues2015[group]
    const value2024 = groupValues2024[group]
    const share2015 = calculateShare(value2015, total2015)
    const share2024 = calculateShare(value2024, total2024)

    // Auf eine Nachkommastelle runden für konsistente Anzeige
    const displayed2015 = Math.round(share2015 * 1000) / 10
    const displayed2024 = Math.round(share2024 * 1000) / 10
    const percentagePointChange = Math.round((displayed2024 - displayed2015) * 10) / 10

    groups.push({
      group,
      value2015,
      value2024,
      share2015,
      share2024,
      percentagePointChange,
    })
  }

  // 5. Größten Zuwachs und größten Rückgang bestimmen
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

// =========================================================================

/**
 * Findet den Monat mit dem höchsten und niedrigsten Wert für eine Quelle.
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

  const firstMonthRow = monthRows[0]!

  let maximumMonth: SourceMonthMetric = {
    monthRow: firstMonthRow,
    valueTwh: firstMonthRow.values[sourceKey],
  }

  let minimumMonth: SourceMonthMetric = {
    monthRow: firstMonthRow,
    valueTwh: firstMonthRow.values[sourceKey],
  }

  for (let index = 1; index < monthRows.length; index++) {
    const monthRow = monthRows[index]!
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
 * Berechnet alle Kennzahlen für einen ausgewählten Energieträger.
 *
 * Liefert null, wenn eines der beiden Jahre fehlt.
 */
export function getSourceMetrics(
  yearRows: MixYearRow[],
  monthRows: MixMonthRow[],
  sourceKey: MixSourceKey,
): SourceMetrics | null {
  // 1. Jahre suchen
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

  // 2. Jahreswerte
  const value2015 = year2015.values[sourceKey]
  const value2024 = year2024.values[sourceKey]

  // 3. Jahressummen
  const total2015 = calculateYearTotal(year2015)
  const total2024 = calculateYearTotal(year2024)

  // 4. Jahresanteile
  const share2015 = calculateShare(value2015, total2015)
  const share2024 = calculateShare(value2024, total2024)

  // 5. Veränderungen
  const changeTwh = value2024 - value2015
  const percentagePointChange = (share2024 - share2015) * 100

  // 6. Höchst- und Tiefstmonat
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

// =========================================================================

/**
 * Berechnet den Kontext für eine ausgewählte Annotation.
 *
 * Liefert null, wenn die Monatszeile nicht gefunden wird.
 */
export function getAnnotationContext(
  monthRows: MixMonthRow[],
  annotation: MixAnnotation,
): AnnotationContext | null {
  // 1. Monatszeile anhand des annotation.date suchen
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

  // 2. Monatsgesamtsumme
  const monthTotal = calculateMonthTotal(matchingMonthRow)

  // 3. Gruppensummen
  const groupValues = calculateMonthGroupValues(matchingMonthRow)

  // 4. Gruppenanteile in Reihenfolge MIX_GROUP_ORDER
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
