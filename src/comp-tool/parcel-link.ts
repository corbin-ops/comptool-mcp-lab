import type {
  CompEvaluateRequest,
  CompParcelEnrichment,
  CompParcelFetchMode,
} from "@/comp-tool/types";

type MergeResult = {
  request: CompEvaluateRequest;
  parcelEnrichment: CompParcelEnrichment | null;
  warnings: string[];
};

type StructuredSignals = {
  textFragments: string[];
  counties: string[];
  states: string[];
  acreages: string[];
  factStrings: string[];
};

type InlineFieldMatches = {
  county: string;
  state: string;
  acreage: string;
};

const LAND_INSIGHTS_HOST_PATTERN = /(^|\.)landinsights\.com$/i;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; DewClawCompTool/1.0; +https://github.com/corbin-ops/CompTool)";
const FACT_KEY_PATTERN =
  /(access|frontage|road|terrain|topography|cover|landcover|utilities?|well|septic|electric|flood|wetland|improvement|structure|zoning|subdiv|water|creek|river|pond|lake|easement|pasture|wooded|timber|cleared|slope)/i;
const US_STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
]);
const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

function buildDefaultQuestion(mode: CompEvaluateRequest["mode"]) {
  switch (mode) {
    case "pricing":
      return "Estimate market value, price per acre, and a practical offer range for this parcel.";
    case "subdivision":
      return "Estimate current market value and whether there is realistic subdivision or lot-split upside.";
    case "rural":
      return "Estimate value while focusing on rural access, remoteness, and discount factors.";
    case "deliverable":
      return "Produce the full DewClaw deliverable using the parcel information available.";
    default:
      return "Estimate market value, offer range, and key risks or upside for this parcel.";
  }
}

function buildPropertyTypeQuestionSuffix(propertyTypeFocus: CompEvaluateRequest["propertyTypeFocus"]) {
  switch (propertyTypeFocus) {
    case "vacant_land":
      return " Keep the analysis focused on normal vacant land and flag any possible structure contamination.";
    case "structure_vacant_land":
      return " Treat this as possible structure/vacant land and separate land value from structure impact where possible.";
    default:
      return " Also flag any signs that the property may include a structure or mixed comping profile.";
  }
}

function titleCaseWords(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toPrettyLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function uniqueValues(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return parts
    .map((part) => (part ? normalizeWhitespace(part) : ""))
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function uniqueJoin(parts: Array<string | null | undefined>, separator = " | ") {
  return uniqueValues(parts).join(separator);
}

function normalizeCounty(value: string) {
  const normalized = normalizeWhitespace(value).replace(/[|,;]+$/, "");
  if (!normalized) {
    return "";
  }

  const countyMatch = normalized.match(
    /\b([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(County|Parish|Borough)\b/i,
  );

  if (countyMatch?.[1] && countyMatch?.[2]) {
    return `${titleCaseWords(countyMatch[1])} ${titleCaseWords(countyMatch[2])}`;
  }

  return normalized;
}

function normalizeState(value: string) {
  const normalized = normalizeWhitespace(value).replace(/[,.;]+$/, "");

  if (!normalized) {
    return "";
  }

  const upper = normalized.toUpperCase();
  if (US_STATE_CODES.has(upper)) {
    return upper;
  }

  return STATE_NAME_TO_CODE[normalized.toLowerCase()] ?? "";
}

function normalizeAcreage(value: string | number) {
  const stringValue = typeof value === "number" ? String(value) : normalizeWhitespace(String(value));
  const match = stringValue.match(/(\d+(?:\.\d+)?)/);

  return match?.[1] ?? "";
}

function extractTitle(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch?.[1] ? normalizeWhitespace(titleMatch[1]) : "";
}

function extractMetaContent(html: string, key: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+(?:name|property)=["']${key}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return normalizeWhitespace(match[1]);
    }
  }

  return "";
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

function inferFromSlug(value: string) {
  const clean = value.toLowerCase();
  const result = {
    county: "",
    state: "",
    acreage: "",
  };

  const acreageMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:ac|acre|acres)\b/);
  if (acreageMatch?.[1]) {
    result.acreage = acreageMatch[1];
  }

  const countyMatch = clean.match(
    /([a-z]+(?:-[a-z]+)*)-(county|parish|borough)\b(?:-([a-z]{2}))?/,
  );
  if (countyMatch?.[1] && countyMatch?.[2]) {
    const normalizedCountySlug = countyMatch[1].replace(
      /^(sample|test|demo|parcel|property)-+/,
      "",
    );
    result.county = `${titleCaseWords(normalizedCountySlug)} ${titleCaseWords(countyMatch[2])}`;
    if (countyMatch[3]) {
      result.state = countyMatch[3].toUpperCase();
    }
  }

  if (!result.state) {
    const tokenMatches = clean.match(/(?:^|[-_/])([a-z]{2})(?:[-_/]|$)/g) ?? [];
    const likelyState = tokenMatches
      .map((token) => token.replace(/[-_/]/g, "").toUpperCase())
      .find((token) => US_STATE_CODES.has(token));
    if (likelyState) {
      result.state = likelyState;
    }
  }

  return result;
}

function extractCountyState(text: string) {
  const countyStateMatch = text.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(County|Parish|Borough)\b(?:,\s*([A-Z]{2}))?/,
  );

  return {
    county:
      countyStateMatch?.[1] && countyStateMatch?.[2]
        ? `${countyStateMatch[1]} ${countyStateMatch[2]}`
        : "",
    state: countyStateMatch?.[3] ? countyStateMatch[3].toUpperCase() : "",
  };
}

function extractAcreage(text: string) {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(?:ac|acre|acres)\b/i);
  return match?.[1] ?? "";
}

