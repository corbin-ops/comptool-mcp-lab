"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";

import { buildClaudeMcpCapturePrompt } from "@/phase2/claude-mcp-prompt";

type IntakeResult = {
  ok?: boolean;
  artifactId?: string;
  dashboardUrl?: string;
  createdAt?: string;
  compEvaluationStatus?: string;
  error?: string;
};

const samplePayload = {
  schemaVersion: "claude-mcp-li-table-v1",
  source: "claude_mcp",
  capturedAt: "2026-05-04T00:00:00.000Z",
  parcelLink: "https://app.landinsights.co/data?parcel=sample-phase2#15.5/35.078273/-82.281284",
  compReportUrl: "https://app.landinsights.co/home/comping/report/sample-phase2",
  dataPlatformUrl: "https://app.landinsights.co/data?parcel=sample-phase2",
  pageTitle: "Land Insights - Sample MCP Capture",
  fields: {
    apn: "114 A 7",
    owner: "Tommy Manning",
    acreage: "13.45",
    county: "Prince Edward County",
    state: "VA",
    ownerMailingAddress: "502 GERMANTOWN RD, FARMVILLE, VA 23901",
    address: "FALKLAND RD, MEHERRIN, VA 23954",
    landLocked: "No",
    roadFrontage: "Visible frontage on Falkland Rd",
    wetlands: "0%",
    floodZone: "0%",
    hoa: "No",
    hasStructure: "No",
    currentLandUse: "Vacant land",
    ownershipLength: "Unknown",
    relationToProperty: "Out of ZIP",
    propertyTax: "$103.02",
    gps: "37.12455904065317, -78.38174543107452",
  },
  fieldCaptures: [
    {
      key: "acreage",
      label: "Acres",
      value: "13.45",
      status: "captured",
      sourceTab: "data_platform",
      confidence: "high",
      notes: "Visible in Land Insights parcel drawer.",
    },
    {
      key: "roadFrontage",
      label: "Road Frontage",
      value: "Visible frontage on Falkland Rd",
      status: "captured",
      sourceTab: "data_platform",
      confidence: "medium",
      notes: "Observed from map and parcel boundary.",
    },
  ],
  comparableRows: [
    {
      city: "Meherrin",
      price: "$149,000",
      acreage: "14.2",
      pricePerAcre: "$10,493",
      status: "active",
      source: "unknown",
      listingUrl: "",
      rawCells: ["14.2 ac", "$149,000", "active"],
    },
  ],
  listingLinks: [],
  visualClassification: {
    areaType: "rural",
    terrainType: "mixed",
    structureSignal: "not_obvious",
    accessOrFrontageSignal: "present",
    confidence: "medium",
    visualRisks: [
      "Mostly wooded parcel; usable build area should be verified.",
      "Confirm whether parcel shape creates driveway or access cost issues.",
    ],
    verifyNext: [
      "Confirm legal access from Falkland Rd.",
      "Check sold comps with similar wooded acreage before anchoring final value.",
    ],
  },
  navigationLog: [
    "Opened Land Insights parcel data platform.",
    "Captured visible parcel drawer fields.",
    "Reviewed satellite view for terrain, access, and structure signal.",
  ],
  diagnostics: ["Sample payload generated from MCP intake tester."],
  rawObservationNotes:
    "Rural wooded parcel with visible road adjacency. No obvious structure signal from captured view.",
};

