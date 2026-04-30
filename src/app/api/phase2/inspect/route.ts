import { NextResponse } from "next/server";

import { runVisualParcelInspector } from "@/phase2/inspector";
import type {
  VisualBrowserPageSnapshot,
  VisualComparableRow,
  VisualExtractedParcelFields,
  VisualParcelInspectorRequest,
} from "@/phase2/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function parseVisualParcelInspectorRequest(payload: unknown): VisualParcelInspectorRequest {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

  return {
    parcelLink: readString(record.parcelLink),
    listingLinks: readListingLinks(record.listingLinks),
    notes: readString(record.notes),
    browserPage: readBrowserSnapshot(record.browserPage),
    browserListings: readBrowserSnapshots(record.browserListings),
    kmlText: readString(record.kmlText),
    kmlFileName: readString(record.kmlFileName),
  };
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON request body." }, { status: 400 });
  }

  const parsed = parseVisualParcelInspectorRequest(payload);

  if (!parsed.parcelLink) {
    return NextResponse.json({ error: "parcelLink is required." }, { status: 400 });
  }

  return NextResponse.json(await runVisualParcelInspector(parsed));
}
