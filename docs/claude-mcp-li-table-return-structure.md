# Claude MCP LI Table Return Structure

This is the first simple contract for Claude MCP output. Keep it close to the current Land Insights table capture before adding valuation logic.

## Goal

Claude MCP should visually navigate Land Insights and return structured source data only. DewClaw valuation happens after this step.

Important rule: do not use Land Insights AI comp numbers as DewClaw market value.

## Required JSON Shape

```json
{
  "schemaVersion": "claude-mcp-li-table-v1",
  "source": "claude_mcp",
  "capturedAt": "2026-04-30T00:00:00.000Z",
  "parcelLink": "https://app.landinsights.co/data?parcel=...",
  "compReportUrl": "https://app.landinsights.co/home/comping/report/...",
  "dataPlatformUrl": "https://app.landinsights.co/data?parcel=...",
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
      "key": "roadFrontage",
      "label": "Road Frontage",
      "value": "170 ft",
      "status": "captured",
      "sourceTab": "property_ownership",
      "confidence": "high",
      "notes": "Visible in Property Insights."
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
  "visualClassification": {
    "areaType": "rural",
    "terrainType": "sloped",
    "structureSignal": "not_obvious",
    "accessOrFrontageSignal": "present",
    "confidence": "medium",
    "visualRisks": [],
    "verifyNext": []
  },
  "navigationLog": [],
  "diagnostics": [],
  "rawObservationNotes": ""
}
```

## Field Rules

- Use empty string when a field is not visible.
- Use `status: "missing"` when the field was not found.
- Use `status: "unclear"` when the field was visible but ambiguous.
- Use `confidence: "low" | "medium" | "high"` per field.
- Do not invent fields from memory.
- Do not infer market value from Land Insights AI comp.

## First MCP Task

Return only the LI table data first:

- Property and Ownership fields
- Comparable rows if visible
- Listing links if visible
- Basic visual classification
- Navigation log and diagnostics

Do not return final DewClaw valuation in this structure yet.