function prettySamplePayload() {
  return JSON.stringify(
    {
      ...samplePayload,
      capturedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while submitting the MCP payload.";
}

export function McpTestClient() {
  const searchParams = useSearchParams();
  const parcelLinkFromQuery =
    searchParams.get("parcelLink") ||
    searchParams.get("parcel") ||
    searchParams.get("source") ||
    "";
  const sourceArtifactId = searchParams.get("artifact") || "";
  const mcpPrompt = useMemo(
    () => buildClaudeMcpCapturePrompt(parcelLinkFromQuery),
    [parcelLinkFromQuery],
  );
  const [jsonText, setJsonText] = useState(prettySamplePayload);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [status, setStatus] = useState<"idle" | "valid" | "error" | "success">("idle");
  const [message, setMessage] = useState("Load the sample or paste Claude MCP JSON.");
  const [copyMessage, setCopyMessage] = useState("Ready to copy into Claude MCP.");
  const [openInNewTab, setOpenInNewTab] = useState(true);
  const [isPending, startTransition] = useTransition();

  const parsedPreview = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;

      return {
        parcel:
          typeof parsed.parcelLink === "string"
            ? parsed.parcelLink
            : typeof parsed.compReportUrl === "string"
              ? parsed.compReportUrl
              : "",
        fieldCount:
          parsed.fields && typeof parsed.fields === "object"
            ? Object.keys(parsed.fields).length
            : 0,
        compCount: Array.isArray(parsed.comparableRows) ? parsed.comparableRows.length : 0,
        hasVisualClassification: Boolean(parsed.visualClassification),
      };
    } catch {
      return null;
    }
  }, [jsonText]);

  function validateJson() {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      const link = parsed.parcelLink || parsed.compReportUrl || parsed.dataPlatformUrl;

      if (typeof link !== "string" || !link.trim()) {
        throw new Error("Missing parcelLink, compReportUrl, or dataPlatformUrl.");
      }

      setStatus("valid");
      setMessage("JSON is valid and has a parcel link source.");
      setResult(null);
    } catch (error) {
      setStatus("error");
      setMessage(readErrorMessage(error));
      setResult(null);
    }
  }

  function submitPayload() {
    startTransition(async () => {
      setStatus("idle");
      setMessage("Submitting Claude MCP payload...");
      setResult(null);

      try {
        const parsed = JSON.parse(jsonText);
        const response = await fetch("/api/phase2/claude-mcp-intake", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(parsed),
        });
        const payload = (await response.json().catch(() => ({}))) as IntakeResult;

        if (!response.ok) {
          throw new Error(payload.error || `Request failed with HTTP ${response.status}.`);
        }

        setResult(payload);
        setStatus("success");
        setMessage("MCP payload accepted. Dashboard artifact created.");

        if (openInNewTab && payload.dashboardUrl) {
          window.open(payload.dashboardUrl, "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        setStatus("error");
        setMessage(readErrorMessage(error));
      }
    });
  }

  return (
    <>
      <section className="panel mcp-prompt-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2>Copy this prompt into Claude MCP</h2>
            <p className="muted-copy">
              {parcelLinkFromQuery
                ? "The parcel link is already inserted. Paste this into Claude MCP, let Claude inspect Land Insights, then paste the returned raw JSON below."
                : "Replace the parcel-link placeholder inside Claude, let Claude inspect Land Insights, then paste the returned raw JSON below."}
            </p>
          </div>

          <div className="mcp-prompt-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(mcpPrompt);
                  setCopyMessage("Prompt copied. Paste it into Claude MCP.");
                } catch {
                  setCopyMessage("Copy blocked by browser. Select the prompt text manually.");
                }
              }}
            >
              Copy MCP prompt
            </button>
            <span className="source-pill">{copyMessage}</span>
          </div>
        </div>

        {parcelLinkFromQuery || sourceArtifactId ? (
          <div className="mcp-handoff-banner">
            {parcelLinkFromQuery ? (
              <p>
                <strong>Parcel loaded from extension:</strong> {parcelLinkFromQuery}
              </p>
            ) : null}
            {sourceArtifactId ? (
              <a
                className="light-button"
                href={`/phase2?artifact=${encodeURIComponent(sourceArtifactId)}`}
                target="_blank"
                rel="noreferrer"
              >
                Open preliminary capture
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="mcp-prompt-steps">
          <span>1. Copy prompt</span>
          <span>2. Paste into Claude MCP</span>
          <span>3. Replace parcel link</span>
          <span>4. Paste JSON below</span>
        </div>

        <textarea
          className="mcp-prompt-textarea"
          readOnly
          spellCheck={false}
          value={mcpPrompt}
          onFocus={(event) => event.currentTarget.select()}
        />
      </section>

      <section className="mcp-test-grid">
        <article className="panel mcp-json-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Claude MCP JSON</h2>
              <p className="muted-copy">
                Paste the raw JSON object only. Avoid markdown fences like <code>```json</code>.
              </p>
            </div>

            <span className={`status-badge ${status === "success" ? "is-live" : ""}`}>
              {isPending ? "Submitting" : status === "idle" ? "Ready" : status}
            </span>
          </div>

          <textarea
            className="mcp-json-textarea"
            spellCheck={false}
            value={jsonText}
            onChange={(event) => {
              setJsonText(event.target.value);
              setStatus("idle");
              setMessage("JSON changed. Validate or submit when ready.");
              setResult(null);
            }}
          />

          <div className="mcp-test-actions">
            <button className="secondary-button" type="button" onClick={submitPayload} disabled={isPending}>
              {isPending ? "Submitting..." : "Submit to dashboard"}
            </button>
            <button className="light-button" type="button" onClick={validateJson} disabled={isPending}>
              Validate JSON
            </button>
            <button
              className="light-button"
              type="button"
              onClick={() => {
                setJsonText(prettySamplePayload());
                setStatus("idle");
                setMessage("Sample payload loaded.");
                setResult(null);
              }}
              disabled={isPending}
            >
              Load sample
            </button>
          </div>

          <label className="mcp-checkbox">
            <input
              checked={openInNewTab}
              type="checkbox"
              onChange={(event) => setOpenInNewTab(event.target.checked)}
            />
            Open dashboard result in a new tab after submit
          </label>
        </article>

        <aside className="panel mcp-result-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Output</p>
              <h2>Intake result</h2>
            </div>
          </div>

          <div className={`mcp-status-card is-${status}`}>
            <span>Status</span>
            <strong>{message}</strong>
          </div>

          {parsedPreview ? (
            <div className="capture-summary-grid">
              <div>
                <span>Fields</span>
                <b>{parsedPreview.fieldCount}</b>
              </div>
              <div>
                <span>Comps</span>
                <b>{parsedPreview.compCount}</b>
              </div>
              <div>
                <span>Visual read</span>
                <b>{parsedPreview.hasVisualClassification ? "attached" : "missing"}</b>
              </div>
            </div>
          ) : (
            <p className="muted-copy">JSON preview is unavailable until the text parses cleanly.</p>
          )}

          {parsedPreview?.parcel ? (
            <div className="callout-card">
              <span className="section-label">Parcel source</span>
              <p>{parsedPreview.parcel}</p>
            </div>
          ) : null}

          {result?.ok && result.dashboardUrl ? (
            <div className="mcp-success-actions">
              <div className="callout-card decision-panel">
                <span className="section-label">Artifact</span>
                <p>{result.artifactId}</p>
                <span className="section-label">Evaluation</span>
                <p>{result.compEvaluationStatus || "queued"}</p>
              </div>

              <a className="secondary-button" href={result.dashboardUrl} target="_blank" rel="noreferrer">
                Open dashboard
              </a>
            </div>
          ) : null}
        </aside>
      </section>
    </>
  );
}