function extractKnownFacts(text: string) {
  const lowered = text.toLowerCase();
  const facts: string[] = [];

  const factRules = [
    {
      pattern: /\b(paved road|road frontage|frontage road|county road|gravel road|public road)\b/i,
      label: "Road frontage / access signals present",
    },
    { pattern: /\b(wooded|timber|trees?)\b/i, label: "Wooded land signals present" },
    { pattern: /\b(pasture|cleared|field)\b/i, label: "Pasture / cleared land signals present" },
    {
      pattern: /\b(landlocked|easement|access issue|limited access|private road)\b/i,
      label: "Possible access constraint mentioned",
    },
    { pattern: /\b(flood|wetland|wetlands|fema)\b/i, label: "Flood or wetlands mention detected" },
    {
      pattern: /\b(house|home|shed|barn|cabin|mobile home|improvement)\b/i,
      label: "Possible structure mention detected",
    },
    {
      pattern: /\b(electric|utilities|well|septic|water line|power line)\b/i,
      label: "Utility-related mention detected",
    },
    {
      pattern: /\b(subdivid|split lots?|lot split|value-add)\b/i,
      label: "Subdivision or value-add language detected",
    },
    {
      pattern: /\b(sloped|slope|terrain|topography|elevation)\b/i,
      label: "Terrain/topography mention detected",
    },
  ];

  for (const rule of factRules) {
    if (rule.pattern.test(lowered)) {
      facts.push(rule.label);
    }
  }

  return uniqueJoin(facts);
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function collectSignalsFromJson(root: unknown): StructuredSignals {
  const signals: StructuredSignals = {
    textFragments: [],
    counties: [],
    states: [],
    acreages: [],
    factStrings: [],
  };
  const queue: Array<{ value: unknown; key: string | null }> = [{ value: root, key: null }];
  const seen = new Set<unknown>();
  let visited = 0;

  while (queue.length && visited < 5000) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const { value, key } = current;
    visited += 1;

    if (value && typeof value === "object") {
      if (seen.has(value)) {
        continue;
      }
      seen.add(value);

      if (Array.isArray(value)) {
        for (const item of value) {
          queue.push({ value: item, key });
        }
        continue;
      }

      for (const [childKey, childValue] of Object.entries(value)) {
        queue.push({ value: childValue, key: childKey });
      }
      continue;
    }

    if (value === null || value === undefined) {
      continue;
    }

    const stringValue =
      typeof value === "string" ? normalizeWhitespace(value) : typeof value === "number" ? String(value) : "";
    const normalizedKey = key ? key.toLowerCase() : "";

    if (!stringValue) {
      continue;
    }

    if (stringValue.length <= 240 && FACT_KEY_PATTERN.test(normalizedKey)) {
      signals.factStrings.push(`${toPrettyLabel(key ?? "Fact")}: ${stringValue}`);
    }

    if (/(^county$|countyname|county_name|parish|borough)/i.test(normalizedKey)) {
      signals.counties.push(normalizeCounty(stringValue));
    }

    if (/(^state$|statecode|state_code|stateabbr|state_abbr|regioncode)/i.test(normalizedKey)) {
      const normalizedState = normalizeState(stringValue);
      if (normalizedState) {
        signals.states.push(normalizedState);
      }
    }

    if (/(acreage|acres|lotsize|lot_size|sizeacres|parcelacres|landsize|areaacres)/i.test(normalizedKey)) {
      const normalizedAcreage = normalizeAcreage(stringValue);
      if (normalizedAcreage) {
        signals.acreages.push(normalizedAcreage);
      }
    }

    if (
      stringValue.length >= 8 &&
      stringValue.length <= 260 &&
      (FACT_KEY_PATTERN.test(stringValue) || /county|parcel|acres|road|access|utilities/i.test(stringValue))
    ) {
      signals.textFragments.push(stringValue);
    }
  }

  return {
    textFragments: uniqueValues(signals.textFragments).slice(0, 30),
    counties: uniqueValues(signals.counties),
    states: uniqueValues(signals.states),
    acreages: uniqueValues(signals.acreages),
    factStrings: uniqueValues(signals.factStrings).slice(0, 12),
  };
}

