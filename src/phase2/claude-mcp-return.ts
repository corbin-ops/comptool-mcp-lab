import type {
  VisualComparableRow,
  VisualConfidence,
  VisualExtractedParcelFields,
} from "@/phase2/types";

export type ClaudeMcpSourceTab =
  | "property_ownership"
  | "market_insights"
  | "slope_insights"
  | "deep_ai_analysis"
  | "data_platform"
  | "listing_page"
  | "manual_note"
  | "unknown";

export type ClaudeMcpFieldStatus = "captured" | "missing" | "unclear";

export interface ClaudeMcpFieldCapture {
  key: keyof VisualExtractedParcelFields;
  label: string;
  value: string;
  status: ClaudeMcpFieldStatus;
  sourceTab: ClaudeMcpSourceTab;
  confidence: VisualConfidence;
  notes?: string;
}

export interface ClaudeMcpVisualClassification {
  areaType: "rural" | "suburban" | "urban" | "unclear";
  terrainType: "flat" | "sloped" | "mixed" | "unclear";
  structureSignal: "present" | "not_obvious" | "unclear";
  accessOrFrontageSignal: "present" | "not_obvious" | "unclear";
  confidence: VisualConfidence;
  visualRisks: string[];
  verifyNext: string[];
}

export interface ClaudeMcpLiTableReturn {
  schemaVersion: "claude-mcp-li-table-v1";
  source: "claude_mcp";
  capturedAt: string;
  parcelLink: string;
  compReportUrl?: string;
  dataPlatformUrl?: string;
  pageTitle?: string;
  fields: VisualExtractedParcelFields;
  fieldCaptures: ClaudeMcpFieldCapture[];
  comparableRows: VisualComparableRow[];
  listingLinks: string[];
  visualClassification: ClaudeMcpVisualClassification;
  navigationLog: string[];
  diagnostics: string[];
  rawObservationNotes?: string;
}

export const CLAUDE_MCP_LI_FIELD_ORDER: Array<{
  key: keyof VisualExtractedParcelFields;
  label: string;
  sourceTab: ClaudeMcpSourceTab;
}> = [
  { key: "apn", label: "APN", sourceTab: "property_ownership" },
  { key: "owner", label: "Current Owner", sourceTab: "property_ownership" },
  { key: "acreage", label: "Acres", sourceTab: "property_ownership" },
  { key: "county", label: "County", sourceTab: "property_ownership" },
  { key: "state", label: "State", sourceTab: "property_ownership" },
  { key: "ownerMailingAddress", label: "Owner Mailing Address", sourceTab: "property_ownership" },
  { key: "address", label: "Property Address", sourceTab: "property_ownership" },
  { key: "landLocked", label: "Land Locked", sourceTab: "property_ownership" },
  { key: "roadFrontage", label: "Road Frontage", sourceTab: "property_ownership" },
  { key: "wetlands", label: "Wetlands", sourceTab: "property_ownership" },
  { key: "floodZone", label: "Flood Zone", sourceTab: "property_ownership" },
  { key: "hoa", label: "HOA", sourceTab: "property_ownership" },
  { key: "hasStructure", label: "Has Structure", sourceTab: "property_ownership" },
  { key: "currentLandUse", label: "Current Land Use", sourceTab: "property_ownership" },
  { key: "ownershipLength", label: "Ownership Length", sourceTab: "property_ownership" },
  { key: "relationToProperty", label: "Relation to Property", sourceTab: "property_ownership" },
  { key: "lastPurchasePrice", label: "Last Purchase Price", sourceTab: "property_ownership" },
  { key: "lastPurchaseDate", label: "Last Purchase Date", sourceTab: "property_ownership" },
  { key: "lastPurchaseType", label: "Last Purchase Type", sourceTab: "property_ownership" },
  { key: "deedType", label: "Deed Type", sourceTab: "property_ownership" },
  { key: "gps", label: "GPS", sourceTab: "property_ownership" },
  { key: "zoning", label: "Zoning", sourceTab: "property_ownership" },
  { key: "propertyTax", label: "Property Tax", sourceTab: "property_ownership" },
  { key: "taxDelinquentFor", label: "Tax Delinquent For", sourceTab: "property_ownership" },
  { key: "inHoa", label: "In HOA", sourceTab: "property_ownership" },
  { key: "familyTransfer", label: "Family Transfer", sourceTab: "property_ownership" },
  { key: "structures", label: "Structures", sourceTab: "property_ownership" },
  { key: "structureCount", label: "Structure Count", sourceTab: "property_ownership" },
  { key: "structureYearBuilt", label: "Structure Year Built", sourceTab: "property_ownership" },
  { key: "mobileHome", label: "Mobile Home", sourceTab: "property_ownership" },
  { key: "assessedValue", label: "Assessed Value", sourceTab: "property_ownership" },
  { key: "assessedLandValue", label: "Assessed Land Value", sourceTab: "property_ownership" },
  { key: "assessedImprovementValue", label: "Assessed Improvement Value", sourceTab: "property_ownership" },
];

export function createEmptyClaudeMcpLiReturn(parcelLink = ""): ClaudeMcpLiTableReturn {
  return {
    schemaVersion: "claude-mcp-li-table-v1",
    source: "claude_mcp",
    capturedAt: new Date().toISOString(),
    parcelLink,
    fields: {},
    fieldCaptures: CLAUDE_MCP_LI_FIELD_ORDER.map((field) => ({
      ...field,
      value: "",
      status: "missing",
      confidence: "low",
    })),
    comparableRows: [],
    listingLinks: [],
    visualClassification: {
      areaType: "unclear",
      terrainType: "unclear",
      structureSignal: "unclear",
      accessOrFrontageSignal: "unclear",
      confidence: "low",
      visualRisks: [],
      verifyNext: [],
    },
    navigationLog: [],
    diagnostics: [],
  };
}
