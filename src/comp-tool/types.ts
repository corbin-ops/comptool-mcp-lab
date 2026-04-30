export const COMP_MODES = [
  "general",
  "pricing",
  "subdivision",
  "rural",
  "deliverable",
] as const;

export type CompMode = (typeof COMP_MODES)[number];

export const DEFAULT_COMP_MODE: CompMode = "general";
export type CompPropertyTypeFocus =
  | "auto_detect"
  | "vacant_land"
  | "structure_vacant_land";

export interface CompEvaluateRequest {
  mode: CompMode;
  propertyTypeFocus: CompPropertyTypeFocus;
  parcelLink: string;
  county: string;
  state: string;
  acreage: string;
  sellerAskingPrice: string;
  question: string;
  knownFacts: string;
  topK: number;
}

export type CompFeedbackRating = "yes" | "partial" | "no";
export type CompFeedbackSource = "comp_tool" | "phase2";

export interface CompFeedbackPayload {
  artifactPath: string;
  phase2ArtifactId?: string;
  source?: CompFeedbackSource;
  rating: CompFeedbackRating;
  correctDecision: string;
  correctMarketValue: string;
  correctOpeningOffer: string;
  whatWasWrong: string;
  whatShouldChange: string;
  ruleToRemember: string;
  reviewerName: string;
}

export interface CompFeedbackRecord extends CompFeedbackPayload {
  id: string;
  createdAt: string;
}

export type CompParcelEnrichmentStatus =
  | "fetched"
  | "inferred"
  | "unreachable"
  | "invalid_url"
  | "not_provided"
  | "no_match";

export type CompParcelFetchMode =
  | "not_applicable"
  | "anonymous"
  | "shared_land_insights_session";

export interface CompParcelEnrichment {
  status: CompParcelEnrichmentStatus;
  fetchMode: CompParcelFetchMode;
  finalUrl: string | null;
  pageTitle: string | null;
  diagnostics: string[];
  extractedFields: {
    county: string;
    state: string;
    acreage: string;
    knownFacts: string;
  };
}

export interface RetrievedCompChunk {
  chunkId: string;
  docId: string;
  category: string;
  pageNumber: number;
  text: string;
  score: number;
  matchedTerms: string[];
}

export interface RecommendedCompSource {
  docId: string;
  category: string;
  priorityRank: number;
  useFor: string;
}

export interface CompPromptPackage {
  retrievalQuery: string;
  systemPrompt: string;
  userPrompt: string;
  combinedPrompt: string;
}

export type CompModelProvider = "openai" | "anthropic";
export type CompGenerationStatus = "completed" | "not_configured" | "failed";
export type CompConfidence = "low" | "medium" | "high";

export interface CompOfferPrices {
  fiftyPercent: string;
  sixtyPercent: string;
  seventyPercent: string;
  landlockedPrice: string;
  reasoning: string;
}

export interface CompValueAddMarketValue {
  status: "available" | "not_applicable" | "needs_verification";
  marketValue: string;
  summary: string;
  lotCount: string;
  lotSize: string;
  estimatedCosts: string;
}

export interface CompValueAddOfferPrice {
  status: "available" | "not_applicable" | "needs_verification";
  fiftyPercent: string;
  sixtyPercent: string;
  seventyPercent: string;
  reasoning: string;
}

export interface CompKeyComp {
  acreage: string;
  salePrice: string;
  pricePerAcre: string;
  status: string;
  notes: string;
}

export interface CompLeadStageClassification {
  sellerAskingPrice: string;
  marketValue: string;
  differenceDollar: string;
  differencePercentOfMarketValue: string;
  stage: string;
  reasoning: string;
}

export type CompDecisionRecommendation =
  | "hot_lead"
  | "warm_lead"
  | "nurture"
  | "verify_first"
  | "pass";

export interface CompDecisionSummary {
  recommendation: CompDecisionRecommendation;
  oneLineDecision: string;
  nextAction: string;
  decisionReason: string;
  topRisks: string[];
}

export interface CompOfferStrategy {
  openingOffer: string;
  targetOffer: string;
  maxOffer: string;
  walkAwayPrice: string;
  scriptAngle: string;
  reasoning: string;
}

export interface CompDataQuality {
  grade: "A" | "B" | "C" | "D" | "F";
  score: string;
  reasoning: string;
  criticalMissingItems: string[];
}

export interface CompPasteReadyOutputs {
  followUpBossNote: string;
  callPrepBrief: string;
  analystChecklist: string[];
}

