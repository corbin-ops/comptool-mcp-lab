import { NextResponse } from "next/server";

import { buildCompEvaluationResponse } from "@/comp-tool/evaluate";
import {
  buildCompRequestFromPhase2Capture,
  buildPhase2ParcelEnrichment,
} from "@/phase2/comp-bridge";
import { runVisualParcelInspector } from "@/phase2/inspector";
import {
  saveVisualBrowserIntakeArtifact,
  updateVisualBrowserIntakeArtifact,
} from "@/phase2/storage";
import type {
  VisualBrowserPageSnapshot,
  VisualComparableRow,
  VisualExtractedParcelFields,
  VisualParcelInspectorRequest,
} from "@/phase2/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXTENSION_TOKEN_HEADER = "x-comp-tool-extension-token";

function applyExtensionCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Comp-Tool-Extension-Token, Authorization",
  );

  return response;
}

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return applyExtensionCors(NextResponse.json(payload, init));
}

function isLocalDevelopmentHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function getConfiguredExtensionToken() {
  return process.env.EXTENSION_INTAKE_TOKEN?.trim() ?? "";
}

function getRequestExtensionToken(request: Request) {
  const explicitToken = request.headers.get(EXTENSION_TOKEN_HEADER)?.trim();

  if (explicitToken) {
    return explicitToken;
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);

  return bearerMatch?.[1]?.trim() ?? "";
}

function hasValidExtensionToken(request: Request) {
  const expectedToken = getConfiguredExtensionToken();
  const actualToken = getRequestExtensionToken(request);

  return Boolean(expectedToken && actualToken && actualToken === expectedToken);
}

function canUseBrowserIntake(request: Request) {
  const url = new URL(request.url);

  return isLocalDevelopmentHost(url.hostname) || hasValidExtensionToken(request);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readListingLinks(value: unknown) {
  return Array.isArray(value) ? value.map((item) => readString(item)).filter(Boolean) : [];
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
        source: (readString(record.source) as VisualComparableRow["source"]) || "unknown",
        rawCells: readListingLinks(record.rawCells),
      } satisfies VisualComparableRow);

      return rows;
    }, []);
}

function readExtractedFields(value: unknown): VisualExtractedParcelFields {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const fields: VisualExtractedParcelFields = {};

  for (const [key, rawValue] of Object.entries(record)) {
    const parsedValue = readString(rawValue);

    if (!parsedValue) {
      continue;
    }

    fields[key as keyof VisualExtractedParcelFields] = parsedValue;
  }

  return fields;
}

function readBrowserSnapshot(value: unknown): VisualBrowserPageSnapshot | null {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;

  if (!record) {
    return null;
  }

  const sourceUrl = readString(record.sourceUrl);

  if (!sourceUrl) {
    return null;
  }

  return {
    sourceUrl,
    finalUrl: readString(record.finalUrl),
    pageTitle: readString(record.pageTitle),
    pageText: readString(record.pageText),
    extractedAt: readString(record.extractedAt),
    sourceApp: readString(record.sourceApp),
    compReportUrl: readString(record.compReportUrl),
    kmlUrl: readString(record.kmlUrl),
    kmlFileName: readString(record.kmlFileName),
    kmlCaptureStatus: readString(record.kmlCaptureStatus),
    hasCompReportButton: Boolean(record.hasCompReportButton),
    hasKmlButton: Boolean(record.hasKmlButton),
    extractionError: readString(record.extractionError),
    listingLinks: readListingLinks(record.listingLinks),
    extractedFields: readExtractedFields(record.extractedFields),
    comparableRows: readComparableRows(record.comparableRows),
  };
}

function readBrowserSnapshots(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => readBrowserSnapshot(item)).filter((item): item is VisualBrowserPageSnapshot => Boolean(item))
    : [];
}

function parseBrowserIntakeRequest(payload: unknown): VisualParcelInspectorRequest {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const browserPage = readBrowserSnapshot(record.browserPage);

  return {
    parcelLink: readString(record.parcelLink) || browserPage?.compReportUrl || browserPage?.sourceUrl || "",
    listingLinks: readListingLinks(record.listingLinks),
    notes: readString(record.notes),
    browserPage,
    browserListings: readBrowserSnapshots(record.browserListings),
    kmlText: readString(record.kmlText),
    kmlFileName: readString(record.kmlFileName) || browserPage?.kmlFileName || "",
  };
}

async function runCompEvaluationForArtifact(
  artifactId: string,
  parsed: VisualParcelInspectorRequest,
  result: Awaited<ReturnType<typeof runVisualParcelInspector>>,
) {
  const startedAt = new Date().toISOString();
  await updateVisualBrowserIntakeArtifact(artifactId, {
    compEvaluationStartedAt: startedAt,
    compEvaluationCompletedAt: null,
  });

  try {
    const compRequest = buildCompRequestFromPhase2Capture(parsed, result);
    const compEvaluation = await buildCompEvaluationResponse(compRequest, {
      skipParcelEnrichment: true,
      parcelEnrichment: buildPhase2ParcelEnrichment(parsed, result),
    });

    await updateVisualBrowserIntakeArtifact(artifactId, {
      compEvaluation,
      compEvaluationStatus:
        compEvaluation.generation.status === "completed" ? "completed" : "failed",
      compEvaluationStartedAt: startedAt,
      compEvaluationCompletedAt: new Date().toISOString(),
      compEvaluationError: compEvaluation.generation.error,
    });
  } catch (error) {
    await updateVisualBrowserIntakeArtifact(artifactId, {
      compEvaluationStatus: "failed",
      compEvaluationStartedAt: startedAt,
      compEvaluationCompletedAt: new Date().toISOString(),
      compEvaluationError:
        error instanceof Error ? error.message : "The comp evaluation failed.",
    });
  }
}

export async function POST(request: Request) {
  if (!canUseBrowserIntake(request)) {
    return jsonResponse({ error: "Missing or invalid extension intake token." }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Expected a JSON request body." }, { status: 400 });
  }

  const parsed = parseBrowserIntakeRequest(payload);

  if (!parsed.parcelLink) {
    return jsonResponse({ error: "parcelLink or browserPage.sourceUrl is required." }, { status: 400 });
  }

  if (!parsed.browserPage) {
    return jsonResponse({ error: "browserPage is required for browser intake." }, { status: 400 });
  }

  const result = await runVisualParcelInspector(parsed);
  const artifact = await saveVisualBrowserIntakeArtifact({
    request: parsed,
    result,
    compEvaluationStatus: "pending",
    compEvaluationStartedAt: null,
    compEvaluationCompletedAt: null,
    compEvaluation: null,
  });

  void runCompEvaluationForArtifact(artifact.id, parsed, result);

  return jsonResponse({
    ok: true,
    artifactId: artifact.id,
    createdAt: artifact.createdAt,
    result: artifact.result,
    compEvaluationStatus: artifact.compEvaluationStatus,
    compEvaluationStartedAt: artifact.compEvaluationStartedAt,
    compEvaluationCompletedAt: artifact.compEvaluationCompletedAt,
    compEvaluation: artifact.compEvaluation,
  });
}

export function OPTIONS() {
  return applyExtensionCors(new NextResponse(null, { status: 204 }));
}
