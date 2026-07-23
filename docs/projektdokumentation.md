# Die Klimabilanz des deutschen Stroms

**Interaktive Datenvisualisierung des deutschen Strommarkts 2015–2024**

Hochschule Harz, Medieninformatik, Modul Visualisierung, Frühjahr 2026  
Prof. Jürgen Singer

---

# Inhaltsverzeichnis

1. Ausgangslage und Aufgabenstellung
2. Fachlicher Hintergrund zum deutschen Strommarkt
3. Datenquellen: SMARD und ENTSO-E
4. Datenaufbereitung und Pipeline
5. Einheiten und Zeitbehandlung
6. Aufbau der Nuxt-Anwendung
7. Datenverwaltung mit Composables
8. KPI-Karten
9. Gestapeltes Flächendiagramm (StackedArea)
10. Scatterplot (ScatterAnalysis)
11. Heatmap (HeatmapCO2)
12. Duck Curve (DuckCurve)
13. Tests und Qualitätssicherung
14. Probleme und Korrekturen während der Entwicklung
15. Grenzen des Projekts und Fazit

---

# Abbildungsverzeichnis

Abbildung 1: Datenfluss von SMARD und ENTSO-E  
Abbildung 2: Aufbau der Datenpipeline  
Abbildung 3: KPI-Karten  
Abbildung 4: Gestapeltes Flächendiagramm  
Abbildung 5: Scatterplot  
Abbildung 6: Heatmap  
Abbildung 7: Duck Curve  
Abbildung 8: Zeitvergleich  
Abbildung 9: Testergebnisse  

# Tabellenverzeichnis

Tabelle 1: Datenquellen im Vergleich  
Tabelle 2: Schema der Stundendaten (hourly_2015_2024.json)  
Tabelle 3: Schema der Jahresdaten (yearly_mix.json)  
Tabelle 4: Einheitenkette von der Rohdaten bis zur Visualisierung  
Tabelle 5: Emissionsfaktoren der Energieträger  
Tabelle 6: Übersicht der Visualisierungen  
Tabelle 7: Testabdeckung nach Themen  
Tabelle 8: Bekannte Grenzen  

# Abkürzungsverzeichnis

| Abkürzung | Bedeutung |
|-----------|----------|
| API | Application Programming Interface |
| CO₂ | Kohlenstoffdioxid |
| D3 | Data-Driven Documents (JavaScript-Bibliothek) |
| DST | Daylight Saving Time (Sommerzeit) |
| EE | Erneuerbare Energien |
| ENTSO-E | European Network of Transmission System Operators for Electricity |
| KPI | Key Performance Indicator (Kennzahl) |
| MW | Megawatt (Leistung) |
| MWh | Megawattstunde (Energie) |
| SMARD | Strommarktdatenplattform der Bundesnetzagentur |
| SSR | Server-Side Rendering |
| SVG | Scalable Vector Graphics |
| UBA | Umweltbundesamt |
| UTC | Coordinated Universal Time |

---

# 1. Ausgangslage und Aufgabenstellung

Der deutsche Strommarkt befindet sich im tiefgreifenden Wandel. Der Anteil
erneuerbarer Energien an der Stromerzeugung ist von rund 33 Prozent im Jahr
2015 auf über 56 Prozent im Jahr 2024 gestiegen. Gleichzeitig sind die
CO₂-Emissionen pro Kilowattstunde gesunken, die Preise schwanken stärker als
früher, und immer häufiger kommt es zu negativen Strompreisen.

Diese Entwicklungen lassen sich aus verschiedenen Datenquellen ablesen. Die
Bundesnetzagentur veröffentlicht auf ihrer Plattform SMARD stündliche
Erzeugungsdaten für alle Energieträger. Die Europäische Netzagentur ENTSO-E
stellt die Day-Ahead-Strompreise bereit. Das Umweltbundesamt gibt
Emissionsfaktoren für die einzelnen Energieträger vor. Diese Daten
existieren unabhängig voneinander und sind für sich genommen schwer zu
überblicken.

Die Aufgabe dieses Projekts war es, diese Datenquellen zusammenzuführen und
in einem interaktiven Dashboard visuell aufzubereiten. Das Dashboard soll
zeigen, wie sich der Strommix über die Jahre verändert hat, welche Faktoren
die CO₂-Intensität beeinflussen und wie sich Preise und Erzeugung im
Tagesverlauf verhalten.

Die Zielgruppe sind Studierende und Dozenten der Medieninformatik sowie alle,
die sich für die Energiewende interessieren. Die Anwendung soll ohne
Internetverbindung laufen, da sie bei Präsentationen oder in der Prüfung
nicht von einer aktiven Datenanbindung abhängen darf.

[Abbildung 1 hier einfügen: Gesamtansicht des Dashboards mit allen vier Tabs]

---

# 2. Fachlicher Hintergrund zum deutschen Strommarkt

Um die Visualisierungen zu verstehen, sind einige fachliche Grundbegriffe
notwendig. Dieses Kapitel erklärt sie knapp.

## Strommix

Der Strommix beschreibt die Zusammensetzung der Stromerzeugung aus
verschiedenen Quellen. Man unterscheidet erneuerbare Energien (Wind, Sonne,
Wasser, Biomasse) und konventionelle Energien (Kohle, Gas, Kernenergie). Der
Begriff „konventionell" wird bewusst verwendet, weil Kernenergie zwar nicht
fossil, aber auch nicht erneuerbar ist. Der früher übliche Begriff „fossil"
würde Kernenergie ausschließen und wäre daher ungenau.

## Residuallast

Die Residuallast ist der Teil der Stromnachfrage, der nach Abzug der
fluktuierenden erneuerbaren Erzeugung (Wind und Sonne) übrig bleibt. Sie
muss durch konventionelle Kraftwerke, Importe oder Speicher gedeckt werden.
Die Residuallast ist ein zentraler Indikator für den Integrationsgrad
erneuerbarer Energien: Je niedriger sie ist, desto mehr Erneuerbare sind im
Netz.

## CO₂-Intensität

Die CO₂-Intensität gibt an, wie viele Gramm CO₂ bei der Erzeugung einer
Kilowattstunde Strom freigesetzt werden. Sie wird für jede Stunde
berechnet, indem die Erzeugung jedes Energieträgers mit seinem
Emissionsfaktor multipliziert und durch die Gesamterzeugung geteilt wird.
Die Intensität schwankt stark: Bei viel Wind und Sonne ist sie niedrig, in
windarmen Winterstunden ist sie hoch.

## Day-Ahead-Preis

Der Day-Ahead-Preis wird an der Strombörse einen Tag vor der tatsächlichen
Lieferung ermittelt. Er bildet Angebot und Nachfrage ab. Bei sehr hoher
EE-Einspeisung und geringer Nachfrage kann der Preis negativ werden. Dann
zahlen Erzeuger dafür, dass sie ihren Strom ins Netz einspeisen dürfen.

## Negativpreise

Negative Strompreise treten auf, wenn die Erzeugung die Nachfrage übersteigt
und flexible Kraftwerke nicht schnell genug heruntergeregelt werden können.
Sie sind ein Zeichen dafür, dass das Stromsystem flexibler werden muss. Im
Jahr 2024 gab es 448 Stunden mit negativen Preisen, Tendenz steigend.

