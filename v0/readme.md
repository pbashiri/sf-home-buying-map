# SF Homebuyer Map (v0)

## TL;DR
An SF-specific decision tool that answers one question at any block: **what should I look out for here?**

Not a scorecard. It shows real hazard geometry from authoritative sources (CGS liquefaction polygons, SF Planning upzoned corridors, FEMA/NOAA flood, SFMTA Vision Zero HIN) and, on any click, lists the concerns specific to that point — with a source and a concrete action item.

Single file. Open `sf-neighborhood-risk-map.html` in any browser.

**Shortlist**: NOPA, Cole Valley, Hayes Valley, Dolores (Mission Dolores), Corona Heights, Noe Valley, Duboce Triangle, and **321 Church St** specifically.

## What's different from v1

You said the v1 felt basic. v2 is a rewrite:

- **8 layers, not 14.** Upzoning, liquefaction, flood, soft-story, schools, safety (crime + HIN combined), walk+transit, fog.
- **"What to look out for" instead of Low/Medium/High chips.** Click any point — get a list of Alerts / Watch for / In favor / Context cards, each with a source and an action item.
- **Real hazard geometry, not rectangles.** CGS 2000 regulatory liquefaction zones (349 polygons unioned to ~82 KB), hand-encoded flood / SLR zones (Marina fill, Mission Bay, Embarcadero, Hunters Point, Treasure Island, Mission Creek pluvial, Islais Creek culvert).
- **Upzoned corridors shown as actual streets** — dashed purple weighted by max height, plus density-decontrol neighborhoods shaded lightly. Proximity to corridor (in meters) determines whether you see a "fronting" alert or a "within 200 m" watch.
- **Editorial aesthetic.** Inter + Newsreader serif, paper off-white background, desaturated earthy palette (terracotta for seismic, steel blue for flood, violet for zoning, amber for soft-story, muted red for safety, forest green for schools, teal for transit, slate for fog).

## The 8 layers

| # | Layer | What you see | Source |
|---|---|---|---|
| 1 | **Upzoning exposure** | Dashed purple corridors (weighted by max height), light purple shading on density-decontrol neighborhoods | SF Planning Family Zoning Plan (adopted 2025-12-12, effective 2026-01-12) |
| 2 | **Seismic hazard zones** | Terracotta polygons | CGS Seismic Hazard Zone Map (statewide regulatory) |
| 3 | **Flood & SLR** | Blue polygons, scaled by severity | FEMA + NOAA SLR + SF Planning + Islais/Mission Creek knowledge |
| 4 | **Soft-story density** | Amber neighborhood shading | DataSF Soft-Story Properties |
| 5 | **Schools** | Circle markers, colored by GreatSchools rating | GreatSchools (April 2026) |
| 6 | **Safety** | Red HIN polylines + muted red crime shading | SFPD 2025 + SFMTA Vision Zero 2024 HIN |
| 7 | **Walk + transit** | Teal BART stations with 800 m walk circle + Muni Metro dots | BART + SFMTA |
| 8 | **Fog belt** | Slate gradient west→east | UC Berkeley microclimate literature |

## Using it

### Click anywhere
The map's primary interaction is **click a point → get concerns**. The drawer that opens tells you:
- **Alerts** (red) — real hazards at that exact spot
- **Watch for** (amber) — nearby concerns worth asking about in diligence
- **In favor** (green) — what's working for you here
- **Context** (gray) — informational

Each concern has a source link + a concrete action ("require geotechnical report", "plan routes avoiding this HIN corridor", "price in flood insurance").

### Shortlist shortcuts
Sidebar has an 8-item list. Click any to fly to that area + open the drawer with concerns for that location. Pressing `1`-`8` toggles layers.

### Compare
Press `C` to open a side-by-side grid of up to 4 shortlist locations. Every cell is colored by severity — you can immediately see, say, "NOPA has 2 alerts on upzoning, Cole Valley has 0".

### Search
Press `/`. Then type an SF address, a neighborhood name, or a shortlist item. Nominatim handles the geocoding (no API key).

## What the concerns actually compute

At any clicked lat/lng, the tool:

