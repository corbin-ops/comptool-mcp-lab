import { NextResponse } from "next/server";

import { createPendingPhase2Artifact } from "@/phase2/artifact-runner";
import { CLAUDE_MCP_LI_FIELD_ORDER } from "@/phase2/claude-mcp-return";
import type {
  ClaudeMcpExternalListingEvidence,
  ClaudeMcpFieldCapture,
  ClaudeMcpLiTableReturn,
  ClaudeMcpVisualClassification,
} from "@/phase2/claude-mcp-return";
import type {
  VisualBrowserPageSnapshot,
  VisualComparableRow,
  VisualConfidence,
  VisualExtractedParcelFields,
  VisualParcelInspectorRequest,
} from "@/phase2/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => readString(item)).filter(Boolean) : [];
}

function readConfidence(value: unknown): VisualConfidence {
  const normalized = readString(value);

  return normalized === "high" || normalized === "medium" || normalized === "low"
    ? normalized
    : "low";
}

function readFields(value: unknown): VisualExtractedParcelFields {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const allowedKeys = new Set(CLAUDE_MCP_LI_FIELD_ORDER.map((field) => field.key));
  const fields: VisualExtractedParcelFields = {};

  for (const [key, rawValue] of Object.entries(source)) {
    if (!allowedKeys.has(key as keyof VisualExtractedParcelFields)) {
      continue;
    }

    const parsed = readString(rawValue);

    if (parsed) {
      fields[key as keyof VisualExtractedParcelFields] = parsed;
    }
  }

  return fields;
}

function readComparableRows(value: unknown): VisualComparableRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<VisualComparableRow[]>((rows, item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : null;

    if (!record) {
      return rows;
    }

    rows.push({
      city: readString(record.city),
      price: readString(record.price),
      acreage: readString(record.acreage),
      pricePerAcre: readString(record.pricePerAcre),
      daysOnMarket: readString(record.daysOnMarket),
      zip: readString(record.zip),
      extraMetric: readString(record.extraMetric),
      status: readString(record.status),
      listingUrl: readString(record.listingUrl),
      source:
        readString(record.source) === "redfin" ||
        readString(record.source) === "zillow" ||
        readString(record.source) === "realtor"
          ? (readString(record.source) as VisualComparableRow["source"])
          : "unknown",
      rawCells: readStringArray(record.rawCells),
    });

    return rows;
  }, []);
}

function readExternalListingEvidence(value: unknown): ClaudeMcpExternalListingEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<ClaudeMcpExternalListingEvidence[]>((items, item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : null;

    if (!record) {
      return items;
    }

    const source = readString(record.source);
    const matchQuality = readString(record.matchQuality);

    items.push({
      source:
        source === "redfin" || source === "zillow" || source === "realtor"
          ? source
          : "unknown",
      url: readString(record.url),
      searchQuery: readString(record.searchQuery),
      matchQuality:
        matchQuality === "confirmed_match" ||
        matchQuality === "possible_match" ||
        matchQuality === "rejected_match"
          ? matchQuality
          : "possible_match",
      matchedSignals: readStringArray(record.matchedSignals),
      photoObservations: readStringArray(record.photoObservations),
      listingFacts: readStringArray(record.listingFacts),
      risks: readStringArray(record.risks),
    });

    return items;
  }, []);
}

