import type {
  VisualExtractedParcelFields,
  VisualKmlBounds,
  VisualKmlCoordinate,
  VisualKmlData,
} from "@/phase2/types";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'"),
  );
}

function parseDescriptionFields(descriptionHtml: string) {
  const plain = stripHtml(descriptionHtml);
  const fields: VisualExtractedParcelFields = {};

  for (const line of plain.split(/\n+/).map((item) => item.trim()).filter(Boolean)) {
    const match = line.match(/^([^:]+):\s*(.+)$/);

    if (!match) {
      continue;
    }

    const label = match[1].trim().toLowerCase();
    const value = match[2].trim();

    if (label === "apn") {
      fields.apn = value;
    } else if (label === "address") {
      fields.address = value;
    } else if (label === "owner") {
      fields.owner = value;
    } else if (label === "acreage") {
      fields.acreage = value;
    }
  }

  return fields;
}

function parseCoordinates(kmlText: string) {
  const coordinates: VisualKmlCoordinate[] = [];
  const coordinateBlocks = [...kmlText.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi)];

  for (const block of coordinateBlocks) {
    const rawBlock = block[1] || "";
    const tuples = rawBlock
      .trim()
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);

    for (const tuple of tuples) {
      const [lonText, latText, altText] = tuple.split(",");
      const lon = Number(lonText);
      const lat = Number(latText);
      const alt = altText ? Number(altText) : null;

      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        continue;
      }

      coordinates.push({
        lon,
        lat,
        alt: Number.isFinite(alt ?? NaN) ? alt : null,
      });
    }
  }

  return coordinates;
}

function computeBounds(coordinates: VisualKmlCoordinate[]): VisualKmlBounds | null {
  if (!coordinates.length) {
    return null;
  }

  let minLon = coordinates[0].lon;
  let maxLon = coordinates[0].lon;
  let minLat = coordinates[0].lat;
  let maxLat = coordinates[0].lat;

  for (const coordinate of coordinates) {
    minLon = Math.min(minLon, coordinate.lon);
    maxLon = Math.max(maxLon, coordinate.lon);
    minLat = Math.min(minLat, coordinate.lat);
    maxLat = Math.max(maxLat, coordinate.lat);
  }

  return {
    minLon,
    maxLon,
    minLat,
    maxLat,
  };
}

export function parseKmlExport(input: { kmlText: string; fileName?: string }): VisualKmlData | null {
  const kmlText = input.kmlText.trim();

  if (!kmlText) {
    return null;
  }

  const placemarkName = normalizeWhitespace(kmlText.match(/<Placemark>[\s\S]*?<name>([\s\S]*?)<\/name>/i)?.[1] || "");
  const descriptionHtml = kmlText.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1] || "";
  const descriptionFields = parseDescriptionFields(descriptionHtml);
  const coordinates = parseCoordinates(kmlText);

  return {
    fileName: input.fileName?.trim() || "",
    placemarkName,
    apn: descriptionFields.apn || placemarkName || "",
    address: descriptionFields.address || "",
    owner: descriptionFields.owner || "",
    acreage: descriptionFields.acreage || "",
    coordinateCount: coordinates.length,
    bounds: computeBounds(coordinates),
    coordinates,
  };
}