## Prozentpunkte

Veränderungen von Prozentangaben werden in Prozentpunkten (PP) gemessen.
Steigt der EE-Anteil von 33 Prozent auf 57 Prozent, ist das eine Zunahme um
24 Prozentpunkte, nicht um 24 Prozent. Prozentpunkte sind absolute
Differenzen, Prozentangaben relative Veränderungen. Im Dashboard werden
durchgängig Prozentpunkte für Veränderungen von Prozentwerten verwendet.

---

# 3. Datenquellen: SMARD und ENTSO-E

Das Projekt verwendet zwei primäre Datenquellen und eine Referenzquelle.

## SMARD (Strommarktdaten)

Die Bundesnetzagentur betreibt die Plattform SMARD (www.smard.de) und
stellt dort stündliche Erzeugungsdaten bereit. Die Daten liegen für zwölf
Energieträger vor: Braunkohle, Steinkohle, Erdgas, Kernenergie, Wind
Onshore, Wind Offshore, Photovoltaik, Biomasse, Wasserkraft,
Pumpspeicher, sonstige Konventionelle und sonstige Erneuerbare. Hinzu
kommt die realisierte Netzlast.

Die Daten haben eine stündliche Auflösung. Jeder Datenpunkt enthält die in
dieser Stunde erzeugte Energiemenge in Megawattstunden (MWh). Da jedes
Intervall genau eine Stunde lang ist, entspricht der MWh-Wert numerisch
der durchschnittlichen Leistung in Megawatt (MW). Der Zeitraum erstreckt
sich von 2015 bis 2024.

Der Download erfolgt über ein Skript (`scripts/download-smard.ts`), das
die API von SMARD abfragt und die Rohdaten als `smard.json` speichert.

## ENTSO-E (Strompreise)

Der Verband Europäischer Übertragungsnetzbetreiber (ENTSO-E) stellt auf
seiner Transparency Platform die Day-Ahead-Preise bereit. Die Preise liegen
in Euro pro Megawattstunde (EUR/MWh) vor, ebenfalls stündlich aufgelöst.

Das Marktgebiet hat sich während des Datenzeitraums verändert: Bis
September 2018 umfasste es Deutschland, Österreich und Luxemburg (DE-AT-LU),
danach nur noch Deutschland und Luxemburg (DE-LU). Dieser Wechsel führte zu
einer Datenlücke von Oktober bis Dezember 2018.

Der Download erfolgt über `scripts/download-prices.ts`. Die ENTSO-E-API
liefert die Daten als XML. Ein Regex extrahiert die Preisangaben. Dabei
musste ein Fehler korrigiert werden: Der ursprüngliche Regex erkannte nur
positive Zahlen, sodass negative Preise ignoriert wurden.

## Umweltbundesamt (Emissionsfaktoren)

Die Emissionsfaktoren stammen vom Umweltbundesamt und geben an, wie viel
Gramm CO₂ bei der Erzeugung einer Kilowattstunde mit einem bestimmten
Energieträger freigesetzt werden. Die Faktoren sind als Referenzwerte in
`emission_factors.json` hinterlegt.

| Träger | g CO₂/kWh |
|--------|-----------|
| Braunkohle | 1075 |
| Steinkohle | 835 |
| Erdgas | 411 |
| Biomasse | 230 |
| Sonstige Konventionelle | 750 |
| Sonstige Erneuerbare | 100 |
| Kernenergie, Wasser, Wind, PV | 0 |

Tabelle 5: Emissionsfaktoren der Energieträger (UBA-Referenzwerte)

---

# 4. Datenaufbereitung und Pipeline

Die Rohdaten aus SMARD und ENTSO-E liegen in unterschiedlichen Formaten vor
und müssen zusammengeführt werden. Dies geschieht in zwei Schritten.

## Schritt 1: Stundenwerte berechnen (build_hourly.ts)

Das Skript `scripts/build_hourly.ts` lädt `smard.json` und `preise.json`
und führt einen Inner Join auf dem Zeitstempel durch. Das bedeutet: Nur
Stunden, für die sowohl Erzeugungs- als auch Preisdaten vorliegen, werden
übernommen. Fehlt einer der beiden Werte, fällt die Stunde weg.

Für jede übernommene Stunde berechnet das Skript:

- **CO₂-Intensität**: Für jeden Energieträger wird die Erzeugung mit
  seinem Emissionsfaktor multipliziert. Die Summe wird durch die
  Gesamterzeugung geteilt. Das ergibt die erzeugungsgewichtete
  CO₂-Intensität für diese Stunde.
- **EE-Anteil**: Anteil der erneuerbaren Erzeugung an der
  Gesamterzeugung, in Prozent.
- **Konventioneller Anteil**: Anteil der nicht-erneuerbaren Erzeugung
  (inklusive Kernenergie) an der Gesamterzeugung, in Prozent.
- **Last**: Die realisierte Netzlast in MWh.

Die deutschen Feldnamen aus SMARD (braunkohle, windOnshore, …) werden
dabei auf englische Bezeichner gemappt (lignite, wind_onshore, …).
Das Ergebnis wird als `hourly_2015_2024.json` gespeichert.

```
public/data/smard.json ──┐
                          ├──→ build_hourly.ts ──→ hourly_2015_2024.json
public/data/preise.json ──┘
```

Abbildung 2: Aufbau der Datenpipeline

Das Schema der Stundendaten sieht folgendermaßen aus:

| Feld | Typ | Bedeutung | Einheit |
|------|-----|-----------|---------|
| timestamp | number | Unix-Zeitstempel (UTC) | ms |
| co2_g_per_kwh | number | CO₂-Intensität | g/kWh |
| ee_share | number | EE-Anteil | % |
| fossil_share | number | Konventioneller Anteil | % |
| price_eur_mwh | number | Day-Ahead-Preis | EUR/MWh |
| load_mwh | number | Netzlast | MWh |
| generation_by_source | object | Erzeugung pro Träger | MWh |

Tabelle 2: Schema der Stundendaten

## Schritt 2: Jahreswerte aggregieren (build_yearly.ts)

Das Skript `scripts/build_yearly.ts` liest die Stundendaten und
aggregiert sie pro Jahr:

- **Erzeugungssumme**: Für jeden Energieträger wird die Jahressumme in
  MWh berechnet.
- **CO₂-Jahresmittel**: Das arithmetische Mittel aller stündlichen
  CO₂-Intensitäten. Die stündlichen Werte sind bereits
  erzeugungsgewichtet (siehe Schritt 1). Das Jahresmittel ist ein
  einfacher Durchschnitt dieser Werte, kein erzeugungsgewichteter
  Jahreswert. Diese Unterscheidung ist bewusst so gewählt und im
  Dashboard transparent gemacht.
- **EE-Anteil Jahresmittel**: Ebenfalls das arithmetische Mittel der
  stündlichen Anteile.
- **Negativpreis-Stunden**: Anzahl der Stunden mit negativem
  Strompreis pro Jahr.

| Feld | Typ | Bedeutung | Einheit |
|------|-----|-----------|---------|
| year | number | Jahr | — |
| sources | object | Jahressumme pro Träger | MWh |
| avg_co2 | number | Mittlere CO₂-Intensität | g/kWh |
| avg_ee_share | number | Mittlerer EE-Anteil | % |
| neg_stunden | number | Negativpreis-Stunden | h |