function readFieldCaptures(value: unknown): ClaudeMcpFieldCapture[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedKeys = new Set(CLAUDE_MCP_LI_FIELD_ORDER.map((field) => field.key));

  return value.reduce<ClaudeMcpFieldCapture[]>((captures, item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
    const key = readString(record?.key) as ClaudeMcpFieldCapture["key"];

    if (!record || !allowedKeys.has(key)) {
      return captures;
    }

    const status = readString(record.status);
    const sourceTab = readString(record.sourceTab);

    captures.push({
      key,
      label: readString(record.label) || key,
      value: readString(record.value),
      status:
        status === "captured" || status === "missing" || status === "unclear"
          ? status
          : "unclear",
      sourceTab:
        sourceTab === "property_ownership" ||
        sourceTab === "market_insights" ||
        sourceTab === "slope_insights" ||
        sourceTab === "deep_ai_analysis" ||
        sourceTab === "data_platform" ||
        sourceTab === "listing_page" ||
        sourceTab === "manual_note"
          ? sourceTab
          : "unknown",
      confidence: readConfidence(record.confidence),
      notes: readString(record.notes),
    });

    return captures;
  }, []);
}

function readVisualClassification(value: unknown): ClaudeMcpVisualClassification {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const areaType = readString(record.areaType);
  const terrainType = readString(record.terrainType);
  const structureSignal = readString(record.structureSignal);
  const accessOrFrontageSignal = readString(record.accessOrFrontageSignal);

  return {
    areaType:
      areaType === "rural" || areaType === "suburban" || areaType === "urban"
        ? areaType
        : "unclear",
    terrainType:
      terrainType === "flat" || terrainType === "sloped" || terrainType === "mixed"
        ? terrainType
        : "unclear",
    structureSignal:
      structureSignal === "present" || structureSignal === "not_obvious"
        ? structureSignal
        : "unclear",
    accessOrFrontageSignal:
      accessOrFrontageSignal === "present" || accessOrFrontageSignal === "not_obvious"
        ? accessOrFrontageSignal
        : "unclear",
    confidence: readConfidence(record.confidence),
    visualRisks: readStringArray(record.visualRisks),
    verifyNext: readStringArray(record.verifyNext),
  };
}

function parseClaudeMcpPayload(payload: unknown): ClaudeMcpLiTableReturn {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const fields = readFields(record.fields);
  const parcelLink =
    readString(record.parcelLink) ||
    readString(record.compReportUrl) ||
    readString(record.dataPlatformUrl);

  return {
    schemaVersion: "claude-mcp-li-table-v1",
    source: "claude_mcp",
    capturedAt: readString(record.capturedAt) || new Date().toISOString(),
    parcelLink,
    compReportUrl: readString(record.compReportUrl),
    dataPlatformUrl: readString(record.dataPlatformUrl),
    pageTitle: readString(record.pageTitle) || "Claude MCP Land Insights capture",
    fields,
    fieldCaptures: readFieldCaptures(record.fieldCaptures),
    comparableRows: readComparableRows(record.comparableRows),
    listingLinks: readStringArray(record.listingLinks),
    externalListingEvidence: readExternalListingEvidence(record.externalListingEvidence),
    visualClassification: readVisualClassification(record.visualClassification),
    navigationLog: readStringArray(record.navigationLog),
    diagnostics: readStringArray(record.diagnostics),
    rawObservationNotes: readString(record.rawObservationNotes),
  };
}

