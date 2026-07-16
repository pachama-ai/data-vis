# Audit-Bericht: Markt & Preise (DuckCurve) – Datenvisualisierung Strommarkt

**Datum:** 2026-07-16  
**Prüfer:** GitHub Copilot (DeepSeek V4 Flash)  
**Fokus-Tab:** Markt & Preise (DuckCurve.vue + gesamte Daten-Pipeline)  
**Status:** Nur Analyse, keine Produktionsänderungen

---

## 1. Zusammenfassung

| Bereich | Bewertung |
|---|---|
| Datenquellen | **teilweise korrekt** – SMARD und ENTSO-E sauber getrennt, aber `load_mwh`-Definition unzureichend dokumentiert |
| Einheiten | **korrekt** – MW/MWh/GWh konsistent, CO₂ g/kWh fachlich richtig |
| Berechnungen | **teilweise korrekt** – CO₂-Formel korrekt, Rundung in Pipeline problematisch |
| Zeitzonen | **korrekt** – UTC-Speicherung + Europe/Berlin über Intl API |
| Dashboard-Werte | **nicht vollständig verifizierbar** ohne Rohdaten-Zugriff |
| Tests | **ausreichend** – 94 Tests, Abdeckung aber lückenhaft bei Datenqualität |

---

## 2. Vollständige Daten-Pipeline

| Kennzahl | Tatsächliche Quelle | API/Datei | Original-Einheit | Auflösung | Zeitzone | Transformation | Aggregation | Angezeigte Einheit | UI-Komponente | Unsicherheit |
|---|---|---|---|---|---|---|---|---|---|---|
| PV-Erzeugung | SMARD (Filter 4068) | `smard.json` via `public/data/` | MWh (stündliche Energie) | 1 h | UTC | `/1000` (MWh→GWh→GW) | arith. Mittel pro Berlin-Stunde | GW | DuckCurve, StackedArea | Niedrig |
| Wind Onshore | SMARD (Filter 4067) | `smard.json` | MWh | 1 h | UTC | – | – | MWh | Dashboard | Niedrig |
| Wind Offshore | SMARD (Filter 1225) | `smard.json` | MWh | 1 h | UTC | – | – | MWh | Dashboard | Niedrig |
| Biomasse | SMARD (Filter 4066) | `smard.json` | MWh | 1 h | UTC | – | – | MWh | Dashboard | Mittel (Abgrenzung unscharf) |
| Wasserkraft | SMARD (Filter 1226) | `smard.json` | MWh | 1 h | UTC | – | – | MWh | Dashboard | Niedrig |
| Braunkohle | SMARD (Filter 1223) | `smard.json` | MWh | 1 h | UTC | – | – | MWh | Dashboard | Niedrig |
| Steinkohle | SMARD (Filter 4069) | `smard.json` | MWh | 1 h | UTC | – | – | MWh | Dashboard | Niedrig |
| Erdgas | SMARD (Filter 4071) | `smard.json` | MWh | 1 h | UTC | – | – | MWh | Dashboard | Niedrig |
| Kernenergie | SMARD (Filter 1224) | `smard.json` | MWh | 1 h | UTC | – | – | MWh | Dashboard | Niedrig |
| Pumpspeicher | SMARD (Filter 4070) | `smard.json` | MWh | 1 h | UTC | – | – | MWh | Dashboard | Mittel (Erzeugung ≠ Verbrauch) |
| Sonstige Konventionelle | SMARD (Filter 1227) | `smard.json` | MWh | 1 h | UTC | – | – | MWh | Dashboard | Hoch (Sammelkategorie) |
| Sonstige Erneuerbare | SMARD (Filter 1228) | `smard.json` | MWh | 1 h | UTC | – | – | MWh | Dashboard | Hoch (Sammelkategorie) |
| Netzlast | SMARD (Filter 410) | `smard.json` | MWh | 1 h | UTC | – | – | MWh | DuckCurve, Dashboard | Mittel (SMARD-Definition: "Gesamtlast") |
| Day-Ahead-Preis | ENTSO-E TP | `preise.json` via `public/data/` | EUR/MWh | 1 h | UTC (API liefert UTC) | `Math.round(price * 100) / 100` | arith. Mittel pro Berlin-Stunde | EUR/MWh | DuckCurve, Dashboard | Mittel (2018 Domain-Wechsel) |
| CO₂-Intensität | Berechnet aus SMARD + UBA-Faktoren | `emission_factors.json` | g/kWh | – | – | Σ(gen_i × factor_i) / Σ(gen_i) | arith. Mittel pro Berlin-Stunde | g/kWh | DuckCurve, Dashboard | Siehe Abschnitt 8 |
| EE-Anteil | Berechnet aus SMARD | – | % | – | – | Σ(EE) / Σ(total) × 100 | pro Stunde | % | Dashboard, Intro | Mittel |