Tabelle 3: Schema der Jahresdaten

Die Jahresdaten werden als `yearly_mix.json` gespeichert und von den
KPI-Sparklines im Dashboard verwendet.

---

# 5. Einheiten und Zeitbehandlung

## Einheitenkette

Bei der Verarbeitung von Stromdaten ist die Unterscheidung zwischen
Leistung und Energie zentral.

- **Leistung** wird in Watt (W), Kilowatt (kW), Megawatt (MW) oder
  Gigawatt (GW) gemessen. Sie beschreibt die momentane
  Stromerzeugung oder den Verbrauch.
- **Energie** wird in Wattstunden (Wh), Megawattstunden (MWh) oder
  Terawattstunden (TWh) gemessen. Sie beschreibt die über einen
  Zeitraum erzeugte oder verbrauchte Strommenge.

Der Zusammenhang lautet:

```
Energie (MWh) / Intervall (h) = durchschnittliche Leistung (MW)
```

Da alle SMARD-Intervalle exakt eine Stunde lang sind, sind die
MWh-Werte numerisch identisch mit der durchschnittlichen MW-Leistung
in dieser Stunde. Die Umrechnung in Gigawatt erfolgt durch Division
durch 1000.

| Schritt | Wert | Umrechnung | Einheit |
|---------|------|-----------|---------|
| SMARD-Rohdaten | 50.000 | — | MWh |
| Mittlere Leistung | 50.000 / 1 h | ÷ 1 | MW |
| Anzeige im Dashboard | 50.000 / 1000 | ÷ 1000 | GW |

Tabelle 4: Einheitenkette am Beispiel 50.000 MWh

Im Dashboard werden die Einheiten wie folgt verwendet:

- **Scatterplot (Stromnachfrage)**: GW (aus load_mwh ÷ 1000)
- **DuckCurve (PV, Residuallast)**: GW (aus generation ÷ 1000)
- **DuckCurve (Preis)**: EUR/MWh (keine Umrechnung)
- **StackedArea (Absolut)**: TWh (aus MWh ÷ 1.000.000)
- **Heatmap + Scatterplot (CO₂)**: g/kWh (keine Umrechnung)
- **Heatmap (EE-Anteil, konv. Anteil)**: % (keine Umrechnung)
- **KPI-Deltas**: Prozentpunkte für relative Kennzahlen

## Zeitbehandlung

Alle Zeitstempel in den Rohdaten und in der aufbereiteten Datei
`hourly_2015_2024.json` liegen als Unix-Zeitstempel in Millisekunden
vor und sind in UTC (Coordinated Universal Time) angegeben. Das hat
den Vorteil, dass Zeitstempel eindeutig sind, sortiert und verglichen
werden können, ohne dass Sommer- oder Winterzeit berücksichtigt werden
muss.

Für die Anzeige und fachliche Auswertung ist jedoch die lokale Zeit in
Deutschland (Europe/Berlin) relevant. Deutschland verwendet:

- **CET (Central European Time)**: UTC + 1 Stunde (Winter, etwa
  Oktober bis März)
- **CEST (Central European Summer Time)**: UTC + 2 Stunden (Sommer,
  etwa März bis Oktober)

Die Umstellung erfolgt jeweils am letzten Sonntag im März (Sommerzeit)
und am letzten Sonntag im Oktober (Winterzeit). Dabei gibt es eine
Besonderheit:

- **DST-Beginn**: Die Uhr springt von 02:00 auf 03:00 vor. Die Stunde
  02:00–03:00 existiert in der lokalen Zeit nicht. Im UTC-Datensatz
  gibt es diese Lücke ebenfalls — es fehlt einfach der Eintrag für
  diese Stunde.
- **DST-Ende**: Die Uhr springt von 03:00 zurück auf 02:00. Die
  Stunde 02:00–03:00 existiert zweimal. Im UTC-Datensatz gibt es zwei
  Einträge: UTC 00:00 (entspricht 02:00 CEST) und UTC 01:00
  (entspricht 02:00 CET). Beide Einträge sind gültig und haben
  unterschiedliche Zeitstempel.

Für die Verarbeitung der lokalen Zeit wurde eine Hilfsbibliothek
`utils/berlin.ts` erstellt. Sie verwendet `Intl.DateTimeFormat` mit
der Zeitzone `Europe/Berlin`, um aus einem UTC-Zeitstempel die lokale
Stunde, den lokalen Monat oder das lokale Jahr zu ermitteln. Ein
Beispiel:

```ts
const hourFmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: 'numeric',
  hour12: false
})

function getBerlinHour(ts: number): number {
  return parseInt(hourFmt.format(ts), 10)
}
```

Die Funktion `parseInt` ist hier wichtig, weil die deutsche Locale
den Wert als „13 Uhr" formatiert. `Number("13 Uhr")` würde NaN
ergeben, `parseInt("13 Uhr", 10)` liefert korrekt 13 zurück.

Die Jahresgrenze ist ein weiterer wichtiger Fall: Ein Zeitstempel vom
31. Dezember 2023 um 23:00 UTC entspricht dem 1. Januar 2024 um 00:00
in Berlin. Für das Dashboard ist der Berliner Kalender maßgeblich:
Diese Stunde gehört fachlich zum Jahr 2024. Die Jahresdaten in
`yearly_mix.json` verwenden aus Kompatibilitätsgründen weiterhin
UTC-Jahre, die KPI-Berechnung im Dashboard verwendet jedoch
durchgängig Berliner Jahre.

---

*Die Kapitel 6 bis 15 folgen in der nächsten Ausgabe.*

---

# 6. Aufbau der Nuxt-Anwendung

Das Dashboard wurde mit Nuxt 3 (später Nuxt 4) und Vue 3 entwickelt. Nuxt
ist ein Meta-Framework, das auf Vue aufbaut und Strukturvorgaben macht. Die
Entscheidung für Nuxt fiel, weil es eine klare Ordnerstruktur vorgibt
(pages/, components/, composables/) und das Projekt dadurch leichter
verständlich wird.

## Konfiguration

Die Datei `nuxt.config.ts` enthält zwei wichtige Einstellungen:

```ts
export default defineNuxtConfig({
  ssr: false,
  components: [
    { path: '~/components', pathPrefix: false },
  ],
})
```

- **ssr: false**: Die Anwendung läuft als reine Single-Page-Application
  (SPA). Es gibt keinen Server-Side-Rendering. Das ist hier sinnvoll, weil
  alle Daten lokal als JSON vorliegen und keine SEO-Anforderungen bestehen.
  Die Anwendung kann vollständig offline aus dem Build-Ordner gestartet
  werden.
- **pathPrefix: false**: Normalerweise müssten Komponenten aus
  Unterordnern mit ihrem Ordner-Prefix importiert werden
  (z. B. `LandingRecordTimeline`). Mit dieser Einstellung entfällt der
  Prefix, und Komponenten heißen einfach `RecordTimeline`.

## Projektstruktur

Das Projekt folgt der von Nuxt vorgegebenen Struktur:

| Ordner | Zweck |
|--------|-------|
| `pages/` | Zwei Seiten: Landingpage (`index.vue`) und Dashboard (`dashboard.vue`) |
| `components/` | Unterteilt in `dashboard/`, `viz/` und `landing/` |
| `composables/` | Wiederverwendbare Logik (Daten laden, filtern, Kennzahlen) |
| `utils/` | Hilfsfunktionen (Zeitzone, Aggregation) |
| `scripts/` | Daten-Pipeline (Download, Aufbereitung, Validierung) |
| `public/data/` | Alle JSON-Datensätze (lokal, ~36 MB gesamt) |
| `tests/` | Unit-Tests (Vitest, 90 Tests) |

## Seiten und Navigation

Die Anwendung hat zwei Seiten:

- **`/` (Landingpage)**: Eine Einführungsseite mit einem Barbell-Chart, das
  den Strommix von 2015 und 2024 vergleicht. Sie lädt die Dashboard-Daten
  bereits im Hintergrund vor, damit der Wechsel zum Dashboard schnell geht.
- **`/dashboard`**: Die Hauptseite mit vier Tabs (Strommix,
  Einflussfaktoren, Tagesmuster, Markt & Preise), vier KPI-Karten und
  verschiedenen Filtern.

Die drei hinteren Tabs (Einflussfaktoren, Tagesmuster, Markt & Preise)
werden asynchron geladen (`defineAsyncComponent`). Das spart etwa 80
Kilobyte initiales Bundle, weil die großen D3-Charts erst geladen werden,
wenn der Nutzer den entsprechenden Tab tatsächlich anklickt.

## Komponenten-Scan

Nuxt scannt automatisch den `components/`-Ordner und macht alle
gefundenen Komponenten ohne manuellen Import verfügbar. Durch die
Einstellung `pathPrefix: false` können Komponenten aus Unterordnern ohne
Prefix verwendet werden. Trotzdem werden die zentralen Komponenten im
Dashboard explizit importiert, um die Abhängigkeiten sichtbar zu machen:

```ts
import DashboardFilterBar from '~/components/dashboard/FilterBar.vue'
import VizStackedArea from '~/components/viz/StackedArea.vue'
```

---

# 7. Datenverwaltung mit Composables

Die zentrale Datenverwaltung erfolgt über Composables. Das sind Funktionen,
die Vue 3 Reaktivität kapseln und von mehreren Komponenten genutzt werden
können.

## useData — Laden und Cachen

Das Composable `useData()` in `composables/useData.ts` ist für das Laden
der JSON-Datensätze zuständig. Es verwendet drei Pattern, die
zusammenspielen:

1. **Modul-Cache**: Die geladenen Daten werden in Modul-Variablen
   gespeichert (`hourlyCache`, `yearlyCache`). Wird eine Load-Funktion
   ein zweites Mal aufgerufen, gibt sie sofort den Cache zurück.
2. **Shared Promises**: Wenn mehrere Komponenten gleichzeitig dieselben
   Daten anfordern (z. B. Landingpage und Dashboard), teilen sie sich
   das gleiche Promise. Es wird nur ein Fetch ausgeführt.
3. **shallowRef**: Die großen Arrays (85.000 Zeilen) werden in
   `shallowRef` gespeichert, nicht in `ref`. Vue erzeugt dann keine
   tiefe Reaktivität auf jeden einzelnen Eintrag, was Speicher spart.

```ts
async function loadHourly(): Promise<HourlyRow[]> {
  if (hourlyCache) return hourlyCache
  if (hourlyPromise) return hourlyPromise

  hourlyPromise = (async () => {
    const res = await fetch('/data/hourly_2015_2024.json')
    hourlyCache = await res.json() as HourlyRow[]
    return hourlyCache
  })()

  return hourlyPromise
}
```

Die Interfaces `HourlyRow` und `YearlyRow` bilden die JSON-Strukturen
ab und geben allen Komponenten Typsicherheit.

## useFilters — Jahrfilter für die KPI

Das Composable `useFilters()` verwaltet den Zeitraum-Filter für die
KPI-Karten. Es kennt drei Modi:

- **Gesamt**: Der gesamte Zeitraum 2015–2024 wird angezeigt.
- **Jahr**: Ein einzelnes Jahr wird ausgewählt und angezeigt.
- **Vergleich**: Zwei Jahre werden verglichen.

Der Filter verwendet `getBerlinYear()` aus der Berlin-Zeitzonen-Bibliothek.
Dadurch werden Stunden an der Jahresgrenze (z. B. Silvester 23:00 UTC)
dem korrekten Berliner Kalenderjahr zugeordnet.

## useExtremeValues — Kennzahlen für die Seitenleiste

Das Composable `useExtremeValues()` berechnet drei Kennzahlen aus den
monatlich aggregierten Daten: den höchsten EE-Anteil, die höchste fossile
Erzeugung und die größte Veränderung zwischen Start und Ende des
Zeitraums. Es ist eine reine Berechnungsfunktion ohne Seiteneffekte.

## Aggregation (utils/aggregate.ts)

Die Funktion `aggregate()` fasst die 85.000 stündlichen Datenpunkte in
frei wählbare Zeiträume zusammen: Tag, Woche, Monat oder Quartal. Sie
wird sowohl vom Dashboard (für die Seitenleiste) als auch vom
StackedArea-Chart verwendet. Dadurch wird die gleiche Logik nicht
doppelt geschrieben.

```ts
export function aggregate(rows: HourlyRow[], options = {}): MonthlyDataPoint[] {
  // Erzeugt Buckets nach gewähltem Level (Monat, Quartal, …)
  // Summiert MWh pro Quelle und erkennt Datenlücken
}
```

---

# 8. KPI-Karten

Die vier KPI-Karten sind der erste visuelle Kontaktpunkt im Dashboard. Sie
zeigen auf einen Blick die wichtigsten Kennzahlen des Strommarkts.

## Aufbau

Jede Karte besteht aus:

