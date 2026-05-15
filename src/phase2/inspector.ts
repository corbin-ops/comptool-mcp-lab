import { URL } from "node:url";

import { comparableRowToSearchText } from "@/phase2/comparable-row";
import { parseKmlExport } from "@/phase2/kml";
import type {
  VisualBrowserPageSnapshot,
  VisualComparableRow,
  VisualConfidence,
  VisualDewClawQa,
  VisualDewClawQaCheck,
  VisualDewClawQaStatus,
  VisualExtractedParcelFields,
  VisualKmlData,
  VisualParcelInspectorRequest,
  VisualParcelInspectorResult,
  VisualSignalState,
  VisualTerrainType,
  VisualAreaType,
} from "@/phase2/types";

const LAND_INSIGHTS_HOST_PATTERN = /(^|\.)landinsights\.(com|co)$/i;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; DewClawPhase2Inspector/1.0; +https://github.com/corbin-ops/CompTool)";
const GENERIC_APP_SHELL_TITLES = new Set(["home", "dashboard", "app", "land insights"]);

type FetchedPage = {
  url: string;
  finalUrl: string;
  ok: boolean;
  status: number;
  title: string;
  text: string;
  source: "fetch" | "browser";
  extractedFields?: VisualExtractedParcelFields;
  comparableRows?: VisualComparableRow[];
};

type PageQuality = {
  diagnostics: string[];
  isLoginWall: boolean;
  isLikelyAppShell: boolean;
  hasWeakContent: boolean;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractTitle(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch?.[1] ? normalizeWhitespace(titleMatch[1]) : "";
}

function stripHtml(html: string) {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'"),
  );
}

function cleanFieldMap(fields: VisualExtractedParcelFields | undefined) {
  const normalized: VisualExtractedParcelFields = {};

  for (const [key, value] of Object.entries(fields ?? {})) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = normalizeWhitespace(value);

    if (!trimmed) {
      continue;
    }

    normalized[key as keyof VisualExtractedParcelFields] = trimmed;
  }

  return normalized;
}

function countKnownFields(fields: VisualExtractedParcelFields | undefined) {
  return Object.values(fields ?? {}).filter(Boolean).length;
}