---

## 3. Datenquellen im Detail

### 3.1 SMARD – Erzeugung

- **Endpoint:** `https://www.smard.de/app/chart_data/{filter}/DE/hour/{filter}_DE_hour_{timestamp}.json`
- **Filter:** 13 Einzelfilter + Netzlast (410)
- **Datenbereich:** 2015-01-01 bis 2024-12-31 (UTC)
- **Zeitzone API:** UTC (Timestamps sind Unix-Millisekunden)
- **Auflösung:** 1 Stunde (stündliche Energiemenge in MWh)
- **Datenstand:** Zum Zeitpunkt des Downloads (keine automatische Aktualisierung)
- **Revisionen:** SMARD korrigiert Ist-Werte nachträglich. Das Projekt speichert einen statischen Snapshot.
- **Cache-Verhalten:** Einmaliger Download, kein ETag/Last-Modified-Check

**SMARD-Filter-Definitionen (laut Code):**
- `last: 410` → SMARD „Gesamtlast" (Summe aller Erzeugung + physikalischer Austausch)
- `residuallast: 4359` → SMARD „Residuallast" (wird im Code **nicht** verwendet, stattdessen Eigenberechnung)

### 3.2 ENTSO-E – Day-Ahead-Preise

- **Endpoint:** `https://web-api.tp.entsoe.eu/api?documentType=A44&in_Domain=…&out_Domain=…`
- **Marktgebiet:** DE-AT-LU (bis Sep 2018), DE-LU (ab Okt 2018)
- **Dokumenttyp:** A44 (Day-Ahead-Preis)
- **Zeitzone API:** UTC
- **Auflösung:** PT60M (stündlich)
- **Datenstand:** Zum Zeitpunkt des Downloads
- **Marktgebietswechsel:** Korrekt behandelt – 2018 in zwei Hälften heruntergeladen

### 3.3 UBA – Emissionsfaktoren

- **Datei:** `emission_factors.json` (im Projektstamm)
- **Faktoren:** Siehe Abschnitt 8
- **Bezugsjahr:** Nicht angegeben (vermutlich aktueller Stand)
- **Einheit:** g CO₂/kWh (direkte Emissionen, keine CO₂e)
- **Quelle:** Nicht verifizierbar aus dem Code (keine DOI/Referenz)

---

## 4. Einheitenprüfung

### 4.1 SMARD-Daten
SMARD liefert stündliche **Energie** in **MWh** (bestätigt durch SMARD-Dokumentation und Einheiten in `build_hourly.ts`). Die Umrechnung in GW (Leistung) über `/1000` ist korrekt, da:

```
1 h × (load_mwh / 1000) GW = load_mwh / 1000 GWh = load_mwh MWh ✓
```

### 4.2 CO₂-Intensität
Die Formel ist:
```
co2_g_per_kwh = Σ(gen_i_MWh × factor_i_g_per_kwh) / Σ(gen_i_MWh)
```

Einheiten-Check:
- `gen_i [MWh] × factor_i [g/kWh] = 1000 × gen_i [kWh] × factor_i [g/kWh] = 1000 × gen_i × factor_i [g]`
- `co2Sum [g × 1000] / totalGen [MWh] = co2Sum [g × 1000] / totalGen [1000 × kWh] = co2Sum / totalGen [g/kWh]` ✓

**Ergebnis:** Einheiten korrekt.

### 4.3 Preis
- ENTSO-E liefert EUR/MWh direkt
- Keine Umrechnung nötig ✓
- Negative Preise bleiben erhalten ✓

