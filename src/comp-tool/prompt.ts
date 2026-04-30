import type {
  CompEvaluateRequest,
  CompFeedbackRecord,
  CompPropertyTypeFocus,
  CompPromptPackage,
  RetrievedCompChunk,
} from "@/comp-tool/types";

const DELIVERABLE_SECTIONS = [
  "0. Decision Summary",
  "1. Market Value",
  "2. Offer Price",
  "3. Value-Add Market Value (Optional)",
  "4. Value-Add Offer Price (Optional)",
  "5. Negotiation Strategies / Leverage",
  "6. Extra Notes",
  "7. Recommended List Price",
  "8. Key Comps Used",
  "9. Questions to Ask Seller",
  "10. Lead Stage Classification",
  "11. Follow-Up Boss Note",
  "12. Analyst Verification Checklist",
];

function buildPropertyTypeInstruction(propertyTypeFocus: CompPropertyTypeFocus) {
  switch (propertyTypeFocus) {
    case "vacant_land":
      return [
        "Property type focus: Vacant Land.",
        "Keep the comp logic land-first and avoid blending in housing-style comps or structure-driven pricing.",
        "If any structure signal appears, flag it as a contamination risk or verification item instead of silently mixing it into the value.",
      ].join(" ");
    case "structure_vacant_land":
      return [
        "Property type focus: Structure / Vacant Land.",
        "Assume the parcel may include a house, shed, barn, or other improvement.",
        "Do not blindly comp it as pure vacant land. Separate land value from structure impact and state clearly when the structure changes the comping approach.",
      ].join(" ");
    default:
      return [
        "Property type focus: Auto-detect.",
        "Run a broad Gen Comp analysis, but actively look for structure indicators and warn when housing or improvement contamination could change pricing.",
      ].join(" ");
  }
}

function buildPropertyBrief(input: CompEvaluateRequest) {
  const lines = [
    `Mode: ${input.mode}`,
    `Property type focus: ${input.propertyTypeFocus}`,
    `Parcel link: ${input.parcelLink || "Not provided"}`,
    `County: ${input.county || "Not provided"}`,
    `State: ${input.state || "Not provided"}`,
    `Acreage: ${input.acreage || "Not provided"}`,
    `Seller asking price: ${input.sellerAskingPrice || "Not provided"}`,
    `Primary question: ${input.question || "Not provided"}`,
    `Known facts: ${input.knownFacts || "Not provided"}`,
  ];

  return lines.join("\n");
}

function formatChunks(chunks: RetrievedCompChunk[]) {
  return chunks
    .map(
      (chunk, index) =>
        `[Context ${index + 1}] ${chunk.docId} | page ${chunk.pageNumber} | score ${chunk.score}\n${chunk.text}`,
    )
    .join("\n\n---\n\n");
}

