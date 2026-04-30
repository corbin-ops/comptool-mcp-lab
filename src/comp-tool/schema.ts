import type {
  CompConfidence,
  CompDataQuality,
  CompDecisionRecommendation,
  CompDecisionSummary,
  CompEvaluationDeliverable,
  CompKeyComp,
  CompLeadStageClassification,
  CompOfferPrices,
  CompOfferStrategy,
  CompPasteReadyOutputs,
  CompValueAddMarketValue,
  CompValueAddOfferPrice,
} from "@/comp-tool/types";

export const COMP_EVALUATION_SCHEMA_NAME = "dewclaw_comp_evaluation";

export const COMP_EVALUATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "decisionSummary",
    "executiveSummary",
    "marketValue",
    "pricePerAcre",
    "marketValueReasoning",
    "confidence",
    "dataQuality",
    "offerPrices",
    "offerStrategy",
    "valueAddMarketValue",
    "valueAddOfferPrice",
    "negotiationStrategies",
    "extraNotes",
    "recommendedListPrice",
    "recommendedListPriceReasoning",
    "keyComps",
    "questionsToAskSeller",
    "leadStageClassification",
    "dataGaps",
    "pasteReadyOutputs",
    "fullDeliverableMarkdown",
  ],
  properties: {
    decisionSummary: {
      type: "object",
      additionalProperties: false,
      required: ["recommendation", "oneLineDecision", "nextAction", "decisionReason", "topRisks"],
      properties: {
        recommendation: {
          type: "string",
          enum: ["hot_lead", "warm_lead", "nurture", "verify_first", "pass"],
          description:
            "Operational decision for the acquisitions team. Use verify_first when key facts are missing.",
        },
        oneLineDecision: {
          type: "string",
          description: "Plain-English one-line answer to what the team should do.",
        },
        nextAction: {
          type: "string",
          description: "The immediate next action for the caller or analyst.",
        },
        decisionReason: {
          type: "string",
          description: "Short explanation for the decision.",
        },
        topRisks: {
          type: "array",
          items: { type: "string" },
          description: "Top one to five risks that could change the decision.",
        },
      },
    },
    executiveSummary: {
      type: "string",
      description: "Two to four sentence operating summary of value, risks, and next move.",
    },
    marketValue: {
      type: "string",
      description: "Specific market value estimate in dollars.",
    },
    pricePerAcre: {
      type: "string",
      description: "Specific price per acre estimate.",
    },
    marketValueReasoning: {
      type: "string",
      description: "Short explanation of why the market value estimate was chosen.",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "Confidence in the valuation based on the available data.",
    },
    dataQuality: {
      type: "object",
      additionalProperties: false,
      required: ["grade", "score", "reasoning", "criticalMissingItems"],
      properties: {
        grade: {
          type: "string",
          enum: ["A", "B", "C", "D", "F"],
          description: "A = strong verified data, F = not enough to price responsibly.",
        },
        score: {
          type: "string",
          description: "Data quality score such as 82/100.",
        },
        reasoning: {
          type: "string",
          description: "Why this data grade was assigned.",
        },
        criticalMissingItems: {
          type: "array",
          items: { type: "string" },
          description: "Critical missing items before offer confidence improves.",
        },
      },
    },
    offerPrices: {
      type: "object",
      additionalProperties: false,
      required: [
        "fiftyPercent",
        "sixtyPercent",
        "seventyPercent",
        "landlockedPrice",
        "reasoning",
      ],
      properties: {
        fiftyPercent: { type: "string" },
        sixtyPercent: { type: "string" },
        seventyPercent: { type: "string" },
        landlockedPrice: {
          type: "string",
          description: "Use N/A when not relevant.",
        },
        reasoning: { type: "string" },
      },
    },
    offerStrategy: {
      type: "object",
      additionalProperties: false,
      required: [
        "openingOffer",
        "targetOffer",
        "maxOffer",
        "walkAwayPrice",
        "scriptAngle",
        "reasoning",
      ],
      properties: {
        openingOffer: {
          type: "string",
          description: "Recommended first offer or Needs verification.",
        },
        targetOffer: {
          type: "string",
          description: "Preferred buy price or Needs verification.",
        },
        maxOffer: {
          type: "string",
          description: "Highest price the team should consider before escalation.",
        },
        walkAwayPrice: {
          type: "string",
          description: "Price where the team should likely pass or escalate.",
        },
        scriptAngle: {
          type: "string",
          description: "Short negotiation angle for the caller.",
        },
        reasoning: {
          type: "string",
          description: "Why this offer strategy fits the deal.",
        },
      },
    },
    valueAddMarketValue: {
      type: "object",
      additionalProperties: false,
      required: [
        "status",
        "marketValue",
        "summary",
        "lotCount",
        "lotSize",
        "estimatedCosts",
      ],
      properties: {
        status: {
          type: "string",
          enum: ["available", "not_applicable", "needs_verification"],
        },
        marketValue: { type: "string" },
        summary: { type: "string" },
        lotCount: { type: "string" },
        lotSize: { type: "string" },
        estimatedCosts: { type: "string" },
      },
    },
    valueAddOfferPrice: {
      type: "object",
      additionalProperties: false,
      required: [
        "status",
        "fiftyPercent",
        "sixtyPercent",
        "seventyPercent",
        "reasoning",
      ],
      properties: {
        status: {
          type: "string",
          enum: ["available", "not_applicable", "needs_verification"],
        },
        fiftyPercent: { type: "string" },
        sixtyPercent: { type: "string" },
        seventyPercent: { type: "string" },
        reasoning: { type: "string" },
      },
    },
    negotiationStrategies: {
      type: "array",
      items: { type: "string" },
    },
    extraNotes: {
      type: "array",
      items: { type: "string" },
    },
    recommendedListPrice: {
      type: "string",
    },
    recommendedListPriceReasoning: {
      type: "string",
    },
    keyComps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["acreage", "salePrice", "pricePerAcre", "status", "notes"],
        properties: {
          acreage: { type: "string" },
          salePrice: { type: "string" },
          pricePerAcre: { type: "string" },
          status: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
    questionsToAskSeller: {
      type: "array",
      items: { type: "string" },
    },
    leadStageClassification: {
      type: "object",
      additionalProperties: false,
      required: [
        "sellerAskingPrice",
        "marketValue",
        "differenceDollar",
        "differencePercentOfMarketValue",
        "stage",
        "reasoning",
      ],
      properties: {
        sellerAskingPrice: { type: "string" },
        marketValue: { type: "string" },
        differenceDollar: { type: "string" },
        differencePercentOfMarketValue: { type: "string" },
        stage: { type: "string" },
        reasoning: { type: "string" },
      },
    },
    dataGaps: {
      type: "array",
      items: { type: "string" },
    },
    pasteReadyOutputs: {
      type: "object",
      additionalProperties: false,
      required: ["followUpBossNote", "callPrepBrief", "analystChecklist"],
      properties: {
        followUpBossNote: {
          type: "string",
          description:
            "Concise plain-text note ready to paste into Follow Up Boss. No markdown tables.",
        },
        callPrepBrief: {
          type: "string",
          description: "Short caller-facing prep brief.",
        },
        analystChecklist: {
          type: "array",
          items: { type: "string" },
          description: "Specific verification tasks for the analyst before final offer.",
        },
      },
    },
    fullDeliverableMarkdown: {
      type: "string",
      description: "The final DewClaw deliverable in readable markdown.",
    },
  },
} as const;

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asConfidence(value: unknown): CompConfidence {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function asDecisionRecommendation(value: unknown): CompDecisionRecommendation {
  return value === "hot_lead" ||
    value === "warm_lead" ||
    value === "nurture" ||
    value === "verify_first" ||
    value === "pass"
    ? value
    : "verify_first";
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => asString(item))
        .filter(Boolean)
    : [];
}