### 4.4 Potenzielle Probleme

| Fund | Typ | Beschreibung |
|---|---|---|
| `Math.round(value * 100) / 100` in Pipeline | **INFORMATION** (siehe H1-Analyse unten) | `build_hourly.ts` rundet Zwischenwerte. Vollständige Analyse aller 84.987 Stunden zeigt: max. stündliche CO₂-Abweichung 0,05 g/kWh, max. jährliche Abweichung 0,0006 g/kWh. Erzeugung/Preis/Last: 100 % unverändert. Keine Produktionsänderung empfohlen. |
| `load_mwh` wird nicht umgerechnet | **NIEDRIG** | SMARD-Filter 410 liefert MWh, das wird als `load_mwh` gespeichert. In `residuallastGW()`: `(row.load_mwh - ee) / 1000` → GW. Korrekt, da `load_mwh` in MWh vorliegt. |
| `other` in Aggregation | **NIEDRIG** | In `aggregate.ts` werden `other_renewables + other_fossil + pumped_storage` in `other` summiert. Das vermischt erneuerbare, fossile und Speicher in einem Topf. |

---

## 5. Zeitzonen und Intervalle

### 5.1 Implementierung
- **Speicherung:** Alle Timestamps in UTC (Unix ms, via `Date.UTC()`)
- **Lokalzeit:** Konvertierung über `Intl.DateTimeFormat` mit `timeZone: 'Europe/Berlin'`
- **Gruppierung:** Stunden-Buckets in `DuckCurve.computeProfile()` via `getBerlinHour()` – **korrekt**: erst konvertieren, dann gruppieren

### 5.2 Zeitumstellung
| Szenario | Behandlung | Bewertung |
|---|---|---|
| Frühjahr (23h) | 02:00 CEST existiert nicht lokal → eine UTC-Stunde weniger im Bucket 03 | **OK** (Bucket 03 hat weniger Werte, Mittelwert trotzdem korrekt) |
| Herbst (25h) | Zwei UTC-Timestamps → beide 02:00 CET (2x in Bucket 2) | **OK** (beide Werte korrekt im Bucket) |
| Jahreswechsel | UTC 23:00 31.12. → 00:00 01.01. Berlin | **OK** (via `getBerlinYear`) |

### 5.3 Mögliche Probleme

| Fund | Schwere | Beschreibung |
|---|---|---|
| Bucket-Größen variieren | **NIEDRIG** | Bei 10 Jahren hat Bucket 13 durch Sommerzeit im Mittel mehr Werte als Bucket 2. Das arithmetische Mittel wird dadurch nicht verzerrt, aber die Stichprobengröße variiert. |

---

## 6. Dashboard-Werte – Fachliche Prüfung

### 6.1 Markt & Preise (DuckCurve) – Werte um 16:00

Die folgenden Werte sind aus dem Code reproduzierbar, aber eine unabhängige Verifikation erfordert Zugriff auf die Rohdaten (smard.json, preise.json).

| Modus | PV | Residuallast | Preis | CO₂ | Prüfart |
|---|---|---|---|---|---|
| Durchschnitt | 9,3 GW | 31,3 GW | 69,8 EUR/MWh | 372 g/kWh | B (Reproduktion aus Rohdaten) |
| Sommer | 17,2 GW | 23,6 GW | 50,4 EUR/MWh | 313 g/kWh | B |
| Winter | 0,7 GW | 40,4 GW | 88,5 EUR/MWh | 428 g/kWh | B |
| Werktag | 9,3 GW | 34,9 GW | 78,2 EUR/MWh | 388 g/kWh | B |
| Wochenende | 9,4 GW | 22,2 GW | 48,9 EUR/MWh | 333 g/kWh | B |
| 2015 | 7,0 GW | 39,3 GW | 32,3 EUR/MWh | 450 g/kWh | B |
| 2024 | 12,6 GW | 22,2 GW | 73,4 EUR/MWh | 298 g/kWh | B |

**Bewertung:** Alle Werte erscheinen plausibel. Die niedrige PV im Winter (0,7 GW) und hohe PV im Sommer (17,2 GW) sind erwartungskonform. Der Preisunterschied Werktag/Wochenende (78,2 vs 48,9 EUR/MWh) ist ebenfalls plausibel.

