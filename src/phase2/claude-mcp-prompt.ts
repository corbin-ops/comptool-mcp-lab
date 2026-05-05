export const CLAUDE_MCP_CAPTURE_PROMPT = `You are helping test the DewClaw CompTool MCP lab.

Your job is to visually inspect a Land Insights parcel and return structured source data for our dashboard.

Parcel link:
{{PASTE_LAND_INSIGHTS_PARCEL_LINK_HERE}}

Critical rules:
- Return raw JSON only.
- Do not wrap the JSON in markdown fences.
- Do not include commentary before or after the JSON.
- Do not use Land Insights AI comp / AI pricing numbers as market value.
- Use Land Insights only as a source/navigation layer.
- After capturing the APN, use it to search Redfin and/or Zillow for matching listing evidence.
- Do not assume a Redfin/Zillow result is the subject parcel unless APN, address, county/state, acreage, or map location match strongly.
- If a field is not visible, use an empty string.
- If something is visually unclear, mark it as unclear and explain it in diagnostics or visualRisks.
- Do not invent exact numbers that are not visible.
- Prefer captured facts over assumptions.

Browser workflow:
1. Open the parcel link.
2. If Land Insights asks for login, stop and say so in diagnostics inside the JSON.
3. Capture visible Property & Ownership fields.
4. Open or inspect the Data Platform/map view if available.
5. Visually classify the parcel:
   - areaType: rural, suburban, urban, or unclear
   - terrainType: flat, sloped, mixed, or unclear
   - structureSignal: present, not_obvious, or unclear
   - accessOrFrontageSignal: present, not_obvious, or unclear
6. Inspect map context for access/frontage, parcel shape, structures, wooded vs pasture/cleared land, slope/topography clues, flood/wetlands clues, and nearby development.
7. Copy the APN/tax ID exactly as shown.
8. Search Redfin and/or Zillow using the APN plus county/state. If APN alone fails, try APN + county + state, then property address if visible.
9. Open likely Redfin/Zillow/original listing matches and inspect listing photos when available.
10. For every external listing you inspect, decide match quality:
    - confirmed_match: APN/address/map/acreage strongly matches the subject.
    - possible_match: some details match, but not enough to rely on it.
    - rejected_match: does not appear to be the subject or useful comp evidence.
11. Use photos only as visual evidence: wooded vs cleared, pasture, driveway, road access, utility poles/meters, structures, build pad, slope, nearby homes/commercial context.
12. If comparable rows or original listing links are visible, capture them.
13. If you open listing pages, capture basic listing details and URLs, but do not make a final DewClaw valuation here.
14. Record a concise navigationLog and diagnostics.

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
      "source": "redfin",
      "url": "",
      "searchQuery": "",
      "matchQuality": "possible_match",
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
- sourceTab: property_ownership, market_insights, slope_insights, deep_ai_analysis, data_platform, listing_page, manual_note, unknown
- confidence: low, medium, high

Important:
- The fields object should contain the best clean value for each visible field.
- fieldCaptures should show where important values came from.
- comparableRows can be empty if no comps are visible.
- listingLinks can be empty if no listing URLs are visible.
- externalListingEvidence can be empty if Redfin/Zillow returns no useful match.
- rawObservationNotes should be short, practical, and useful for land comping.`;
