import type { CompEvaluateResponse } from "@/comp-tool/types";

export type VisualAreaType = "rural" | "suburban" | "urban" | "unclear";
export type VisualTerrainType = "flat" | "sloped" | "mixed" | "unclear";
export type VisualSignalState = "present" | "not_obvious" | "unclear";
export type VisualConfidence = "low" | "medium" | "high";

export interface VisualComparableRow {
  city?: string;
  price?: string;
  acreage?: string;
  pricePerAcre?: string;
  daysOnMarket?: string;
  zip?: string;
  extraMetric?: string;
  status?: string;
  listingUrl?: string;
  source?: "redfin" | "zillow" | "realtor" | "unknown";
  rawCells: string[];
}

export interface VisualExtractedParcelFields {
  apn?: string;
  county?: string;
  state?: string;
  owner?: string;
  acreage?: string;
  address?: string;
  ownerMailingAddress?: string;
  roadFrontage?: string;
  wetlands?: string;
  floodZone?: string;
  hoa?: string;
  hasStructure?: string;
  currentLandUse?: string;
  ownershipLength?: string;
  relationToProperty?: string;
  lastPurchasePrice?: string;
  lastPurchaseDate?: string;
  gps?: string;
  zoning?: string;
  propertyTax?: string;
  assessedValue?: string;
  assessedLandValue?: string;
  assessedImprovementValue?: string;
  structures?: string;
  structureCount?: string;
  structureYearBuilt?: string;
  deedType?: string;
  lastPurchaseType?: string;
  inHoa?: string;
  familyTransfer?: string;
  mobileHome?: string;
  landLocked?: string;
  taxDelinquentFor?: string;
}

export interface VisualKmlCoordinate {
  lon: number;
  lat: number;
  alt?: number | null;
}

export interface VisualKmlBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

export interface VisualKmlData {
  fileName?: string;
  placemarkName?: string;
  apn?: string;
  address?: string;
  owner?: string;
  acreage?: string;
  coordinateCount: number;
  bounds?: VisualKmlBounds | null;
  coordinates: VisualKmlCoordinate[];
}

export interface VisualBrowserPageSnapshot {
  sourceUrl: string;
  finalUrl?: string;
  pageTitle: string;
  pageText: string;
  extractedAt?: string;
  sourceApp?: string;
  compReportUrl?: string;
  kmlUrl?: string;
  kmlFileName?: string;
  kmlCaptureStatus?: string;
  hasCompReportButton?: boolean;
  hasKmlButton?: boolean;
  extractionError?: string;
  listingLinks?: string[];
  extractedFields?: VisualExtractedParcelFields;
  comparableRows?: VisualComparableRow[];
}

export interface VisualParcelInspectorRequest {
  parcelLink: string;
  listingLinks?: string[];
  notes?: string;
  browserPage?: VisualBrowserPageSnapshot | null;
  browserListings?: VisualBrowserPageSnapshot[];
  kmlText?: string;
  kmlFileName?: string;
}

export interface VisualParcelInspectorPageStatus {
  parcelPageReached: boolean;
  listingPagesReached: number;
  listingPagesAttempted: number;
}

export interface VisualParcelInspectorResult {
  pageStatus: VisualParcelInspectorPageStatus;
  parcelPageTitle?: string;
  parcelFinalUrl?: string;
  structuredFields?: VisualExtractedParcelFields;
  kmlData?: VisualKmlData | null;
  comparableRows?: VisualComparableRow[];
  areaType: VisualAreaType;
  terrainType: VisualTerrainType;
  structureSignal: VisualSignalState;
  accessOrFrontageSignal: VisualSignalState;
  visualRisks: string[];
  verifyNext: string[];
  confidence: VisualConfidence;
  summary: string;
  diagnostics?: string[];
  screenshots?: string[];
  navigationLog?: string[];
}

export interface VisualBrowserIntakeArtifact {
  id: string;
  createdAt: string;
  request: VisualParcelInspectorRequest;
  result: VisualParcelInspectorResult;
  compEvaluationStatus?: "pending" | "completed" | "failed";
  compEvaluationStartedAt?: string | null;
  compEvaluationCompletedAt?: string | null;
  compEvaluation?: CompEvaluateResponse | null;
  compEvaluationError?: string | null;
}

export const EMPTY_VISUAL_PARCEL_INSPECTOR_RESULT: VisualParcelInspectorResult = {
  pageStatus: {
    parcelPageReached: false,
    listingPagesReached: 0,
    listingPagesAttempted: 0,
  },
  parcelPageTitle: "",
  parcelFinalUrl: "",
  structuredFields: {},
  kmlData: null,
  comparableRows: [],
  areaType: "unclear",
  terrainType: "unclear",
  structureSignal: "unclear",
  accessOrFrontageSignal: "unclear",
  visualRisks: [],
  verifyNext: [],
  confidence: "low",
  summary: "",
  diagnostics: [],
  screenshots: [],
  navigationLog: [],
};