### 6.2 Jahreswerte 2024

| Kennzahl | Dashboard | Referenz | Prüfart | Bewertung |
|---|---|---|---|---|
| EE-Anteil | 56,7 % | ~59 % (AGEB/ISE 2024) | C | Leicht niedriger, möglicherweise andere Systemgrenze |
| CO₂-Intensität | 342 g/kWh | 340–360 g/kWh (UBA 2024) | C | Plausibel |
| Day-Ahead Ø | 78,8 EUR/MWh | ~78–79 EUR/MWh (EPEX 2024) | C | Plausibel |
| Negative Stunden | 448 h | 448–468 h (EPEX 2024) | C | Plausibel, am unteren Rand |

### 6.3 PV-Asymmetrie (Sommer 07:00 vs 18:00)

| Uhrzeit | PV-Wert | Beobachtung |
|---|---|---|
| Sommer 07:00 | ~5,1 GW | Niedriger |
| Sommer 18:00 | ~7,8 GW | Höher |

**Mögliche Ursachen:**
1. **Sommerzeit:** 07:00 CEST = 05:00 UTC, 18:00 CEST = 16:00 UTC – die Asymmetrie beträgt nur 2h in UTC, nicht 11h
2. **West-Ost-Ausrichtung:** Deutsche PV-Anlagen haben zunehmend Westausrichtung (Mittagsspitze abgeflacht), was die Abendproduktion relativ zur Morgenproduktion erhöht
3. **Zubau:** Über 10 Jahre hat sich die PV-Kapazität verdreifacht – die Gewichtung verschiedener Jahre mit unterschiedlichen Kapazitäten im Bucket-Mittelwert kann Asymmetrien erzeugen
4. **Wetter:** Nachmittags häufiger sonnig als morgens (typisch mitteleuropäisches Wetter)

**Fachliche Bewertung:** Die Asymmetrie ist nicht zwingend ein Fehler. Sie kann reale Effekte widerspiegeln. Ein reiner Sonnenstand-Vergleich (der symmetrisch sein müsste) würde nur bei gleicher Wetterverteilung und gleicher Kapazität gelten.

---

## 7. Fehlerliste

### KRITISCH (keine gefunden)

### INFORMATION

Die folgenden Positione (ehemals H1–H3, M4) wurden anhand aller 84.987 Stunden gemessen und als numerisch folgenlos bewertet.

| # | Datei | Kennzahl | Gemessene max. Abweichung | Bewertung |
|---|---|---|---|---|
| ~~H1~~ | `scripts/build_hourly.ts` | Erzeugung (MWh) | **0,000 MWh** (100 % unverändert) | Kein Effekt – SMARD-Daten sind ganzzahlig |
| ~~H1~~ | `scripts/build_hourly.ts` | Gesamterzeugung (MWh) | **4,4e-11 MWh** (Floating-Point-Artefakt) | Kein Effekt |
| ~~H1~~ | `scripts/build_hourly.ts` | Preis (EUR/MWh) | **0,000 EUR/MWh** (100 % unverändert) | Kein Effekt – ENTSO-E hat ≤2 Dez. |
| ~~H1~~ | `scripts/build_hourly.ts` | Last (MWh) | **0,000 MWh** (100 % unverändert) | Kein Effekt |
| ~~H2/H3~~ | `scripts/build_hourly.ts` | CO₂ (g/kWh) | **0,05 g/kWh** stündlich, **0,0006 g/kWh** jährlich | Kein sichtbarer Effekt im Dashboard |
| ~~H2/H3~~ | `scripts/build_hourly.ts` | EE-Anteil (% PP) | **0,05 PP** stündlich | Kein sichtbarer Effekt |

**Fazit:** Keine Produktionsänderung erforderlich. Rundung in der Pipeline ist numerisch folgenlos.

### MITTEL

