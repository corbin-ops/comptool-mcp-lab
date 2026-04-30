function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function collectVisibleText() {
  const bodyText = document.body?.innerText || "";
  return normalizeWhitespace(bodyText).slice(0, 120000);
}

function collectVisibleLines(root = document.body) {
  return String(root?.innerText || "")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function dedupe(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function toAbsoluteUrl(value) {
  const rawValue = normalizeWhitespace(value);

  if (!rawValue) {
    return "";
  }

  try {
    return new URL(rawValue, window.location.href).href;
  } catch {
    return "";
  }
}

function isVisibleElement(element) {
  if (!element || !(element instanceof Element)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function getElementText(element) {
  return normalizeWhitespace(element?.innerText || element?.textContent || "");
}

function findActionElementByText(pattern) {
  const selectors = ["a", "button", '[role="button"]', "[tabindex]", "[data-testid]"];

  return (
    Array.from(document.querySelectorAll(selectors.join(","))).find((element) => {
      const text = getElementText(element);

      return isVisibleElement(element) && pattern.test(text);
    }) || null
  );
}

function findHrefNearElement(element, urlPattern) {
  if (!element) {
    return "";
  }

  const candidates = [];

  if (element.matches?.("a[href]")) {
    candidates.push(element);
  }

  const closestAnchor = element.closest?.("a[href]");
  if (closestAnchor) {
    candidates.push(closestAnchor);
  }

  for (let current = element; current && candidates.length < 12; current = current.parentElement) {
    candidates.push(...Array.from(current.querySelectorAll?.("a[href]") || []));
  }

  for (const candidate of candidates) {
    const href = toAbsoluteUrl(candidate.getAttribute("href") || "");

    if (href && (!urlPattern || urlPattern.test(href))) {
      return href;
    }
  }

  return "";
}

function findHrefByText(textPattern, urlPattern) {
  const anchors = Array.from(document.querySelectorAll("a[href]"));

  for (const anchor of anchors) {
    const href = toAbsoluteUrl(anchor.getAttribute("href") || "");
    const text = getElementText(anchor);

    if (href && textPattern.test(text) && (!urlPattern || urlPattern.test(href))) {
      return href;
    }
  }

  return "";
}

function findHrefByUrl(urlPattern) {
  const anchors = Array.from(document.querySelectorAll("a[href]"));

  for (const anchor of anchors) {
    const href = toAbsoluteUrl(anchor.getAttribute("href") || "");

    if (href && urlPattern.test(href)) {
      return href;
    }
  }

  return "";
}

function findHrefByPredicate(predicate) {
  const anchors = Array.from(document.querySelectorAll("a[href]"));

  for (const anchor of anchors) {
    const href = toAbsoluteUrl(anchor.getAttribute("href") || "");

    if (href && predicate(href)) {
      return href;
    }
  }

  return "";
}

function isLandInsightsHost(hostname) {
  return /^app\.landinsights\.(com|co)$/i.test(hostname);
}

function isLikelyKmlDownloadUrl(href) {
  try {
    const url = new URL(href, window.location.href);

    if (url.protocol === "blob:") {
      return true;
    }

    if (!isLandInsightsHost(url.hostname)) {
      return false;
    }

    const pathname = decodeURIComponent(url.pathname).toLowerCase();
    const format = (url.searchParams.get("format") || "").toLowerCase();
    const type = (url.searchParams.get("type") || "").toLowerCase();
    const fileType = (url.searchParams.get("fileType") || "").toLowerCase();
    const exportType = (url.searchParams.get("exportType") || "").toLowerCase();

    return (
      pathname.endsWith(".kml") ||
      /\/kml(?:\/|$)/i.test(pathname) ||
      [format, type, fileType, exportType].includes("kml")
    );
  } catch {
    return false;
  }
}

function collectLandInsightsActionLinks() {
  const compReportElement = findActionElementByText(/\bcomp\s*report\b/i);
  const kmlElement = findActionElementByText(/\bkml\b/i);
  const compReportUrl =
    findHrefNearElement(compReportElement, /\/home\/comping\/report\//i) ||
    findHrefByText(/\bcomp\s*report\b/i, /\/home\/comping\/report\//i) ||
    findHrefByUrl(/\/home\/comping\/report\//i) ||
    (/\/home\/comping\/report\//i.test(window.location.href) ? window.location.href : "");
  const kmlUrl =
    findHrefNearElement(kmlElement, /\.kml(?:$|[?#])/i) ||
    findHrefByText(/\bkml\b/i, /\.kml(?:$|[?#])/i) ||
    findHrefByPredicate(isLikelyKmlDownloadUrl);

  return {
    compReportUrl,
    kmlUrl,
    hasCompReportButton: Boolean(compReportElement),
    hasKmlButton: Boolean(kmlElement),
    kmlElement
  };
}

function inferKmlFileName(fields) {
  const apn = normalizeWhitespace(fields?.apn || "parcel").replace(/[^a-zA-Z0-9-]+/g, "_");
  const county = normalizeWhitespace(fields?.county || "").replace(/[^a-zA-Z0-9-]+/g, "_");
  const state = normalizeWhitespace(fields?.state || "").replace(/[^a-zA-Z0-9-]+/g, "_");
  const parts = [apn, county, state].filter(Boolean);

  return `${parts.join("-") || "landinsights-parcel"}.kml`;
}

function installKmlCaptureBridge() {
  // The bridge is injected by background.js with chrome.scripting in the page MAIN world.
  // Do not inject inline scripts here; Land Insights blocks inline script tags through CSP.
}

function captureKmlFromButton(kmlElement, fallbackFileName) {
  if (!kmlElement) {
    return Promise.resolve(null);
  }

  installKmlCaptureBridge();

  const captureId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve) => {
    let settled = false;
    let timeout = null;

    function finish(payload) {
      if (settled) {
        return;
      }

      settled = true;
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timeout);
      resolve(payload);
    }

    function handleMessage(event) {
      if (
        event.source !== window ||
        event.data?.source !== "dewclaw-comp-tool" ||
        event.data?.type !== "kml-captured" ||
        event.data?.captureId !== captureId
      ) {
        return;
      }

      finish({
        kmlText: String(event.data.kmlText || ""),
        kmlFileName: normalizeWhitespace(event.data.fileName || fallbackFileName),
        captureSource: normalizeWhitespace(event.data.captureSource || "button-click"),
        captureStatus: "KML captured from user click"
      });
    }

    window.addEventListener("message", handleMessage);
    window.postMessage(
      {
        source: "dewclaw-comp-tool",
        type: "arm-kml-capture",
        captureId,
        timeoutMs: 7000
      },
      "*"
    );

    timeout = window.setTimeout(
      () =>
        finish({
          kmlText: "",
          kmlFileName: fallbackFileName,
          captureSource: "button-download",
          captureStatus: "KML button clicked; waiting for Chrome download capture"
        }),
      7500
    );

    try {
      kmlElement.click();
    } catch {
      finish({
        kmlText: "",
        kmlFileName: fallbackFileName,
        captureSource: "button-click-failed",
        captureStatus: "KML button click failed"
      });
    }
  });
}

function looksLikeKmlDocument(text) {
  return /<kml[\s>]/i.test(text || "") || /Exported from LandInsights/i.test(text || "");
}

function fetchKmlBlobUrlFromPage(blobUrl, fileName) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      finish({
        ok: false,
        error: "Timed out while reading KML blob URL from Land Insights tab."
      });
    }, 7000);

    function finish(payload) {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
      resolve(payload);
    }

    function handleMessage(event) {
      if (
        event.source !== window ||
        event.data?.source !== "dewclaw-comp-tool" ||
        event.data?.type !== "kml-blob-url-fetched" ||
        event.data?.requestId !== requestId
      ) {
        return;
      }

      finish({
        ok: Boolean(event.data.ok),
        kmlText: String(event.data.kmlText || ""),
        fileName: normalizeWhitespace(event.data.fileName || fileName || ""),
        error: normalizeWhitespace(event.data.error || "")
      });
    }

    window.addEventListener("message", handleMessage);
    window.postMessage(
      {
        source: "dewclaw-comp-tool",
        type: "fetch-kml-blob-url",
        requestId,
        blobUrl,
        fileName
      },
      "*"
    );

    fetch(blobUrl)
      .then((response) => response.text())
      .then((text) => {
        if (looksLikeKmlDocument(text)) {
          finish({
            ok: true,
            kmlText: text,
            fileName
          });
        }
      })
      .catch(() => {
        // Blob URLs are usually page-owned; the MAIN-world bridge remains the primary path.
      });
  });
}

function collectGenericListingLinks() {
  const selectors = [
    'a[href*="redfin.com"]',
    'a[href*="zillow.com"]',
    'a[href*="realtor.com"]'
  ];

  return dedupe(
    Array.from(document.querySelectorAll(selectors.join(",")))
      .map((anchor) => anchor.getAttribute("href") || "")
      .filter((href) => href.startsWith("http"))
      .map((href) => href.trim())
  ).slice(0, 20);
}

const FIELD_SPECS = [
  { key: "ownerMailingAddress", label: "Owner Mailing Address", maxLines: 1 },
  { key: "address", label: "Property Address", maxLines: 1 },
  { key: "county", label: "County", maxLines: 1 },
  { key: "acreage", label: "Acres", maxLines: 1 },
  { key: "lastPurchasePrice", label: "Last Purchase Price", maxLines: 1 },
  { key: "lastPurchaseDate", label: "Last Purchase Date", maxLines: 1 },
  { key: "apn", label: "APN", maxLines: 1 },
  { key: "gps", label: "GPS", maxLines: 1 },
  { key: "taxDelinquentFor", label: "Tax Delinquent For", maxLines: 1 },
  { key: "familyTransfer", label: "Family Transfer", maxLines: 1 },
  { key: "structureCount", label: "Structure count", maxLines: 1 },
  { key: "mobileHome", label: "Mobile Home", maxLines: 1 },
  { key: "lastPurchaseType", label: "Last Purchase Type", maxLines: 1 },
  { key: "deedType", label: "Deed Type", maxLines: 1 },
  { key: "zoning", label: "Zoning", maxLines: 1 },
  { key: "propertyTax", label: "Property Tax", maxLines: 1 },
  { key: "inHoa", label: "In HOA", maxLines: 1 },
  { key: "structures", label: "Structures", maxLines: 1 },
  { key: "structureYearBuilt", label: "Structure year built", maxLines: 1 },
  { key: "assessedValue", label: "Assessed Value", maxLines: 1 },
  { key: "assessedLandValue", label: "Assessed Land Value", maxLines: 1 },
  { key: "assessedImprovementValue", label: "Assessed Improvement Value", maxLines: 1 },
  { key: "landLocked", label: "Land Locked", maxLines: 1 },
  { key: "roadFrontage", label: "Road Frontage", maxLines: 1 },
  { key: "wetlands", label: "Wetlands", maxLines: 1 },
  { key: "floodZone", label: "Flood Zone", maxLines: 1 },
  { key: "hoa", label: "HOA", maxLines: 1 },
  { key: "hasStructure", label: "Has Structure", maxLines: 1 },
  { key: "currentLandUse", label: "Current Land Use", maxLines: 1 },
  { key: "owner", label: "Current Owner", maxLines: 1 },
  { key: "ownershipLength", label: "Ownership Length", maxLines: 2 },
  { key: "relationToProperty", label: "Relation to Property", maxLines: 1 }
];

const KNOWN_LABELS = new Set(FIELD_SPECS.map((spec) => spec.label.toLowerCase()));

function splitCountyState(value) {
  const match = normalizeWhitespace(value).match(/^(.*?),\s*([A-Z]{2})$/);
  if (!match) {
    return null;
  }

  return {
    county: normalizeWhitespace(match[1]),
    state: match[2].trim()
  };
}

function getTextLines(element) {
  return String(element?.innerText || element?.textContent || "")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function findExactTextElements(label) {
  const target = label.toLowerCase();
  const selectors = ["div", "span", "p", "td", "th", "strong"];

  return Array.from(document.querySelectorAll(selectors.join(","))).filter((element) => {
    const text = normalizeWhitespace(element.textContent || "");
    if (text.toLowerCase() !== target) {
      return false;
    }

    return !Array.from(element.children).some((child) => normalizeWhitespace(child.textContent || "").toLowerCase() === target);
  });
}

function findTightFieldContainer(labelElement, label, maxLines) {
  const target = label.toLowerCase();
  let current = labelElement;
  let best = null;

  for (let depth = 0; depth < 6 && current; depth += 1) {
    const parent = current.parentElement;
    if (!parent) {
      break;
    }

    const lines = getTextLines(parent);
    const labelIndex = lines.findIndex((line) => line.toLowerCase() === target);
    if (labelIndex !== -1 && lines.length >= 2 && lines.length <= Math.max(6, maxLines + 4)) {
      best = { element: parent, lines, labelIndex };
    }

    current = parent;
  }

  return best;
}

function extractValueFromLines(lines, labelIndex, maxLines) {
  const values = [];

  for (let index = labelIndex + 1; index < lines.length; index += 1) {
    const candidate = lines[index];
    if (!candidate) {
      continue;
    }

    if (KNOWN_LABELS.has(candidate.toLowerCase())) {
      break;
    }

    values.push(candidate);

    if (values.length >= maxLines) {
      break;
    }
  }

  return normalizeWhitespace(values.join(" "));
}

function extractValueByLabel(label, maxLines = 1) {
  const matches = findExactTextElements(label);

  for (const match of matches) {
    const container = findTightFieldContainer(match, label, maxLines);
    if (!container) {
      continue;
    }

    const value = extractValueFromLines(container.lines, container.labelIndex, maxLines);
    if (value) {
      return value;
    }
  }

  return "";
}

function extractTopSummaryFields() {
  const lines = collectVisibleLines();
  const fields = {};

  const apnIndex = lines.findIndex((line) => /^APN:\s*/i.test(line));
  if (apnIndex !== -1) {
    fields.apn = normalizeWhitespace(lines[apnIndex].replace(/^APN:\s*/i, ""));

    if (lines[apnIndex + 1]) {
      fields.owner = lines[apnIndex + 1];
    }

    const acreageLine = lines.slice(apnIndex, apnIndex + 6).find((line) => /^\d+(\.\d+)?\s+acres?$/i.test(line));
    if (acreageLine) {
      fields.acreage = acreageLine.replace(/\s+acres?$/i, "");
    }
  }

  const countyLine = lines.find((line) => /county,\s*[A-Z]{2}\b/i.test(line));
  if (countyLine) {
    const countyState = splitCountyState(countyLine);
    if (countyState) {
      fields.county = countyState.county;
      fields.state = countyState.state;
    }
  }

  return fields;
}

function extractStructuredFields() {
  const fields = {
    ...extractTopSummaryFields()
  };

  for (const spec of FIELD_SPECS) {
    const value = extractValueByLabel(spec.label, spec.maxLines);
    if (value) {
      fields[spec.key] = value;
    }
  }

  if (fields.county) {
    const countyState = splitCountyState(fields.county);
    if (countyState) {
      fields.county = countyState.county;
      fields.state = fields.state || countyState.state;
    }
  }

  return fields;
}

function inferListingSource(url) {
  if (!url) {
    return "unknown";
  }

  if (url.includes("redfin.com")) {
    return "redfin";
  }

  if (url.includes("zillow.com")) {
    return "zillow";
  }

  if (url.includes("realtor.com")) {
    return "realtor";
  }

  return "unknown";
}

function looksLikeCurrencyCell(value) {
  return /^\$[\d,]+(?:\.\d+)?(?:\s*(?:\/?ac|acre|acres))?$/i.test(value);
}

function looksLikePlainNumberCell(value) {
  return /^\d+(?:,\d{3})*(?:\.\d+)?$/.test(value);
}

function looksLikeDomCell(value) {
  if (!looksLikePlainNumberCell(value)) {
    return false;
  }

  const numericValue = Number(value.replace(/,/g, ""));

  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 5000;
}

function looksLikeZipCell(value) {
  return /^\d{5}(?:-\d{4})?$/.test(value);
}

function looksLikeStatusCell(value) {
  return /\b(ago|active|sold|pending|closed|expired|off market|under contract)\b/i.test(value);
}

function uniqueInlineCells(values) {
  return Array.from(new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))).join(", ");
}

function inferComparableCells(cells) {
  const normalizedCells = cells.map((cell) => normalizeWhitespace(cell)).filter(Boolean);
  const currencyIndexes = normalizedCells
    .map((cell, index) => (looksLikeCurrencyCell(cell) ? index : -1))
    .filter((index) => index >= 0);
  const priceIndex = currencyIndexes[0] ?? -1;
  const pricePerAcreIndex = currencyIndexes.find((index) => index > priceIndex) ?? -1;
  const beforePrice = priceIndex > 0 ? normalizedCells.slice(1, priceIndex) : normalizedCells.slice(1);
  const afterPrice = priceIndex >= 0 ? normalizedCells.slice(priceIndex + 1) : [];
  const afterPricePerAcre = pricePerAcreIndex >= 0 ? normalizedCells.slice(pricePerAcreIndex + 1) : [];
  const acreageCandidates =
    priceIndex >= 0 && pricePerAcreIndex > priceIndex
      ? normalizedCells.slice(priceIndex + 1, pricePerAcreIndex)
      : afterPrice;
  const zip = normalizedCells.find(looksLikeZipCell) || "";
  const statusBeforePrice = beforePrice.find(looksLikeStatusCell) || "";
  const statusAfterPricePerAcre = afterPricePerAcre.find(looksLikeStatusCell) || "";
  const numericAfterPricePerAcre = afterPricePerAcre.filter(
    (cell) => looksLikePlainNumberCell(cell) && !looksLikeZipCell(cell)
  );
  const distance = numericAfterPricePerAcre[0] || "";
  const daysOnMarketAfterDistance = numericAfterPricePerAcre
    .slice(distance ? 1 : 0)
    .find(looksLikeDomCell) || "";

  return {
    city: normalizedCells[0] || "",
    daysOnMarket: beforePrice.find(looksLikeDomCell) || daysOnMarketAfterDistance,
    status: uniqueInlineCells([statusAfterPricePerAcre, statusBeforePrice]),
    price: priceIndex >= 0 ? normalizedCells[priceIndex] : "",
    acreage: acreageCandidates.find((cell) => looksLikePlainNumberCell(cell) && !looksLikeZipCell(cell)) || "",
    pricePerAcre: pricePerAcreIndex >= 0 ? normalizedCells[pricePerAcreIndex] : "",
    extraMetric: distance,
    zip
  };
}

function extractComparableRows() {
  return Array.from(document.querySelectorAll("tr.lui-table--clickable"))
    .map((row) => {
      const cells = Array.from(row.querySelectorAll("td")).map((cell) => normalizeWhitespace(cell.innerText || cell.textContent || ""));
      const listingAnchor = row.querySelector('a[href*="redfin.com"],a[href*="zillow.com"],a[href*="realtor.com"]');
      const listingUrl = listingAnchor?.href?.trim() || "";

      if (!cells.some(Boolean) && !listingUrl) {
        return null;
      }

      const inferredCells = inferComparableCells(cells);

      return {
        city: inferredCells.city,
        price: inferredCells.price,
        acreage: inferredCells.acreage,
        pricePerAcre: inferredCells.pricePerAcre,
        daysOnMarket: inferredCells.daysOnMarket,
        zip: inferredCells.zip,
        extraMetric: inferredCells.extraMetric,
        status: inferredCells.status,
        listingUrl,
        source: inferListingSource(listingUrl),
        rawCells: cells
      };
    })
    .filter(Boolean)
    .slice(0, 50);
}

async function buildCurrentPageSnapshot() {
  const comparableRows = extractComparableRows();
  const rowLinks = comparableRows.map((row) => row.listingUrl).filter(Boolean);
  const extractedFields = extractStructuredFields();
  const actionLinks = collectLandInsightsActionLinks();
  const fallbackKmlFileName = inferKmlFileName(extractedFields);
  const clickCapturedKml = actionLinks.kmlUrl
    ? null
    : await captureKmlFromButton(actionLinks.kmlElement, fallbackKmlFileName);

  return {
    sourceUrl: window.location.href,
    finalUrl: window.location.href,
    pageTitle: normalizeWhitespace(document.title || ""),
    pageText: collectVisibleText(),
    extractedAt: new Date().toISOString(),
    sourceApp: "landinsights-browser-extension",
    listingLinks: dedupe([...rowLinks, ...collectGenericListingLinks()]),
    extractedFields,
    comparableRows,
    compReportUrl: actionLinks.compReportUrl,
    kmlUrl: actionLinks.kmlUrl,
    kmlText: clickCapturedKml?.kmlText || "",
    kmlFileName: clickCapturedKml?.kmlFileName || fallbackKmlFileName,
    kmlCaptureStatus: clickCapturedKml?.kmlText
      ? `Captured from ${clickCapturedKml.captureSource || "KML button"}`
      : clickCapturedKml?.captureStatus
        ? clickCapturedKml.captureStatus
      : actionLinks.kmlUrl
        ? "KML URL detected; background fetch required"
        : actionLinks.hasKmlButton
          ? "KML button found, but no KML blob was captured"
          : "KML button not found",
    hasCompReportButton: actionLinks.hasCompReportButton,
    hasKmlButton: actionLinks.hasKmlButton
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "phase2:resolve-blob-kml") {
    fetchKmlBlobUrlFromPage(message.blobUrl || "", message.fileName || "")
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unknown KML blob read error."
        });
      });

    return true;
  }

  if (message?.type !== "phase2:extract-current-page") {
    return false;
  }

  buildCurrentPageSnapshot()
    .then((snapshot) => sendResponse(snapshot))
    .catch((error) => {
      sendResponse({
        sourceUrl: window.location.href,
        finalUrl: window.location.href,
        pageTitle: normalizeWhitespace(document.title || ""),
        pageText: collectVisibleText(),
        extractedAt: new Date().toISOString(),
        sourceApp: "landinsights-browser-extension",
        listingLinks: collectGenericListingLinks(),
        extractedFields: extractStructuredFields(),
        comparableRows: extractComparableRows(),
        extractionError: error instanceof Error ? error.message : "Unknown extraction error"
      });
    });

  return true;
});