function normalizeIdentity(value: string | undefined) {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeCounty(value: string | undefined) {
  return (value || "")
    .toUpperCase()
    .replace(/\bCOUNTY\b/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function parseKmlCountyStateFromFileName(fileName: string | undefined) {
  const normalized = (fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/\s+\(\d+\)$/, "");
  const match = normalized.match(/-([A-Za-z_ ]+_County)-([A-Z]{2})$/);

  if (!match) {
    return null;
  }

  return {
    county: normalizeWhitespace(match[1].replace(/_/g, " ")),
    state: match[2],
  };
}

function normalizeComparableRows(rows: VisualComparableRow[] | undefined) {
  return (rows ?? [])
    .map((row) => ({
      city: normalizeWhitespace(row.city || ""),
      price: normalizeWhitespace(row.price || ""),
      acreage: normalizeWhitespace(row.acreage || ""),
      pricePerAcre: normalizeWhitespace(row.pricePerAcre || ""),
      daysOnMarket: normalizeWhitespace(row.daysOnMarket || ""),
      zip: normalizeWhitespace(row.zip || ""),
      extraMetric: normalizeWhitespace(row.extraMetric || ""),
      status: normalizeWhitespace(row.status || ""),
      listingUrl: row.listingUrl?.trim() || "",
      source: row.source || "unknown",
      rawCells: (row.rawCells ?? []).map((item) => normalizeWhitespace(item)).filter(Boolean),
    }))
    .filter((row) => row.rawCells.length || row.listingUrl);
}

function splitCountyState(value: string) {
  const match = value.match(/^(.*?),\s*([A-Z]{2})$/);

  if (!match) {
    return null;
  }

  return {
    county: normalizeWhitespace(match[1]),
    state: match[2].trim(),
  };
}

function mergeStructuredFields(args: {
  browserFields?: VisualExtractedParcelFields;
  kmlData?: VisualKmlData | null;
  pageTitle?: string;
}) {
  const merged: VisualExtractedParcelFields = {
    ...cleanFieldMap(args.browserFields),
  };

  if (args.kmlData?.apn && !merged.apn) {
    merged.apn = args.kmlData.apn;
  }

  if (args.kmlData?.address && !merged.address) {
    merged.address = args.kmlData.address;
  }

  if (args.kmlData?.owner && !merged.owner) {
    merged.owner = args.kmlData.owner;
  }

  if (args.kmlData?.acreage && !merged.acreage) {
    merged.acreage = args.kmlData.acreage;
  }

  const countyStateSource = merged.county || args.pageTitle || "";
  const countyState = splitCountyState(countyStateSource);

  if (countyState) {
    merged.county = merged.county || countyState.county;
    merged.state = merged.state || countyState.state;
  }

  return merged;
}

function structuredFieldsToText(fields: VisualExtractedParcelFields) {
  return Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" ");
}

function normalizeSnapshot(snapshot: VisualBrowserPageSnapshot): VisualBrowserPageSnapshot {
  return {
    sourceUrl: snapshot.sourceUrl.trim(),
    finalUrl: snapshot.finalUrl?.trim() || snapshot.sourceUrl.trim(),
    pageTitle: normalizeWhitespace(snapshot.pageTitle || ""),
    pageText: normalizeWhitespace(snapshot.pageText || ""),
    extractedAt: snapshot.extractedAt?.trim(),
    sourceApp: snapshot.sourceApp?.trim(),
    listingLinks: (snapshot.listingLinks ?? []).map((link) => link.trim()).filter(Boolean),
    extractedFields: cleanFieldMap(snapshot.extractedFields),
    comparableRows: normalizeComparableRows(snapshot.comparableRows),
  };
}

function pageFromSnapshot(snapshot: VisualBrowserPageSnapshot): FetchedPage {
  const normalized = normalizeSnapshot(snapshot);

  return {
    url: normalized.sourceUrl,
    finalUrl: normalized.finalUrl || normalized.sourceUrl,
    ok: Boolean(normalized.pageTitle || normalized.pageText),
    status: 200,
    title: normalized.pageTitle,
    text: normalized.pageText,
    source: "browser",
    extractedFields: normalized.extractedFields,
    comparableRows: normalized.comparableRows,
  };
}

function buildFetchHeaders(url: URL) {
  const headers = new Headers({
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "User-Agent": DEFAULT_USER_AGENT,
  });

  if (LAND_INSIGHTS_HOST_PATTERN.test(url.hostname)) {
    headers.set("Referer", process.env.LAND_INSIGHTS_REFERER?.trim() || `${url.origin}/`);
    headers.set("Origin", url.origin);
    headers.set("Cache-Control", "no-cache");

    const cookie = process.env.LAND_INSIGHTS_COOKIE?.trim();
    if (cookie) {
      headers.set("Cookie", cookie);
    }
  }

  return headers;
}

async function fetchPage(targetUrl: string): Promise<FetchedPage> {
  const url = new URL(targetUrl);
  const timeoutMs = Number(process.env.LAND_INSIGHTS_TIMEOUT_MS || "12000");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 12000);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: buildFetchHeaders(url),
    });

    const html = await response.text();
    const title = extractTitle(html);
    const text = stripHtml(html);

    return {
      url: targetUrl,
      finalUrl: response.url || targetUrl,
      ok: response.ok,
      status: response.status,
      title,
      text,
      source: "fetch",
      extractedFields: {},
    };
  } finally {
    clearTimeout(timeout);
  }
}

function inferAreaType(input: string, fields: VisualExtractedParcelFields): VisualAreaType {
  const landUse = (fields.currentLandUse || "").toLowerCase();

  if (landUse.includes("vacant land") || landUse.includes("agricultural") || landUse.includes("rural")) {
    return "rural";
  }

  if (landUse.includes("residential")) {
    return "suburban";
  }

  const value = input.toLowerCase();

  const ruralHits = [
    "rural",
    "country",
    "farm",
    "pasture",
    "timber",
    "acreage",
    "vacant land",
    "agricultural",
  ].filter((token) => value.includes(token)).length;

  const suburbanHits = [
    "subdivision",
    "neighborhood",
    "residential",
    "hoa",
    "community",
    "school district",
  ].filter((token) => value.includes(token)).length;

  const urbanHits = [
    "downtown",
    "city center",
    "metro",
    "commercial corridor",
    "urban",
    "shopping",
  ].filter((token) => value.includes(token)).length;

  if (ruralHits > suburbanHits && ruralHits > urbanHits && ruralHits > 0) {
    return "rural";
  }

  if (suburbanHits > ruralHits && suburbanHits >= urbanHits && suburbanHits > 0) {
    return "suburban";
  }

  if (urbanHits > ruralHits && urbanHits > suburbanHits && urbanHits > 0) {
    return "urban";
  }

  return "unclear";
}

