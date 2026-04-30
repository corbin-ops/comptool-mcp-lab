import type {
  CompEvaluateRequest,
  CompParcelEnrichment,
  CompPropertyTypeFocus,
} from "@/comp-tool/types";
import { formatComparableRowSummary } from "@/phase2/comparable-row";
import type {
  VisualBrowserPageSnapshot,
  VisualComparableRow,
  VisualExtractedParcelFields,
  VisualKmlData,
  VisualParcelInspectorRequest,
  VisualParcelInspectorResult,
} from "@/phase2/types";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function labelFromKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function uniqueLines(lines: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return lines
    .map((line) => (line ? line.trim() : ""))
    .filter(Boolean)
    .filter((line) => {
      const key = line.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function fieldLines(fields: VisualExtractedParcelFields | undefined) {
  return Object.entries(fields ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${labelFromKey(key)}: ${value}`);
}

function comparableRowLine(row: VisualComparableRow, index: number) {
  return formatComparableRowSummary(row, index);
}

function comparableRowsLines(rows: VisualComparableRow[] | undefined) {
  return (rows ?? []).slice(0, 8).map(comparableRowLine);
}

function kmlLines(kmlData: VisualKmlData | null | undefined) {
  if (!kmlData) {
    return [];
  }

  return uniqueLines([
    kmlData.fileName ? `KML file: ${kmlData.fileName}` : "",
    kmlData.placemarkName ? `KML placemark: ${kmlData.placemarkName}` : "",
    kmlData.apn ? `KML APN: ${kmlData.apn}` : "",
    kmlData.address ? `KML address: ${kmlData.address}` : "",
    kmlData.owner ? `KML owner: ${kmlData.owner}` : "",
    kmlData.acreage ? `KML acreage: ${kmlData.acreage}` : "",
    `KML coordinate count: ${kmlData.coordinateCount}`,
  ]);
}

function browserPageLines(browserPage: VisualBrowserPageSnapshot | null | undefined) {
  if (!browserPage) {
    return [];
  }

  return uniqueLines([
    `Captured page title: ${browserPage.pageTitle || "Not provided"}`,
    `Captured source URL: ${browserPage.sourceUrl}`,
    browserPage.finalUrl ? `Captured final URL: ${browserPage.finalUrl}` : "",
    browserPage.extractedAt ? `Captured at: ${browserPage.extractedAt}` : "",
    browserPage.pageText ? `Captured page text excerpt: ${truncate(browserPage.pageText, 1800)}` : "",
  ]);
}

function inferPropertyTypeFocus(
  fields: VisualExtractedParcelFields | undefined,
  result: VisualParcelInspectorResult,
): CompPropertyTypeFocus {
  const structureText = [
    fields?.hasStructure,
    fields?.structures,
    fields?.structureCount,
    fields?.structureYearBuilt,
    fields?.mobileHome,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    result.structureSignal === "present" ||
    /\b(yes|present|house|home|mobile|shed|barn|structure|improvement)\b/.test(structureText)
  ) {
    return "structure_vacant_land";
  }

  return "auto_detect";
}

function buildKnownFacts(
  request: VisualParcelInspectorRequest,
  result: VisualParcelInspectorResult,
) {
  const fields = result.structuredFields ?? {};
  const browserPage = request.browserPage;
  const rows = result.comparableRows ?? browserPage?.comparableRows ?? [];

  return uniqueLines([
    "Source: Chrome extension capture from the opened Land Insights parcel page.",
    "Do not assume missing facts. Mark unknown or unsupported facts as Needs verification.",
    request.notes ? `User notes: ${request.notes}` : "",
    ...browserPageLines(browserPage),
    ...fieldLines(fields),
    result.summary ? `Visual inspector summary: ${result.summary}` : "",
    `Area type: ${result.areaType}`,
    `Terrain: ${result.terrainType}`,
    `Structure signal: ${result.structureSignal}`,
    `Access/frontage signal: ${result.accessOrFrontageSignal}`,
    `Visual confidence: ${result.confidence}`,
    ...result.visualRisks.map((risk) => `Visual risk: ${risk}`),
    ...result.verifyNext.map((item) => `Verify next: ${item}`),
    ...kmlLines(result.kmlData),
    ...comparableRowsLines(rows),
  ]).join("\n");
}

export function buildCompRequestFromPhase2Capture(
  request: VisualParcelInspectorRequest,
  result: VisualParcelInspectorResult,
): CompEvaluateRequest {
  const fields = result.structuredFields ?? {};

  return {
    mode: "general",
    propertyTypeFocus: inferPropertyTypeFocus(fields, result),
    parcelLink: request.parcelLink || request.browserPage?.sourceUrl || "",
    county: fields.county ?? "",
    state: fields.state ?? "",
    acreage: fields.acreage ?? "",
    sellerAskingPrice: "",
    question:
      "Run a concise CompTool V1 DewClaw evaluation from this browser-captured Land Insights parcel. Estimate market value, offer range, decision, key risks, and seller/analyst next steps using the captured structured fields and comparable rows.",
    knownFacts: buildKnownFacts(request, result),
    topK: 4,
  };
}

export function buildPhase2ParcelEnrichment(
  request: VisualParcelInspectorRequest,
  result: VisualParcelInspectorResult,
): CompParcelEnrichment {
  const fields = result.structuredFields ?? {};

  return {
    status: "fetched",
    fetchMode: "not_applicable",
    finalUrl: result.parcelFinalUrl || request.browserPage?.finalUrl || request.parcelLink || null,
    pageTitle: result.parcelPageTitle || request.browserPage?.pageTitle || null,
    diagnostics: uniqueLines([
      "Used browser extension capture instead of server-side parcel fetch.",
      ...((result.diagnostics ?? []).slice(0, 10)),
    ]),
    extractedFields: {
      county: fields.county ?? "",
      state: fields.state ?? "",
      acreage: fields.acreage ?? "",
      knownFacts: result.summary,
    },
  };
}
