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
      (chunk, index) => {
        const matchedTerms = chunk.matchedTerms.length
          ? ` | matched: ${chunk.matchedTerms.join(", ")}`
          : "";

        return `[Context ${index + 1}] ${chunk.docId} | category ${chunk.category} | page ${chunk.pageNumber} | score ${chunk.score}${matchedTerms}\n${chunk.text}`;
      },
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
    "Use the retrieved DewClaw PDF training context as the primary valuation authority.",
    "For comping workflow, APN/listing investigation, and visual map/photo interpretation, treat the newer MCP comping guides as higher authority than older handbook references.",
    "The captured parcel facts, Land Insights fields, Land Insights MLS comp/photo evidence, Redfin/Zillow evidence, photos, and map observations describe the property; the DewClaw PDF context tells you how to interpret and price those facts.",
    "Do not make a pricing or lead-stage decision from general real estate knowledge when a relevant retrieved DewClaw context chunk exists.",
    "When the retrieved context is weak, missing, or not on-point, say the decision is preliminary and list the exact missing reference or property fact.",
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
    "PDF GROUNDING RULES",
    "- Treat the retrieved DewClaw context above as the rulebook for valuation logic, offer posture, discounts, lead stage, and output format.",
    "- Use property facts from the PROPERTY BRIEF; use retrieved PDF context to decide what those facts mean.",
    "- Do not cite or apply a DewClaw rule unless it appears in the retrieved context packet.",
    "- If the retrieved context conflicts with a captured parcel fact, keep the parcel fact and use the PDF only as methodology.",
    "- If multiple retrieved chunks apply, follow the highest-priority/source-specific chunk first, then use lower-priority chunks as support.",
    "- marketValueReasoning must mention 1 to 3 source anchors from the retrieved context when they materially affect the decision, using the format docId p.pageNumber.",
    "- offerStrategy.reasoning must explain how the retrieved DewClaw context supports the opening/target/max/walk-away posture.",
    "- dataQuality.reasoning must say whether the retrieved context was strong enough for the current property type or if more source context is needed.",
    "",
    "DOCUMENT ROUTING RULES",
    "- MCP/browser comping workflow, source capture, and visual evidence handling: prioritize dcl_mcp_comping_guide.",
    "- Land Insights MLS comp/photo review, APN checks, Redfin/Zillow investigation, listing-photo review, comp match quality, and evidence quality: prioritize dcl_comp_investigation_guide.",
    "- Visual map/photo interpretation, wooded vs cleared/pasture, slope/access cues, structures, and nearby development context: prioritize dcl_visual_land_analysis_guide and dcl_visual_field_guide_v3.",
    "- General land comping and legacy decision logic: use complete_handbook_merged only as supporting methodology behind the newer MCP guides.",
    "- PPA, trendline, acreage-size adjustment, market value, and normal flip pricing: prioritize dcl_comp_investigation_guide plus pricing_trendline_mastery.",
    "- Subdivision, road frontage, lot split, flagpole/road-building, and hidden value: prioritize subdivision_mastery and subdivision_advanced_part10.",
    "- Rural/remoteness/access discount, middle-of-nowhere risk, poor roads, and extreme access friction: prioritize rural_properties.",
    "- Supporting visual land classification: use complete_supplemental_reference only after the newer visual guides.",
    "- Final section order, lead stage classification, and Follow-Up Boss note format: prioritize deliverable_format_v3_final.",
    "- If a needed document category was not retrieved, do not pretend it was. Mark the related conclusion preliminary and add a verification/source gap.",
    "",
    "SOURCE VS FACT RULES",
    "- Land Insights AI comp/pricing numbers are not allowed as market value anchors.",
    "- Land Insights parcel fields, hazard layers, due diligence layers, MLS comp rows, and MLS comp photos may be used as property/visual evidence when captured.",
    "- Land Insights MLS comp photos/details can reduce or replace Redfin/Zillow inspection when they show enough APN/status/acreage/photo evidence, but label the evidence source clearly.",
    "- Redfin/Zillow/APN/photo observations may be used as visual/property evidence only when matchQuality is confirmed_match or clearly labeled possible_match.",
    "- Do not automatically reject family transfers, quit claim deeds, landlocked cases, acreage discrepancies, or major-issue comps. Classify them as clean anchor, price floor, price ceiling, weak context, or unrelated.",
    "- Weak or unusual comps should not anchor market value unless their weakness matches the subject. They can still be useful as floor/ceiling/context evidence when clearly labeled.",
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