function inferTerrainType(input: string, fields: VisualExtractedParcelFields): VisualTerrainType {
  const value = `${input} ${fields.currentLandUse || ""}`.toLowerCase();
  const flatSignals = ["flat", "level", "cleared", "open field", "pasture", "meadow"].some((token) =>
    value.includes(token),
  );
  const slopeSignals = ["slope", "sloped", "steep", "hill", "elevation", "topography"].some((token) =>
    value.includes(token),
  );

  if (flatSignals && slopeSignals) {
    return "mixed";
  }

  if (slopeSignals) {
    return "sloped";
  }

  if (flatSignals) {
    return "flat";
  }

  return "unclear";
}

function inferStructureSignal(input: string, fields: VisualExtractedParcelFields): VisualSignalState {
  const hasStructure = (fields.hasStructure || fields.structures || "").toLowerCase();

  if (
    ["yes", "true"].some((token) => hasStructure.includes(token)) ||
    (fields.structures && !/\b0\s*sqft\b/i.test(fields.structures))
  ) {
    return "present";
  }

  if (
    ["no", "0 sqft", "none"].some((token) => hasStructure.includes(token)) ||
    /\b0\s*sqft\b/i.test(fields.structures || "")
  ) {
    return "not_obvious";
  }

  const value = input.toLowerCase();

  if (
    ["house", "home", "shed", "barn", "cabin", "mobile home", "garage", "building", "structure"].some((token) =>
      value.includes(token),
    )
  ) {
    return "present";
  }

  if (["vacant", "no structure", "unimproved"].some((token) => value.includes(token))) {
    return "not_obvious";
  }

  return "unclear";
}

function inferAccessSignal(input: string, fields: VisualExtractedParcelFields): VisualSignalState {
  const roadFrontage = (fields.roadFrontage || "").toLowerCase();
  const landLocked = (fields.landLocked || "").toLowerCase();

  if (roadFrontage && !roadFrontage.includes("0")) {
    return "present";
  }

  if (landLocked.includes("yes")) {
    return "not_obvious";
  }

  if (landLocked.includes("no")) {
    return "present";
  }

  const value = input.toLowerCase();

  if (
    ["road frontage", "paved road", "county road", "public road", "gravel road", "frontage", "driveway"].some(
      (token) => value.includes(token),
    )
  ) {
    return "present";
  }

  return "unclear";
}

function evaluatePageQuality(page: FetchedPage | null, label: string): PageQuality {
  if (!page) {
    return {
      diagnostics: [`${label}: no page content captured.`],
      isLoginWall: false,
      isLikelyAppShell: false,
      hasWeakContent: true,
    };
  }

  const diagnostics: string[] = [];
  const title = page.title.toLowerCase();
  const text = page.text.toLowerCase();
  const textLength = page.text.length;
  const finalUrl = page.finalUrl.toLowerCase();
  const extractedFieldCount = countKnownFields(page.extractedFields);
  const hasStrongBrowserCapture = page.source === "browser" && extractedFieldCount >= 6;

  diagnostics.push(`${label}: source=${page.source}, finalUrl=${page.finalUrl}`);
  diagnostics.push(`${label}: title="${page.title || "(empty)"}"`);
  diagnostics.push(`${label}: textLength=${textLength}`);
  diagnostics.push(`${label}: extractedFieldCount=${extractedFieldCount}`);
  if (hasStrongBrowserCapture) {
    diagnostics.push(`${label}: browser structured fields accepted as parcel detail.`);
  }

  const isLoginWall =
    finalUrl.includes("login") ||
    finalUrl.includes("signin") ||
    ["sign in", "log in", "login", "signin", "password", "authentication"].some((token) =>
      text.includes(token) || title.includes(token),
    );

  const isLikelyAppShell =
    !hasStrongBrowserCapture &&
    (GENERIC_APP_SHELL_TITLES.has(title.trim()) ||
      (title.includes("land insights") &&
        textLength < 500 &&
        extractedFieldCount < 4 &&
        !["apn", "owner", "acre", "road frontage", "wetlands", "flood zone"].some((token) =>
          text.includes(token),
        )));

  const hasWeakContent = textLength < 200 && extractedFieldCount < 4;

  if (page.url !== page.finalUrl) {
    diagnostics.push(`${label}: redirected from source URL.`);
  }

  if (isLoginWall) {
    diagnostics.push(`${label}: content looks like a login or auth wall.`);
  }

  if (isLikelyAppShell) {
    diagnostics.push(`${label}: content looks like an app shell, not parcel detail.`);
  }

  if (hasWeakContent) {
    diagnostics.push(`${label}: captured text is too short for a reliable read.`);
  }

  return {
    diagnostics,
    isLoginWall,
    isLikelyAppShell,
    hasWeakContent,
  };
}