- **Titel**: Name der Kennzahl (z. B. „EE-Anteil")
- **Aktueller Wert**: Die Kennzahl für den gewählten Zeitraum
- **Sparkline**: Ein kleines Liniendiagramm, das den Verlauf über die
  Jahre oder Monate zeigt
- **Delta**: Die Veränderung zwischen Start und Ende des gewählten
  Zeitraums (z. B. „2015 → 2024: +23,6 pp")

[Abbildung 3 hier einfügen: Die vier KPI-Karten nebeneinander]

## Berechnung der Kennzahlen

Die Berechnung erfolgt in einem zentralen `computed`-Block auf der
Dashboard-Seite (`pages/dashboard.vue`). Die Funktionen sind nach
Kennzahl und Modus getrennt:

- **`yearlyValues(field)`**: Liefert ein Array mit einem Wert pro Jahr
  (für die Sparkline im Gesamt-Modus). Für EE-Anteil und CO₂ werden
  die Werte aus `yearly_mix.json` verwendet, für Preis und
  Negativstunden werden sie aus den Stundendaten berechnet.
- **`monthlyValues(year, field)`**: Liefert ein Array mit 12 Werten
  (für die Sparkline im Einzeljahres-Modus).
- **`singleYearValue(year, field)`**: Berechnet den Durchschnittswert
  für ein einzelnes Jahr.
- **`buildDeltaStr(diff, unit, label)`**: Formatiert eine Veränderung
  als lesbaren String, z. B. „2015 → 2024: +23,6 pp".

## Prozentpunkte

Die Veränderung prozentualer Kennzahlen wird in Prozentpunkten (PP)
angegeben, nicht in Prozent. Steigt der EE-Anteil von 33 % auf 57 %,
beträgt die Veränderung +24 PP, nicht +24 %. Der Unterschied: 24 PP
ist die absolute Differenz (57 − 33), während die relative Veränderung
(57 / 33 − 1) etwa 73 % betragen würde. Im Dashboard ist die absolute
Differenz aussagekräftiger, weil sie direkt die Größenordnung der
Veränderung zeigt.

## Rendering mit d3.create

Die Sparkline wird mit D3 gezeichnet. Anders als bei den großen Charts
verwendet die KPI-Karte das Pattern `d3.create("svg")`. Das SVG wird
komplett offline im Speicher gebaut und erst fertig in den Container
gehängt. Das verhindert Konflikte zwischen Vue und D3 beim DOM-Zugriff.

```ts
function drawSparkline(): SVGSVGElement | null {
  const svg = d3.create("svg")
    .attr("class", "kpi-spark")
    // … Skalen, Linie, Achsen
  return svg.node()
}
```

---

# 9. Gestapeltes Flächendiagramm (StackedArea)

Das gestapelte Flächendiagramm im Tab „Strommix" zeigt die Entwicklung
des Erzeugungsmix über die Jahre 2015 bis 2024.

## Darstellung

Zehn Energieträger sind als übereinander gestapelte Flächen dargestellt.
Jeder Träger hat eine eigene Farbe. Die Breite der Fläche zeigt seinen
Anteil an der Gesamterzeugung. Der Betrachter sieht auf einen Blick, wie
sich der Mix verschiebt: Braunkohle und Kernenergie werden weniger, Wind
und Sonne werden mehr.

[Abbildung 4 hier einfügen: Gestapeltes Flächendiagramm im Prozentmodus]

## Zwei Modi

Das Diagramm kann in zwei Modi angezeigt werden:

- **Absolut**: Die Y-Achse zeigt Terawattstunden (TWh). Die Flächen
  sind in absoluten Werten gestapelt.
- **Prozent**: Die Y-Achse zeigt Prozent. Hier ist die relative
  Zusammensetzung des Strommix sichtbar, unabhängig von der
  Gesamterzeugungsmenge.

D3 bietet mit `d3.stack()` eine Funktion, die das Stapeln übernimmt. Für
den Prozentmodus wird `d3.stackOffsetExpand` verwendet, das die Werte
automatisch auf den Bereich 0 bis 1 normalisiert.

```ts
const stack = d3.stack<any>().keys(activeKeys)
  .value((d, key) => d[key] / (mode === 'absolute' ? 1000000 : 1000))
if (mode === 'percent') stack.offset(d3.stackOffsetExpand)
const stacked = stack(aggregated)
```

## Aggregation

Die 85.000 Stundenwerte werden vor der Darstellung aggregiert. Der Nutzer
kann zwischen Tag, Woche, Monat und Quartal wählen. Für die
Monatsansicht werden alle Stunden eines Monats summiert. Die Aggregation
verwendet die Berliner Lokalzeit, damit Monats- und Jahresgrenzen korrekt
sind.

## Interaktionen

- **Legende**: Klicken auf einen Energieträger blendet ihn aus oder ein.
  Hovern hebt ihn hervor.
- **Zoom**: Mit dem Mausrad kann in den Zeitraum gezoomt werden. Ein
  Chip-Button setzt den Zoom zurück.
- **Tooltip**: Beim Bewegen der Maus über das Diagramm zeigt ein Tooltip
  die genauen Werte pro Energieträger an. Im Prozentmodus werden die
  relativen Anteile gezeigt, im Absolutmodus die Terawattstunden.
- **Event-Marker**: Acht nummerierte Kreise unter der X-Achse markieren
  wichtige Ereignisse (Pariser Abkommen, Atomausstieg, Ukraine-Krieg
  usw.). Beim Hovern erscheint ein Tooltip mit Datum und Beschreibung.

## Datenlücken

Das Jahr 2018 hat ab Oktober eine Datenlücke durch den Wechsel des
ENTSO-E-Marktgebiets. Das Diagramm zeigt einen Warnhinweis, wenn der
sichtbare Zeitraum 2018 umfasst.

---

# 10. Scatterplot (ScatterAnalysis)

Der Scatterplot im Tab „Einflussfaktoren" untersucht den Zusammenhang
zwischen der CO₂-Intensität und verschiedenen Einflussfaktoren.

## Fragestellung

Die zentrale Frage ist: Was beeinflusst die CO₂-Intensität des deutschen
Stroms? Der Scatterplot erlaubt es, vier verschiedene Zusammenhänge zu
untersuchen:

- **EE-Anteil vs. CO₂**: Je höher der EE-Anteil, desto niedriger die
  CO₂-Intensität. Die erwartete negative Korrelation ist deutlich
  sichtbar.
- **Konventioneller Anteil vs. CO₂**: Die positive Korrelation zeigt,
  dass mehr konventionelle Erzeugung zu höheren Emissionen führt.
- **Stromnachfrage vs. CO₂**: Zeigt, ob hohe Nachfrage zu mehr
  fossilen Kraftwerken führt.
- **Strompreis vs. CO₂**: Untersucht den Zusammenhang zwischen Preis
  und CO₂-Intensität.

[Abbildung 5 hier einfügen: Scatterplot mit EE-Anteil auf der X-Achse]

## Aufbau

Jeder Punkt im Diagramm steht für eine Stunde (ca. 85.000 mögliche
Punkte). Die X-Achse wird durch die gewählte Metrik bestimmt, die Y-Achse
zeigt immer die CO₂-Intensität in g/kWh. Die Punkte sind nach Tageszeit
eingefärbt:

- Nacht (0–5 Uhr): Dunkelblau
- Morgen (6–9 Uhr): Orange
- Tag (10–17 Uhr): Gelb
- Abend (18–23 Uhr): Magenta

Diese Färbung macht sichtbar, dass die CO₂-Intensität nicht nur vom
EE-Anteil, sondern auch von der Tageszeit abhängt. Nachts ist der
EE-Anteil oft niedriger (keine Sonne), aber die Nachfrage auch.

## Zeitraum-Auswahl

Ein Range-Slider erlaubt die Auswahl eines beliebigen Zeitraums zwischen
2015 und 2024. Sechs Preset-Buttons (Alles, 2015/16, 2017/18, …)
ermöglichen schnelle Wechsel. Der Slider verwendet Monats-Schritte.

## Data-Join

Anders als bei den anderen Charts, die bei jeder Änderung komplett
neuzeichnen, verwendet der Scatterplot einen echten D3-Data-Join.
Wenn sich der Zeitraum ändert, werden nur die Punkte aktualisiert, die
hinzukommen oder wegfallen. Das ist performanter, weil der DOM nicht
komplett neu aufgebaut wird.

```ts
const circles = chart.selectAll('circle')
  .data(filteredPoints, (d: any) => d.id)

circles.join(
  enter => enter.append('circle').attr('r', 3),
  update => update,
  exit => exit.remove()
)
```

## Trendlinie

Eine lineare Regressionslinie zeigt den statistischen Zusammenhang. Das
Bestimmtheitsmaß R² wird im Diagramm angezeigt. Ein Wert von 0,94
bedeutet, dass 94 % der Varianz der CO₂-Intensität durch den EE-Anteil
erklärt werden können.

## Erklärzonen

In der Seitenleiste werden die zehn Prozent der Stunden mit dem
niedrigsten und höchsten EE-Anteil verglichen. Die Anzeige zeigt die
durchschnittliche CO₂-Intensität beider Gruppen und die Differenz. Das
macht die Aussagekraft des Zusammenhangs konkret fassbar.

---

*Die Kapitel 11 bis 15 folgen in der nächsten Ausgabe.*

---

# 11. Heatmap (HeatmapCO2)

Die Heatmap im Tab „Tagesmuster" zeigt die Verteilung einer Metrik über
Monate und Tagesstunden. Auf einen Blick wird sichtbar, zu welcher
Jahreszeit und zu welcher Uhrzeit bestimmte Werte typischerweise auftreten.

## Darstellung

Die Heatmap ist als 24 × 12-Raster aufgebaut:

- **X-Achse**: Monate (Januar bis Dezember)
- **Y-Achse**: Stunden (0 bis 23, Berliner Lokalzeit)
- **Farbe**: Intensität der gewählten Metrik

Jede Zelle zeigt den Durchschnittswert aller Stunden, die in diesen
Monat und diese Stunde fallen. Ein Jahr hat dafür 365 oder 366
Datenpunkte pro Stunde, über zehn Jahre sind es entsprechend 3650 oder
mehr.

[Abbildung 6 hier einfügen: Heatmap der CO₂-Intensität für 2024]

## Metriken

Vier Metriken stehen zur Auswahl:

1. **CO₂-Intensität** (g/kWh): Die Farbskala geht von hell nach braun.
   Sichtbar wird, dass die CO₂-Intensität nachts und im Winter höher
   ist.
2. **EE-Anteil** (%): Die Farbskala geht von hell nach grün. Mittags im
   Sommer ist der EE-Anteil am höchsten, weil die Sonne scheint.
3. **Konventioneller Anteil** (%): Die Farbskala geht von hell nach
   dunkel. Der konventionelle Anteil ist das Spiegelbild des EE-Anteils.
4. **Day-Ahead-Preis** (EUR/MWh): Eine divergierende Farbskala (blau →
   weiß → orange) zeigt negative Preise in Blau, positive in Orange.
   Die Skala ist fest auf −50 bis 300 EUR/MWh eingestellt, damit die
   Jahre vergleichbar bleiben.

## Skalierung

Die Heatmap kann in zwei Skalierungsmodi angezeigt werden:

- **Einheitlich**: Die Farbskala wird über den gesamten Zeitraum
  2015–2024 berechnet. Alle Jahre sind dadurch direkt vergleichbar.
- **Jährlich**: Die Farbskala wird pro Jahr berechnet. Das zeigt die
  Muster innerhalb eines Jahres deutlicher, macht aber den Vergleich
  zwischen Jahren schwieriger.

## Berechnung der Matrix

Für jede Kombination aus Monat und Stunde wird der Mittelwert aller
Stundenwerte berechnet. Die Funktion `computeMonthlyHeatmap` durchläuft
alle Stunden eines Jahres, ermittelt mit `getBerlinMonth()` und
`getBerlinHour()` den Monat und die Stunde und addiert den Wert zum
passenden Bucket.

```ts
function computeMonthlyHeatmap(rows, year, metric, months) {
  const result = Array.from({ length: 12 }, () => Array(24).fill(NaN))
  const counts = Array.from({ length: 12 }, () => Array(24).fill(0))
  for (const r of rows) {
    const y = getBerlinYear(r.timestamp)
    if (y !== year) continue
    const m = getBerlinMonth(r.timestamp) - 1
    if (!months.includes(m)) continue
    const h = getBerlinHour(r.timestamp)
    if (isNaN(result[m][h])) { result[m][h] = metric.value(r); counts[m][h] = 1 }
    else { result[m][h] += metric.value(r); counts[m][h]++ }
  }
  // Mittelwert pro Zelle
  for (let m = 0; m < 12; m++)
    for (let h = 0; h < 24; h++)
      if (counts[m][h] > 0) result[m][h] /= counts[m][h]
  return result
}
```

## Interaktionen

- **Hover**: Beim Überfahren einer Zelle zeigt ein Tooltip den
  genauen Wert, Monat und Stunde.
- **Klick**: Ein Klick auf eine Zelle wählt diesen Tag aus und
  schaltet zur Duck Curve, falls diese Metrik dort verfügbar ist.
- **Seitenleiste**: Zeigt die Extremwerte der aktuellen Metrik
  (Maximum, Minimum und größte Spannweite eines Monats).

---

# 12. Duck Curve (DuckCurve)

Die Duck Curve (Entenkurve) im Tab „Markt & Preise" zeigt den typischen
Tagesverlauf des deutschen Strommarkts. Die Bezeichnung kommt aus der
Energiewirtschaft und beschreibt den charakteristischen Verlauf der
Residuallast an Tagen mit hoher PV-Einspeisung.

## Darstellung

Das Diagramm zeigt vier Linien über 24 Stunden:

- **PV-Erzeugung** (gelb): Wie viel Solarstrom eingespeist wird.
  Mittags erreicht die Kurve ihren Höhepunkt.
- **Residuallast** (schwarz): Die verbleibende Last nach Abzug der
  erneuerbaren Erzeugung. Sie sinkt mittags (PV-Effekt) und steigt
  abends steil an.
- **Day-Ahead-Preis** (grün): Der Strompreis folgt oft der
  Residuallast. Bei negativen Preisen sinkt die Linie unter null.
- **CO₂-Intensität** (braun): Sie folgt ebenfalls der Residuallast,
  weil konventionelle Kraftwerke die Residuallast decken.

[Abbildung 7 hier einfügen: Duck Curve im Durchschnittsmodus]

## Berechnung der Residuallast

Die Residuallast wird aus den SMARD-Daten berechnet:

```ts
function residuallastGW(row: HourlyRow): number {
  const ee = wind_onshore + wind_offshore + pv + biomass + hydro
  return (row.load_mwh - ee) / 1000
}
```

Pumpspeicher werden weder bei den Erneuerbaren noch bei den
Konventionellen eingerechnet, da sie weder das eine noch das andere
sind.

## Modi

Der Nutzer kann verschiedene Zeiträume auswählen, über die gemittelt wird:

- **Durchschnitt**: Alle Stunden 2015–2024
- **Sommer**: Nur Juni bis August
- **Winter**: Nur Dezember bis Februar
- **Werktag**: Nur Montag bis Freitag
- **Wochenende**: Nur Samstag und Sonntag
- **2015** / **2024**: Nur das jeweilige Jahr

## Zeitregler

Unter dem Diagramm befindet sich ein Schieberegler, mit dem die
aktuelle Stunde ausgewählt wird. Fünf Preset-Buttons (03 Uhr Nacht,
08 Uhr Morgen, 13 Uhr PV-Peak, 18 Uhr Abendrampe, 22 Uhr Abend)
erlauben schnelle Sprünge zu typischen Tageszeiten.

## Vergleichsmodus

Der Vergleichsmodus aktiviert zwei unabhängige Regler (A und B). Die
KPI-Karten zeigen dann beide Werte sowie die Differenz zwischen ihnen.
Damit können beispielsweise die Mittagsstunde und die Abendstunde
direkt verglichen werden.

[Abbildung 8 hier einfügen: Duck Curve im Vergleichsmodus]

## Methodik-Text

Unter dem Diagramm befindet sich ein ausführlicher Methodik-Text, der
für jede Kennzahl erklärt:

- Datenquelle,
- zeitliche Auflösung,
- Berechnungsvorschrift,
- Aussagegrenzen (Durchschnittswerte, keine Einzelfälle).

Dieser Text ist direkt in der Komponente enthalten und wird im
Normalbetrieb immer angezeigt.

---

# 13. Tests und Qualitätssicherung

Das Projekt verfügt über drei Qualitätsstufen, die nacheinander
ausgeführt werden können.

## Stufe 1: Datenintegrität (Level 1)

Das Skript `scripts/checks/level1-integrity.ts` prüft die Rohdaten auf:

- Vollständigkeit der Zeitreihe (fehlende Stunden)
- Korrekte Stundenzahl pro Jahr (Schaltjahre: 8784 h, normale: 8760 h)
- Sommerzeit-Umstellungen
- Wertebereiche der Schlüsselfelder
- Summenkonsistenz zwischen Einzelwerten und Gesamtwerten

## Stufe 2: Unit-Tests (Level 2)

90 Unit-Tests in zwei Dateien prüfen die Berechnungslogik:

| Thema | Tests | Beschreibung |
|-------|-------|-------------|
| EE-Anteil | 4 | Prozentberechnung, Grenzfälle |
| Residuallast | 3 | Last − EE, 0-Werte |
| CO₂-Intensität | 5 | Erzeugungsgewichtete Berechnung |
| Perzentile | 4 | Untere/obere 10 % |
| Korrelation | 3 | Pearson-R |
| Regression | 4 | Steigung, R² |
| Delta-Formatierung | 4 | buildDeltaStr |
| Jahresaggregation | 3 | UTC-Jahr |
| Berliner Lokalzeit | 7 | DST, Jahreswechsel |
| KPI-Jahreswerte | 6 | Berlin-Jahr, Negativzählung |
| Aggregation | 4 | Durchschnitt, Summe |
| Fehlende Werte | 3 | null, NaN, leere Arrays |
| Prozentpunkte | 3 | Absolute Differenz |
| Filter | 4 | Jahr, Monat, Stunde |
| Division durch null | 4 | safeDivide |
| Vergleich 2015–2024 | 3 | EE, CO₂, Trend |
| Min/Max | 3 | Normale, negative, einzelne Werte |
| Trendlinie (OLS) | 5 | Steigung, R², Rauschen |
| Einheitenumrechnung | 4 | MWh→MW→GW |
| Chronologische Sortierung | 2 | Timestamps |
| Schaltjahre | 6 | 2000, 1900, 2024 |
| Konventioneller Anteil | 4 | Inkl. Kernenergie |
| CO₂-gewichteter Referenzwert | 2 | Einfacher vs. gewichteter MW |
| Filter Monat + Stunde | 2 | Kombinationsfilter |
| **Gesamt** | **90** | |

Tabelle 7: Testabdeckung nach Themen

Die Tests sind bewusst einfach gehalten. Sie arbeiten mit kleinen,
manuell nachrechenbaren Datensätzen. Jeder Test hat einen klaren Namen,
der die fachliche Absicht beschreibt.

```ts
it('40 GWh EE bei 100 GWh Gesamt → 40%', () => {
  const gen = { wind_onshore: 20, wind_offshore: 10, pv: 5, /* … */ }
  expect(calcEeShare(gen)).toBeCloseTo(40, 1)
})
```

[Abbildung 9 hier einfügen: Testergebnisse der 90 Tests]

## Stufe 3: Konsistenz (Level 3)

Das Skript `scripts/checks/level3-consistency.ts` vergleicht die Werte
im Dashboard mit den Rohdaten. Es prüft für jedes Jahr:

- EE-Anteil aus yearly_mix vs. Neuberechnung aus Stundendaten
- CO₂-Intensität aus yearly_mix vs. Neuberechnung aus Stundendaten
- Negativpreis-Stunden aus yearly_mix vs. Zählung aus Stundendaten

Die erlaubten Abweichungen sind sehr klein (0,1 Prozentpunkte beim
EE-Anteil, 0,5 g/kWh bei CO₂, 1 Stunde bei Negativpreisen).

---

# 14. Probleme und Korrekturen während der Entwicklung

Während der Entwicklung sind mehrere Fehler aufgetreten, die hier
dokumentiert sind. Die Auflistung folgt der Chronologie.

## Negative Preise wurden nicht erkannt

Der Regex zum Parsen der ENTSO-E-XML-Daten erkannte nur positive Zahlen:

```js
/<price\.amount>([\d.]+)<\/price\.amount>/
```

Das Minuszeichen vor negativen Preisen wurde nicht erfasst. Dadurch
fehlten etwa 1.900 Stunden mit negativen Preisen im Datensatz. Der Fix
ergänzte das optionale Minuszeichen:

```js
/<price\.amount>\s*([-+]?\d+(?:\.\d+)?)\s*<\/price\.amount>/
```

## Kernenergie wurde als fossil bezeichnet

In der Datenpipeline wurde Kernenergie in der else-Branch zusammen mit
fossilen Trägern klassifiziert. Die UI zeigte daher „Fossil-Anteil",
obwohl Kernenergie nicht fossil ist. Der Begriff wurde überall in
„Konventioneller Anteil" geändert, der Kernenergie korrekt einschließt.
Der interne Feldname `fossil_share` blieb aus Kompatibilitätsgründen
bestehen.

## Zeitzonen-Fehler in der Duck Curve

Die Duck Curve verwendete ursprünglich `getUTCHours()` zur Gruppierung
der Daten nach Stunden. Die Daten enthalten aber Berliner Lokalzeit, und
die Preset-Buttons beschreiben Berliner Stunden („13 Uhr PV-Peak").
Durch die Verwendung von UTC-Stunden verschoben sich die Tagesprofile im
Sommer um eine Stunde. Der Fix erstellte eine zentrale
Zeitzonen-Bibliothek `utils/berlin.ts` und stellte alle
Visualisierungen auf Berliner Zeit um.

## CO₂-Jahresmittel: Einfacher vs. gewichteter Durchschnitt

Die jährliche CO₂-Intensität wird als einfaches arithmetisches Mittel
der stündlichen CO₂-Intensitäten berechnet. Die stündlichen Werte
werden jedoch bereits erzeugungsgewichtet über die Emissionsfaktoren
der einzelnen Energieträger berechnet. Die Differenz zu einem
erzeugungsgewichteten Jahresmittel beträgt weniger als 5 Prozent und
ist als methodische Entscheidung dokumentiert.

## Tooltip im Prozentmodus

Der Tooltip des StackedArea-Diagramms zeigte im Prozentmodus absolute
Gigawattstunden (GWh) an, obwohl die Y-Achse Prozent anzeigte. Die
Prozentangaben im Tooltip waren korrekt, aber die Einheit „GWh" war
irreführend. Der Tooltip zeigt im Prozentmodus jetzt ausschließlich
Prozentanteile.

| Problem | Ursache | Fix |
|---------|---------|-----|
| Negative Preise ignoriert | Regex ohne Minus | `[-+]?` ergänzt |
| Kernenergie als fossil | Else-Branch ohne Ausnahme | Label auf „Konventioneller Anteil" |
| Duck Curve Stunden versetzt | `getUTCHours()` statt Berlin | `utils/berlin.ts` erstellt |
| CO₂-Jahresmittel | Einfacher MW statt gewichtet | Als Methode dokumentiert |
| Tooltip GWh im %-Modus | Einheit nicht an Modus angepasst | Tooltip zeigt jetzt % |

---

# 15. Grenzen des Projekts und Fazit

## Bekannte Grenzen

| Grenze | Auswirkung |
|--------|-----------|
| **2015 beginnt am 4. Januar** | Die SMARD-API liefert erst ab diesem Datum. Etwa 95 Stunden fehlen. |
| **2018-Datenlücke (Okt–Dez)** | Durch ENTSO-E-Marktgebietswechsel fehlen die Preisdaten. Ca. 25 % der Stunden fehlen in diesem Zeitraum. |
| **Keine Importe/Exporte** | Die Residuallast ignoriert den grenzüberschreitenden Stromhandel. |
| **CO₂-Jahresmittel nicht erzeugungsgewichtet** | Die jährliche CO₂-Intensität ist ein einfacher Mittelwert. Die Abweichung zum gewichteten Wert ist gering (< 5 %). |
| **Kein Service Worker / PWA** | Die App ist nach dem ersten Laden über den HTTP-Cache verfügbar, aber nicht als installierbare PWA. |
| **Durchschnittswerte in der Duck Curve** | Der Zeitregler zeigt gemittelte Tagesprofile, keine Einzeltage. Einzelne Tage weichen deutlich ab. |
| **Keine mobile Optimierung** | Die Charts sind für Bildschirmbreiten ab etwa 900 Pixeln optimiert. |

Tabelle 8: Bekannte Grenzen

## Fazit

Das Dashboard zeigt den Wandel des deutschen Strommarkts von 2015 bis
2024 auf einen Blick. Die Kombination aus vier Visualisierungen erlaubt
unterschiedliche Perspektiven: den zeitlichen Verlauf (StackedArea), die
Zusammenhänge (Scatterplot), die typischen Muster (Heatmap) und den
Tagesverlauf (Duck Curve).

Die Daten stammen aus offiziellen Quellen (SMARD, ENTSO-E, UBA) und
wurden in einer nachvollziehbaren Pipeline aufbereitet. Alle Berechnungen
sind durch 90 Unit-Tests abgesichert. Die Anwendung läuft vollständig
offline, benötigt keinen Server und kann direkt aus dem Build-Ordner
gestartet werden.

## Mögliche Erweiterungen

- **Importe und Exporte**: Die Einbeziehung des grenzüberschreitenden
  Stromhandels würde die Residuallast genauer machen.
- **Prognosedaten**: Ein Vergleich von Day-Ahead-Prognosen mit
  tatsächlichen Werten wäre fachlich interessant.
- **Einzeltag-Ansicht**: Die Duck Curve könnte auf einen konkreten Tag
  heruntergebrochen werden.
- **PWA**: Ein Service Worker würde die Installation als App
  ermöglichen.
- **Datenaktualisierung**: Ein Skript zur automatischen
  Datenaktualisierung würde das Dashboard langfristig aktuell halten.

---

# Quellenverzeichnis

## Datenquellen

- **SMARD – Strommarktdaten**: Bundesnetzagentur.
  https://www.smard.de/ [Letzter Zugriff: Juli 2026]
- **ENTSO-E Transparency Platform – Day-Ahead-Preise**: European
  Network of Transmission System Operators for Electricity.
  https://transparency.entsoe.eu/ [Letzter Zugriff: Juli 2026]
- **Umweltbundesamt – Emissionsfaktoren**: Emissionsfaktoren für
  Energieträger.
  https://www.umweltbundesamt.de/ [Letzter Zugriff: Juli 2026]

## Technische Dokumentationen

- **D3.js Dokumentation**. https://d3js.org/ [Letzter Zugriff: Juli 2026]
- **Nuxt 3 Dokumentation**. https://nuxt.com/docs [Letzter Zugriff: Juli 2026]
- **Vue 3 Dokumentation**. https://vuejs.org/ [Letzter Zugriff: Juli 2026]
- **MDN Web Docs – Intl.DateTimeFormat**.
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
  [Letzter Zugriff: Juli 2026]
- **TypeScript Dokumentation**. https://www.typescriptlang.org/docs/
  [Letzter Zugriff: Juli 2026]
- **Vitest Dokumentation**. https://vitest.dev/ [Letzter Zugriff: Juli 2026]

## Fachliteratur und Berichte

- **Singer, J. (2026)**: Visualisierung mit Type-/JavaScript und D3.
  Lehrskript. Hochschule Harz.
- **Bundesnetzagentur (2024)**: Monitoringbericht 2024.
  https://www.bundesnetzagentur.de/ [Letzter Zugriff: Juli 2026]
- **BMWK (2024)**: Erneuerbare Energien in Zahlen.
  Bundesministerium für Wirtschaft und Klimaschutz.
  https://www.bmwk.de/ [Letzter Zugriff: Juli 2026]
- **Agora Energiewende (2024)**: Die Energiewende in Deutschland:
  Stand der Dinge 2024. https://www.agora-energiewende.de/
  [Letzter Zugriff: Juli 2026]
- **IEA (2024)**: Electricity Market Report 2024.
  International Energy Agency. https://www.iea.org/ [Letzter Zugriff: Juli 2026]

---

# Anhang

## Vollständige Projektstruktur

```
data-vis/
├── pages/
│   ├── index.vue
│   └── dashboard.vue
├── components/
│   ├── dashboard/
│   │   ├── FilterBar.vue
│   │   ├── KpiCard.vue
│   │   ├── ExtremeValuesPanel.vue
│   │   └── StartEndComparison.vue
│   ├── viz/
│   │   ├── StackedArea.vue
│   │   ├── ScatterAnalysis.vue
│   │   ├── HeatmapCO2.vue
│   │   └── DuckCurve.vue
│   └── landing/
│       ├── BarbellChart.vue
│       └── …
├── composables/
│   ├── useData.ts
│   ├── useFilters.ts
│   ├── useExtremeValues.ts
│   ├── useLandingData.ts
│   └── useEnergyMixData.ts
├── utils/
│   ├── berlin.ts
│   └── aggregate.ts
├── scripts/
│   ├── build_hourly.ts
│   ├── build_yearly.ts
│   ├── download-smard.ts
│   ├── download-prices.ts
│   ├── validate-data.ts
│   └── checks/
│       ├── level1-integrity.ts
│       └── level3-consistency.ts
├── tests/
│   ├── calculations.test.ts
│   └── logic.test.ts
├── public/
│   └── data/
│       ├── hourly_2015_2024.json
│       ├── yearly_mix.json
│       └── emission_factors.json
├── docs/
│   ├── log.md
│   ├── offline-test.md
│   ├── perf-summary.md
│   └── performance-test.md
├── nuxt.config.ts
├── package.json
└── tsconfig.json
```

