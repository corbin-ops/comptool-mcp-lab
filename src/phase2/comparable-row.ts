import type { VisualComparableRow } from "@/phase2/types";

export interface NormalizedComparableRow {
  city: string;
  status: string;
  price: string;
  acreage: string;
  pricePerAcre: string;
  daysOnMarket: string;
  zip: string;
  distance: string;
  listingUrl: string;
  source: VisualComparableRow["source"];
}

function normalizeWhitespace(value: string | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function looksLikeCurrency(value: string) {
  return /^\$[\d,]+(?:\.\d+)?(?:\s*(?:\/?ac|acre|acres))?$/i.test(value);
}

function looksLikePlainNumber(value: string) {
  return /^\d+(?:,\d{3})*(?:\.\d+)?$/.test(value);
}

function looksLikeDom(value: string) {
  if (!looksLikePlainNumber(value)) {
    return false;
  }

  const numericValue = Number(value.replace(/,/g, ""));

  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 5000;
}

function looksLikeZip(value: string) {
  return /^\d{5}(?:-\d{4})?$/.test(value);
}

function looksLikeStatus(value: string) {
  return /\b(ago|active|sold|pending|closed|expired|off market|under contract)\b/i.test(value);
}

function uniqueInline(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].join(", ");
}

function inferFromRawCells(
  rawCells: string[],
): Partial<Omit<NormalizedComparableRow, "listingUrl" | "source">> {
  const cells = rawCells.map((cell) => normalizeWhitespace(cell)).filter(Boolean);

  if (!cells.length) {
    return {};
  }

  const currencyIndexes = cells
    .map((cell, index) => (looksLikeCurrency(cell) ? index : -1))
    .filter((index) => index >= 0);
  const priceIndex = currencyIndexes[0] ?? -1;
  const pricePerAcreIndex = currencyIndexes.find((index) => index > priceIndex) ?? -1;
  const beforePrice = priceIndex > 0 ? cells.slice(1, priceIndex) : cells.slice(1);
  const afterPrice = priceIndex >= 0 ? cells.slice(priceIndex + 1) : [];
  const afterPricePerAcre = pricePerAcreIndex >= 0 ? cells.slice(pricePerAcreIndex + 1) : [];
  const acreageCandidates =
    priceIndex >= 0 && pricePerAcreIndex > priceIndex
      ? cells.slice(priceIndex + 1, pricePerAcreIndex)
      : afterPrice;
  const zip = cells.find(looksLikeZip) || "";
  const statusBeforePrice = beforePrice.find(looksLikeStatus) || "";
  const statusAfterPricePerAcre = afterPricePerAcre.find(looksLikeStatus) || "";
  const numericAfterPricePerAcre = afterPricePerAcre.filter(
    (cell) => looksLikePlainNumber(cell) && !looksLikeZip(cell),
  );
  const distance = numericAfterPricePerAcre[0] || "";
  const daysOnMarketAfterDistance = numericAfterPricePerAcre
    .slice(distance ? 1 : 0)
    .find(looksLikeDom);

  return {
    city: cells[0] || "",
    status: uniqueInline([statusAfterPricePerAcre, statusBeforePrice]),
    price: priceIndex >= 0 ? cells[priceIndex] : "",
    acreage: acreageCandidates.find((cell) => looksLikePlainNumber(cell) && !looksLikeZip(cell)) || "",
    pricePerAcre: pricePerAcreIndex >= 0 ? cells[pricePerAcreIndex] : "",
    daysOnMarket: beforePrice.find(looksLikeDom) || daysOnMarketAfterDistance || "",
    zip,
    distance,
  };
}

export function normalizeComparableRowForDisplay(row: VisualComparableRow): NormalizedComparableRow {
  const inferred = inferFromRawCells(row.rawCells ?? []);

  return {
    city: inferred.city || normalizeWhitespace(row.city),
    status: inferred.status || normalizeWhitespace(row.status),
    price: inferred.price || normalizeWhitespace(row.price),
    acreage: inferred.acreage || normalizeWhitespace(row.acreage),
    pricePerAcre: inferred.pricePerAcre || normalizeWhitespace(row.pricePerAcre),
    daysOnMarket: inferred.daysOnMarket || normalizeWhitespace(row.daysOnMarket),
    zip: inferred.zip || normalizeWhitespace(row.zip),
    distance: inferred.distance || normalizeWhitespace(row.extraMetric),
    listingUrl: normalizeWhitespace(row.listingUrl),
    source: row.source || "unknown",
  };
}

export function formatComparableAcreage(value: string) {
  const normalized = normalizeWhitespace(value);

  if (!normalized || /\bac(?:re|res)?\b/i.test(normalized)) {
    return normalized;
  }

  return `${normalized} ac`;
}

export function formatComparableRowSummary(row: VisualComparableRow, index?: number) {
  const normalized = normalizeComparableRowForDisplay(row);
  const parts = [
    normalized.city || "Unknown city",
    normalized.status,
    normalized.price,
    formatComparableAcreage(normalized.acreage),
    normalized.pricePerAcre ? `PPA ${normalized.pricePerAcre}` : "",
    normalized.daysOnMarket ? `DOM ${normalized.daysOnMarket}` : "",
    normalized.distance ? `Distance ${normalized.distance}` : "",
    normalized.zip ? `ZIP ${normalized.zip}` : "",
    normalized.listingUrl ? `${normalized.source || "source"}: ${normalized.listingUrl}` : "",
  ].filter(Boolean);

  const summary = parts.join(" | ");

  return typeof index === "number" ? `Comp ${index + 1}: ${summary}` : summary;
}

export function comparableRowToSearchText(row: VisualComparableRow) {
  const normalized = normalizeComparableRowForDisplay(row);

  return [
    normalized.city,
    normalized.status,
    normalized.price,
    normalized.acreage,
    normalized.pricePerAcre,
    normalized.daysOnMarket,
    normalized.distance,
    normalized.zip,
    normalized.source,
  ]
    .filter(Boolean)
    .join(" ");
}