function inferConfidence(
  parcelPageReached: boolean,
  listingPagesReached: number,
  signals: {
    areaType: VisualAreaType;
    terrainType: VisualTerrainType;
    structureSignal: VisualSignalState;
    accessOrFrontageSignal: VisualSignalState;
  },
  parcelQuality: PageQuality,
  structuredFields: VisualExtractedParcelFields,
): VisualConfidence {
  if (!parcelPageReached || parcelQuality.isLoginWall || parcelQuality.isLikelyAppShell) {
    return "low";
  }

  const knownCount = [
    signals.areaType !== "unclear",
    signals.terrainType !== "unclear",
    signals.structureSignal !== "unclear",
    signals.accessOrFrontageSignal !== "unclear",
  ].filter(Boolean).length;
  const fieldCount = countKnownFields(structuredFields);

  if (!parcelQuality.hasWeakContent && (knownCount >= 3 || fieldCount >= 8) && listingPagesReached > 0) {
    return "high";
  }

  if (knownCount >= 2 || fieldCount >= 6) {
    return "medium";
  }

  return "low";
}

function buildRisksAndVerifyItems(
  signals: {
    terrainType: VisualTerrainType;
    structureSignal: VisualSignalState;
    accessOrFrontageSignal: VisualSignalState;
  },
  parcelQuality: PageQuality,
  structuredFields: VisualExtractedParcelFields,
) {
  const visualRisks: string[] = [];
  const verifyNext: string[] = [];

  if (parcelQuality.isLoginWall || parcelQuality.isLikelyAppShell) {
    visualRisks.push("The captured parcel page does not look like a reliable parcel-detail view yet.");
    verifyNext.push("Confirm the extractor is running on the actual parcel detail screen.");
  }

  if (parcelQuality.hasWeakContent) {
    visualRisks.push("Captured parcel content is too thin for a dependable visual read.");
    verifyNext.push("Capture the parcel page again after the full detail view has loaded.");
  }

  if (signals.structureSignal === "unclear") {
    visualRisks.push("Structure status is not clear from the available page content.");
    verifyNext.push("Confirm whether the parcel has a house, shed, barn, or other improvement.");
  }

  if (signals.accessOrFrontageSignal === "unclear") {
    visualRisks.push("Access or frontage is not clearly visible from the captured content.");
    verifyNext.push("Confirm legal access and usable road frontage.");
  }

  if (signals.terrainType === "sloped" || signals.terrainType === "mixed") {
    visualRisks.push("Terrain may affect use, value, or buildability.");
    verifyNext.push("Verify slope and topography before final valuation.");
  }

  if (structuredFields.floodZone && !structuredFields.floodZone.includes("0%")) {
    visualRisks.push(`Flood-zone signal needs review (${structuredFields.floodZone}).`);
    verifyNext.push("Confirm flood-zone impact before final valuation.");
  }

  if (structuredFields.wetlands && !structuredFields.wetlands.includes("0%")) {
    visualRisks.push(`Wetlands signal needs review (${structuredFields.wetlands}).`);
    verifyNext.push("Confirm wetlands coverage before final valuation.");
  }

  if (!visualRisks.length) {
    visualRisks.push("Visual pass did not surface a major obvious issue, but deeper review may still be needed.");
  }

  return {
    visualRisks: [...new Set(visualRisks)],
    verifyNext: [...new Set(verifyNext)],
  };
}

function buildSummary(args: {
  areaType: VisualAreaType;
  terrainType: VisualTerrainType;
  structureSignal: VisualSignalState;
  accessOrFrontageSignal: VisualSignalState;
  confidence: VisualConfidence;
  structuredFields: VisualExtractedParcelFields;
}) {
  const parts = [
    `Area type looks ${args.areaType}.`,
    `Terrain reads as ${args.terrainType}.`,
    `Structure signal is ${args.structureSignal.replaceAll("_", " ")}.`,
    `Access/frontage signal is ${args.accessOrFrontageSignal.replaceAll("_", " ")}.`,
  ];

  if (args.structuredFields.currentLandUse) {
    parts.push(`Current land use reads as ${args.structuredFields.currentLandUse}.`);
  }

  parts.push(`Confidence is ${args.confidence}.`);

  return parts.join(" ");
}

