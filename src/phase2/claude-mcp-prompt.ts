export const CLAUDE_MCP_PARCEL_LINK_PLACEHOLDER = "{{PASTE_LAND_INSIGHTS_PARCEL_LINK_HERE}}";

export const CLAUDE_MCP_CAPTURE_PROMPT = `You are helping test the DewClaw CompTool MCP lab.

Your job is to visually inspect a Land Insights parcel and return structured source data for our dashboard.

Parcel link:
${CLAUDE_MCP_PARCEL_LINK_PLACEHOLDER}

Critical rules:
- Return raw JSON only.
- Do not wrap the JSON in markdown fences.
- Do not include commentary before or after the JSON.
- Do not use Land Insights AI comp / AI pricing numbers as market value.
- Land Insights parcel fields, map layers, MLS comp rows, MLS comp photos, and comp detail popups may be used as factual/visual evidence.
- Treat Redfin/Zillow as fallback or bonus evidence. Start with Land Insights Data Platform + MLS comp photos first.
- Do not assume any MLS comp is a clean market anchor. Classify it by evidence quality and visual similarity.
- If a field is not visible, use an empty string.
- If something is visually unclear, mark it as unclear and explain it in diagnostics or visualRisks.
- Do not invent exact numbers that are not visible.
- Prefer captured facts over assumptions.

Browser workflow:
1. Open the parcel link.
2. If Land Insights asks for login, stop and say so in diagnostics inside the JSON.
3. Capture visible Property & Ownership fields.
4. Open or inspect the Data Platform/map view if available.
5. Configure the Data Platform map layers:
   - All hazards: ON / checked.
   - Standard Due Diligence: ON / checked.
   - MLS Data: ON.
   - MLS Comps: ON / checked.
   - Acreage Range Mode: Auto.
   - If enough nearby comp evidence appears, keep the range tight around subject acreage and inspect both smaller/larger comps as floor/ceiling context.
   - If the comp pool is thin, expand acreage range roughly 80% to 150% and record that expansion in diagnostics.
6. Visually classify the subject parcel:
   - areaType: rural, suburban, urban, or unclear
   - terrainType: flat, sloped, mixed, or unclear
   - structureSignal: present, not_obvious, or unclear
   - accessOrFrontageSignal: present, not_obvious, or unclear
7. Inspect map context for access/frontage, parcel shape, structures, wooded vs pasture/cleared land, slope/topography clues, flood/wetlands clues, hazard overlays, flood/wetland overlays, and nearby development.
8. Click nearby MLS comp properties directly inside Land Insights. Inspect the comp popup/report and any available MLS photos before using the comp.
9. For each useful Land Insights MLS comp, capture price, acreage, PPA, status, DOM, source link if visible, photo observations, and why it is useful.
10. If Land Insights MLS photos/details are enough, do not force Redfin/Zillow. If they are missing or unclear, then use APN/address/listing link to inspect Redfin/Zillow as fallback.
11. For every Land Insights MLS, Redfin, Zillow, or original listing evidence item you inspect, decide match quality:
    - confirmed_match: APN/address/map/acreage strongly matches the subject.
    - possible_match: some details match, but not enough to rely on it.
    - rejected_match: does not appear to be the subject or useful comp evidence.
12. Use photos only as visual/property evidence: wooded vs cleared, pasture, driveway, road access, utility poles/meters, structures, build pad, slope, nearby homes/commercial context, water/creek quality, and signs of active use.
13. Classify each comp as one of: anchor, price_floor, price_ceiling, weak_context, unrelated. Family transfers, quit claims, landlocked cases, acreage discrepancies, or major-issue comps are not automatically bad; keep them if they help define a floor/ceiling/context.
14. If comparable rows or original listing links are visible, capture them.
15. Do not make a final DewClaw valuation here. Return source JSON only.
16. Record a concise navigationLog and diagnostics, including which map layers were enabled and whether acreage range was Auto/tight/expanded.

Return exactly this JSON shape:
{
  "schemaVersion": "claude-mcp-li-table-v1",
  "source": "claude_mcp",
  "capturedAt": "CURRENT_ISO_TIMESTAMP",
  "parcelLink": "",
  "compReportUrl": "",
  "dataPlatformUrl": "",
  "pageTitle": "Land Insights",
  "fields": {
    "apn": "",
    "owner": "",
    "acreage": "",
    "county": "",
    "state": "",
    "ownerMailingAddress": "",
    "address": "",
    "landLocked": "",
    "roadFrontage": "",
    "wetlands": "",
    "floodZone": "",
    "hoa": "",
    "hasStructure": "",
    "currentLandUse": "",
    "ownershipLength": "",
    "relationToProperty": "",
    "lastPurchasePrice": "",
    "lastPurchaseDate": "",
    "lastPurchaseType": "",
    "deedType": "",
    "gps": "",
    "zoning": "",
    "propertyTax": "",
    "taxDelinquentFor": "",
    "inHoa": "",
    "familyTransfer": "",
    "structures": "",
    "structureCount": "",
    "structureYearBuilt": "",
    "mobileHome": "",
    "assessedValue": "",
    "assessedLandValue": "",
    "assessedImprovementValue": ""
  },
  "fieldCaptures": [
    {
      "key": "apn",
      "label": "APN",
      "value": "",
      "status": "captured",
      "sourceTab": "property_ownership",
      "confidence": "high",
      "notes": ""
    }
  ],
  "comparableRows": [
    {
      "city": "",
      "price": "",
      "acreage": "",
      "pricePerAcre": "",
      "daysOnMarket": "",
      "zip": "",
      "extraMetric": "",
      "status": "",
      "listingUrl": "",
      "source": "unknown",
      "rawCells": []
    }
  ],
  "listingLinks": [],
  "externalListingEvidence": [
    {
      "source": "landinsights_mls",
      "url": "",
      "searchQuery": "",
      "matchQuality": "possible_match",
      "compRole": "weak_context",
      "matchedSignals": [],
      "photoObservations": [],
      "listingFacts": [],
      "risks": []
    }
  ],
  "visualClassification": {
    "areaType": "unclear",
    "terrainType": "unclear",
    "structureSignal": "unclear",
    "accessOrFrontageSignal": "unclear",
    "confidence": "low",
    "visualRisks": [],
    "verifyNext": []
  },
  "navigationLog": [],
  "diagnostics": [],
  "rawObservationNotes": ""
}

Allowed fieldCapture values:
- status: captured, missing, unclear
- sourceTab: property_ownership, market_insights, slope_insights, deep_ai_analysis, data_platform, landinsights_mls, listing_page, manual_note, unknown
- confidence: low, medium, high

Allowed externalListingEvidence values:
- source: landinsights_mls, redfin, zillow, realtor, unknown
- matchQuality: confirmed_match, possible_match, rejected_match
- compRole: anchor, price_floor, price_ceiling, weak_context, unrelated

Important:
- The fields object should contain the best clean value for each visible field.
- fieldCaptures should show where important values came from.
- comparableRows can be empty if no comps are visible.
- listingLinks can be empty if no listing URLs are visible.
- externalListingEvidence should prioritize inspected Land Insights MLS comp photo/detail evidence. It can be empty only if no useful comp detail/photos are visible.
- rawObservationNotes should be short, practical, and useful for land comping.`;

export function buildClaudeMcpCapturePrompt(parcelLink?: string) {
  const cleanParcelLink = parcelLink?.trim();

  if (!cleanParcelLink) {
    return CLAUDE_MCP_CAPTURE_PROMPT;
  }

  return CLAUDE_MCP_CAPTURE_PROMPT.replace(CLAUDE_MCP_PARCEL_LINK_PLACEHOLDER, cleanParcelLink);
}