function extractJsonSignals(html: string) {
  const combinedSignals: StructuredSignals = {
    textFragments: [],
    counties: [],
    states: [],
    acreages: [],
    factStrings: [],
  };
  const scriptPattern =
    /<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    const parsed = tryParseJson(match[1]);
    if (!parsed) {
      continue;
    }

    const signals = collectSignalsFromJson(parsed);
    combinedSignals.textFragments.push(...signals.textFragments);
    combinedSignals.counties.push(...signals.counties);
    combinedSignals.states.push(...signals.states);
    combinedSignals.acreages.push(...signals.acreages);
    combinedSignals.factStrings.push(...signals.factStrings);
  }

  const nextDataPattern =
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
  const nextDataMatch = html.match(nextDataPattern);
  if (nextDataMatch?.[1]) {
    const parsed = tryParseJson(nextDataMatch[1]);
    if (parsed) {
      const signals = collectSignalsFromJson(parsed);
      combinedSignals.textFragments.push(...signals.textFragments);
      combinedSignals.counties.push(...signals.counties);
      combinedSignals.states.push(...signals.states);
      combinedSignals.acreages.push(...signals.acreages);
      combinedSignals.factStrings.push(...signals.factStrings);
    }
  }

  return {
    textFragments: uniqueValues(combinedSignals.textFragments).slice(0, 40),
    counties: uniqueValues(combinedSignals.counties),
    states: uniqueValues(combinedSignals.states),
    acreages: uniqueValues(combinedSignals.acreages),
    factStrings: uniqueValues(combinedSignals.factStrings).slice(0, 12),
  };
}

function extractInlineFieldMatches(html: string): InlineFieldMatches {
  const countyMatch = html.match(
    /"(?:county|countyName|county_name|countyFullName)"\s*:\s*"([^"]+)"/i,
  );
  const stateMatch = html.match(
    /"(?:state|stateCode|state_code|stateAbbr|state_abbr)"\s*:\s*"([^"]+)"/i,
  );
  const acreageMatch = html.match(
    /"(?:acreage|acres|lotSize|lot_size|parcelAcres|parcel_acres|areaAcres|area_acres)"\s*:\s*"?(\\?[\d.]+)"?/i,
  );

  return {
    county: countyMatch?.[1] ? normalizeCounty(countyMatch[1]) : "",
    state: stateMatch?.[1] ? normalizeState(stateMatch[1]) : "",
    acreage: acreageMatch?.[1] ? normalizeAcreage(acreageMatch[1].replace(/\\/g, "")) : "",
  };
}

function resolveFetchMode(url: URL): CompParcelFetchMode {
  const hasCookie = Boolean(process.env.LAND_INSIGHTS_COOKIE?.trim());
  if (LAND_INSIGHTS_HOST_PATTERN.test(url.hostname) && hasCookie) {
    return "shared_land_insights_session";
  }

  return "anonymous";
}

function buildFetchHeaders(url: URL, fetchMode: CompParcelFetchMode) {
  const headers = new Headers({
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "User-Agent": process.env.LAND_INSIGHTS_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
  });

  if (LAND_INSIGHTS_HOST_PATTERN.test(url.hostname)) {
    headers.set("Referer", process.env.LAND_INSIGHTS_REFERER?.trim() || `${url.origin}/`);
    headers.set("Origin", url.origin);
    headers.set("Cache-Control", "no-cache");
  }

  if (fetchMode === "shared_land_insights_session" && process.env.LAND_INSIGHTS_COOKIE?.trim()) {
    headers.set("Cookie", process.env.LAND_INSIGHTS_COOKIE.trim());
  }

  return headers;
}