1. **Point-in-polygon test** against CGS liquefaction MultiPolygon. Hit = Alert.
2. **Point-in-polygon test** against each flood zone. Hit = Alert or Watch based on severity.
3. **Distance to upzoned corridor polyline**. Under 75 m = Alert, under 200 m = Watch. Density-decontrol neighborhood = lighter Watch.
4. **Point-in-polygon test** against soft-story neighborhood tier.
5. **Point-in-polygon test** against crime tier; distance to HIN polyline under 100 m = Watch.
6. **Distance to nearest BART station**; under 800 m = Favor, 800-1600 m = Neutral, more = Watch. Same for Muni at 400 m.
7. **Distance to nearest school by rating**. Rating ≥ 8 within 1200 m = Favor.
8. **Longitude check** for fog belt band.

All distances are great-circle (haversine). Polyline distance uses segment-projection in a local planar approximation.

## Key decisions & caveats

- **Soft-story is per-building, not per-block.** The neighborhood-tier layer tells you whether the surrounding stock is risky, but for an actual purchase decision the building-specific DataSF record is the source of truth. Always check it.
- **Liquefaction zones are regulatory as of 2000-11-17.** They don't update automatically. For a specific parcel, the CGS EQ Zapp is the live source.
- **Flood polygons are hand-encoded approximations** of the well-known exposure areas (Marina / Mission Bay / Embarcadero / Hunters Point / TI / Mission Creek / Islais Creek). For a specific address, FEMA's MSC tool is the authoritative source.
- **Upzoning corridor proximity thresholds are heuristic** (75 m = "fronting", 200 m = "near"). SF blocks are ~110 m, so 75 m roughly = on or across the street, 200 m = a block and a half out.
- **School ratings are summary-only** (GreatSchools stopped exposing sub-ratings consistently). Visit schools. Especially Flynn (4/10) and Paul Revere (2/10) — both heavy dual-immersion / ELL, and ratings badly misrepresent the English-native experience.

## 321 Church St — what the tool tells you

Click the black pill at the 321 Church St location (or press the welcome modal's CTA):

- **Duboce Triangle**, at 14th / Church.
- **Outside liquefaction zone** (bedrock Franciscan Complex uphill).
- **Outside FEMA SFHA, outside Mission Creek pluvial zone.**
- **~100 m from Church St upzoned corridor** (85 ft base) — Watch: expect future construction along Church St frontage nearby.
- **~50 m from Church Muni Metro** — Favor: J Church surface stop.
- **Closest BART: 16th St Mission at ~850 m** — Neutral.
- **Nearest good school: Harvey Milk / McKinley (5/10) within walking distance.** New Traditions 9/10 is further.
- **Moderate soft-story density** (Castro/Upper Market tier) — verify the specific building's retrofit status in DataSF before bidding.
- **East of fog shadow** — Favor: sunny.

Use `Compare` after to weigh it side by side against NOPA, Cole, Hayes, Noe.

## Sources (live)

- SF Planning Family Zoning Plan — [sfplanning.org/sf-family-zoning-plan](https://sfplanning.org/sf-family-zoning-plan)
- CGS Seismic Hazard Zones — [maps.conservation.ca.gov/cgs/informationwarehouse/eqzapp](https://maps.conservation.ca.gov/cgs/informationwarehouse/eqzapp/)
- DataSF Soft-Story map — [jwdp-cqyc](https://data.sfgov.org/Housing-and-Buildings/Map-of-Soft-Story-Properties/jwdp-cqyc)
- SF Planning Combined Flood Map — [sfplanninggis.org/floodmap](https://sfplanninggis.org/floodmap/)
- FEMA MSC — [msc.fema.gov](https://msc.fema.gov/)
- NOAA SLR — [coast.noaa.gov/slr](https://coast.noaa.gov/slr/)
- SFMTA Vision Zero 2024 HIN — [sf.gov/2024-high-injury-network-hin-map](https://www.sf.gov/2024-high-injury-network-hin-map)
- SFPD Crime Dashboard — [sanfranciscopolice.org/stay-safe/crime-data/crime-dashboard](https://www.sanfranciscopolice.org/stay-safe/crime-data/crime-dashboard)
- GreatSchools — [greatschools.org/california/san-francisco](https://www.greatschools.org/california/san-francisco/)
- BART Stations — [bart.gov/stations](https://www.bart.gov/stations)
- SFMTA Muni Metro — [sfmta.com/maps/muni-metro-map](https://www.sfmta.com/maps/muni-metro-map)

## Disclaimer

For informational purposes only. Verify with licensed professionals (structural engineer, real-estate attorney, insurance broker) before any purchase decision. Does not constitute real estate, legal, seismic, or financial advice.