function buildQaCheck(
  key: string,
  label: string,
  status: VisualDewClawQaStatus,
  summary: string,
  detail?: string,
): VisualDewClawQaCheck {
  return {
    key,
    label,
    status,
    summary,
    detail,
  };
}

function buildDewClawQa(args: {
  parcelPageReached: boolean;
  parcelQuality: PageQuality;
  structuredFields: VisualExtractedParcelFields;
  kmlData: VisualKmlData | null;
  comparableRows: VisualComparableRow[];
  listingPagesReached: number;
  listingPagesAttempted: number;
  hasClassifiedCompEvidence: boolean;
  browserPage?: VisualBrowserPageSnapshot | null;
}): VisualDewClawQa {
  const checks: VisualDewClawQaCheck[] = [];
  const nextFixes: string[] = [];
  const fieldCount = countKnownFields(args.structuredFields);

  if (args.parcelPageReached && fieldCount >= 6 && !args.parcelQuality.isLoginWall) {
    checks.push(
      buildQaCheck(
        "parcel_capture",
        "Parcel captured",
        "pass",
        `${fieldCount} structured fields captured from Land Insights.`,
        args.browserPage ? "Captured from the logged-in browser extension." : "Captured by server fetch.",
      ),
    );
  } else {
    checks.push(
      buildQaCheck(
        "parcel_capture",
        "Parcel captured",
        "fail",
        "Parcel detail capture is not reliable enough yet.",
        `Fields captured: ${fieldCount}.`,
      ),
    );
    nextFixes.push("Open the actual Land Insights parcel detail/report page and run the extension again.");
  }

  if (!args.kmlData) {
    checks.push(
      buildQaCheck(
        "kml_identity",
        "KML match",
        "warning",
        "No KML attached, so parcel boundary was not verified.",
      ),
    );
    nextFixes.push("Attach the KML export from the same Land Insights parcel before trusting boundary-sensitive analysis.");
  } else {
    const kmlFileCountyState = parseKmlCountyStateFromFileName(args.kmlData.fileName);
    const parcelApn = normalizeIdentity(args.structuredFields.apn);
    const kmlApn = normalizeIdentity(args.kmlData.apn || args.kmlData.placemarkName);
    const parcelCounty = normalizeCounty(args.structuredFields.county);
    const kmlCounty = normalizeCounty(kmlFileCountyState?.county);
    const parcelState = normalizeIdentity(args.structuredFields.state);
    const kmlState = normalizeIdentity(kmlFileCountyState?.state);
    const mismatches: string[] = [];
    const matches: string[] = [];

    if (parcelApn && kmlApn) {
      if (parcelApn === kmlApn) {
        matches.push("APN");
      } else {
        mismatches.push(`APN ${args.structuredFields.apn} vs ${args.kmlData.apn || args.kmlData.placemarkName}`);
      }
    }

    if (parcelCounty && kmlCounty) {
      if (parcelCounty === kmlCounty) {
        matches.push("county");
      } else {
        mismatches.push(`county ${args.structuredFields.county} vs ${kmlFileCountyState?.county}`);
      }
    }

    if (parcelState && kmlState) {
      if (parcelState === kmlState) {
        matches.push("state");
      } else {
        mismatches.push(`state ${args.structuredFields.state} vs ${kmlFileCountyState?.state}`);
      }
    }

    if (!args.kmlData.coordinateCount) {
      mismatches.push("KML has no coordinates");
    }

    if (mismatches.length) {
      checks.push(
        buildQaCheck(
          "kml_identity",
          "KML match",
          "fail",
          "KML appears mismatched or incomplete.",
          mismatches.join("; "),
        ),
      );
      nextFixes.push("Re-upload the KML from the exact same Land Insights parcel before using the comp result.");
    } else if (matches.length || args.kmlData.coordinateCount > 0) {
      checks.push(
        buildQaCheck(
          "kml_identity",
          "KML match",
          "pass",
          `KML attached with ${args.kmlData.coordinateCount} coordinates.`,
          matches.length ? `Matched by ${matches.join(", ")}.` : "No identity mismatch detected.",
        ),
      );
    } else {
      checks.push(
        buildQaCheck(
          "kml_identity",
          "KML match",
          "warning",
          "KML attached, but parcel identity could not be fully verified.",
        ),
      );
      nextFixes.push("Confirm the uploaded KML belongs to the same APN/county/state as the parcel.");
    }
  }

  if (args.listingPagesReached > 0) {
    checks.push(
      buildQaCheck(
        "listing_verification",
        "Comp photos/listings inspected",
        "pass",
        `${args.listingPagesReached} comp photo/listing evidence item(s) were captured.`,
      ),
    );
  } else if (args.listingPagesAttempted > 0) {
    checks.push(
      buildQaCheck(
        "listing_verification",
        "Comp photos/listings inspected",
        "warning",
        `${args.listingPagesAttempted} listing link(s) were detected, but none were inspected.`,
        "This should remain preliminary until Land Insights MLS photos or Redfin/Zillow APN/photos/status/acreage are verified.",
      ),
    );
    nextFixes.push("Use Claude MCP to inspect Land Insights MLS photos first, then Redfin/Zillow only if needed.");
  } else {
    checks.push(
      buildQaCheck(
        "listing_verification",
        "Comp photos/listings inspected",
        "warning",
        "No comp photo/listing evidence was captured.",
      ),
    );
    nextFixes.push("Inspect Land Insights MLS comp photos/details for the strongest nearby comps.");
  }

  if (args.comparableRows.length >= 3) {
    checks.push(
      buildQaCheck(
        "comp_table_capture",
        "Comp rows captured",
        "pass",
        `${args.comparableRows.length} Land Insights comparable row(s) captured.`,
        "Rows still need quality classification before final valuation.",
      ),
    );
  } else if (args.comparableRows.length > 0) {
    checks.push(
      buildQaCheck(
        "comp_table_capture",
        "Comp rows captured",
        "warning",
        `Only ${args.comparableRows.length} comparable row(s) captured.`,
      ),
    );
    nextFixes.push("Capture more same-county comparable rows before finalizing value.");
  } else {
    checks.push(
      buildQaCheck(
        "comp_table_capture",
        "Comp rows captured",
        "fail",
        "No comparable rows captured.",
      ),
    );
    nextFixes.push("Turn on MLS comps / capture the comp table before running valuation.");
  }

  if (args.hasClassifiedCompEvidence) {
    checks.push(
      buildQaCheck(
        "comp_quality_classification",
        "Comp quality classified",
        "pass",
        "At least one comp evidence item was classified as anchor, floor, ceiling, weak context, or unrelated.",
        "Still review the role labels before final pricing, especially if photos were not fully opened.",
      ),
    );
  } else {
    checks.push(
      buildQaCheck(
        "comp_quality_classification",
        "Comp quality classified",
        "warning",
        "Comp rows are captured but not yet classified as anchor, floor, ceiling, weak context, or unrelated.",
        "Family transfers, quit claims, landlocked cases, acreage issues, and major problems should be kept but weighted correctly.",
      ),
    );
    nextFixes.push("Classify top comps as anchor, floor, ceiling, weak context, or unrelated before trusting the final value.");
  }

  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarning = checks.some((check) => check.status === "warning" || check.status === "unknown");
  const overallStatus: VisualDewClawQa["overallStatus"] = hasFail
    ? "contaminated"
    : hasWarning
      ? "preliminary"
      : "strong";
  const summary =
    overallStatus === "strong"
      ? "Strong capture. Evidence is ready for DewClaw valuation review."
      : overallStatus === "contaminated"
        ? "Do not trust final pricing yet. One or more source checks are mismatched or missing."
        : "Preliminary comp. Intake worked, but source verification is incomplete.";

  return {
    overallStatus,
    summary,
    checks,
    nextFixes: [...new Set(nextFixes)].slice(0, 6),
  };
}

