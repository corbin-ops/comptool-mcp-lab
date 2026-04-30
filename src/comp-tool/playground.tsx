"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

import {
  COUNTY_OPTIONS_BY_STATE,
  US_STATE_OPTIONS,
} from "@/comp-tool/location-data";
import {
  COMP_PROPERTY_TYPE_DESCRIPTIONS,
  COMP_PROPERTY_TYPE_LABELS,
  DEFAULT_COMP_MODE,
  type CompEvaluateResponse,
  type CompEvaluationDeliverable,
  type CompFeedbackPayload,
  type CompFeedbackRating,
  type CompMode,
  type CompPropertyTypeFocus,
} from "@/comp-tool/types";

type ModePreset = "default" | "manual";

type FormState = {
  modePreset: ModePreset;
  propertyTypeFocus: Exclude<CompPropertyTypeFocus, "auto_detect">;
  parcelLink: string;
  county: string;
  state: string;
  acreage: string;
  sellerAskingPrice: string;
  question: string;
  knownFacts: string;
  topK: string;
};

type ParseParcelResponse = Pick<
  CompEvaluateResponse,
  "request" | "parcelEnrichment" | "warnings"
>;

type FeedbackFormState = Omit<CompFeedbackPayload, "artifactPath">;

const DEFAULT_FORM: FormState = {
  modePreset: "default",
  propertyTypeFocus: "vacant_land",
  parcelLink: "",
  county: "",
  state: "",
  acreage: "",
  sellerAskingPrice: "",
  question: "",
  knownFacts: "",
  topK: "8",
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

function getEffectiveMode(form: FormState): CompMode {
  return DEFAULT_COMP_MODE;
}

function getEffectivePropertyTypeFocus(form: FormState): CompPropertyTypeFocus {
  return form.modePreset === "manual" ? form.propertyTypeFocus : "auto_detect";
}

function buildEvaluateRequestPayload(form: FormState) {
  return {
    mode: getEffectiveMode(form),
    propertyTypeFocus: getEffectivePropertyTypeFocus(form),
    parcelLink: form.parcelLink,
    county: form.county,
    state: form.state,
    acreage: form.acreage,
    sellerAskingPrice: form.sellerAskingPrice,
    question: form.question,
    knownFacts: form.knownFacts,
    topK: form.topK,
  };
}

function mergeText(current: string, incoming: string) {
  const parts = [current, incoming]
    .map((part) => part.trim())
    .filter(Boolean);
  const unique = [...new Set(parts.map((part) => part.toLowerCase()))];

  if (unique.length === 1 && parts.length > 1) {
    return parts[0];
  }

  return parts.join("\n");
}

function BulletList({ items, empty = "N/A" }: { items: string[]; empty?: string }) {
  const filtered = items.filter(Boolean);

  if (!filtered.length) {
    return <p className="muted-copy">{empty}</p>;
  }

  return (
    <ul className="flat-list compact-list">
      {filtered.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function OutputSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="callout-card simple-output-section">
      <div className="simple-section-head">
        <strong>{title}</strong>
        <Link href={`/references#${id}`}>Reference</Link>
      </div>
      {children}
    </section>
  );
}

function RunStatus({ result }: { result: CompEvaluateResponse }) {
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

function DecisionSummaryTiles({
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
    <section className="decision-summary-grid" aria-label="Decision summary">
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

function SimplifiedOutput({ result }: { result: CompEvaluateResponse }) {
  const evaluation = result.generation.evaluation;

  if (!evaluation) {
    return (
      <div className="comp-output">
        <RunStatus result={result} />
        {result.warnings.length ? (
          <OutputSection id="others" title="Warnings">
            <BulletList items={result.warnings} />
          </OutputSection>
        ) : null}
        <OutputSection id="others" title="Prompt packet">
          <p className="muted-copy">
            The model did not return a completed comp. Use the generated prompt or fix the model
            configuration.
          </p>
        </OutputSection>
      </div>
    );
  }

  return (
    <div className="comp-output compact-output">
      <DecisionSummaryTiles evaluation={evaluation} />

      <RunStatus result={result} />

      {result.warnings.length ? (
        <OutputSection id="others" title="Warnings">
          <BulletList items={result.warnings} />
        </OutputSection>
      ) : null}

      <OutputSection id="decision" title="Decision details">
        <BulletList
          items={[
            `Reason: ${evaluation.decisionSummary.decisionReason || "N/A"}`,
            ...evaluation.decisionSummary.topRisks
              .slice(0, 5)
              .map((risk) => `Top risk: ${risk}`),
          ]}
        />
      </OutputSection>

      <OutputSection id="market-value" title="2. Market Value">
        <BulletList
          items={[
            `Market value: ${evaluation.marketValue || "Needs verification"}`,
            `Price per acre: ${evaluation.pricePerAcre || "Needs verification"}`,
            `Confidence: ${evaluation.confidence}`,
            `Data quality: ${evaluation.dataQuality.grade || "--"} (${evaluation.dataQuality.score || "--"})`,
            `Reason: ${evaluation.marketValueReasoning || "N/A"}`,
          ]}
        />
      </OutputSection>

      <OutputSection id="offer" title="3. Offer">
        <BulletList
          items={[
            `Opening: ${evaluation.offerStrategy.openingOffer || evaluation.offerPrices.fiftyPercent || "N/A"}`,
            `Target: ${evaluation.offerStrategy.targetOffer || evaluation.offerPrices.sixtyPercent || "N/A"}`,
            `Max: ${evaluation.offerStrategy.maxOffer || evaluation.offerPrices.seventyPercent || "N/A"}`,
            `Walk away: ${evaluation.offerStrategy.walkAwayPrice || "N/A"}`,
            `List price: ${evaluation.recommendedListPrice || "N/A"}`,
            `Script angle: ${evaluation.offerStrategy.scriptAngle || "N/A"}`,
          ]}
        />
      </OutputSection>

      <OutputSection id="others" title="4. Others">
        <div className="copy-stack">
          <div>
            <span className="section-label">Follow Up Boss note</span>
            <pre className="compact-pre">
              {evaluation.pasteReadyOutputs.followUpBossNote || "N/A"}
            </pre>
          </div>

          <div>
            <span className="section-label">Call prep</span>
            <pre className="compact-pre">{evaluation.pasteReadyOutputs.callPrepBrief || "N/A"}</pre>
          </div>

          <div>
            <span className="section-label">Verify next</span>
            <BulletList
              items={[
                ...evaluation.pasteReadyOutputs.analystChecklist,
                ...evaluation.dataQuality.criticalMissingItems,
                ...evaluation.dataGaps,
              ].slice(0, 8)}
            />
          </div>
        </div>
      </OutputSection>

      <details className="details-card">
        <summary>Full deliverable</summary>
        <pre>{evaluation.fullDeliverableMarkdown}</pre>
      </details>

      <details className="details-card">
        <summary>Run details</summary>
        <BulletList
          items={[
            `Property type focus: ${COMP_PROPERTY_TYPE_LABELS[result.request.propertyTypeFocus] || result.request.propertyTypeFocus || "--"}`,
            `State: ${result.request.state || "--"}`,
            `County: ${result.request.county || "--"}`,
            `Acreage: ${result.request.acreage || "--"}`,
            `Asking price: ${result.request.sellerAskingPrice || "Not provided"}`,
            `Parcel ingestion: ${result.parcelEnrichment?.status || "not used"}`,
            `Artifact: ${result.generation.artifactPath || "--"}`,
          ]}
        />
      </details>

      <FeedbackPanel result={result} />
    </div>
  );
}

function FeedbackPanel({ result }: { result: CompEvaluateResponse }) {
  const [feedback, setFeedback] = useState<FeedbackFormState>(DEFAULT_FEEDBACK_FORM);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const artifactPath = result.generation.artifactPath ?? "";

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
            ...feedback,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to save feedback.");
        }

        const payload = (await response.json()) as { artifactPath?: string };
        setSaveStatus(`Feedback saved: ${payload.artifactPath ?? "saved"}`);
        setFeedback(DEFAULT_FEEDBACK_FORM);
      } catch (caughtError) {
        setSaveError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
      }
    });
  }

  return (
    <section className="callout-card feedback-panel">
      <div className="simple-section-head">
        <strong>Training feedback</strong>
        <span className="muted-chip">Saved as JSON</span>
      </div>

      <p className="muted-copy">
        Use this when Corbin reviews an output. These corrections become the training and QA set.
      </p>

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

      <div className="input-pair">
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
      </div>

      <div className="input-pair">
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
          rows={3}
          placeholder="Example: It called this a Warm Lead, but access was not verified."
          value={feedback.whatWasWrong}
          onChange={(event) => updateFeedback("whatWasWrong", event.target.value)}
        />
      </label>

      <label className="field">
        <span>What should change?</span>
        <textarea
          rows={3}
          placeholder="Example: Mark as Verify First until road frontage is confirmed."
          value={feedback.whatShouldChange}
          onChange={(event) => updateFeedback("whatShouldChange", event.target.value)}
        />
      </label>

      <label className="field">
        <span>Rule to remember next time</span>
        <textarea
          rows={3}
          placeholder="Example: If access is missing, default to Verify First unless seller ask is clearly below 50% of value."
          value={feedback.ruleToRemember}
          onChange={(event) => updateFeedback("ruleToRemember", event.target.value)}
        />
      </label>

      <button
        className="light-button"
        type="button"
        onClick={saveFeedback}
        disabled={isSaving || !artifactPath}
      >
        {isSaving ? "Saving feedback..." : "Save feedback"}
      </button>

      {!artifactPath ? (
        <p className="auth-note">Feedback requires a saved evaluation artifact.</p>
      ) : null}
      {saveStatus ? <p className="auth-note">{saveStatus}</p> : null}
      {saveError ? <p className="auth-error">{saveError}</p> : null}
    </section>
  );
}