type NormalizedEvaluationWithoutMarkdown = Omit<CompEvaluationDeliverable, "fullDeliverableMarkdown">;

function isUsefulText(value: string) {
  const normalized = value.trim().toLowerCase();

  return Boolean(
    normalized &&
      !["n/a", "na", "none", "not available", "not provided"].includes(normalized),
  );
}

function uniqueNonEmpty(items: string[]) {
  const seen = new Set<string>();

  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function buildFallbackFollowUpBossNote(evaluation: NormalizedEvaluationWithoutMarkdown) {
  return uniqueNonEmpty([
    `Decision: ${evaluation.decisionSummary.oneLineDecision || evaluation.decisionSummary.recommendation}.`,
    `Market value: ${evaluation.marketValue || "Needs verification"}.`,
    `Price per acre: ${evaluation.pricePerAcre || "Needs verification"}.`,
    `Opening offer: ${evaluation.offerStrategy.openingOffer || evaluation.offerPrices.fiftyPercent || "Needs verification"}.`,
    `Confidence/data: ${evaluation.confidence} confidence; data quality ${evaluation.dataQuality.grade}${evaluation.dataQuality.score ? ` / ${evaluation.dataQuality.score}` : ""}.`,
    evaluation.decisionSummary.topRisks[0]
      ? `Top risk: ${evaluation.decisionSummary.topRisks[0]}.`
      : "",
    `Next action: ${evaluation.decisionSummary.nextAction || "Verify missing deal facts before final offer"}.`,
  ]).join("\n");
}

function buildFallbackCallPrepBrief(evaluation: NormalizedEvaluationWithoutMarkdown) {
  const verificationItem =
    evaluation.pasteReadyOutputs.analystChecklist[0] ||
    evaluation.dataQuality.criticalMissingItems[0] ||
    evaluation.dataGaps[0] ||
    evaluation.decisionSummary.topRisks[0] ||
    "confirm access, usable acreage, and seller expectations";

  return uniqueNonEmpty([
    evaluation.offerStrategy.scriptAngle
      ? `Opening angle: ${evaluation.offerStrategy.scriptAngle}`
      : `Opening angle: confirm the owner is open to selling before quoting firm numbers.`,
    `Value anchor: ${evaluation.marketValue || "Needs verification"}${evaluation.pricePerAcre ? ` (${evaluation.pricePerAcre})` : ""}.`,
    `Offer posture: ${evaluation.offerStrategy.openingOffer || evaluation.offerPrices.fiftyPercent || "preliminary offer only after verification"}.`,
    `Verify before final offer: ${verificationItem}.`,
  ]).join("\n");
}

function buildFallbackAnalystChecklist(evaluation: NormalizedEvaluationWithoutMarkdown) {
  return uniqueNonEmpty([
    ...evaluation.pasteReadyOutputs.analystChecklist,
    ...evaluation.dataQuality.criticalMissingItems,
    ...evaluation.dataGaps,
    ...evaluation.decisionSummary.topRisks.map((risk) => `Review risk: ${risk}`),
  ]).slice(0, 8);
}

function fillPasteReadyOutputs(
  evaluation: NormalizedEvaluationWithoutMarkdown,
): CompPasteReadyOutputs {
  return {
    followUpBossNote: isUsefulText(evaluation.pasteReadyOutputs.followUpBossNote)
      ? evaluation.pasteReadyOutputs.followUpBossNote
      : buildFallbackFollowUpBossNote(evaluation),
    callPrepBrief: isUsefulText(evaluation.pasteReadyOutputs.callPrepBrief)
      ? evaluation.pasteReadyOutputs.callPrepBrief
      : buildFallbackCallPrepBrief(evaluation),
    analystChecklist: buildFallbackAnalystChecklist(evaluation),
  };
}

function normalizeOfferPrices(value: unknown): CompOfferPrices {
  const record = asRecord(value);

  return {
    fiftyPercent: asString(record.fiftyPercent),
    sixtyPercent: asString(record.sixtyPercent),
    seventyPercent: asString(record.seventyPercent),
    landlockedPrice: asString(record.landlockedPrice),
    reasoning: asString(record.reasoning),
  };
}

function normalizeDecisionSummary(value: unknown): CompDecisionSummary {
  const record = asRecord(value);

  return {
    recommendation: asDecisionRecommendation(record.recommendation),
    oneLineDecision: asString(record.oneLineDecision),
    nextAction: asString(record.nextAction),
    decisionReason: asString(record.decisionReason),
    topRisks: asStringArray(record.topRisks),
  };
}

function normalizeDataQuality(value: unknown): CompDataQuality {
  const record = asRecord(value);
  const grade = asString(record.grade);

  return {
    grade:
      grade === "A" || grade === "B" || grade === "C" || grade === "D" || grade === "F"
        ? grade
        : "D",
    score: asString(record.score),
    reasoning: asString(record.reasoning),
    criticalMissingItems: asStringArray(record.criticalMissingItems),
  };
}

function normalizeOfferStrategy(value: unknown): CompOfferStrategy {
  const record = asRecord(value);

  return {
    openingOffer: asString(record.openingOffer),
    targetOffer: asString(record.targetOffer),
    maxOffer: asString(record.maxOffer),
    walkAwayPrice: asString(record.walkAwayPrice),
    scriptAngle: asString(record.scriptAngle),
    reasoning: asString(record.reasoning),
  };
}

function normalizeValueAddMarketValue(value: unknown): CompValueAddMarketValue {
  const record = asRecord(value);
  const status = asString(record.status);

  return {
    status:
      status === "available" || status === "not_applicable" || status === "needs_verification"
        ? status
        : "not_applicable",
    marketValue: asString(record.marketValue),
    summary: asString(record.summary),
    lotCount: asString(record.lotCount),
    lotSize: asString(record.lotSize),
    estimatedCosts: asString(record.estimatedCosts),
  };
}

function normalizeValueAddOfferPrice(value: unknown): CompValueAddOfferPrice {
  const record = asRecord(value);
  const status = asString(record.status);

  return {
    status:
      status === "available" || status === "not_applicable" || status === "needs_verification"
        ? status
        : "not_applicable",
    fiftyPercent: asString(record.fiftyPercent),
    sixtyPercent: asString(record.sixtyPercent),
    seventyPercent: asString(record.seventyPercent),
    reasoning: asString(record.reasoning),
  };
}

function normalizeKeyComp(value: unknown): CompKeyComp {
  const record = asRecord(value);

  return {
    acreage: asString(record.acreage),
    salePrice: asString(record.salePrice),
    pricePerAcre: asString(record.pricePerAcre),
    status: asString(record.status),
    notes: asString(record.notes),
  };
}

function normalizeLeadStageClassification(value: unknown): CompLeadStageClassification {
  const record = asRecord(value);

  return {
    sellerAskingPrice: asString(record.sellerAskingPrice),
    marketValue: asString(record.marketValue),
    differenceDollar: asString(record.differenceDollar),
    differencePercentOfMarketValue: asString(record.differencePercentOfMarketValue),
    stage: asString(record.stage),
    reasoning: asString(record.reasoning),
  };
}

function normalizePasteReadyOutputs(value: unknown): CompPasteReadyOutputs {
  const record = asRecord(value);

  return {
    followUpBossNote: asString(record.followUpBossNote),
    callPrepBrief: asString(record.callPrepBrief),
    analystChecklist: asStringArray(record.analystChecklist),
  };
}

function formatList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- N/A";
}

