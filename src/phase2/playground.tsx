"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";

import {
  COMP_PROPERTY_TYPE_LABELS,
  type CompEvaluateResponse,
  type CompEvaluationDeliverable,
  type CompFeedbackPayload,
  type CompFeedbackRating,
} from "@/comp-tool/types";
import { formatComparableRowSummary } from "@/phase2/comparable-row";
import { Phase2MapPanel } from "@/phase2/map-panel";
import type {
  VisualBrowserIntakeArtifact,
  VisualComparableRow,
  VisualExtractedParcelFields,
  VisualKmlData,
  VisualParcelInspectorRequest,
  VisualParcelInspectorResult,
} from "@/phase2/types";

type FormState = {
  parcelLink: string;
  listingLinksText: string;
  notes: string;
  kmlText: string;
  kmlFileName: string;
};

type FeedbackFormState = Omit<
  CompFeedbackPayload,
  "artifactPath" | "phase2ArtifactId" | "source"
>;

type TestingProgress = {
  goal: number;
  totalComps: number;
  excludedLocalTests: number;
  artifactCount: number;
  percentComplete: number;
  lastUpdatedAt: string;
};

const DEFAULT_FORM: FormState = {
  parcelLink: "",
  listingLinksText: "",
  notes: "",
  kmlText: "",
  kmlFileName: "",
};

const DEFAULT_FEEDBACK_FORM: FeedbackFormState = {
  rating: "partial",
  correctDecision: "",
  correctMarketValue: "",
  correctOpeningOffer: "",
  whatWasWrong: "",
  whatShouldChange: "",
  ruleToRemember: "",
  reviewerName: "",
};

const FIELD_LABELS: Partial<Record<keyof VisualExtractedParcelFields, string>> = {
  apn: "APN",
  county: "County",
  state: "State",
  owner: "Owner",
  acreage: "Acreage",
  address: "Property address",
  ownerMailingAddress: "Owner mailing address",
  roadFrontage: "Road frontage",
  wetlands: "Wetlands",
  floodZone: "Flood zone",
  hoa: "HOA",
  hasStructure: "Has structure",
  currentLandUse: "Current land use",
  ownershipLength: "Ownership length",
  relationToProperty: "Relation to property",
  lastPurchasePrice: "Last purchase price",
  lastPurchaseDate: "Last purchase date",
  gps: "GPS",
  zoning: "Zoning",
  propertyTax: "Property tax",
  assessedValue: "Assessed value",
  assessedLandValue: "Assessed land value",
  assessedImprovementValue: "Assessed improvement value",
  structures: "Structures",
  structureCount: "Structure count",
  structureYearBuilt: "Structure year built",
  deedType: "Deed type",
  lastPurchaseType: "Last purchase type",
  inHoa: "In HOA",
  familyTransfer: "Family transfer",
  mobileHome: "Mobile home",
  landLocked: "Land locked",
  taxDelinquentFor: "Tax delinquent for",
};

const RECOMMENDATION_LABELS: Record<
  CompEvaluationDeliverable["decisionSummary"]["recommendation"],
  string
> = {
  hot_lead: "Hot lead",
  warm_lead: "Warm lead",
  nurture: "Nurture",
  verify_first: "Verify first",
  pass: "Pass",
};

function isUsefulOutputText(value: string) {
  const normalized = value.trim().toLowerCase();

  return Boolean(
    normalized &&
      !["n/a", "na", "none", "not available", "not provided"].includes(normalized),
  );
}