function normalizeListingLinks(...inputs: Array<string[] | undefined>) {
  return [...new Set(inputs.flatMap((links) => (links ?? []).map((link) => link.trim()).filter(Boolean)))].slice(
    0,
    5,
  );
}

function comparableRowsToText(rows: VisualComparableRow[] | undefined) {
  return (rows ?? [])
    .map((row) => comparableRowToSearchText(row))
    .filter(Boolean)
    .join(" ");
}

async function resolveParcelPage(
  input: VisualParcelInspectorRequest,
  navigationLog: string[],
): Promise<FetchedPage | null> {
  if (input.browserPage) {
    const browserPage = pageFromSnapshot(input.browserPage);
    navigationLog.push(`Use browser parcel snapshot: ${browserPage.url}`);
    navigationLog.push(`Browser parcel title: ${browserPage.title || "(empty)"}`);
    return browserPage;
  }

  try {
    navigationLog.push(`Open parcel: ${input.parcelLink}`);
    const page = await fetchPage(input.parcelLink);
    navigationLog.push(page.ok ? `Parcel page loaded: HTTP ${page.status}` : `Parcel page failed: HTTP ${page.status}`);
    return page;
  } catch (error) {
    navigationLog.push(
      `Parcel page fetch failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return null;
  }
}

async function resolveListingPages(
  input: VisualParcelInspectorRequest,
  normalizedListingLinks: string[],
  navigationLog: string[],
  options: {
    fetchMissingPages: boolean;
  },
) {
  let listingPagesReached = 0;
  const listingSignals: string[] = [];
  const diagnostics: string[] = [];

  const browserListingsByUrl = new Map(
    (input.browserListings ?? []).map((snapshot) => {
      const normalized = normalizeSnapshot(snapshot);
      return [normalized.sourceUrl, normalized];
    }),
  );

  for (const listingLink of normalizedListingLinks) {
    const browserListing = browserListingsByUrl.get(listingLink);

    if (browserListing) {
      navigationLog.push(`Use browser listing snapshot: ${listingLink}`);
      const page = pageFromSnapshot(browserListing);
      if (page.ok) {
        listingPagesReached += 1;
        listingSignals.push(`${page.title} ${page.text.slice(0, 1200)} ${structuredFieldsToText(page.extractedFields || {})}`);
      }
      diagnostics.push(...evaluatePageQuality(page, `listing:${listingLink}`).diagnostics);
      continue;
    }

    if (!options.fetchMissingPages) {
      navigationLog.push(`Skip external listing fetch: ${listingLink}`);
      diagnostics.push(`listing:${listingLink}: skipped external fetch because browser parcel data was already captured.`);
      continue;
    }

    try {
      navigationLog.push(`Open listing: ${listingLink}`);
      const listingPage = await fetchPage(listingLink);
      if (listingPage.ok) {
        listingPagesReached += 1;
        listingSignals.push(`${listingPage.title} ${listingPage.text.slice(0, 1200)}`);
        navigationLog.push(`Listing page loaded: HTTP ${listingPage.status}`);
      } else {
        navigationLog.push(`Listing page failed: HTTP ${listingPage.status}`);
      }
      diagnostics.push(...evaluatePageQuality(listingPage, `listing:${listingLink}`).diagnostics);
    } catch (error) {
      navigationLog.push(
        `Listing fetch failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  return {
    listingPagesReached,
    listingSignals,
    diagnostics,
  };
}

export async function runVisualParcelInspector(
  input: VisualParcelInspectorRequest,
): Promise<VisualParcelInspectorResult> {
  const navigationLog: string[] = [];
  const screenshots: string[] = [];
  const normalizedBrowserCompRows = normalizeComparableRows(input.browserPage?.comparableRows);
  const normalizedListingLinks = normalizeListingLinks(
    input.listingLinks,
    input.browserPage?.listingLinks,
    normalizedBrowserCompRows.map((row) => row.listingUrl || ""),
  );
  const parcelPage = await resolveParcelPage(input, navigationLog);
  const parcelQuality = evaluatePageQuality(parcelPage, "parcel");
  const listingPages = await resolveListingPages(input, normalizedListingLinks, navigationLog, {
    fetchMissingPages: !input.browserPage,
  });
  const kmlData = input.kmlText ? parseKmlExport({ kmlText: input.kmlText, fileName: input.kmlFileName }) : null;
  const structuredFields = mergeStructuredFields({
    browserFields: parcelPage?.extractedFields,
    kmlData,
    pageTitle: parcelPage?.title,
  });

  const combinedText = [
    parcelPage?.title ?? "",
    parcelPage?.text ?? "",
    structuredFieldsToText(structuredFields),
    comparableRowsToText(parcelPage?.comparableRows),
    kmlData ? `kml apn ${kmlData.apn || ""} address ${kmlData.address || ""} acreage ${kmlData.acreage || ""}` : "",
    ...listingPages.listingSignals,
    input.notes ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const areaType = inferAreaType(combinedText, structuredFields);
  const terrainType = inferTerrainType(combinedText, structuredFields);
  const structureSignal = inferStructureSignal(combinedText, structuredFields);
  const accessOrFrontageSignal = inferAccessSignal(combinedText, structuredFields);
  const confidence = inferConfidence(
    Boolean(parcelPage?.ok),
    listingPages.listingPagesReached,
    {
      areaType,
      terrainType,
      structureSignal,
      accessOrFrontageSignal,
    },
    parcelQuality,
    structuredFields,
  );
  const { visualRisks, verifyNext } = buildRisksAndVerifyItems(
    {
      terrainType,
      structureSignal,
      accessOrFrontageSignal,
    },
    parcelQuality,
    structuredFields,
  );

  const diagnostics = [...parcelQuality.diagnostics, ...listingPages.diagnostics];
  const browserPage = input.browserPage;
  const offMarketTargets = (browserPage?.externalSearchTargets ?? []).filter(
    (target) => target.abortComping || target.offMarketDetected || /off[\s-]*market/i.test(target.status ?? ""),
  );

  if (browserPage?.compReportUrl) {
    diagnostics.push(`extension: compReportUrl=${browserPage.compReportUrl}`);
  }

  if (browserPage?.kmlCaptureStatus) {
    diagnostics.push(`extension: ${browserPage.kmlCaptureStatus}`);
  }

  if (browserPage?.externalSearchLaunchStatus) {
    diagnostics.push(`extension: ${browserPage.externalSearchLaunchStatus}`);
  }

  for (const target of browserPage?.externalSearchTargets ?? []) {
    diagnostics.push(
      `extension: ${target.source || "external"} search tab ${target.reused ? "reused" : "opened"} for ${target.searchQuery || target.url}; ${target.status || "review tab ready"}${target.detectionText ? ` (${target.detectionText})` : ""}`,
    );
  }

  if (offMarketTargets.length) {
    const sources = offMarketTargets.map((target) => target.source || "external").join(", ");
    diagnostics.push(`extension: abortComping=true because Off Market was detected on ${sources}.`);
    visualRisks.unshift("Abort comping: Redfin/Zillow showed Off Market. Select a usable active/sold/pending comp before pricing.");
    verifyNext.unshift("Open a different usable listing/comp; do not price from the Off Market page.");
  }

  if (browserPage?.kmlUrl) {
    diagnostics.push(`extension: kmlUrl=${browserPage.kmlUrl}`);
  }

  if (browserPage?.extractionError) {
    diagnostics.push(`extension: extractionError=${browserPage.extractionError}`);
  }

  if (kmlData) {
    diagnostics.push(`kml: file=${kmlData.fileName || "(unnamed)"}`);
    diagnostics.push(`kml: placemark=${kmlData.placemarkName || "(empty)"}`);
    diagnostics.push(`kml: coordinateCount=${kmlData.coordinateCount}`);
  }

  diagnostics.push(`parcel: comparableRows=${parcelPage?.comparableRows?.length ?? 0}`);
  const comparableRows = parcelPage?.comparableRows ?? [];
  const classifiedCompEvidenceText = [
    browserPage?.pageText ?? "",
    ...listingPages.listingSignals,
    input.notes ?? "",
  ].join(" ");
  const hasClassifiedCompEvidence =
    /\b(comp role|external comp role)\s*:\s*(anchor|price_floor|price ceiling|price_ceiling|floor|ceiling|weak_context|weak context|unrelated)/i.test(
      classifiedCompEvidenceText,
    );
  const dewClawQa = buildDewClawQa({
    parcelPageReached: Boolean(parcelPage?.ok),
    parcelQuality,
    structuredFields,
    kmlData,
    comparableRows,
    listingPagesReached: listingPages.listingPagesReached,
    listingPagesAttempted: normalizedListingLinks.length,
    hasClassifiedCompEvidence,
    browserPage,
  });

  diagnostics.push(`qa: overallStatus=${dewClawQa.overallStatus}`);
  diagnostics.push(`qa: classifiedCompEvidence=${hasClassifiedCompEvidence ? "yes" : "no"}`);

  return {
    pageStatus: {
      parcelPageReached: Boolean(parcelPage?.ok),
      listingPagesReached: listingPages.listingPagesReached,
      listingPagesAttempted: normalizedListingLinks.length,
    },
    parcelPageTitle: parcelPage?.title ?? "",
    parcelFinalUrl: parcelPage?.finalUrl ?? input.parcelLink,
    structuredFields,
    kmlData,
    comparableRows,
    areaType,
    terrainType,
    structureSignal,
    accessOrFrontageSignal,
    visualRisks,
    verifyNext,
    confidence,
    dewClawQa,
    summary: buildSummary({
      areaType,
      terrainType,
      structureSignal,
      accessOrFrontageSignal,
      confidence,
      structuredFields,
    }),
    diagnostics,
    screenshots,
    navigationLog,
  };
}
