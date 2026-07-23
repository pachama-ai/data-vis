# Datenvalidierung

Dieses Dokument beschreibt die Datenquellen, Verarbeitungsschritte und
Prüfergebnisse des Projekts.

## Datenfluss

```
SMARD (Bundesnetzagentur)   →   public/data/smard.json
                                     ↓
                              scripts/build-data.ts
                                     ↓
                         public/data/visualization-data.json
                                     ↓
                    ┌────────────────┼────────────────┐
                    ↓                ↓                ↓
           pages/index.vue   components/generation/  components/emissions/
           GroupedBarChart    StackedAreaChart       DeviationChart
```

## Datensätze

| Datensatz | Quelle | Abgrenzung | Einheit | Zeitraum |
|---|---|---|---|---|
| `smard.json` | SMARD API | Öffentliche Nettostromerzeugung, Deutschland | MWh (stündlich) | 2015-01 – 2024-12 |
| `visualization-data.json` | build-data.ts | Öffentliche Nettostromerzeugung, Deutschland | MWh (monatlich/jährlich) | 2015 – 2024 |
| `emission-factors.json` | UBA Climate Change 16/2026 | Direkte CO₂-Emissionen | g CO₂/kWh | 2026 |
| `yearly_mix.json` | build-data.ts | Öffentliche Nettostromerzeugung | MWh (jährlich) | 2015 – 2024 |

## Datenabgrenzung

- **Öffentliche Nettostromerzeugung** – entspricht SMARD-Definition
- **10 ausgewählte Energieträger** – die öffentliche Nettostromerzeugung
  wird nicht vollständig abgebildet; kleinere Kategorien wie sonstige
  erneuerbare Energien und Pumpspeicher sind nicht einzeln aufgeführt.
- **Deshalb ergeben die dargestellten Anteile rund 97–98 % der gesamten
  öffentlichen Nettostromerzeugung.**
- **Direkte CO₂-Emissionen** – keine Lebenszyklusemissionen. Erneuerbare
  und Kernenergie haben in dieser Bilanz 0 g/kWh.

## Formeln

### Jahressumme
```
Summe aller Monatswerte (MWh) → yearlyMix.totalGenerationMwh
```

### Erzeugungsanteil
```
Anteil (%) = sourceValue / totalGeneration × 100
```

### Emissionen je Energieträger
```
Emissionen (Mt CO₂) = Erzeugung (TWh) × Emissionsfaktor (g/kWh) / 1000
```
Herleitung:
- 1 TWh = 10⁹ kWh
- Emissionen in Gramm = TWh × 10⁹ × g/kWh
- 1 Mt = 10¹² g
- Emissionen in Mt = TWh × 10⁹ × g/kWh / 10¹² = TWh × g/kWh / 1000

### Emissionsanteil
```
Emissionsanteil (%) = Emissionen des Trägers / Gesamtemissionen × 100
```

### Abweichung (Prozentpunkte)
```
Abweichung (pp) = Emissionsanteil − Erzeugungsanteil
```

### Strommix-Emissionsfaktor
```
g CO₂/kWh = Gesamtemissionen (Mt) / Gesamterzeugung (TWh) × 1000
```

## Emissionsfaktoren

| Energieträger | g CO₂/kWh | Quelle |
|---|---|---|
| Braunkohle | 1100 | UBA |
| Steinkohle | 900 | UBA |
| Erdgas | 430 | UBA |
| Kernenergie | 0 | Direkte Emissionen |
| Erneuerbare | 0 | Direkte Emissionen |
| Sonstige Konventionelle | 700 | UBA-basiert |

Alle Faktoren bilden direkte CO₂-Emissionen ab (ohne Vorketten).

## Quellenvergleich

| Jahr | Projektwert CO₂ g/kWh | UBA-Wert | Anmerkung |
|---|---|---|---|
| 2024 | ca. 350–400 | ca. 330–370 | UBA bezieht sich auf Stromverbrauch, Projekt auf öffentliche Nettostromerzeugung |

Abweichungen sind methodisch begründet: unterschiedliche Bezugsgröße
(Erzeugung vs. Verbrauch) und leicht abweichende Emissionsfaktoren.

## Datenqualität

- Alle Monate 2015-01 bis 2024-12 vorhanden (120 Monate)
- Alle 10 Energieträger pro Monat vorhanden
- Kernenergie ab Mai 2023 korrekt auf null
- Keine negativen Erzeugungswerte
- Keine doppelten Monate
- Sommerzeitumstellung korrekt behandelt (März 23h, Oktober 25h)

## Bekannte Einschränkungen

1. Die 10 dargestellten Energieträger decken nicht die gesamte
   öffentliche Nettostromerzeugung ab (ca. 97–98 %).
2. Emissionsfaktoren sind modellhaft und können von aktuellen
   UBA-Werten abweichen.
3. Der Strommix-Emissionsfaktor bezieht sich auf die öffentliche
   Nettostromerzeugung, nicht auf den tatsächlichen Stromverbrauch.
