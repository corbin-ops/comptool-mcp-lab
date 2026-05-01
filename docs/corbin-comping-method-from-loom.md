# Corbin Comping Method From Loom

Source transcript: `C:\Users\JOW\Documents\New project\loom_transcript.md`

Purpose: convert Corbin's demonstrated manual comping workflow into rules for the Claude MCP lab.

## Core Principle

Do not trust Land Insights comp numbers as final market value.

Use Land Insights as a navigation/source layer, then inspect original listings, maps, photos, APN, acreage, access, terrain, and market behavior.

## Manual Comp Workflow

1. Start with Land Insights comp filters.
   - Typical range: 50% to 100% of subject size.
   - Expand to 75%, 100%, or 150% if too few useful comps exist.
   - Manual acreage range example from Loom: 6 to 20 acres.

2. Keep required map/listing toggles on.
   - AI must be able to visually compare parcel shapes, acreage, terrain, listings, and map layers.

3. Open the original listing for every potential comp.
   - Do not rely only on Land Insights table values.
   - Open Zillow/Redfin/Realtor/original listing when available.
   - Pull APN/tax ID when possible.

4. Reject off-market listings for market value.
   - Off-market sales are not reliable market value.
   - They may reflect discounts, private relationships, bad data, or non-market transfers.
   - They can show demand, but should not anchor value.

5. Verify acreage.
   - Deeded acreage can be wrong or misleading.
   - Compare calculated acreage, parcel map, shape, and surrounding parcels.
   - If deeded vs calculated acreage conflicts, flag it for human review.

6. Locate the exact parcel on the map.
   - Use APN/county lookup when possible.
   - Confirm the listing marker actually corresponds to the parcel.
   - Land Insights/listing marker placement can be wrong.

7. Classify comp quality.
   - Cleared lots are worth more than wooded lots.
   - Cleared lots with tractor work, water meter, electric hookup, driveway, or build pad are superior.
   - Subject property should be discounted if it is skinnier, harder to access, wooded, sloped, or requires a long road/driveway.

8. Evaluate access and shape.
   - Road frontage matters heavily.
   - Flagpole / skinny access parcels are less convenient and usually lower value.
   - If an entrance appears visible, note it but do not assume full driveway/access quality.

9. Evaluate terrain and buildability.
   - Slope lines/topography matter.
   - High-voltage powerlines reduce value.
   - Powerline setbacks can reduce buildable area.
   - Flood zones, creeks, cemeteries, churches/buildings, or unusual improvements can make a comp weird or less usable.

10. Use active listings carefully.
    - Active listings are often higher than eventual sold price.
    - A listing that dropped from high active price to lower sold price shows negotiation/market reality.
    - Active listings help define ceiling, not final value.

11. Build ceiling, floor, and similar-comp range.
    - Nicer cleared/access-friendly comps define the ceiling.
    - Worse or contaminated comps define lower anchors.
    - Most similar comps get the most weight.
    - Outliers do not make the truth.

12. Adjust price per acre by size.
    - Smaller lots usually sell for higher price per acre.
    - Bigger lots usually sell for lower price per acre.

13. Final valuation is a range.
    - In the Loom example, Corbin narrowed a difficult property to roughly $14k to $15k per acre.
    - If 10 acres, that implies roughly $140k to $150k market value.
    - He would still get two realtor opinions for extra validation.

## Claude MCP Required Behaviors

Claude MCP should:

- Navigate original listings, not just Land Insights rows.
- Determine whether a comp is on-market, sold, active, pending, or off-market.
- Discard off-market comps from market-value anchoring.
- Pull/verify APN when possible.
- Check whether acreage is deeded, calculated, or conflicting.
- Visually inspect parcel shape, access, terrain, powerlines, flood zone, and structures.
- Compare subject property quality against each comp.
- Label each comp as:
  - `reject_off_market`
  - `ceiling`
  - `floor`
  - `similar_anchor`
  - `outlier`
  - `needs_review`
- Explain why each comp was kept or rejected.
- Return a range, not false precision.

## Do Not Let AI Do This

- Do not average all comps blindly.
- Do not treat off-market sales as market value.
- Do not trust listing acreage without checking parcel/APN context.
- Do not use a comp with buildings/structures as clean vacant land unless explicitly adjusted.
- Do not assume public water/electric is connected just because it is available nearby.
- Do not ignore access, parcel shape, or terrain.

## Suggested MCP Output Additions

Add these after the basic LI table return structure is stable:

```json
{
  "compReasoning": {
    "acceptedComps": [],
    "rejectedComps": [],
    "ceilingComps": [],
    "floorComps": [],
    "similarAnchorComps": [],
    "acreageConflicts": [],
    "subjectAdjustments": [],
    "estimatedPpaRange": {
      "low": "",
      "high": "",
      "recommended": ""
    },
    "confidence": "low",
    "realtorOpinionRecommended": true
  }
}
```