function pageLooksLikeLoginWall(finalUrl: string, html: string) {
  const title = extractTitle(html).toLowerCase();
  const text = stripHtml(html).toLowerCase().slice(0, 4000);
  const url = finalUrl.toLowerCase();

  if (/\/login\b|\/signin\b|\/auth\b/.test(url)) {
    return true;
  }

  return (
    /\b(sign in|log in|login|authentication required)\b/.test(title) ||
    (/\b(sign in|log in|login|authentication required)\b/.test(text) &&
      !/\b(parcel|county|acre|property)\b/.test(text))
  );
}

async function fetchParcelPage(parcelLink: string) {
  const url = new URL(parcelLink);
  const fetchMode = resolveFetchMode(url);
  const timeoutMs = Number(process.env.LAND_INSIGHTS_TIMEOUT_MS || "12000");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 12000);

  try {
    const response = await fetch(parcelLink, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: buildFetchHeaders(url, fetchMode),
    });

    const html = await response.text();
    const loginWall = pageLooksLikeLoginWall(response.url || parcelLink, html);

    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      html,
      loginWall,
      fetchMode,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildKnownFacts(pageText: string, structuredFacts: string[]) {
  return uniqueJoin([extractKnownFacts(pageText), ...structuredFacts]);
}

function buildParcelEnrichment(
  status: CompParcelEnrichment["status"],
  fetchMode: CompParcelFetchMode,
  finalUrl: string | null,
  pageTitle: string | null,
  diagnostics: string[],
  extractedFields: CompParcelEnrichment["extractedFields"],
): CompParcelEnrichment {
  return {
    status,
    fetchMode,
    finalUrl,
    pageTitle,
    diagnostics,
    extractedFields,
  };
}

