/**
 * utils/berlin.ts
 * =================
 * Hilfsfunktionen für Europe/Berlin Lokalzeit.
 * Unix-Timestamps bleiben unverändert — nur die Interpretation ändert sich.
 * Alle Komponenten, die Tagesstunden oder Kalenderdaten anzeigen,
 * nutzen diese Funktionen statt getUTCHours/getUTCMonth/getUTCFullYear.
 */

// Einmal erzeugte Formatierer (wiederverwendbar, spart Speicher)
const hourFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false })
const yearFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', month: 'numeric' })
const dayFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric' })
const weekdayFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short' })
const dateKeyFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
const fullFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: 'numeric' })

/** Europe/Berlin Stunde (0–23) */
export function getBerlinHour(ts: number): number {
  return parseInt(hourFmt.format(ts), 10)
}

/** Europe/Berlin Jahr (z. B. 2024) */
export function getBerlinYear(ts: number): number {
  return Number(yearFmt.format(ts))
}

/** Europe/Berlin Monat (1–12) */
export function getBerlinMonth(ts: number): number {
  return Number(monthFmt.format(ts))
}

/** Europe/Berlin Tag (1–31) */
export function getBerlinDay(ts: number): number {
  return Number(dayFmt.format(ts))
}

/** Europe/Berlin Wochentag (0=So, 1=Mo, …, 6=Sa) — an toLocaleString angepasst */
export function getBerlinWeekday(ts: number): number {
  // toLocaleString mit weekday: 'short' liefert "Mo", "Di" etc.
  const map: Record<string, number> = { Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 0 }
  return map[weekdayFmt.format(ts)] ?? 0
}

/** Prüft, ob ein Datum in Berlin-Zeit auf ein Wochenende fällt */
export function isBerlinWeekend(ts: number): boolean {
  const wd = getBerlinWeekday(ts)
  return wd === 0 || wd === 6
}

/** Gibt einen Datums-String im Format YYYY-MM-DD (Berlin-Zeit) zurück */
export function getBerlinDateKey(ts: number): string {
  // dateKeyFmt liefert "DD.MM.YYYY" — umdrehen zu YYYY-MM-DD
  const parts = dateKeyFmt.format(ts).split('.')
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

/** Gibt Monats-String "YYYY-MM" (Berlin-Zeit) zurück */
export function getBerlinMonthKey(ts: number): string {
  const y = getBerlinYear(ts)
  const m = String(getBerlinMonth(ts)).padStart(2, '0')
  return `${y}-${m}`
}
