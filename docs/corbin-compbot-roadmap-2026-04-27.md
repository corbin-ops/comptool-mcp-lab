# Corbin CompBot Roadmap Notes - 2026-04-27

## Source

These notes summarize the April 27, 2026 working discussion between Jow and Corbin about the next CompTool V2 / CompBot direction.

## Product Direction

The preferred workflow is extension-first, not API-first.

1. Salesperson opens the live Land Insights parcel or comp report page.
2. Salesperson clicks the Chrome extension.
3. Extension captures the same parcel fields, comp rows, listing links, and visible page context the salesperson sees.
4. V2 turns that browser capture into a DewClaw comp request.
5. AI produces a V1-style dashboard result with decision, market value, offer posture, risks, verification needs, and caller output.

This avoids waiting for formal Land Insights API access while keeping the workflow simple for salespeople.

## Current Map Strategy

Mapbox is still a strong long-term option because Land Insights appears to use a Mapbox-style map experience. The likely future service is Mapbox GL JS with a satellite/streets style.

For the MVP, keep the free map path:

- OpenLayers for the map UI.
- USGS imagery/topo tiles for basemap.
- Captured GPS for subject parcel marker.
- Optional KML for exact parcel boundary.
- Captured comp distances for an approximate comp-radius overlay.

Mapbox should only be added after the team can create the account and track usage/cost. Expected free tier discussion was roughly 50,000 map loads/month, but actual billing should be verified inside the Mapbox account before production use.

## CompBot Training Direction

Corbin wants the comping bot to become a major long-term system, not just a simple prompt wrapper.

Key points:

- Corbin will spend more time teaching the team how he comps.
- Jow needs deeper comping context so product decisions match actual land-investor judgment.
- Corbin plans to produce around 100 detailed comp examples.
- Each example should explain what he looked at, what mattered, what he ignored, the valuation logic, the offer logic, and the final decision.
- These examples should become a training/evaluation corpus for the AI workflow.

The highest-value training data is not just final comp output. It is the reasoning trace behind the decision.

## Regulation Corpus Direction

Corbin is gathering statewide, county, and township subdivision rules.

The desired organization is hierarchical:

```text
state/
  county/
    township/
      subdivision-rules
      zoning-rules
      notes
      source-links
```

This regulation corpus should eventually support:

- subdivision go/no-go checks
- county-specific and township-specific split rules
- market selection
- subdivision marketing assumptions
- normal flip analysis when subdivision potential is detected
- value-add analysis when a seller rejects the standard 50% offer

The system should not treat regulation data as generic context. It should retrieve by state, county, and township when those fields are known.

## Near-Term Requirements

### Extension Intake

- Keep improving browser capture from Land Insights.
- Make the extension result flow easy enough for nontechnical salespeople.
- Chrome Web Store publishing remains the cleaner distribution path after the extension stabilizes.

### Map Panel

- Keep the free OpenLayers + USGS map as the MVP default.
- Show subject parcel marker from GPS.
- Show KML boundary when available.
- Make the UI clear that no KML means no exact boundary.
- Consider Mapbox later if the team wants a Land Insights-like map layer and accepts usage billing.

### Annotated Comp Examples

Create a repeatable format for Corbin's 100 example comps:

```text
Property:
County/state:
Acreage:
Property type:
Seller ask:
Relevant Land Insights fields:
Visual/map observations:
Comps considered:
Comps rejected and why:
Primary anchor comp:
Adjustments:
Market value:
Offer strategy:
Top risks:
Decision:
What the bot should learn:
```

### Regulation Imports

Create a future import path for regulation docs:

```text
data/regulations/<state>/<county>/<township>/
```

Each regulation file should preserve source URL, jurisdiction, effective date if known, and whether the rule applies to subdivision, zoning, access/frontage, perc/septic, minimum lot size, or road requirements.

## Open Product Questions

- Should Mapbox become a paid production dependency, or should the free OpenLayers map remain the default?
- What is the expected monthly number of salespeople and map loads?
- Where will the regulation corpus live long-term: repo, Render disk, object storage, or database?
- What review workflow should Corbin use to approve or correct the bot's comp output?
- Should annotated comp examples be stored as JSON, markdown, or both?

## Implementation Priority

1. Stabilize extension capture and result dashboard.
2. Make map panel reliable without paid API dependency.
3. Define the annotated comp example format.
4. Build a regulation-corpus import structure.
5. Add retrieval routing by state/county/township.
6. Add feedback/review tooling so Corbin's corrections improve future outputs.
