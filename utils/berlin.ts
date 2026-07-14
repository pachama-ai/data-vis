/**
 * berlin.ts – Hilfsfunktionen für Europe/Berlin Lokalzeit.
 *
 * Alle Komponenten nutzen diese Funktionen statt getUTCHours/getUTCMonth,
 * damit die Stunden und Monate korrekt in der Berliner Zeitzone interpretiert
 * werden (inkl. Sommer-/Winterzeit-Umstellung).
 * Die Formatierer sind einmalig erzeugt und werden wiederverwendet.
 */

// Einmal erzeugte Formatierer (wiederverwendbar, spart Speicher)
const hourFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false })
const yearFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', month: 'numeric' })
const dayFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric' })
const weekdayFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short' })
const dateKeyFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
const fullFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: 'numeric' })

/**
 * Gibt die Stunde in Berliner Lokalzeit zurück (0–23).
 * @param ts Unix-Timestamp (ms).
 * @returns Stunde 0–23.
 */
export function getBerlinHour(ts: number): number {
  return parseInt(hourFmt.format(ts), 10)
}

/**
 * Gibt das Jahr in Berliner Lokalzeit zurück.
 * @param ts Unix-Timestamp (ms).
 * @returns Jahr als Zahl.
 */
export function getBerlinYear(ts: number): number {
  return Number(yearFmt.format(ts))
}

/**
 * Gibt den Monat in Berliner Lokalzeit zurück (1–12).
 * @param ts Unix-Timestamp (ms).
 * @returns Monat 1–12.
 */
export function getBerlinMonth(ts: number): number {
  return Number(monthFmt.format(ts))
}

/**
 * Gibt den Tag in Berliner Lokalzeit zurück (1–31).
 * @param ts Unix-Timestamp (ms).
 * @returns Tag 1–31.
 */
export function getBerlinDay(ts: number): number {
  return Number(dayFmt.format(ts))
}

/**
 * Gibt den Wochentag in Berliner Lokalzeit zurück.
 * 0 = Sonntag, 1 = Montag, …, 6 = Samstag.
 * @param ts Unix-Timestamp (ms).
 * @returns Wochentag 0–6.
 */
export function getBerlinWeekday(ts: number): number {
  // toLocaleString mit weekday: 'short' liefert "Mo", "Di" etc.
  const map: Record<string, number> = { Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 0 }
  return map[weekdayFmt.format(ts)] ?? 0
}

/**
 * Prüft, ob ein Datum in Berliner Zeit auf ein Wochenende fällt.
 * @param ts Unix-Timestamp (ms).
 * @returns true bei Samstag oder Sonntag.
 */
export function isBerlinWeekend(ts: number): boolean {
  const wd = getBerlinWeekday(ts)
  return wd === 0 || wd === 6
}

/**
 * Gibt einen Datums-String im Format YYYY-MM-DD (Berliner Zeit) zurück.
 * @param ts Unix-Timestamp (ms).
 * @returns Datum als String.
 */
export function getBerlinDateKey(ts: number): string {
  // dateKeyFmt liefert "DD.MM.YYYY" — umdrehen zu YYYY-MM-DD
  const parts = dateKeyFmt.format(ts).split('.')
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

/**
 * Gibt einen Monats-String im Format YYYY-MM (Berliner Zeit) zurück.
 * @param ts Unix-Timestamp (ms).
 * @returns Monat als String.
 */
export function getBerlinMonthKey(ts: number): string {
  const y = getBerlinYear(ts)
  const m = String(getBerlinMonth(ts)).padStart(2, '0')
  return `${y}-${m}`
}