function buildPageText(capture: ClaudeMcpLiTableReturn) {
  const fieldLines = Object.entries(capture.fields)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}: ${value}`);
  const captureLines = capture.fieldCaptures
    .filter((item) => item.value)
    .map((item) => `${item.label}: ${item.value}`);
  const listingEvidenceLines = capture.externalListingEvidence.flatMap((item, index) => [
    `External listing evidence ${index + 1}: ${item.source} ${item.matchQuality}`,
    item.url ? `URL: ${item.url}` : "",
    item.searchQuery ? `Search query: ${item.searchQuery}` : "",
    item.matchedSignals.length ? `Matched signals: ${item.matchedSignals.join("; ")}` : "",
    item.photoObservations.length
      ? `Photo observations: ${item.photoObservations.join("; ")}`
      : "",
    item.listingFacts.length ? `Listing facts: ${item.listingFacts.join("; ")}` : "",
    item.risks.length ? `Listing risks: ${item.risks.join("; ")}` : "",
  ]);

  return [
    "Claude MCP Land Insights source capture.",
    ...fieldLines,
    ...captureLines,
    ...listingEvidenceLines,
    capture.rawObservationNotes ? `Raw observation notes: ${capture.rawObservationNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildExternalListingSnapshots(
  capture: ClaudeMcpLiTableReturn,
): VisualBrowserPageSnapshot[] {
  return capture.externalListingEvidence.map((item, index) => {
    const pageText = [
      `External listing evidence ${index + 1}.`,
      `Source: ${item.source}`,
      `Match quality: ${item.matchQuality}`,
      item.searchQuery ? `Search query: ${item.searchQuery}` : "",
      item.matchedSignals.length ? `Matched signals: ${item.matchedSignals.join("; ")}` : "",
      item.photoObservations.length
        ? `Photo observations: ${item.photoObservations.join("; ")}`
        : "",
      item.listingFacts.length ? `Listing facts: ${item.listingFacts.join("; ")}` : "",
      item.risks.length ? `Risks: ${item.risks.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      sourceUrl: item.url || capture.parcelLink,
      finalUrl: item.url,
      pageTitle: `${item.source} ${item.matchQuality}`,
      pageText,
      extractedAt: capture.capturedAt,
      sourceApp: "claude-mcp-external-listing",
      extractionError: item.url ? "" : "Claude MCP did not provide an external listing URL.",
    };
  });
}

function buildRequestFromClaudeMcp(capture: ClaudeMcpLiTableReturn): VisualParcelInspectorRequest {
  const browserPage: VisualBrowserPageSnapshot = {
    sourceUrl: capture.parcelLink,
    finalUrl: capture.dataPlatformUrl || capture.parcelLink,
    pageTitle: capture.pageTitle || "Claude MCP Land Insights capture",
    pageText: buildPageText(capture),
    extractedAt: capture.capturedAt,
    sourceApp: "claude-mcp",
    compReportUrl: capture.compReportUrl,
    listingLinks: capture.listingLinks,
    extractedFields: capture.fields,
    comparableRows: capture.comparableRows,
    kmlCaptureStatus: "Claude MCP capture did not attach KML",
  };

  return {
    parcelLink: capture.compReportUrl || capture.parcelLink || capture.dataPlatformUrl || "",
    listingLinks: capture.listingLinks,
    notes: [
      "Source: Claude MCP LI-table return.",
      capture.rawObservationNotes,
      ...capture.externalListingEvidence.flatMap((item) => [
        `External listing ${item.source}: ${item.matchQuality}`,
        ...item.matchedSignals.map((signal) => `External matched signal: ${signal}`),
        ...item.photoObservations.map((observation) => `External photo observation: ${observation}`),
        ...item.risks.map((risk) => `External listing risk: ${risk}`),
      ]),
      ...capture.visualClassification.visualRisks.map((risk) => `MCP visual risk: ${risk}`),
      ...capture.visualClassification.verifyNext.map((item) => `MCP verify next: ${item}`),
    ]
      .filter(Boolean)
      .join("\n"),
    browserPage,
    browserListings: buildExternalListingSnapshots(capture),
    kmlText: "",
    kmlFileName: "",
  };
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON request body." }, { status: 400 });
  }

  const capture = parseClaudeMcpPayload(payload);

  if (!capture.parcelLink) {
    return NextResponse.json(
      { error: "parcelLink, compReportUrl, or dataPlatformUrl is required." },
      { status: 400 },
    );
  }

  const parsed = buildRequestFromClaudeMcp(capture);
  const artifact = await createPendingPhase2Artifact(parsed);

  return NextResponse.json({
    ok: true,
    artifactId: artifact.id,
    dashboardUrl: `/phase2?artifact=${encodeURIComponent(artifact.id)}`,
    createdAt: artifact.createdAt,
    result: artifact.result,
    compEvaluationStatus: artifact.compEvaluationStatus,
  });
}
