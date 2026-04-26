# CHANGELOG

## v1.0 - 2026-04-19 - Initial release

### Data collection & fact-checking
Four parallel fact-check agents ran before any code was written. Each verified a cluster of layers against authoritative sources.

**Zoning (Family Zoning Plan 2025)**
- Confirmed adoption date (2025-12-12), effective date (2026-01-12).
- Corrected brief: "Van Ness 650 ft max" is select parcels only, not corridor-wide.
- Density-decontrol zones confirmed: Marina, Pacific Heights, Presidio Heights, Nob Hill, Russian Hill, Inner/Outer Richmond, Inner/Outer Sunset.
- Confirmed 85 ft base / 140 ft corner pattern on named corridors but flagged that street-by-street application varies.
- Neighborhood impact summary:
  - Bernal, Glen Park: minimal (only commercial strips)
  - Inner Sunset: significant (in decontrol zone)
  - NOPA, Noe Valley, Cole Valley, Hayes Valley: significant

**Seismic (liquefaction, faults, soft-story)**
- Confirmed Marina / SoMa / Mission Bay / waterfront as high liquefaction.
- Corrected brief: Richmond + Sunset are dune sand that is MOSTLY LOW liquefaction per CGS, not blanket-high. Isolated pockets flagged.
- San Andreas location verified: ~2-5 mi offshore from Ocean Beach.
- No Alquist-Priolo zones on SF mainland (brief implied there might be).
- Soft-story retrofit program: ~95%+ complete as of 2026 per DBI; cannot cite exact number without contacting DBI directly.

**Flood / transit / microclimate / historic**
- Glen Park flood risk corrected: NOT zero. Islais Creek culvert floods during atmospheric rivers.
- NASA 2023 InSAR subsidence data doubles effective SLR exposure for Bay-facing areas.
- Geary BRT is NOT yet complete; phase 2 construction 2026-2027.
- Central Subway extension is conceptual only with no funding.
- Article 10 districts confirmed, including Alamo Square (1984).

**Schools / crime / Vision Zero**
- GreatSchools ratings verified April 2026:
  - Alice Fong Yu: 10/10
  - Lincoln HS: 9/10
  - New Traditions: 9/10
  - Lowell: 9/10 (citywide)
  - Alvarado: 8/10
  - Clarendon: 8/10
  - Fairmount: ~6-7/10 (summary not explicit)
  - Jefferson: 6/10
  - John Muir: 6/10
  - Flynn: 4/10 (caveat: high ELL/immersion)
  - Glen Park Elementary: 4/10
  - Junipero Serra: ~2-3/10
  - Paul Revere: 2/10 (caveat: high ELL)
- 2025 crime stats: citywide Part I down ~25%, car break-ins at 22-year low (~8,500 reported), homicides lowest since 1960.
- Vision Zero 2024 HIN released March 2026, covers 13% of streets / 74% of severe crashes.
- Confirmed HIN corridors: Divisadero, Geary, Van Ness, 19th Ave, Sloat, Market, Mission, Folsom, Howard, 6th, Jones/Taylor/Leavenworth (Tenderloin), Turk, Eddy, Cesar Chavez, Alemany, San Jose, Third, Ocean, Lincoln Way, Fulton, Fell/Oak, plus 2024 additions (Fulton 4th-7th, Embarcadero Howard-Pier 40, Point Lobos).

### Implementation
- Downloaded SF Analysis Neighborhoods GeoJSON from DataSF (dataset j2bu-swwd), 41 features, simplified from 1.7 MB to 51 KB at 0.0005-degree Douglas-Peucker tolerance.
- Hand-curated 41 × 14 = 574-cell scoring matrix from authoritative sources.
- Encoded key spatial features inline:
  - 27 HIN corridor polylines (key segments)
  - 13 upzoned corridor polylines (Family Zoning Plan)
  - 6 Article 10 historic district polygons
  - 13 schools with GreatSchools ratings
  - 8 BART stations + 8 Muni Metro stations
  - 8 major construction projects
  - 3 future transit project polylines
- Built 14-layer toggle + 0-5 weight sliders.
- Built composite view with 5-bucket color scale.
- Built sweet-spot mode filter.
- Built side-by-side comparison table.
- Built Nominatim address search.
- Built detail drawer with per-neighborhood buyer take.
- Built keyboard shortcuts (1-9 layers, C compare, R reset, Esc close).
- Built URL hash state persistence for shareable views.
- Built mobile responsive bottom-sheet sidebar.
- Built welcome modal with family-buyer preset one-click.
- Built print stylesheet.
- Color palette: ColorBrewer-inspired 5-color risk scale (green-yellow-orange-red), color-blind-safe.

### Design
- Stripe / Linear aesthetic: system font (Inter), restrained palette, subtle transitions, information density without clutter.
- CartoDB Positron base map.
- Sticky sidebar header for orientation during scroll.
- Tabular-nums throughout for legible score comparison.

### v1.0 final audit pass
A skeptical-buyer audit agent read the code and scoring matrix. Fixed before ship:
- **Scoring convention bug**: previous `inverted` flag caused inverted layers (Transit, Microclimate, Commercial, FutureTransit) to be scored backward in both composite and sweet-spot. Verified scoring convention: `raw=1` always means "favorable for buyer" across all layers; removed the inversion math. Composite and sweet-spot now score correctly.
- **Drawer close button**: had no visible × character. Fixed.
- **Checkbox/label wiring**: `for="cb-..."` pointed to non-existent id. Added matching `id` to checkbox so label clicks toggle.
- **Marina soft-story**: scored 3; corrected to 2 (Marina housing is largely detached SFRs from 1920-30s, fewer mandatory-retrofit multi-unit buildings than Mission / Haight / WA).
- **Keyboard shortcut advertising**: `1-9` only covers 9 of 14 layers. Added `0` for layer 10, `Shift+1..5` (→ `!@#$%`) for 11-14, and `/` for search focus. Updated help text.
- **Focus/composite/sweetspot state collisions**: clicking any of the three now clears the active class on the other two.
- **URL hash round-trip for focus layer**: after load, the matching `.layer-focus-btn` now gets `.active` class.
- **Welcome modal CTA for skip**: no change (kept simple; `R` still available to reset to default preset).

### Known gaps vs. brief
- **Block-level resolution not implemented.** Data is at Analysis Neighborhood level (41 polygons). Some layers (soft-story, zoning) have block-level data available via DataSF but would require a much larger embedded dataset. The in-app UX directs users to the source systems for per-property verification.
- **Crime heatmap not implemented.** Neighborhood-level categorical scoring only. SFPD incident data is at point level but aggregating ~200K incidents to a heatmap would break the 3 MB budget. Trade-off was made in favor of file size.
- **PDF export and dark mode** are listed as nice-to-haves in the brief and are not implemented in v1.0.