function buildFallbackDeliverableMarkdown(evaluation: Omit<CompEvaluationDeliverable, "fullDeliverableMarkdown">) {
  return [
    "## 0. Decision Summary",
    `Recommendation: ${evaluation.decisionSummary.recommendation}`,
    `Decision: ${evaluation.decisionSummary.oneLineDecision || "Needs review"}`,
    `Next action: ${evaluation.decisionSummary.nextAction || "Needs verification"}`,
    `Reason: ${evaluation.decisionSummary.decisionReason || "N/A"}`,
    "",
    "Top risks:",
    formatList(evaluation.decisionSummary.topRisks),
    "",
    "## 1. Market Value",
    `Market value: ${evaluation.marketValue || "Needs verification"}`,
    `Price per acre: ${evaluation.pricePerAcre || "Needs verification"}`,
    `Confidence: ${evaluation.confidence}`,
    `Reasoning: ${evaluation.marketValueReasoning || "N/A"}`,
    "",
    "## 2. Offer Price",
    `50%: ${evaluation.offerPrices.fiftyPercent || "N/A"}`,
    `60%: ${evaluation.offerPrices.sixtyPercent || "N/A"}`,
    `70%: ${evaluation.offerPrices.seventyPercent || "N/A"}`,
    `Landlocked price: ${evaluation.offerPrices.landlockedPrice || "N/A"}`,
    `Reasoning: ${evaluation.offerPrices.reasoning || "N/A"}`,
    "",
    "## 2A. Offer Strategy",
    `Opening offer: ${evaluation.offerStrategy.openingOffer || "N/A"}`,
    `Target offer: ${evaluation.offerStrategy.targetOffer || "N/A"}`,
    `Max offer: ${evaluation.offerStrategy.maxOffer || "N/A"}`,
    `Walk-away price: ${evaluation.offerStrategy.walkAwayPrice || "N/A"}`,
    `Script angle: ${evaluation.offerStrategy.scriptAngle || "N/A"}`,
    "",
    "## 3. Value-Add Market Value",
    `Status: ${evaluation.valueAddMarketValue.status}`,
    `Market value: ${evaluation.valueAddMarketValue.marketValue || "N/A"}`,
    `Summary: ${evaluation.valueAddMarketValue.summary || "N/A"}`,
    `Lot count: ${evaluation.valueAddMarketValue.lotCount || "N/A"}`,
    `Lot size: ${evaluation.valueAddMarketValue.lotSize || "N/A"}`,
    `Estimated costs: ${evaluation.valueAddMarketValue.estimatedCosts || "N/A"}`,
    "",
    "## 4. Value-Add Offer Price",
    `Status: ${evaluation.valueAddOfferPrice.status}`,
    `50%: ${evaluation.valueAddOfferPrice.fiftyPercent || "N/A"}`,
    `60%: ${evaluation.valueAddOfferPrice.sixtyPercent || "N/A"}`,
    `70%: ${evaluation.valueAddOfferPrice.seventyPercent || "N/A"}`,
    `Reasoning: ${evaluation.valueAddOfferPrice.reasoning || "N/A"}`,
    "",
    "## 5. Negotiation Strategies / Leverage",
    formatList(evaluation.negotiationStrategies),
    "",
    "## 6. Extra Notes",
    formatList(evaluation.extraNotes),
    "",
    "## 7. Recommended List Price",
    `Recommended list price: ${evaluation.recommendedListPrice || "N/A"}`,
    `Reasoning: ${evaluation.recommendedListPriceReasoning || "N/A"}`,
    "",
    "## 8. Key Comps Used",
    evaluation.keyComps.length
      ? evaluation.keyComps
          .map(
            (comp, index) =>
              `${index + 1}. ${comp.acreage || "Unknown acreage"} | ${comp.salePrice || "Unknown sale price"} | ${comp.pricePerAcre || "Unknown PPA"} | ${comp.status || "Unknown status"} | ${comp.notes || "No notes"}`,
          )
          .join("\n")
      : "N/A",
    "",
    "## 9. Questions to Ask Seller",
    formatList(evaluation.questionsToAskSeller),
    "",
    "## 10. Lead Stage Classification",
    `Seller ask: ${evaluation.leadStageClassification.sellerAskingPrice || "N/A"}`,
    `Market value: ${evaluation.leadStageClassification.marketValue || "N/A"}`,
    `Difference: ${evaluation.leadStageClassification.differenceDollar || "N/A"}`,
    `Difference %: ${evaluation.leadStageClassification.differencePercentOfMarketValue || "N/A"}`,
    `Stage: ${evaluation.leadStageClassification.stage || "N/A"}`,
    `Reasoning: ${evaluation.leadStageClassification.reasoning || "N/A"}`,
    "",
    "## 11. Follow-Up Boss Note",
    evaluation.pasteReadyOutputs.followUpBossNote || "N/A",
    "",
    "## 12. Analyst Verification Checklist",
    formatList(evaluation.pasteReadyOutputs.analystChecklist),
    "",
    "## Data Gaps",
    formatList(evaluation.dataGaps),
  ].join("\n");
}