export function CompToolPlayground() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [result, setResult] = useState<CompEvaluateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseStatus, setParseStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isParsing, startParseTransition] = useTransition();
  const countyOptions = COUNTY_OPTIONS_BY_STATE[form.state] ?? [];
  const effectivePropertyTypeFocus = getEffectivePropertyTypeFocus(form);
  const hasCustomCounty = Boolean(
    form.county && form.state && !countyOptions.includes(form.county),
  );

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "state" ? { county: "" } : {}),
    }));
  }

  function parseParcelLink() {
    setError(null);
    setParseStatus(null);

    if (!form.parcelLink.trim()) {
      setError("Add a parcel link before parsing.");
      return;
    }

    startParseTransition(async () => {
      try {
        const response = await fetch("/api/comp/parse-parcel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildEvaluateRequestPayload(form)),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to parse the parcel link.");
        }

        const payload = (await response.json()) as ParseParcelResponse;

        setForm((current) => ({
          ...current,
          state: payload.request.state || current.state,
          county: payload.request.county || current.county,
          acreage: payload.request.acreage || current.acreage,
          question: current.question || payload.request.question,
          knownFacts: mergeText(current.knownFacts, payload.request.knownFacts),
        }));

        const status = payload.parcelEnrichment?.status ?? "not_used";
        const fetchMode = payload.parcelEnrichment?.fetchMode ?? "not_applicable";
        setParseStatus(`Parse status: ${status} (${fetchMode}).`);
      } catch (caughtError) {
        setParseStatus(null);
        setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
      }
    });
  }

  function runEvaluation() {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/comp/evaluate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildEvaluateRequestPayload(form)),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to evaluate the comp request.");
        }

        const payload = (await response.json()) as CompEvaluateResponse;
        setResult(payload);
      } catch (caughtError) {
        setResult(null);
        setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="two-column-grid comp-tool-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Input</p>
            <h2>Comp request</h2>
          </div>
          <span className={`filters-status${isPending || isParsing ? " is-pending" : ""}`}>
            {isPending ? "Generating..." : isParsing ? "Parsing..." : "Ready"}
          </span>
        </div>

        <div className="comp-form">
          <label className="field">
            <span>Mode</span>
            <select
              value={form.modePreset}
              onChange={(event) => updateField("modePreset", event.target.value as ModePreset)}
            >
              <option value="default">Default (Gen Comp)</option>
              <option value="manual">Manual</option>
            </select>
            <small>
              {form.modePreset === "default"
                ? "Broad Gen Comp workflow. The tool should still try to flag possible structures automatically."
                : "Manual mode lets you tell the tool whether this should be treated as vacant land or structure / vacant land."}
            </small>
          </label>

          {form.modePreset === "manual" ? (
            <label className="field">
              <span>Manual focus</span>
              <select
                value={form.propertyTypeFocus}
                onChange={(event) =>
                  updateField(
                    "propertyTypeFocus",
                    event.target.value as FormState["propertyTypeFocus"],
                  )
                }
              >
                {(["vacant_land", "structure_vacant_land"] as const).map((propertyType) => (
                  <option key={propertyType} value={propertyType}>
                    {COMP_PROPERTY_TYPE_LABELS[propertyType]}
                  </option>
                ))}
              </select>
              <small>{COMP_PROPERTY_TYPE_DESCRIPTIONS[effectivePropertyTypeFocus]}</small>
            </label>
          ) : null}

          <label className="field">
            <span>Parcel link</span>
            <input
              type="url"
              placeholder="https://..."
              value={form.parcelLink}
              onChange={(event) => updateField("parcelLink", event.target.value)}
            />
          </label>

          <button
            className="light-button"
            type="button"
            onClick={parseParcelLink}
            disabled={isParsing}
          >
            {isParsing ? "Parsing parcel link..." : "Parse parcel link"}
          </button>

          {parseStatus ? <p className="auth-note">{parseStatus}</p> : null}

          <div className="input-pair">
            <label className="field">
              <span>State</span>
              <select
                value={form.state}
                onChange={(event) => updateField("state", event.target.value)}
              >
                <option value="">Select state</option>
                {US_STATE_OPTIONS.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.code} - {state.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>County</span>
              <select
                value={form.county}
                onChange={(event) => updateField("county", event.target.value)}
                disabled={!form.state}
              >
                <option value="">
                  {form.state ? "Select county" : "Select state first"}
                </option>
                {hasCustomCounty ? <option value={form.county}>{form.county}</option> : null}
                {countyOptions.map((county) => (
                  <option key={county} value={county}>
                    {county}
                  </option>
                ))}
              </select>
              <small>
                County options update after state selection.
              </small>
            </label>
          </div>

          <div className="input-pair">
            <label className="field">
              <span>Acreage</span>
              <input
                type="text"
                placeholder="12.5"
                value={form.acreage}
                onChange={(event) => updateField("acreage", event.target.value)}
              />
            </label>

            <label className="field">
              <span>Asking price (optional)</span>
              <input
                type="text"
                placeholder="Leave blank if unknown"
                value={form.sellerAskingPrice}
                onChange={(event) => updateField("sellerAskingPrice", event.target.value)}
              />
              <small>Optional. Most comps can still run without a seller ask.</small>
            </label>
          </div>

          <label className="field">
            <span>Primary question</span>
            <textarea
              rows={3}
              placeholder="What should this property be worth and what should we offer?"
              value={form.question}
              onChange={(event) => updateField("question", event.target.value)}
            />
          </label>

          <label className="field">
            <span>Known facts / notes</span>
            <textarea
              rows={7}
              placeholder="Road frontage, wooded vs pasture, nearby comps, access issues, wetlands, structures, seller notes..."
              value={form.knownFacts}
              onChange={(event) => updateField("knownFacts", event.target.value)}
            />
          </label>

          <div className="hero-actions comp-form-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={runEvaluation}
              disabled={isPending}
            >
              {isPending ? "Generating..." : "Generate comp"}
            </button>
          </div>

          {error ? <p className="auth-error">{error}</p> : null}
        </div>
      </section>

      <section id="evaluation" className="panel evaluation-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Output</p>
            <h2>Comp result</h2>
          </div>
          <Link className="reference-link" href="/references">
            References
          </Link>
        </div>

        {!result ? (
          <p className="auth-note">
            Output will stay short: decision, market value, offer, and other notes. Methodology
            lives on the references page.
          </p>
        ) : (
          <SimplifiedOutput result={result} />
        )}
      </section>
    </div>
  );
}