function truncateMemory(value: string, maxLength = 360) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function formatFeedbackMemory(records: CompFeedbackRecord[]) {
  if (!records.length) {
    return "No saved reviewer feedback yet.";
  }

  return records
    .map((record, index) => {
      const lines = [
        `[Feedback ${index + 1}] rating=${record.rating}; source=${record.source ?? "comp_tool"}; reviewer=${record.reviewerName || "unknown"}`,
        record.correctDecision ? `Correct decision: ${record.correctDecision}` : "",
        record.correctMarketValue ? `Correct market value: ${record.correctMarketValue}` : "",
        record.correctOpeningOffer ? `Correct opening offer: ${record.correctOpeningOffer}` : "",
        record.whatWasWrong ? `What was wrong: ${truncateMemory(record.whatWasWrong)}` : "",
        record.whatShouldChange ? `What should change: ${truncateMemory(record.whatShouldChange)}` : "",
        record.ruleToRemember ? `Rule to remember: ${truncateMemory(record.ruleToRemember)}` : "",
      ].filter(Boolean);

      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

export function buildCompPromptPackage(
  input: CompEvaluateRequest,
  retrievalQuery: string,
  chunks: RetrievedCompChunk[],
  feedbackMemory: CompFeedbackRecord[] = [],
): CompPromptPackage {
  const systemPrompt = [
    "You are DewClaw's internal land valuation analyst.",
    "Use the provided DewClaw training context as the primary authority.",
    "Do not invent property facts, comps, or legal conclusions that are not supported by the input or the retrieved context.",
    "If key data is missing, explicitly mark it as Needs verification.",
    "The output must help an acquisitions operator decide what to do next, not just summarize research.",
    "Follow the DewClaw Version 3 deliverable format and keep the tone operational, concise, and practical.",
    "When you make an estimate, briefly explain the logic behind it.",
    "Never hide low confidence behind precise-looking numbers. Label preliminary estimates as preliminary when comps or property facts are missing.",
    "Do not use decorative emojis in paste-ready notes or the structured deliverable.",
    "If subdivision or value-add does not exist, mark the value-add sections as N/A.",
    "For Lead Stage Classification, use the seller asking price versus market value table from the DewClaw deliverable instructions.",
    buildPropertyTypeInstruction(input.propertyTypeFocus),
  ].join(" ");

  const userPrompt = [
    "PROPERTY BRIEF",
    buildPropertyBrief(input),
    "",
    "RETRIEVAL QUERY",
    retrievalQuery,
    "",
    "RETRIEVED DEWCLAW CONTEXT",
    formatChunks(chunks),
    "",
    "SAVED REVIEWER FEEDBACK MEMORY",
    "Use these reviewer corrections as operating guidance when applicable. Do not treat them as parcel facts unless the current property input supports them.",
    formatFeedbackMemory(feedbackMemory),
    "",
    "REQUIRED OUTPUT",
    "Produce the final answer as a DewClaw property evaluation deliverable with these exact sections:",
    DELIVERABLE_SECTIONS.map((section) => `- ${section}`).join("\n"),
    "",
    "TOP-OF-OUTPUT DECISION RULES",
    "- Start with the decision, next action, offer strategy, and confidence/data quality before the long analysis.",
    "- Recommendation must be one of: hot_lead, warm_lead, nurture, verify_first, pass.",
    "- Use verify_first when market value is plausible but critical facts are missing.",
    "- Use pass when the seller ask is clearly too high, value is unsupported, or risks outweigh upside.",
    "- Data quality grade: A = strong verified comps and property facts; B = solid but minor gaps; C = usable with several gaps; D = weak/placeholder; F = not enough to price responsibly.",
    "",
    "OFFER STRATEGY RULES",
    "- Give openingOffer, targetOffer, maxOffer, and walkAwayPrice.",
    "- If seller asking price is missing, still provide a preliminary offer strategy but label it preliminary.",
    "- If the seller ask is known, compare it directly against market value and walk-away price.",
    "- The opening offer should be practical for the caller, not just a mechanical percentage.",
    "",
    "MARKET HEAT & RECENCY RULES",
    "- Weight days-on-market (DOM) and listing recency to gauge market heat. Short DOM (under ~30 days) across multiple sold comps signals a hot market; long DOM (over ~120 days) or repeated relisting signals a cold market.",
    "- Use DOM from BOTH sold and active listings. Sold DOM tells you how fast the market clears; active DOM tells you what is currently sticking and at what price.",
    "- Prefer comps sold within the last 6 months. Treat comps older than 12 months as supporting evidence only, not primary anchors, and call that out.",
    "- In a hot market, lean openingOffer and maxOffer toward the upper end of the market value range. In a cold market, anchor lower and widen negotiation room.",
    "- Surface market heat (hot / neutral / cold) explicitly in the Decision Summary or Extra Notes so the caller knows the tempo.",
    "",
    "PROPERTY-TYPE RULES",
    "- In auto-detect mode, explicitly flag possible structures or housing contamination if the parcel may not be pure vacant land.",
    "- In vacant_land mode, do not blend in residential housing logic unless the notes clearly say the land has a structure and that needs verification.",
    "- In structure_vacant_land mode, separate what appears to be land value versus structure impact and state the uncertainty if exact structure details are missing.",
    "",
    "PASTE-READY OUTPUT RULES",
    "- followUpBossNote should be 6 to 10 short lines, plain text, and ready to paste into FUB.",
    "- callPrepBrief should tell the caller what to say first and what to verify.",
    "- analystChecklist should be specific, checkable tasks, not generic reminders.",
    "- Never return N/A, blank text, or placeholder text for followUpBossNote or callPrepBrief; if facts are missing, write a verification-focused note and brief.",
    "- Keep fullDeliverableMarkdown concise. Avoid repeating the same comp facts across sections.",
    "",
    "IMPORTANT RULES",
    "- Always provide a specific Market Value and estimated price per acre when there is enough evidence.",
    "- If there is not enough evidence, give a preliminary value only and state exactly what would change it.",
    "- Include 50%, 60%, and 70% offer prices.",
    "- Only include value-add pricing if the context supports subdivision or another real value-add path.",
    "- List 3 to 5 key comps in the DewClaw format when the information is available. If exact comp details are missing, state what still needs verification.",
    "- Add negotiation leverage and seller questions only when grounded in the provided facts or context.",
    "- In Extra Notes, call out hazards, structures, unusual access, zoning uncertainty, or data gaps.",
    "- If the seller asking price is missing, state that Section 10 cannot be finalized yet.",
  ].join("\n");

  return {
    retrievalQuery,
    systemPrompt,
    userPrompt,
    combinedPrompt: `${systemPrompt}\n\n${userPrompt}`,
  };
}