export function normalizeCompEvaluationDeliverable(
  value: unknown,
): CompEvaluationDeliverable {
  const record = asRecord(value);

  const normalizedBase: NormalizedEvaluationWithoutMarkdown = {
    decisionSummary: normalizeDecisionSummary(record.decisionSummary),
    executiveSummary: asString(record.executiveSummary),
    marketValue: asString(record.marketValue),
    pricePerAcre: asString(record.pricePerAcre),
    marketValueReasoning: asString(record.marketValueReasoning),
    confidence: asConfidence(record.confidence),
    dataQuality: normalizeDataQuality(record.dataQuality),
    offerPrices: normalizeOfferPrices(record.offerPrices),
    offerStrategy: normalizeOfferStrategy(record.offerStrategy),
    valueAddMarketValue: normalizeValueAddMarketValue(record.valueAddMarketValue),
    valueAddOfferPrice: normalizeValueAddOfferPrice(record.valueAddOfferPrice),
    negotiationStrategies: asStringArray(record.negotiationStrategies),
    extraNotes: asStringArray(record.extraNotes),
    recommendedListPrice: asString(record.recommendedListPrice),
    recommendedListPriceReasoning: asString(record.recommendedListPriceReasoning),
    keyComps: Array.isArray(record.keyComps)
      ? record.keyComps
          .map((item) => normalizeKeyComp(item))
          .filter((item) => Object.values(item).some(Boolean))
      : [],
    questionsToAskSeller: asStringArray(record.questionsToAskSeller),
    leadStageClassification: normalizeLeadStageClassification(record.leadStageClassification),
    dataGaps: asStringArray(record.dataGaps),
    pasteReadyOutputs: normalizePasteReadyOutputs(record.pasteReadyOutputs),
  };

  const normalizedWithoutMarkdown: NormalizedEvaluationWithoutMarkdown = {
    ...normalizedBase,
    pasteReadyOutputs: fillPasteReadyOutputs(normalizedBase),
  };

  const fullDeliverableMarkdown =
    asString(record.fullDeliverableMarkdown) ||
    buildFallbackDeliverableMarkdown(normalizedWithoutMarkdown);

  return {
    ...normalizedWithoutMarkdown,
    fullDeliverableMarkdown,
  };
}