export interface CompEvaluationDeliverable {
  decisionSummary: CompDecisionSummary;
  executiveSummary: string;
  marketValue: string;
  pricePerAcre: string;
  marketValueReasoning: string;
  confidence: CompConfidence;
  dataQuality: CompDataQuality;
  offerPrices: CompOfferPrices;
  offerStrategy: CompOfferStrategy;
  valueAddMarketValue: CompValueAddMarketValue;
  valueAddOfferPrice: CompValueAddOfferPrice;
  negotiationStrategies: string[];
  extraNotes: string[];
  recommendedListPrice: string;
  recommendedListPriceReasoning: string;
  keyComps: CompKeyComp[];
  questionsToAskSeller: string[];
  leadStageClassification: CompLeadStageClassification;
  dataGaps: string[];
  pasteReadyOutputs: CompPasteReadyOutputs;
  fullDeliverableMarkdown: string;
}

export interface CompModelUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface CompGenerationResult {
  status: CompGenerationStatus;
  provider: CompModelProvider | null;
  model: string | null;
  evaluation: CompEvaluationDeliverable | null;
  rawText: string | null;
  error: string | null;
  artifactPath: string | null;
  usage: CompModelUsage | null;
}

export interface CompEvaluateResponse {
  request: CompEvaluateRequest;
  originalRequest: CompEvaluateRequest;
  parcelEnrichment: CompParcelEnrichment | null;
  warnings: string[];
  promptPackage: CompPromptPackage;
  retrieval: {
    topK: number;
    recommendedSources: RecommendedCompSource[];
    chunks: RetrievedCompChunk[];
  };
  generation: CompGenerationResult;
}

const DEFAULT_REQUEST: CompEvaluateRequest = {
  mode: DEFAULT_COMP_MODE,
  propertyTypeFocus: "auto_detect",
  parcelLink: "",
  county: "",
  state: "",
  acreage: "",
  sellerAskingPrice: "",
  question: "",
  knownFacts: "",
  topK: 8,
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readMode(value: unknown): CompMode {
  return COMP_MODES.includes(value as CompMode) ? (value as CompMode) : DEFAULT_REQUEST.mode;
}

function readPropertyTypeFocus(value: unknown): CompPropertyTypeFocus {
  return value === "vacant_land" ||
    value === "structure_vacant_land" ||
    value === "auto_detect"
    ? value
    : DEFAULT_REQUEST.propertyTypeFocus;
}

function readTopK(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : DEFAULT_REQUEST.topK;

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_REQUEST.topK;
  }

  return Math.max(3, Math.min(12, Math.round(numericValue)));
}

export function parseCompEvaluateRequest(payload: unknown): CompEvaluateRequest {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

  return {
    mode: readMode(record.mode),
    propertyTypeFocus: readPropertyTypeFocus(record.propertyTypeFocus),
    parcelLink: readString(record.parcelLink),
    county: readString(record.county),
    state: readString(record.state),
    acreage: readString(record.acreage),
    sellerAskingPrice: readString(record.sellerAskingPrice),
    question: readString(record.question),
    knownFacts: readString(record.knownFacts),
    topK: readTopK(record.topK),
  };
}

export const COMP_MODE_LABELS: Record<CompMode, string> = {
  general: "Gen Comp",
  pricing: "Pricing",
  subdivision: "Subdivision",
  rural: "Rural",
  deliverable: "Deliverable only",
};

export const COMP_MODE_DESCRIPTIONS: Record<CompMode, string> = {
  general: "Balanced retrieval across the main handbook and supporting references.",
  pricing: "Bias toward market value, comps, and PPA trendline logic.",
  subdivision: "Bias toward hidden value, lot design, and split feasibility.",
  rural: "Bias toward access problems and extreme rural discounts.",
  deliverable: "Bias toward the final 10-section DewClaw output format.",
};

export const COMP_PROPERTY_TYPE_LABELS: Record<CompPropertyTypeFocus, string> = {
  auto_detect: "Auto-detect",
  vacant_land: "Vacant Land",
  structure_vacant_land: "Structure / Vacant Land",
};

export const COMP_PROPERTY_TYPE_DESCRIPTIONS: Record<CompPropertyTypeFocus, string> = {
  auto_detect:
    "Broad Gen Comp mode. The tool should still try to detect possible structures and flag contamination risk.",
  vacant_land:
    "Use vacant-land logic only. If structure signals appear, treat them as a warning or verify item.",
  structure_vacant_land:
    "Use when the property may include a house, shed, or other structure so land value and structure impact are not mixed blindly.",
};