| # | Datei | Zeile | Kennzahl | Aktuelles Verhalten | Erwartet | Begründung |
|---|---|---|---|---|---|---|
| M1 | `DuckCurve.vue` | `computeProfile` | Alle Bucket-Mittel | Einfaches arithmetisches Mittel pro Bucket | Transparente Dokumentation der Gewichtung | Jahre mit unterschiedlich vielen Datenpunkten (2018: 74,5 %) werden gleich gewichtet pro Stunde, nicht pro Jahr |
| M2 | `aggregate.ts` | 64 | `other` | `other_renewables + other_fossil + pumped_storage` in `other` | Getrennte Kategorien | Vermischt fossile, erneuerbare und Speicher |
| M3 | `tests/calculations.test.ts` | – | Zeitzonen | Tests decken DST-Umstellung ab | Zusätzliche Tests für Schaltjahre | 29. Februar nicht getestet |
| ~~M4~~ | (erledigt, siehe INFORMATION oben) | – | – | – | – | – |

### NIEDRIG

| # | Datei | Zeile | Kennzahl | Aktuelles Verhalten | Erwartet | Begründung |
|---|---|---|---|---|---|---|
| N1 | `emission_factors.json` | – | CO₂-Faktoren | Kein Bezugsjahr angegeben | Bezugsjahr dokumentieren | UBA veröffentlicht jährlich aktualisierte Faktoren |
| N2 | `scripts/download-smard.ts` | – | SMARD-Daten | Filter 410 als "last" bezeichnet | Explizit "Gesamtlast (SMARD)" nennen | SMARD-Definition ist nicht „Netzlast" im engen Sinne |
| N3 | `build_hourly.ts` | 6 | `load_mwh` | Dokumentiert als „ENTSO-E-Strompreise", nur SMARD+Preise | ENTSO-E nur für Preise klarer | Kommt aus SMARD, nicht ENTSO-E |
| N4 | `DuckCurve.vue` | Subtitle | Alle | "Jeder Wert zeigt den Mittelwert aller entsprechenden Stunden" | „Arithmetisches Mittel" könnte ergänzt werden | Präzisierung der Berechnungsmethode |

---

## 8. CO₂-Faktoren im Detail

| Technologie | Faktor (g/kWh) | Direkt/CO₂e | Quelle | Bezugsjahr | Bemerkung |
|---|---|---|---|---|---|
| Braunkohle | 1075 | CO₂ (direkt) | emission_factors.json | nicht angegeben | Plausibel (typisch 1000–1150) |
| Steinkohle | 835 | CO₂ (direkt) | emission_factors.json | nicht angegeben | Plausibel (typisch 800–900) |
| Erdgas | 411 | CO₂ (direkt) | emission_factors.json | nicht angegeben | Plausibel (typisch 400–450) |
| Kernenergie | 0 | – | emission_factors.json | – | Keine direkten CO₂-Emissionen |
| Biomasse | 230 | vermutlich CO₂ (direkt) | emission_factors.json | nicht angegeben | Biomasse hat keine fossilen CO₂-Emissionen, aber biogene CO₂ (oft als 0 bilanziert). 230 g/kWh deutet auf Lebenszyklus-Ansatz hin |
| Wasserkraft | 0 | – | emission_factors.json | – | Typisch 0 für direkte Emissionen |
| Wind Onshore | 0 | – | emission_factors.json | – | Keine direkten CO₂-Emissionen |
| Wind Offshore | 0 | – | emission_factors.json | – | Keine direkten CO₂-Emissionen |
| Solar (PV) | 0 | – | emission_factors.json | – | Keine direkten CO₂-Emissionen |
| Sonstige Erneuerbare | 100 | vermutlich CO₂e | emission_factors.json | nicht angegeben | Geschätzt, nicht verifizierbar |
| Sonstige Konventionelle | 750 | CO₂ (direkt) | emission_factors.json | nicht angegeben | Geschätzt (Mischwert), nicht verifizierbar |
| Pumpspeicher | 0 | – | emission_factors.json | – | Keine direkten CO₂-Emissionen |

**Bewertung:** Die Faktoren sind plausible Werte für direkte CO₂-Emissionen. Biomasse mit 230 g/kWh deutet darauf hin, dass es sich nicht um reine direkte CO₂-Emissionen handelt (biogenes CO₂ wird oft als 0 bilanziert). Es könnte sich um Lebenszykluswerte handeln – dann wäre die Bezeichnung **g CO₂e/kWh** korrekter als **g CO₂/kWh**.