function uniqueText(items: string[]) {
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

function fieldValue(fields: VisualExtractedParcelFields | undefined, key: keyof VisualExtractedParcelFields) {
  return String(fields?.[key] || "").trim();
}

function parseDateMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatElapsedTime(ms: number | null) {
  if (ms === null || ms < 0) {
    return "Not tracked";
  }

  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function getCompTimingLabel(
  artifact: VisualBrowserIntakeArtifact | null,
  nowMs: number,
) {
  const startedAt =
    parseDateMs(artifact?.compEvaluationStartedAt) ??
    (artifact?.compEvaluationStatus === "pending" ? parseDateMs(artifact?.createdAt) : null);
  const completedAt = parseDateMs(artifact?.compEvaluationCompletedAt);

  if (!startedAt) {
    return "AI time: not tracked";
  }

  if (artifact?.compEvaluationStatus === "pending" && !completedAt) {
    return `AI running: ${formatElapsedTime(nowMs - startedAt)}`;
  }

  return `AI time: ${formatElapsedTime((completedAt ?? nowMs) - startedAt)}`;
}

function buildParcelEssentialItems(fields: VisualExtractedParcelFields | undefined) {
  const countyState = [fieldValue(fields, "county"), fieldValue(fields, "state")]
    .filter(Boolean)
    .join(", ");

  return [
    { label: "APN", value: fieldValue(fields, "apn") },
    { label: "County", value: countyState },
    { label: "Acres", value: fieldValue(fields, "acreage") },
    { label: "Wetlands", value: fieldValue(fields, "wetlands") },
    { label: "Road frontage", value: fieldValue(fields, "roadFrontage") },
    { label: "Flood zone", value: fieldValue(fields, "floodZone") },
    {
      label: "Structure",
      value:
        fieldValue(fields, "hasStructure") ||
        fieldValue(fields, "structures") ||
        fieldValue(fields, "structureCount"),
    },
    { label: "Owner", value: fieldValue(fields, "owner") },
  ].filter((item) => item.value);
}

function buildFallbackFollowUpBossNote(evaluation: CompEvaluationDeliverable) {
  return uniqueText([
    `Decision: ${evaluation.decisionSummary.oneLineDecision || RECOMMENDATION_LABELS[evaluation.decisionSummary.recommendation]}.`,
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

function buildFallbackCallPrepBrief(evaluation: CompEvaluationDeliverable) {
  const verificationItem =
    evaluation.pasteReadyOutputs.analystChecklist[0] ||
    evaluation.dataQuality.criticalMissingItems[0] ||
    evaluation.dataGaps[0] ||
    evaluation.decisionSummary.topRisks[0] ||
    "confirm access, usable acreage, and seller expectations";

  return uniqueText([
    evaluation.offerStrategy.scriptAngle
      ? `Opening angle: ${evaluation.offerStrategy.scriptAngle}`
      : "Opening angle: confirm the owner is open to selling before quoting firm numbers.",
    `Value anchor: ${evaluation.marketValue || "Needs verification"}${evaluation.pricePerAcre ? ` (${evaluation.pricePerAcre})` : ""}.`,
    `Offer posture: ${evaluation.offerStrategy.openingOffer || evaluation.offerPrices.fiftyPercent || "preliminary offer only after verification"}.`,
    `Verify before final offer: ${verificationItem}.`,
  ]).join("\n");
}

function getPasteReadyOutputs(evaluation: CompEvaluationDeliverable) {
  return {
    followUpBossNote: isUsefulOutputText(evaluation.pasteReadyOutputs.followUpBossNote)
      ? evaluation.pasteReadyOutputs.followUpBossNote
      : buildFallbackFollowUpBossNote(evaluation),
    callPrepBrief: isUsefulOutputText(evaluation.pasteReadyOutputs.callPrepBrief)
      ? evaluation.pasteReadyOutputs.callPrepBrief
      : buildFallbackCallPrepBrief(evaluation),
    analystChecklist: uniqueText([
      ...evaluation.pasteReadyOutputs.analystChecklist,
      ...evaluation.dataQuality.criticalMissingItems,
      ...evaluation.dataGaps,
      ...evaluation.decisionSummary.topRisks.map((risk) => `Review risk: ${risk}`),
    ]).slice(0, 10),
  };
}

function parseListingLinks(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildRequestPayload(form: FormState): VisualParcelInspectorRequest {
  return {
    parcelLink: form.parcelLink.trim(),
    listingLinks: parseListingLinks(form.listingLinksText),
    notes: form.notes.trim(),
    kmlText: form.kmlText,
    kmlFileName: form.kmlFileName,
  };
}

function formFromArtifact(artifact: VisualBrowserIntakeArtifact): FormState {
  return {
    parcelLink: artifact.request.parcelLink,
    listingLinksText: (artifact.request.listingLinks ?? artifact.request.browserPage?.listingLinks ?? []).join("\n"),
    notes: artifact.request.notes ?? "",
    kmlText: artifact.request.kmlText ?? "",
    kmlFileName: artifact.request.kmlFileName ?? "",
  };
}

function OutputList({ items }: { items: string[] }) {
  if (!items.length) {
    return <p className="muted-copy">None returned.</p>;
  }

  return (
    <ul className="flat-list compact-list">
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function CompBulletList({ items, empty = "N/A" }: { items: string[]; empty?: string }) {
  const filtered = items.filter(Boolean);

  if (!filtered.length) {
    return <p className="muted-copy">{empty}</p>;
  }

  return (
    <ul className="flat-list compact-list">
      {filtered.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function CompRunStatus({ result }: { result: CompEvaluateResponse }) {
  return (
    <div className="run-status">
      <span>
        {result.generation.status === "completed"
          ? `Generated with ${result.generation.provider}`
          : result.generation.status === "not_configured"
            ? "Prompt built, model not configured"
            : "Generation failed"}
      </span>
      {result.generation.usage ? (
        <span>
          Tokens: {result.generation.usage.inputTokens ?? "--"} /{" "}
          {result.generation.usage.outputTokens ?? "--"}
        </span>
      ) : null}
    </div>
  );
}

function CompDecisionSummaryTiles({
  evaluation,
}: {
  evaluation: CompEvaluationDeliverable;
}) {
  const decisionLabel = RECOMMENDATION_LABELS[evaluation.decisionSummary.recommendation];
  const topRisks = evaluation.decisionSummary.topRisks.filter(Boolean).slice(0, 3);
  const offerLine = [
    evaluation.offerStrategy.openingOffer || evaluation.offerPrices.fiftyPercent,
    evaluation.offerStrategy.targetOffer || evaluation.offerPrices.sixtyPercent,
  ]
    .filter(Boolean)
    .join(" -> ");

  return (
    <section className="decision-summary-grid" aria-label="CompTool V1 decision summary">
      <article
        className={`decision-summary-tile primary-summary-tile is-${evaluation.decisionSummary.recommendation}`}
      >
        <span>Decision</span>
        <strong>{decisionLabel}</strong>
        <p>{evaluation.decisionSummary.oneLineDecision || "Needs review before calling."}</p>
      </article>

      <article className="decision-summary-tile">
        <span>Market value</span>
        <strong>{evaluation.marketValue || "Verify"}</strong>
        <p>
          {evaluation.pricePerAcre || "PPA needed"} | {evaluation.confidence} confidence
        </p>
      </article>

      <article className="decision-summary-tile">
        <span>Offer</span>
        <strong>
          {evaluation.offerStrategy.openingOffer || evaluation.offerPrices.fiftyPercent || "N/A"}
        </strong>
        <p>{offerLine || "Offer range needs review"}</p>
      </article>

      <article className="decision-summary-tile">
        <span>Next action</span>
        <strong>{evaluation.decisionSummary.nextAction || "Verify first"}</strong>
        <p>{evaluation.decisionSummary.decisionReason || "No decision reason returned."}</p>
      </article>

      <article className="decision-summary-tile risk-summary-tile">
        <span>Top risks</span>
        {topRisks.length ? (
          <ul>
            {topRisks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        ) : (
          <strong>No major risks returned</strong>
        )}
      </article>

      <article className="decision-summary-tile">
        <span>Data quality</span>
        <strong>
          {evaluation.dataQuality.grade || "--"} / {evaluation.dataQuality.score || "--"}
        </strong>
        <p>
          {evaluation.dataQuality.criticalMissingItems.slice(0, 2).join(", ") ||
            "No critical gaps returned"}
        </p>
      </article>
    </section>
  );
}

function DealSnapshot({
  evaluation,
  fields,
}: {
  evaluation: CompEvaluationDeliverable;
  fields?: VisualExtractedParcelFields;
}) {
  const decisionLabel = RECOMMENDATION_LABELS[evaluation.decisionSummary.recommendation];
  const topRisk =
    evaluation.decisionSummary.topRisks[0] ||
    evaluation.dataQuality.criticalMissingItems[0] ||
    evaluation.dataGaps[0] ||
    "No major risk returned";
  const openingOffer =
    evaluation.offerStrategy.openingOffer ||
    evaluation.offerPrices.fiftyPercent ||
    "Needs verification";
  const parcelItems = buildParcelEssentialItems(fields);
  const quickFacts = [
    {
      label: "Data quality",
      value: `${evaluation.dataQuality.grade}${evaluation.dataQuality.score ? ` / ${evaluation.dataQuality.score}` : ""}`,
    },
    {
      label: "Confidence",
      value: evaluation.confidence,
    },
    {
      label: "Acres",
      value: fieldValue(fields, "acreage") || "Verify",
    },
    {
      label: "Wetlands",
      value: fieldValue(fields, "wetlands") || "Verify",
    },
    {
      label: "Road frontage",
      value: fieldValue(fields, "roadFrontage") || "Verify",
    },
    {
      label: "Next action",
      value: evaluation.decisionSummary.nextAction || "Verify first",
    },
  ];

  return (
    <section
      className={`deal-snapshot is-${evaluation.decisionSummary.recommendation}`}
      aria-label="Immediate comp decision"
    >
      <div className="deal-snapshot-main">
        <article className="deal-snapshot-decision">
          <span>Decision</span>
          <strong>{decisionLabel}</strong>
          <p>{evaluation.decisionSummary.oneLineDecision || evaluation.decisionSummary.decisionReason}</p>
        </article>

        <article>
          <span>Market value</span>
          <strong>{evaluation.marketValue || "Verify"}</strong>
          <p>{evaluation.pricePerAcre || "PPA needs review"}</p>
        </article>

        <article>
          <span>Opening offer</span>
          <strong>{openingOffer}</strong>
          <p>{evaluation.offerStrategy.targetOffer || evaluation.offerPrices.sixtyPercent || "Target needs review"}</p>
        </article>
      </div>

      <div className="deal-risk-strip">
        <span>Top risk</span>
        <strong>{topRisk}</strong>
      </div>

      <div className="deal-snapshot-strip">
        {quickFacts.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <b>{item.value}</b>
          </div>
        ))}
      </div>

      {parcelItems.length ? (
        <div className="parcel-essentials-inline" aria-label="Parcel essentials">
          {parcelItems.slice(0, 6).map((item) => (
            <span key={item.label}>
              <b>{item.label}:</b> {item.value}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ParcelEssentials({ fields }: { fields?: VisualExtractedParcelFields }) {
  const items = buildParcelEssentialItems(fields);

  if (!items.length) {
    return null;
  }

  return (
    <section className="simple-output-section">
      <div className="simple-section-head">
        <strong>Parcel essentials</strong>
      </div>
      <div className="parcel-essentials-grid">
        {items.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <b>{item.value}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function Phase2FeedbackPanel({
  result,
  phase2ArtifactId,
  variant = "compact",
  panelId,
}: {
  result: CompEvaluateResponse;
  phase2ArtifactId: string;
  variant?: "compact" | "wide";
  panelId?: string;
}) {
  const [feedback, setFeedback] = useState<FeedbackFormState>(DEFAULT_FEEDBACK_FORM);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const artifactPath = result.generation.artifactPath ?? "";
  const isWide = variant === "wide";
  const feedbackRows = isWide ? 9 : 3;

  function updateFeedback<Key extends keyof FeedbackFormState>(
    key: Key,
    value: FeedbackFormState[Key],
  ) {
    setFeedback((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveFeedback() {
    setSaveStatus(null);
    setSaveError(null);

    startSaving(async () => {
      try {
        const response = await fetch("/api/comp/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            artifactPath,
            phase2ArtifactId,
            source: "phase2",
            ...feedback,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to save evaluation.");
        }

        const payload = (await response.json()) as { artifactPath?: string };
        setSaveStatus(`Evaluation saved as training reference: ${payload.artifactPath ?? "saved"}`);
        setFeedback(DEFAULT_FEEDBACK_FORM);
      } catch (caughtError) {
        setSaveError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
      }
    });
  }

  return (
    <section
      className={`callout-card feedback-panel phase2-result-card${isWide ? " feedback-panel-wide" : ""}`}
      id={panelId}
    >
      <div className="simple-section-head">
        <strong>{isWide ? "Feedback evaluation" : "Review evaluation"}</strong>
        <span className="muted-chip">Saved as training reference</span>
      </div>

      <p className="muted-copy">
        Use this when Corbin or the sales team reviews the comp. Saved corrections become the
        practical reference set for future comp tuning.
      </p>

      <div className="field-grid">
        <label className="field">
          <span>Was this output correct?</span>
          <select
            value={feedback.rating}
            onChange={(event) =>
              updateFeedback("rating", event.target.value as CompFeedbackRating)
            }
          >
            <option value="yes">Yes</option>
            <option value="partial">Partially</option>
            <option value="no">No</option>
          </select>
        </label>

        <label className="field">
          <span>Correct decision</span>
          <input
            type="text"
            placeholder="Verify first, Warm lead, Pass..."
            value={feedback.correctDecision}
            onChange={(event) => updateFeedback("correctDecision", event.target.value)}
          />
        </label>

        <label className="field">
          <span>Correct market value</span>
          <input
            type="text"
            placeholder="$74,000"
            value={feedback.correctMarketValue}
            onChange={(event) => updateFeedback("correctMarketValue", event.target.value)}
          />
        </label>

        <label className="field">
          <span>Correct opening offer</span>
          <input
            type="text"
            placeholder="$37,000"
            value={feedback.correctOpeningOffer}
            onChange={(event) => updateFeedback("correctOpeningOffer", event.target.value)}
          />
        </label>

        <label className="field">
          <span>Reviewer</span>
          <input
            type="text"
            placeholder="Corbin"
            value={feedback.reviewerName}
            onChange={(event) => updateFeedback("reviewerName", event.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span>What was wrong?</span>
        <textarea
          rows={feedbackRows}
          placeholder="Example: It treated this as a Warm Lead, but access was not verified."
          value={feedback.whatWasWrong}
          onChange={(event) => updateFeedback("whatWasWrong", event.target.value)}
        />
      </label>

      <label className="field">
        <span>What should change?</span>
        <textarea
          rows={feedbackRows}
          placeholder="Example: Mark as Verify First until legal access is confirmed."
          value={feedback.whatShouldChange}
          onChange={(event) => updateFeedback("whatShouldChange", event.target.value)}
        />
      </label>

      <label className="field">
        <span>Rule to remember</span>
        <textarea
          rows={isWide ? 6 : 3}
          placeholder="Example: If access is unclear, default to Verify First unless price is clearly below 50% of market value."
          value={feedback.ruleToRemember}
          onChange={(event) => updateFeedback("ruleToRemember", event.target.value)}
        />
      </label>

      <button
        className="light-button"
        type="button"
        onClick={saveFeedback}
        disabled={isSaving || (!artifactPath && !phase2ArtifactId)}
      >
        {isSaving ? "Saving evaluation..." : "Save evaluation"}
      </button>

      {!artifactPath && !phase2ArtifactId ? (
        <p className="auth-note">Evaluation feedback requires a saved comp artifact.</p>
      ) : null}
      {saveStatus ? <p className="auth-note">{saveStatus}</p> : null}
      {saveError ? <p className="auth-error">{saveError}</p> : null}
    </section>
  );
}

function MarketOfferComparison({
  result,
  compEvaluation,
}: {
  result: VisualParcelInspectorResult;
  compEvaluation: CompEvaluateResponse | null;
}) {
  const evaluation = compEvaluation?.generation.evaluation;
  const dewClawDecision = evaluation
    ? RECOMMENDATION_LABELS[evaluation.decisionSummary.recommendation]
    : compEvaluation?.generation.status === "failed"
      ? "Failed"
      : "Generating";
  const offerRange = [
    evaluation?.offerPrices.fiftyPercent || evaluation?.offerStrategy.openingOffer,
    evaluation?.offerPrices.seventyPercent || evaluation?.offerStrategy.maxOffer,
  ]
    .filter(Boolean)
    .join(" - ");
  const compCount = result.comparableRows?.length ?? 0;
  const sourceSummary = [
    `${compCount} captured comps`,
    result.areaType,
    result.terrainType,
    result.structureSignal.replaceAll("_", " "),
    result.accessOrFrontageSignal.replaceAll("_", " "),
  ].filter(Boolean);
  const comparisonRows = [
    {
      label: "DewClaw market value",
      source: "Land Insights capture only",
      dewClaw: evaluation?.marketValue || "Generating",
    },
    {
      label: "DewClaw PPA",
      source: "Source rows only",
      dewClaw: evaluation?.pricePerAcre || "Generating",
    },
    {
      label: "Offer range 50% to 70%",
      source: "Not calculated from LI value",
      dewClaw: offerRange || "Generating",
    },
    {
      label: "50% offer",
      source: "DewClaw only",
      dewClaw:
        evaluation?.offerStrategy.openingOffer || evaluation?.offerPrices.fiftyPercent || "Generating",
    },
    {
      label: "60% target",
      source: "DewClaw only",
      dewClaw:
        evaluation?.offerStrategy.targetOffer || evaluation?.offerPrices.sixtyPercent || "Generating",
    },
    {
      label: "70% max",
      source: "DewClaw only",
      dewClaw: evaluation?.offerStrategy.maxOffer || evaluation?.offerPrices.seventyPercent || "Generating",
    },
  ];

  return (
    <section className="callout-card phase2-market-compare-card phase2-result-card">
      <div className="simple-section-head">
        <strong>Market value and offer range</strong>
        <span className="muted-chip">DewClaw pricing only</span>
      </div>

      <div className="market-compare-hero">
        <article>
          <span>Market value</span>
          <strong>{evaluation?.marketValue || dewClawDecision}</strong>
          <p>{evaluation?.pricePerAcre || "Waiting for DewClaw AI comp"}</p>
        </article>

        <article className="is-dewclaw">
          <span>Offer range of 50% to 70%</span>
          <strong>{offerRange || dewClawDecision}</strong>
          <p>
            {evaluation?.offerStrategy.openingOffer || "50% opening offer"} to{" "}
            {evaluation?.offerStrategy.maxOffer || "70% max offer"}
          </p>
        </article>
      </div>

      <p className="auth-note">
        Land Insights numbers are not used as pricing anchors. LI is used only for captured parcel
        facts, map context, and comparable rows; DewClaw generates the market value and offer range.
      </p>

      <div className="market-compare-table" role="table" aria-label="DewClaw pricing with Land Insights source context">
        <div className="market-compare-row market-compare-head" role="row">
          <span>Metric</span>
          <span>Source role</span>
          <span>DewClaw</span>
        </div>
        {comparisonRows.map((row) => (
          <div className="market-compare-row" role="row" key={row.label}>
            <span>{row.label}</span>
            <strong>{row.source}</strong>
            <strong>{row.dewClaw}</strong>
          </div>
        ))}
      </div>

      <p className="muted-copy">LI source context: {sourceSummary.join(" | ")}</p>

      {evaluation ? (
        <p className="muted-copy">
          Next action: {evaluation.decisionSummary.nextAction || "Verify core deal facts before offer."}
        </p>
      ) : null}
    </section>
  );
}

function LandInsightsCompResults({
  result,
  artifactMeta,
}: {
  result: VisualParcelInspectorResult;
  artifactMeta: VisualBrowserIntakeArtifact | null;
}) {
  const statusLabel = artifactMeta?.request.browserPage
    ? "Browser capture"
    : result.pageStatus.parcelPageReached
      ? "Parcel reached"
      : "Parcel failed";

  return (
    <section className="callout-card simple-output-section phase2-result-card">
      <div className="simple-section-head">
        <strong>LI CompResults</strong>
        <span className="muted-chip">{statusLabel}</span>
      </div>

      <div className="mini-grid">
        <div>
          <span>Area</span>
          <b>{result.areaType}</b>
        </div>
        <div>
          <span>Terrain</span>
          <b>{result.terrainType}</b>
        </div>
        <div>
          <span>Structure</span>
          <b>{result.structureSignal.replaceAll("_", " ")}</b>
        </div>
        <div>
          <span>Access</span>
          <b>{result.accessOrFrontageSignal.replaceAll("_", " ")}</b>
        </div>
      </div>

      <p className="muted-copy">{result.summary}</p>

      <section className="simple-output-section">
        <div className="simple-section-head">
          <strong>Captured comp rows</strong>
          <span className="muted-chip">{result.comparableRows?.length ?? 0}</span>
        </div>
        <ComparableRowsList rows={result.comparableRows?.slice(0, 5)} />
      </section>

      {result.visualRisks.length ? (
        <section className="simple-output-section">
          <div className="simple-section-head">
            <strong>LI flags</strong>
          </div>
          <OutputList items={result.visualRisks.slice(0, 4)} />
        </section>
      ) : null}
    </section>
  );
}

function EvaluationColumn({
  result,
  status,
  error,
}: {
  result: CompEvaluateResponse | null;
  status: VisualBrowserIntakeArtifact["compEvaluationStatus"] | null;
  error: string | null;
}) {
  if (!result && status === "pending") {
    return (
      <section className="callout-card simple-output-section phase2-result-card">
        <div className="simple-section-head">
          <strong>Evaluation</strong>
          <span className="muted-chip">Generating</span>
        </div>
        <p className="muted-copy">The review form will appear when DewClaw comping finishes.</p>
      </section>
    );
  }

  if (!result && status === "failed") {
    return (
      <section className="callout-card simple-output-section phase2-result-card">
        <div className="simple-section-head">
          <strong>Evaluation</strong>
          <span className="muted-chip">Failed</span>
        </div>
        <p className="auth-error">{error || "The DewClaw comp generation failed."}</p>
      </section>
    );
  }

  if (!result?.generation.evaluation) {
    return (
      <section className="callout-card simple-output-section phase2-result-card">
        <div className="simple-section-head">
          <strong>Evaluation</strong>
          <span className="muted-chip">Waiting</span>
        </div>
        <p className="muted-copy">Run or load a completed comp before saving reviewer feedback.</p>
      </section>
    );
  }

  const decision = result.generation.evaluation.decisionSummary;

  return (
    <section className="callout-card simple-output-section phase2-result-card evaluation-quick-card">
      <div className="simple-section-head">
        <strong>Evaluation</strong>
        <span className="muted-chip">Ready</span>
      </div>
      <p className="muted-copy">
        {decision.oneLineDecision || "DewClaw comp is ready for reviewer feedback."}
      </p>
      <a className="light-button feedback-jump-link" href="#phase2-feedback-evaluation">
        Open feedback box
      </a>
    </section>
  );
}

function FeedbackEvaluationSection({
  result,
  status,
  error,
  phase2ArtifactId,
}: {
  result: CompEvaluateResponse | null;
  status: VisualBrowserIntakeArtifact["compEvaluationStatus"] | null;
  error: string | null;
  phase2ArtifactId: string;
}) {
  if (!result && status === "pending") {
    return (
      <section
        className="callout-card simple-output-section feedback-panel-wide-placeholder"
        id="phase2-feedback-evaluation"
      >
        <div className="simple-section-head">
          <strong>Feedback evaluation</strong>
          <span className="muted-chip">Generating</span>
        </div>
        <p className="muted-copy">The full feedback box will appear after the AI comp finishes.</p>
      </section>
    );
  }

  if (!result && status === "failed") {
    return (
      <section
        className="callout-card simple-output-section feedback-panel-wide-placeholder"
        id="phase2-feedback-evaluation"
      >
        <div className="simple-section-head">
          <strong>Feedback evaluation</strong>
          <span className="muted-chip">Failed</span>
        </div>
        <p className="auth-error">{error || "The DewClaw comp generation failed."}</p>
      </section>
    );
  }

  if (!result?.generation.evaluation) {
    return (
      <section
        className="callout-card simple-output-section feedback-panel-wide-placeholder"
        id="phase2-feedback-evaluation"
      >
        <div className="simple-section-head">
          <strong>Feedback evaluation</strong>
          <span className="muted-chip">Waiting</span>
        </div>
        <p className="muted-copy">Load a completed comp before saving reviewer feedback.</p>
      </section>
    );
  }

  return (
    <Phase2FeedbackPanel
      result={result}
      phase2ArtifactId={phase2ArtifactId}
      variant="wide"
      panelId="phase2-feedback-evaluation"
    />
  );
}

function TestingProgressCard({ progress }: { progress: TestingProgress | null }) {
  const goal = progress?.goal ?? 1000;
  const totalComps = progress?.totalComps ?? 0;
  const percentComplete = progress?.percentComplete ?? 0;

  return (
    <section className="callout-card testing-progress-card">
      <div className="simple-section-head">
        <strong>Corbin testing progress</strong>
        <span className="muted-chip">{totalComps} / {goal} comps</span>
      </div>

      <div className="testing-progress-track" aria-label={`${percentComplete}% complete`}>
        <span style={{ width: `${Math.min(100, percentComplete)}%` }} />
      </div>

      <div className="testing-progress-stats">
        <span>{percentComplete}% of testing goal</span>
        <span>
          {progress
            ? `${progress.excludedLocalTests} local/sample tests excluded`
            : "Loading local count..."}
        </span>
      </div>
    </section>
  );
}

function Phase2TimingSummary({
  artifactMeta,
  nowMs,
}: {
  artifactMeta: VisualBrowserIntakeArtifact | null;
  nowMs: number;
}) {
  if (!artifactMeta) {
    return null;
  }

  return (
    <section className="callout-card simple-output-section">
      <div className="simple-section-head">
        <strong>Generation timing</strong>
        <span className="muted-chip">{artifactMeta.compEvaluationStatus || "capture only"}</span>
      </div>
      <CompBulletList
        items={[
          getCompTimingLabel(artifactMeta, nowMs),
          artifactMeta.compEvaluationStartedAt
            ? `Started: ${artifactMeta.compEvaluationStartedAt}`
            : "Started: not tracked",
          artifactMeta.compEvaluationCompletedAt
            ? `Completed: ${artifactMeta.compEvaluationCompletedAt}`
            : artifactMeta.compEvaluationStatus === "pending"
              ? "Completed: still running"
              : "Completed: not tracked",
        ]}
      />
    </section>
  );
}

function CompToolV1Output({
  result,
  status,
  error,
  fields,
}: {
  result: CompEvaluateResponse | null;
  status: VisualBrowserIntakeArtifact["compEvaluationStatus"] | null;
  error: string | null;
  fields?: VisualExtractedParcelFields;
}) {
  if (!result && status === "pending") {
    return (
      <section className="callout-card simple-output-section phase2-result-card">
        <div className="simple-section-head">
          <strong>DewClaw CompResults</strong>
          <span className="muted-chip">Generating</span>
        </div>
        <p className="muted-copy">
          The browser capture is saved. The V1 comp is still generating in the background.
        </p>
      </section>
    );
  }

  if (!result && status === "failed") {
    return (
      <section className="callout-card simple-output-section phase2-result-card">
        <div className="simple-section-head">
          <strong>DewClaw CompResults</strong>
          <span className="muted-chip">Failed</span>
        </div>
        <p className="auth-error">{error || "The V1 comp generation failed."}</p>
      </section>
    );
  }

  if (!result) {
    return null;
  }

  const evaluation = result.generation.evaluation;

  if (!evaluation) {
    return (
      <section className="callout-card simple-output-section phase2-result-card">
        <div className="simple-section-head">
          <strong>DewClaw CompResults</strong>
        </div>
        <CompRunStatus result={result} />
        {result.warnings.length ? <CompBulletList items={result.warnings} /> : null}
        <p className="muted-copy">
          The V1 prompt and retrieval packet were built, but live AI output is not available until a
          model key is configured.
        </p>
      </section>
    );
  }

  const pasteReadyOutputs = getPasteReadyOutputs(evaluation);

  return (
    <section className="callout-card simple-output-section phase2-result-card">
      <div className="simple-section-head">
        <strong>DewClaw CompResults</strong>
        <span className="muted-chip">{COMP_PROPERTY_TYPE_LABELS[result.request.propertyTypeFocus]}</span>
      </div>

      <DealSnapshot evaluation={evaluation} fields={fields} />
      <ParcelEssentials fields={fields} />
      <CompRunStatus result={result} />

      {result.warnings.length ? (
        <section className="simple-output-section">
          <div className="simple-section-head">
            <strong>Warnings</strong>
          </div>
          <CompBulletList items={result.warnings} />
        </section>
      ) : null}

      <section className="simple-output-section">
        <div className="simple-section-head">
          <strong>Market and offer</strong>
        </div>
        <CompBulletList
          items={[
            `Market value: ${evaluation.marketValue || "Needs verification"}`,
            `Price per acre: ${evaluation.pricePerAcre || "Needs verification"}`,
            `Opening offer: ${evaluation.offerStrategy.openingOffer || evaluation.offerPrices.fiftyPercent || "N/A"}`,
            `Target offer: ${evaluation.offerStrategy.targetOffer || evaluation.offerPrices.sixtyPercent || "N/A"}`,
            `Max offer: ${evaluation.offerStrategy.maxOffer || evaluation.offerPrices.seventyPercent || "N/A"}`,
            `Walk away: ${evaluation.offerStrategy.walkAwayPrice || "N/A"}`,
            `List price: ${evaluation.recommendedListPrice || "N/A"}`,
          ]}
        />
      </section>

      <section className="simple-output-section">
        <div className="simple-section-head">
          <strong>Caller output</strong>
        </div>
        <div className="copy-stack">
          <div>
            <span className="section-label">Follow Up Boss note</span>
            <pre className="compact-pre">
              {pasteReadyOutputs.followUpBossNote}
            </pre>
          </div>
          <div>
            <span className="section-label">Call prep</span>
            <pre className="compact-pre">{pasteReadyOutputs.callPrepBrief}</pre>
          </div>
        </div>
      </section>

      <section className="simple-output-section">
        <div className="simple-section-head">
          <strong>Verify next</strong>
        </div>
        <CompBulletList
          items={[
            ...pasteReadyOutputs.analystChecklist,
            ...evaluation.dataQuality.criticalMissingItems,
            ...evaluation.dataGaps,
          ].slice(0, 10)}
        />
      </section>
    </section>
  );
}

function DewClawCompDetails({ result }: { result: CompEvaluateResponse | null }) {
  const evaluation = result?.generation.evaluation;

  if (!result || !evaluation) {
    return null;
  }

  return (
    <>
      <details className="details-card">
        <summary>DewClaw decision details</summary>
        <div className="details-card-body">
          <CompDecisionSummaryTiles evaluation={evaluation} />
        </div>
      </details>

      <details className="details-card">
        <summary>Full DewClaw deliverable</summary>
        <pre>{evaluation.fullDeliverableMarkdown}</pre>
      </details>

      <details className="details-card">
        <summary>DewClaw run details</summary>
        <CompBulletList
          items={[
            `State: ${result.request.state || "--"}`,
            `County: ${result.request.county || "--"}`,
            `Acreage: ${result.request.acreage || "--"}`,
            `Asking price: ${result.request.sellerAskingPrice || "Not provided"}`,
            `Parcel ingestion: ${result.parcelEnrichment?.status || "browser capture"}`,
            `Artifact: ${result.generation.artifactPath || "--"}`,
          ]}
        />
      </details>
    </>
  );
}

function FieldList({ fields }: { fields: VisualExtractedParcelFields | undefined }) {
  const entries = Object.entries(fields ?? {}).filter(([, value]) => Boolean(value));

  if (!entries.length) {
    return <p className="muted-copy">No structured parcel fields captured yet.</p>;
  }

  return (
    <ul className="flat-list compact-list">
      {entries.map(([key, value], index) => (
        <li key={`${index}-${key}`}>
          <strong>{FIELD_LABELS[key as keyof VisualExtractedParcelFields] || key}:</strong> {value}
        </li>
      ))}
    </ul>
  );
}

function KmlSummary({ kmlData }: { kmlData: VisualKmlData | null | undefined }) {
  if (!kmlData) {
    return <p className="muted-copy">No KML file attached.</p>;
  }

  return (
    <ul className="flat-list compact-list">
      <li>
        <strong>File:</strong> {kmlData.fileName || "(unnamed)"}
      </li>
      <li>
        <strong>Placemark:</strong> {kmlData.placemarkName || "(empty)"}
      </li>
      <li>
        <strong>APN:</strong> {kmlData.apn || "(empty)"}
      </li>
      <li>
        <strong>Address:</strong> {kmlData.address || "(empty)"}
      </li>
      <li>
        <strong>Owner:</strong> {kmlData.owner || "(empty)"}
      </li>
      <li>
        <strong>Acreage:</strong> {kmlData.acreage || "(empty)"}
      </li>
      <li>
        <strong>Coordinate count:</strong> {kmlData.coordinateCount}
      </li>
      {kmlData.bounds ? (
        <li>
          <strong>Bounds:</strong> {kmlData.bounds.minLat.toFixed(6)}, {kmlData.bounds.minLon.toFixed(6)} to{" "}
          {kmlData.bounds.maxLat.toFixed(6)}, {kmlData.bounds.maxLon.toFixed(6)}
        </li>
      ) : null}
    </ul>
  );
}

function ArtifactKmlAttachPanel({
  artifactId,
  result,
  artifactMeta,
  isUploading,
  uploadStatus,
  onUpload,
}: {
  artifactId: string;
  result: VisualParcelInspectorResult | null;
  artifactMeta: VisualBrowserIntakeArtifact | null;
  isUploading: boolean;
  uploadStatus: string;
  onUpload: (file: File | null) => void;
}) {
  if (!artifactId || !result) {
    return null;
  }

  const hasKml = Boolean(result.kmlData);
  const captureStatus = artifactMeta?.request.browserPage?.kmlCaptureStatus || "";

  return (
    <section className="callout-card simple-output-section">
      <div className="simple-section-head">
        <strong>{hasKml ? "KML attached" : "KML not attached"}</strong>
        <span className={`filters-status${isUploading ? " is-pending" : ""}`}>
          {isUploading ? "Uploading..." : hasKml ? "Ready" : "Needs file"}
        </span>
      </div>

      <p className="muted-copy">
        {hasKml
          ? "Boundary data is attached to this saved comp. Upload another KML only if you need to replace it."
          : "Upload the KML file that Land Insights downloaded. CompTool will save it to this comp and refresh the output."}
      </p>

      <label className="field">
        <span>{hasKml ? "Replace KML export" : "Upload downloaded KML export"}</span>
        <input
          type="file"
          accept=".kml,application/vnd.google-earth.kml+xml,text/xml,application/xml"
          disabled={isUploading}
          onChange={(event) => {
            onUpload(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
      </label>

      {captureStatus ? <p className="muted-copy">Extension status: {captureStatus}</p> : null}
      {uploadStatus ? <p className="muted-copy">{uploadStatus}</p> : null}
    </section>
  );
}

function ComparableRowsList({ rows }: { rows: VisualComparableRow[] | undefined }) {
  if (!(rows ?? []).length) {
    return <p className="muted-copy">No comparable rows captured yet.</p>;
  }

  return (
    <ul className="flat-list compact-list">
      {rows!.slice(0, 10).map((row, index) => (
        <li key={`${index}-${row.listingUrl || row.city || "row"}`}>
          {formatComparableRowSummary(row)}
        </li>
      ))}
    </ul>
  );
}

export function VisualParcelInspectorPlayground() {
  const searchParams = useSearchParams();
  const artifactIdFromQuery = searchParams.get("artifact")?.trim() || "";

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [result, setResult] = useState<VisualParcelInspectorResult | null>(null);
  const [compEvaluation, setCompEvaluation] = useState<CompEvaluateResponse | null>(null);
  const [compEvaluationStatus, setCompEvaluationStatus] = useState<
    VisualBrowserIntakeArtifact["compEvaluationStatus"] | null
  >(null);
  const [compEvaluationError, setCompEvaluationError] = useState<string | null>(null);
  const [artifactId, setArtifactId] = useState<string>("");
  const [artifactMeta, setArtifactMeta] = useState<VisualBrowserIntakeArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testingProgress, setTestingProgress] = useState<TestingProgress | null>(null);
  const [isKmlUploading, setIsKmlUploading] = useState(false);
  const [kmlUploadStatus, setKmlUploadStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isLoadingArtifact, setIsLoadingArtifact] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let isActive = true;

    void fetch("/api/phase2/testing-progress", {
      method: "GET",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as TestingProgress;
      })
      .then((progress) => {
        if (isActive && progress) {
          setTestingProgress(progress);
        }
      })
      .catch(() => {
        // Progress is helpful, not critical. Keep the dashboard usable if counting fails.
      });

    return () => {
      isActive = false;
    };
  }, [artifactId, compEvaluationStatus]);

  useEffect(() => {
    if (compEvaluationStatus !== "pending") {
      return;
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [compEvaluationStatus]);

  useEffect(() => {
    if (!artifactIdFromQuery) {
      return;
    }

    let isActive = true;
    setIsLoadingArtifact(true);
    setError(null);

    void fetch(`/api/phase2/browser-intake/${artifactIdFromQuery}`, {
      method: "GET",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to load browser artifact.");
        }

        return (await response.json()) as VisualBrowserIntakeArtifact;
      })
      .then((artifact) => {
        if (!isActive) {
          return;
        }

        setArtifactMeta(artifact);
        setArtifactId(artifact.id);
        setForm(formFromArtifact(artifact));
        setResult(artifact.result);
        setCompEvaluation(artifact.compEvaluation ?? null);
        setCompEvaluationStatus(
          artifact.compEvaluationStatus ?? (artifact.compEvaluation ? "completed" : null),
        );
        setCompEvaluationError(artifact.compEvaluationError ?? null);
      })
      .catch((caughtError) => {
        if (!isActive) {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : "Failed to load browser artifact.");
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingArtifact(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [artifactIdFromQuery]);

  useEffect(() => {
    const currentArtifactId = artifactId || artifactIdFromQuery;

    if (!currentArtifactId || compEvaluationStatus !== "pending") {
      return;
    }

    let isActive = true;

    async function refreshArtifact() {
      try {
        const response = await fetch(`/api/phase2/browser-intake/${currentArtifactId}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const artifact = (await response.json()) as VisualBrowserIntakeArtifact;

        if (!isActive) {
          return;
        }

        setArtifactMeta(artifact);
        setArtifactId(artifact.id);
        setResult(artifact.result);
        setCompEvaluation(artifact.compEvaluation ?? null);
        setCompEvaluationStatus(
          artifact.compEvaluationStatus ?? (artifact.compEvaluation ? "completed" : null),
        );
        setCompEvaluationError(artifact.compEvaluationError ?? null);
      } catch {
        // Keep the current capture visible; the next poll can recover.
      }
    }

    const interval = window.setInterval(() => {
      void refreshArtifact();
    }, 4000);

    void refreshArtifact();

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [artifactId, artifactIdFromQuery, compEvaluationStatus]);

  const browserCaptureSummary = useMemo(() => {
    if (!artifactMeta?.request.browserPage) {
      return null;
    }

    const page = artifactMeta.request.browserPage;
    return {
      sourceUrl: page.sourceUrl,
      pageTitle: page.pageTitle || "(empty title)",
      extractedAt: page.extractedAt || artifactMeta.createdAt,
      fieldCount: Object.values(page.extractedFields ?? {}).filter(Boolean).length,
      rowCount: page.comparableRows?.length ?? 0,
    };
  }, [artifactMeta]);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleKmlUpload(file: File | null) {
    if (!file) {
      updateField("kmlText", "");
      updateField("kmlFileName", "");
      return;
    }

    const text = await file.text();
    updateField("kmlText", text);
    updateField("kmlFileName", file.name);
  }

  async function handleArtifactKmlUpload(file: File | null) {
    const currentArtifactId = artifactId || artifactIdFromQuery;

    if (!file || !currentArtifactId) {
      return;
    }

    setIsKmlUploading(true);
    setKmlUploadStatus("Uploading KML and refreshing comp output...");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/phase2/browser-intake/${currentArtifactId}/kml`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to attach KML.");
      }

      const artifact = (await response.json()) as VisualBrowserIntakeArtifact;
      setArtifactMeta(artifact);
      setArtifactId(artifact.id);
      setForm(formFromArtifact(artifact));
      setResult(artifact.result);
      setCompEvaluation(artifact.compEvaluation ?? null);
      setCompEvaluationStatus(
        artifact.compEvaluationStatus ?? (artifact.compEvaluation ? "completed" : null),
      );
      setCompEvaluationError(artifact.compEvaluationError ?? null);
      setKmlUploadStatus(
        artifact.compEvaluationStatus === "completed"
          ? "KML attached. DewClaw comp refreshed."
          : "KML attached. Review the comp status below.",
      );
    } catch (caughtError) {
      setKmlUploadStatus("");
      setError(caughtError instanceof Error ? caughtError.message : "Failed to attach KML.");
    } finally {
      setIsKmlUploading(false);
    }
  }

  function runInspection() {
    setError(null);
    setArtifactId("");
    setArtifactMeta(null);
    setCompEvaluation(null);
    setCompEvaluationStatus(null);
    setCompEvaluationError(null);
    setKmlUploadStatus("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/phase2/inspect", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildRequestPayload(form)),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to inspect parcel.");
        }

        setResult((await response.json()) as VisualParcelInspectorResult);
      } catch (caughtError) {
        setResult(null);
        setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
      }
    });
  }

  const isArtifactLoadingView = Boolean(artifactIdFromQuery && !result && !error);
  const shouldPrioritizeOutput = Boolean(result);

  if (isArtifactLoadingView) {
    return (
      <div className="two-column-grid phase2-grid">
        <section className="panel phase2-output-panel phase2-loading-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Output</p>
              <h2>Loading saved comp</h2>
            </div>
            <span className={`filters-status${isLoadingArtifact ? " is-pending" : ""}`}>
              {isLoadingArtifact ? "Loading..." : "Preparing..."}
            </span>
          </div>
          <p className="auth-note">
            Pulling the saved browser capture and DewClaw comp result. The dashboard will appear
            here as soon as it is ready.
          </p>
        </section>
      </div>
    );
  }

  const inputPanel = (
    <section className="panel phase2-source-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{shouldPrioritizeOutput ? "Source" : "Phase 2A"}</p>
            <h2>{shouldPrioritizeOutput ? "Source and rerun controls" : "Visual Parcel Inspector"}</h2>
          </div>
          <span className={`filters-status${isPending || isLoadingArtifact ? " is-pending" : ""}`}>
            {isPending ? "Inspecting..." : isLoadingArtifact ? "Loading capture..." : "Ready"}
          </span>
        </div>

        {browserCaptureSummary ? (
          <section className="callout-card simple-output-section">
            <div className="simple-section-head">
              <strong>Loaded browser capture</strong>
            </div>
            <div className="capture-summary-grid">
              <div>
                <span>Fields</span>
                <b>{browserCaptureSummary.fieldCount}</b>
              </div>
              <div>
                <span>Comp rows</span>
                <b>{browserCaptureSummary.rowCount}</b>
              </div>
              <div>
                <span>Captured</span>
                <b>{browserCaptureSummary.extractedAt}</b>
              </div>
            </div>
            <p className="muted-copy">Source URL: {browserCaptureSummary.sourceUrl}</p>
            <p className="muted-copy">Artifact ID: {artifactId}</p>
          </section>
        ) : null}

        <div className="comp-form">
          <label className="field">
            <span>Parcel link</span>
            <input
              type="url"
              placeholder="https://..."
              value={form.parcelLink}
              onChange={(event) => updateField("parcelLink", event.target.value)}
            />
            <small>Required. This is the main page the Phase 2 inspector will open first.</small>
          </label>

          <label className="field">
            <span>Listing links</span>
            <textarea
              rows={5}
              placeholder="Optional. Paste one Redfin/Zillow link per line."
              value={form.listingLinksText}
              onChange={(event) => updateField("listingLinksText", event.target.value)}
            />
            <small>Optional. Use one line per link.</small>
          </label>

          <label className="field">
            <span>Notes</span>
            <textarea
              rows={5}
              placeholder="Optional. Add known context or what you want to validate."
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </label>

          <label className="field">
            <span>KML export</span>
            <input
              type="file"
              accept=".kml,application/vnd.google-earth.kml+xml,text/xml,application/xml"
              onChange={(event) => {
                void handleKmlUpload(event.target.files?.[0] ?? null);
              }}
            />
            <small>
              Optional. Attach the Land Insights export file to enrich parcel identity and geometry.
            </small>
          </label>

          {form.kmlFileName ? <p className="muted-copy">Loaded KML: {form.kmlFileName}</p> : null}

          <div className="hero-actions comp-form-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={runInspection}
              disabled={isPending || isLoadingArtifact}
            >
              {isPending ? "Inspecting..." : "Run visual inspection"}
            </button>
          </div>

          {error ? <p className="auth-error">{error}</p> : null}
        </div>
      </section>
  );

  const outputPanel = (
      <section className="panel phase2-output-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Output</p>
            <h2>Dashboard result</h2>
          </div>
        </div>

        {!result ? (
          <p className="auth-note">
            {isLoadingArtifact || artifactIdFromQuery
              ? "Loading the saved comp result. The dashboard will appear here first."
              : "This prototype now returns structured parcel fields, optional KML metadata, page diagnostics, and the visual classification summary."}
          </p>
        ) : (
          <div className="comp-output compact-output phase2-output-layout">
            <section className="phase2-top-columns" aria-label="Comp result comparison">
              <MarketOfferComparison
                result={result}
                compEvaluation={compEvaluation}
              />

              <EvaluationColumn
                result={compEvaluation}
                status={compEvaluationStatus}
                error={compEvaluationError}
              />
            </section>

            <section className="phase2-full-width-stack" aria-label="Supporting comp details">
              <ArtifactKmlAttachPanel
                artifactId={artifactId}
                result={result}
                artifactMeta={artifactMeta}
                isUploading={isKmlUploading}
                uploadStatus={kmlUploadStatus}
                onUpload={(file) => {
                  void handleArtifactKmlUpload(file);
                }}
              />

              <FeedbackEvaluationSection
                result={compEvaluation}
                status={compEvaluationStatus}
                error={compEvaluationError}
                phase2ArtifactId={artifactId}
              />

              <TestingProgressCard progress={testingProgress} />

              <Phase2MapPanel
                fields={result.structuredFields}
                kmlData={result.kmlData}
                comparableRows={result.comparableRows}
              />

              <section className="decision-summary-grid" aria-label="Phase 2 summary">
                <article className="decision-summary-tile primary-summary-tile">
                  <span>Summary</span>
                  <strong>{result.areaType}</strong>
                  <p>{result.summary}</p>
                </article>

                <article className="decision-summary-tile">
                  <span>Terrain</span>
                  <strong>{result.terrainType}</strong>
                  <p>Visual terrain classification</p>
                </article>

                <article className="decision-summary-tile">
                  <span>Structure signal</span>
                  <strong>{result.structureSignal.replaceAll("_", " ")}</strong>
                  <p>Improvement / housing contamination signal</p>
                </article>

                <article className="decision-summary-tile">
                  <span>Access / frontage</span>
                  <strong>{result.accessOrFrontageSignal.replaceAll("_", " ")}</strong>
                  <p>Visible access or frontage signal</p>
                </article>

                <article className="decision-summary-tile">
                  <span>Confidence</span>
                  <strong>{result.confidence}</strong>
                  <p>Current structured-confidence read</p>
                </article>

                <article className="decision-summary-tile">
                  <span>Page status</span>
                  <strong>
                    {artifactMeta?.request.browserPage
                      ? "Browser capture"
                      : result.pageStatus.parcelPageReached
                        ? "Parcel reached"
                        : "Parcel failed"}
                  </strong>
                  <p>
                    {artifactMeta?.request.browserPage
                      ? `External listing fetch skipped; ${result.comparableRows?.length ?? 0} comp rows captured.`
                      : `Listings reached: ${result.pageStatus.listingPagesReached} / ${result.pageStatus.listingPagesAttempted}`}
                  </p>
                </article>
              </section>

              <DewClawCompDetails result={compEvaluation} />

              <section className="callout-card simple-output-section">
                <div className="simple-section-head">
                  <strong>Parcel diagnostics</strong>
                </div>
                <p className="muted-copy">Title: {result.parcelPageTitle || "(empty title)"}</p>
                <p className="muted-copy">Final URL: {result.parcelFinalUrl || "(empty URL)"}</p>
              </section>

              <section className="callout-card simple-output-section">
                <div className="simple-section-head">
                  <strong>Structured parcel fields</strong>
                </div>
                <FieldList fields={result.structuredFields} />
              </section>

              <section className="callout-card simple-output-section">
                <div className="simple-section-head">
                  <strong>KML summary</strong>
                </div>
                <KmlSummary kmlData={result.kmlData} />
              </section>

              <section className="callout-card simple-output-section">
                <div className="simple-section-head">
                  <strong>Comparable rows</strong>
                </div>
                <ComparableRowsList rows={result.comparableRows} />
              </section>

              <section className="callout-card simple-output-section">
                <div className="simple-section-head">
                  <strong>Visual risks</strong>
                </div>
                <OutputList items={result.visualRisks} />
              </section>

              <section className="callout-card simple-output-section">
                <div className="simple-section-head">
                  <strong>Verify next</strong>
                </div>
                <OutputList items={result.verifyNext} />
              </section>

              <details className="details-card">
                <summary>Diagnostics</summary>
                <OutputList items={result.diagnostics ?? []} />
              </details>

              <details className="details-card">
                <summary>Navigation log</summary>
                <OutputList items={result.navigationLog ?? []} />
              </details>

              <Phase2TimingSummary artifactMeta={artifactMeta} nowMs={nowMs} />
            </section>
          </div>
        )}
      </section>
  );

  return (
    <div className={`two-column-grid phase2-grid${shouldPrioritizeOutput ? " is-output-first" : ""}`}>
      {shouldPrioritizeOutput ? (
        <>
          {outputPanel}
          {inputPanel}
        </>
      ) : (
        <>
          {inputPanel}
          {outputPanel}
        </>
      )}
    </div>
  );
}