export async function enrichCompRequestFromParcelLink(
  input: CompEvaluateRequest,
): Promise<MergeResult> {
  if (!input.parcelLink) {
    return {
      request: input,
      parcelEnrichment: null,
      warnings: [],
    };
  }

  let url: URL;

  try {
    url = new URL(input.parcelLink);
  } catch {
    return {
      request: input,
      parcelEnrichment: buildParcelEnrichment(
        "invalid_url",
        "not_applicable",
        null,
        null,
        ["Parcel link is not a valid URL."],
        {
          county: "",
          state: "",
          acreage: "",
          knownFacts: "",
        },
      ),
      warnings: ["Parcel link is not a valid URL, so auto-fill could not run."],
    };
  }

  const slug = url.pathname.split("/").filter(Boolean).pop() ?? "";
  const inferredFromUrl = inferFromSlug(slug);
  const fetchMode = resolveFetchMode(url);
  const diagnostics: string[] = [];
  let pageTitle = "";
  let pageText = "";
  let finalUrl = input.parcelLink;
  let status: CompParcelEnrichment["status"] = "no_match";

  if (
    LAND_INSIGHTS_HOST_PATTERN.test(url.hostname) &&
    fetchMode === "anonymous"
  ) {
    diagnostics.push(
      "No LAND_INSIGHTS_COOKIE configured on the server, so the parcel page is being fetched anonymously.",
    );
  }

  if (fetchMode === "shared_land_insights_session") {
    diagnostics.push("Using the shared Land Insights session configured on the server.");
  }

  let structuredSignals: StructuredSignals = {
    textFragments: [],
    counties: [],
    states: [],
    acreages: [],
    factStrings: [],
  };
  let inlineMatches: InlineFieldMatches = {
    county: "",
    state: "",
    acreage: "",
  };

  try {
    const response = await fetchParcelPage(input.parcelLink);
    finalUrl = response.finalUrl || input.parcelLink;

    if (response.loginWall) {
      diagnostics.push("Land Insights returned a login wall instead of parcel data.");
      status = "unreachable";
    } else if (!response.ok) {
      diagnostics.push(`Parcel page returned HTTP ${response.status}.`);
      status = "unreachable";
    } else {
      pageTitle =
        extractTitle(response.html) ||
        extractMetaContent(response.html, "og:title") ||
        extractMetaContent(response.html, "twitter:title");
      const metaDescription =
        extractMetaContent(response.html, "description") ||
        extractMetaContent(response.html, "og:description");
      structuredSignals = extractJsonSignals(response.html);
      inlineMatches = extractInlineFieldMatches(response.html);
      pageText = uniqueJoin(
        [
          pageTitle,
          metaDescription,
          stripHtml(response.html),
          ...structuredSignals.textFragments,
          ...structuredSignals.factStrings,
        ],
        " ",
      );
      status = "fetched";
    }
  } catch (error) {
    diagnostics.push(
      error instanceof Error ? error.message : "Parcel page could not be fetched from the server.",
    );
    status = "unreachable";
  }

  const extractedFromText = pageText
    ? {
        ...extractCountyState(pageText),
        acreage: extractAcreage(pageText),
      }
    : {
        county: "",
        state: "",
        acreage: "",
      };

  const extractedFields = {
    county:
      input.county ||
      inlineMatches.county ||
      structuredSignals.counties[0] ||
      extractedFromText.county ||
      inferredFromUrl.county,
    state:
      input.state ||
      inlineMatches.state ||
      structuredSignals.states[0] ||
      extractedFromText.state ||
      inferredFromUrl.state,
    acreage:
      input.acreage ||
      inlineMatches.acreage ||
      structuredSignals.acreages[0] ||
      extractedFromText.acreage ||
      inferredFromUrl.acreage,
    knownFacts: buildKnownFacts(pageText, structuredSignals.factStrings),
  };

  if (
    status === "unreachable" &&
    (inferredFromUrl.county || inferredFromUrl.state || inferredFromUrl.acreage)
  ) {
    status = "inferred";
    diagnostics.push("Used URL-based inference because the parcel page was unreachable.");
  }

  if (
    status === "fetched" &&
    !extractedFields.county &&
    !extractedFields.state &&
    !extractedFields.acreage
  ) {
    status =
      inferredFromUrl.county || inferredFromUrl.state || inferredFromUrl.acreage
        ? "inferred"
        : "no_match";
    if (status === "inferred") {
      diagnostics.push(
        "Fetched the parcel page, but relied on the parcel URL slug for the property basics.",
      );
    }
  }

  if (!pageText && !extractedFields.county && !extractedFields.state && !extractedFields.acreage) {
    diagnostics.push("No county, state, or acreage could be extracted automatically from the parcel link.");
  }

  if (status === "fetched" && extractedFields.knownFacts) {
    diagnostics.push("Detected structured property facts from the parcel page.");
  }

  const mergedKnownFacts = uniqueJoin([input.knownFacts, extractedFields.knownFacts]);

  const resolvedRequest: CompEvaluateRequest = {
    ...input,
    county: extractedFields.county,
    state: extractedFields.state,
    acreage: extractedFields.acreage,
    question:
      input.question ||
      `${buildDefaultQuestion(input.mode)}${buildPropertyTypeQuestionSuffix(input.propertyTypeFocus)}`,
    knownFacts: mergedKnownFacts,
  };

  const warnings: string[] = [];

  if (status === "unreachable") {
    warnings.push("Parcel link could not be fetched from the server, so no auto-fill was applied.");
  }

  if (status === "inferred") {
    warnings.push(
      "Parcel basics were inferred from the parcel link, so verify county/state/acreage before relying on the output.",
    );
  }

  if (
    LAND_INSIGHTS_HOST_PATTERN.test(url.hostname) &&
    fetchMode === "anonymous" &&
    status !== "fetched"
  ) {
    warnings.push(
      "Land Insights appears to require authentication for this parcel. Add LAND_INSIGHTS_COOKIE on the server to enable richer parcel ingestion.",
    );
  }

  if (
    LAND_INSIGHTS_HOST_PATTERN.test(url.hostname) &&
    fetchMode === "shared_land_insights_session" &&
    status !== "fetched"
  ) {
    warnings.push(
      "The shared Land Insights session may be expired or blocked. Refresh LAND_INSIGHTS_COOKIE on the server if parcel ingestion keeps failing.",
    );
  }

  if (status === "no_match" && !input.county && !input.state && !input.acreage) {
    warnings.push("Parcel link was received, but the tool could not auto-fill county/state/acreage yet.");
  }

  return {
    request: resolvedRequest,
    parcelEnrichment: buildParcelEnrichment(
      status,
      fetchMode,
      finalUrl,
      pageTitle || null,
      diagnostics,
      extractedFields,
    ),
    warnings,
  };
}