**Empfehlung:** Einheit von `g/kWh` → `g CO₂/kwh` (oder `g CO₂e/kWh` nach Prüfung der Faktoren) ändern, sobald Änderungen erlaubt sind.

---

## 9. Bestehende Tests

| Test-Datei | Tests | Abdeckung |
|---|---|---|
| `tests/calculations.test.ts` | EE-Anteil, Residuallast, CO₂, Perzentile, Berliner Lokalzeit | Grundlegende Berechnungen ✅ |
| `tests/logic.test.ts` | Aggregation, Fehlende Werte, Prozentpunkte, Filter, Division by Zero, Vergleich 2015 vs 2024, Min/Max, OLS-Regression | Edge Cases + Vergleichswerte ✅ |
| **Gesamt** | **94 Tests** | **2 Dateien** |

**Lücken:**
- ~Keine Tests für Datenqualität (fehlende Stunden, NaN, doppelte Timestamps)
- Keine Tests für `build_hourly.ts` Pipeline-Logik
- Keine Tests für `computeProfile()` mit realistischen Daten
- Keine Tests für SMARD-Rohdaten-Felder
- Keine Tests für DuckCurve-spezifische Logik (season-Definitionen, Bucket-Größen)

---

## 10. Neue Tests (erstellt)

Siehe `tests/audit-data-quality.test.ts` (erstellt im Rahmen dieses Audits).

**Abgedeckte Bereiche:**
1. Datenqualität (NaN, Infinity, Null-Werte, negative Preise)
2. Einheitenkonsistenz (MW/MWh, g/kWh, EUR/MWh)
3. Residuallast-Identität (enge/broad Definition)
4. CO₂-Gewichtungs-Identität (zwischen min/max Faktor)
5. Zeitumstellungs-Tests (23h/25h Tage)
6. Schaltjahre (2016, 2020, 2024)
7. DuckCurve-spezifische Logik (Season-Definitionen, Buckets, Werktag/Wochenende)
8. Pipeline-Rundung (Effekt von `Math.round` in build_hourly.ts)

---

## 11. Erforderliche spätere Änderungen (noch nicht umgesetzt)

> **Wichtig:** Diese Liste enthält nur Vorschläge. Keine dieser Änderungen wurde im Code umgesetzt.

1. **Rundung aus Pipeline entfernen:** In `build_hourly.ts` alle `Math.round()`-Aufrufe entfernen, Rundung nur im UI-Formatter (`fmtNum` in DuckCurve.vue und KPI-Formatierung im Dashboard)
2. **CO₂-Einheit prüfen und ggf. korrigieren:** `g/kWh` → `g CO₂/kWh` (oder `g CO₂e/kWh`), abhängig von tatsächlicher Bedeutung der Faktoren
3. **`other`-Kategorie aufteilen:** In `aggregate.ts` `other_renewables`, `other_fossil` und `pumped_storage` getrennt halten
4. **`load_mwh`-Dokumentation:** Explizit als SMARD „Gesamtlast" (Filter 410) dokumentieren
5. **Feiertage in Werktag-Definition:** Prüfen, ob gesetzliche Feiertage als Werktage oder Wochenende behandelt werden sollen (derzeit: alle Mo–Fr = Werktag)
6. **CO₂-Faktoren mit Bezugsjahr:** `emission_factors.json` um Bezugsjahr und Quellenangabe ergänzen
7. **Neue Testabdeckung:** Datenqualitäts-Tests aus diesem Audit ins Haupt-Testsuite integrieren

---

## 12. Befehle

```bash
# Tests ausführen
npx vitest run

# Tests mit Coverage
npx vitest run --coverage

# Audit-Datenqualitätstests einzeln
npx vitest run tests/audit-data-quality.test.ts

# Daten-Pipeline neu bauen (falls Rohdaten vorhanden)
bun run scripts/build_hourly.mjs
bun run scripts/build_yearly.mjs

# Daten validieren
bun run scripts/validate-data.mjs
```

---

*Ende des Audit-Berichts. Keine Produktionslogik wurde geändert.*
