const APP_BASE_URL = "https://comptool-mcp-lab.onrender.com";
const LOCAL_WORKER_URL = "http://127.0.0.1:4777";
const EXTENSION_INTAKE_TOKEN = "ce8f050fdb583135eac2c16a889bd0146a09f783958f49cde341903706c5f79f";
const LAND_INSIGHTS_HOST_PATTERN = /^https:\/\/app\.landinsights\.(com|co)\//i;

function cleanSearchValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildListingSearchQuery(browserPage) {
  const fields = browserPage?.extractedFields || {};
  const apn = cleanSearchValue(fields.apn);
  const address = cleanSearchValue(fields.address || fields.propertyAddress);
  const county = cleanSearchValue(fields.county);
  const state = cleanSearchValue(fields.state);

  if (apn) {
    return {
      query: [apn, county, state].filter(Boolean).join(" "),
      source: "apn",
    };
  }

  if (address) {
    return {
      query: [address, county, state].filter(Boolean).join(" "),
      source: "address",
    };
  }

  return {
    query: [county, state].filter(Boolean).join(" "),
    source: county || state ? "county_state" : "",
  };
}

function buildExternalListingSearchTabs(browserPage) {
  const search = buildListingSearchQuery(browserPage);

  if (!search.query) {
    return [];
  }

  const encoded = encodeURIComponent(search.query);

  return [
    {
      source: "zillow",
      searchSource: search.source,
      searchQuery: search.query,
      url: "https://www.zillow.com/",
      fallbackUrl: `https://www.google.com/search?q=${encodeURIComponent(`${search.query} site:zillow.com`)}`,
    },
    {
      source: "redfin",
      searchSource: search.source,
      searchQuery: search.query,
      url: `https://www.redfin.com/?searchInputBox=${encoded}`,
      fallbackUrl: `https://www.google.com/search?q=${encodeURIComponent(`${search.query} site:redfin.com`)}`,
    },
  ];
}

function appendQueryParam(params, key, value) {
  const cleanValue = cleanSearchValue(value);

  if (cleanValue) {
    params.set(key, cleanValue);
  }
}

function buildGuidedClaudeCaptureUrl(browserPage, externalSearchLaunch) {
  const fields = browserPage?.extractedFields || {};
  const parcelLink = browserPage?.compReportUrl || browserPage?.sourceUrl || "";
  const search = buildListingSearchQuery(browserPage);
  const targets = externalSearchLaunch?.opened || [];
  const zillowTarget = targets.find((target) => /^zillow\b/i.test(target.source || ""));
  const redfinTarget = targets.find((target) => /^redfin\b/i.test(target.source || ""));
  const params = new URLSearchParams();

  appendQueryParam(params, "parcelLink", parcelLink);
  appendQueryParam(params, "source", browserPage?.sourceUrl);
  appendQueryParam(params, "apn", fields.apn);
  appendQueryParam(params, "address", fields.address || fields.propertyAddress);
  appendQueryParam(params, "county", fields.county);
  appendQueryParam(params, "state", fields.state);
  appendQueryParam(params, "acreage", fields.acreage);
  appendQueryParam(params, "searchQuery", search.query);
  appendQueryParam(params, "searchSource", search.source);
  appendQueryParam(params, "zillowUrl", zillowTarget?.finalUrl || zillowTarget?.url);
  appendQueryParam(params, "redfinUrl", redfinTarget?.finalUrl || redfinTarget?.url);
  appendQueryParam(params, "extensionStatus", externalSearchLaunch?.status);
  params.set("flow", "guided-claude-capture");

  return `${APP_BASE_URL}/mcp-test?${params.toString()}`;
}

function waitForTabLoad(tabId, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let settled = false;
    let timeout = null;

    function cleanup() {
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      clearTimeout(timeout);
    }

    function finish(result) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    }

    function handleUpdated(updatedTabId, changeInfo, tab) {
      if (updatedTabId !== tabId) {
        return;
      }

      if (changeInfo.status === "complete") {
        finish({ ok: true, tab });
      }
    }

    chrome.tabs.onUpdated.addListener(handleUpdated);
    timeout = setTimeout(() => {
      chrome.tabs.get(tabId, (tab) => {
        finish({
          ok: false,
          tab: chrome.runtime.lastError ? null : tab,
          error: "Timed out waiting for listing search tab to load.",
        });
      });
    }, timeoutMs);

    chrome.tabs.get(tabId, (tab) => {
      if (!chrome.runtime.lastError && tab?.status === "complete") {
        finish({ ok: true, tab });
      }
    });
  });
}

async function primeExternalSearchTab(tabId, target) {
  if (!tabId || !target?.searchQuery) {
    return {
      ok: false,
      status: "No tab/query available for search priming.",
    };
  }

  await waitForTabLoad(tabId);

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: runListingSearchOnPage,
      args: [target.source, target.searchQuery],
    });

    return result?.result || {
      ok: false,
      status: "Search script returned no result.",
    };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof Error ? error.message : "Search script could not run.",
    };
  }
}

async function detectExternalListingPageState(tabId) {
  if (!tabId) {
    return {
      offMarketDetected: false,
      listingState: "unknown",
      status: "No tab available for listing-state detection.",
    };
  }

  await waitForTabLoad(tabId, 20000);

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: readExternalListingPageState,
    });

    return result?.result || {
      offMarketDetected: false,
      listingState: "unknown",
      status: "Listing-state script returned no result.",
    };
  } catch (error) {
    return {
      offMarketDetected: false,
      listingState: "unknown",
      status: error instanceof Error ? error.message : "Listing-state script could not run.",
    };
  }
}

function readExternalListingPageState() {
  const text = String(document.body?.innerText || "").replace(/\s+/g, " ").trim();
  const title = String(document.title || "").trim();
  const haystack = `${title} ${text}`;

  function has(pattern) {
    return pattern.test(haystack);
  }

  const offMarketDetected = has(/\boff[\s-]*market\b/i);
  let listingState = "unknown";

  if (offMarketDetected) {
    listingState = "off_market";
  } else if (has(/\bfor sale\b|\bactive\b/i)) {
    listingState = "active";
  } else if (has(/\bpending\b|\bunder contract\b/i)) {
    listingState = "pending";
  } else if (has(/\bsold\b|\bclosed\b/i)) {
    listingState = "sold";
  }

  const evidenceMatch = haystack.match(
    /\b(?:off[\s-]*market|for sale|active|pending|under contract|sold|closed)\b.{0,120}/i,
  );

  return {
    offMarketDetected,
    abortComping: offMarketDetected,
    listingState,
    status: offMarketDetected
      ? "Off Market detected. Comping should abort until a usable comp/listing is selected."
      : `Listing/search state detected: ${listingState}.`,
    detectionText: evidenceMatch?.[0]?.trim() || "",
    finalUrl: window.location.href,
  };
}

function runListingSearchOnPage(source, query) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const selectorsBySource = {
    zillow: [
      'input[aria-label*="Search" i]',
      'input[placeholder*="address" i]',
      'input[placeholder*="city" i]',
      'input[type="search"]',
      'input[type="text"]',
    ],
    redfin: [
      'input[data-rf-test-id*="search" i]',
      'input[placeholder*="City" i]',
      'input[placeholder*="address" i]',
      'input[title*="Search" i]',
      'input[type="search"]',
      'input[type="text"]',
    ],
  };
  const selectors = selectorsBySource[source] || selectorsBySource.redfin;

  function isUsableInput(element) {
    if (!element || !(element instanceof HTMLInputElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      !element.disabled &&
      !element.readOnly &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 20 &&
      rect.height > 10
    );
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;

    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function pressEnter(input) {
    for (const type of ["keydown", "keypress", "keyup"]) {
      input.dispatchEvent(new KeyboardEvent(type, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      }));
    }
  }

  function clickSearchButton(input) {
    const form = input.closest("form");
    const scopedButtons = [
      ...(form ? Array.from(form.querySelectorAll("button,input[type='submit']")) : []),
      ...Array.from(document.querySelectorAll(
        'button[type="submit"],button[aria-label*="Search" i],button[title*="Search" i],[role="button"][aria-label*="Search" i]'
      )),
    ];
    const button = scopedButtons.find((candidate) => {
      const style = window.getComputedStyle(candidate);
      const rect = candidate.getBoundingClientRect();

      return !candidate.disabled && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });

    if (button) {
      button.click();
      return true;
    }

    if (form?.requestSubmit) {
      form.requestSubmit();
      return true;
    }

    if (form) {
      form.submit();
      return true;
    }

    return false;
  }

  return (async () => {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      for (const selector of selectors) {
        const input = Array.from(document.querySelectorAll(selector)).find(isUsableInput);

        if (!input) {
          continue;
        }

        input.focus();
        input.select?.();
        setInputValue(input, query);
        await wait(250);
        pressEnter(input);
        await wait(250);
        const clicked = clickSearchButton(input);

        return {
          ok: true,
          status: clicked ? "Search query entered and search submitted." : "Search query entered and Enter dispatched.",
          selector,
          finalUrl: window.location.href,
        };
      }

      await wait(400);
    }

    return {
      ok: false,
      status: "Search input was not found. Use the fallback search tab/query manually.",
      finalUrl: window.location.href,
    };
  })();
}

async function openExternalListingSearchTabs(browserPage, sourceTab) {
  const targets = buildExternalListingSearchTabs(browserPage);

  if (!targets.length || !sourceTab?.id || sourceTab.windowId == null) {
    return {
      opened: [],
      status: "No APN/address/county search target available for Redfin/Zillow tabs.",
    };
  }

  const existingTabs = await chrome.tabs.query({ windowId: sourceTab.windowId });
  const existingUrls = new Set(existingTabs.map((tab) => tab.url).filter(Boolean));
  const opened = [];
  let nextIndex = Number.isInteger(sourceTab.index) ? sourceTab.index + 1 : undefined;

  for (const target of targets) {
    if (existingUrls.has(target.url)) {
      const existingTab = existingTabs.find((tab) => tab.url === target.url);
      const primeResult = await primeExternalSearchTab(existingTab?.id, target);
      const pageState = await detectExternalListingPageState(existingTab?.id);
      opened.push({
        ...target,
        tabId: existingTab?.id || null,
        reused: true,
        primeResult,
        ...pageState,
        status: pageState.offMarketDetected ? pageState.status : `${primeResult.status} ${pageState.status}`,
      });
      continue;
    }

    const createdTab = await chrome.tabs.create({
      url: target.url,
      active: false,
      windowId: sourceTab.windowId,
      openerTabId: sourceTab.id,
      ...(Number.isInteger(nextIndex) ? { index: nextIndex } : {}),
    });

    opened.push({
      ...target,
      tabId: createdTab.id || null,
      reused: false,
    });

    const primeResult = await primeExternalSearchTab(createdTab.id, target);
    const pageState = await detectExternalListingPageState(createdTab.id);
    opened[opened.length - 1].primeResult = primeResult;
    Object.assign(opened[opened.length - 1], pageState, {
      status: pageState.offMarketDetected ? pageState.status : `${primeResult.status} ${pageState.status}`,
    });

    if (!primeResult.ok && target.fallbackUrl) {
      const fallbackTab = await chrome.tabs.create({
        url: target.fallbackUrl,
        active: false,
        windowId: sourceTab.windowId,
        openerTabId: sourceTab.id,
        ...(Number.isInteger(nextIndex) ? { index: nextIndex + 1 } : {}),
      });

      opened.push({
        ...target,
        source: `${target.source}_google_fallback`,
        url: target.fallbackUrl,
        tabId: fallbackTab.id || null,
        reused: false,
        status: "Opened Google fallback because site search could not be auto-submitted.",
      });
    }

    if (Number.isInteger(nextIndex)) {
      nextIndex += primeResult.ok || !target.fallbackUrl ? 1 : 2;
    }
  }

  return {
    opened,
    status: opened.length
      ? opened.some((target) => target.abortComping || target.offMarketDetected)
        ? "Opened Redfin/Zillow search tabs; Off Market detected, so comping should abort."
        : `Opened ${opened.length} Redfin/Zillow search tab(s) from ${opened[0].searchSource || "search"} query.`
      : "No Redfin/Zillow search tabs opened.",
  };
}

async function openProgressTab(sourceUrl) {
  return chrome.tabs.create({
    url: `${APP_BASE_URL}/phase2/loading?source=${encodeURIComponent(sourceUrl)}`,
    active: true,
  });
}

async function navigateResultTab(tabId, url) {
  if (tabId) {
    await chrome.tabs.update(tabId, {
      url,
      active: true,
    });
    return;
  }

  await chrome.tabs.create({
    url,
    active: true,
  });
}

async function postBrowserCapture(payload) {
  const response = await fetch(`${APP_BASE_URL}/api/phase2/browser-intake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Comp-Tool-Extension-Token": EXTENSION_INTAKE_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Browser intake failed.");
  }

  return response.json();
}

async function queueLocalWorker(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 2000);

  try {
    const response = await fetch(`${LOCAL_WORKER_URL}/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Local worker returned HTTP ${response.status}.`);
    }

    return await response.json();
  } catch (error) {
    console.info(
      "[Phase2 Extractor] Local worker not queued. Dashboard still opened with browser capture.",
      error,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getDownloadDisplayName(downloadItem) {
  const filename = downloadItem?.filename || "";

  return filename.split(/[\\/]/).pop() || "";
}

function getDownloadUrl(downloadItem) {
  return downloadItem?.finalUrl || downloadItem?.url || "";
}

function isBlobUrl(value) {
  return /^blob:/i.test(value || "");
}

function isRecentDownload(downloadItem, startedAtMs) {
  if (!downloadItem) {
    return false;
  }

  const startTimeMs = downloadItem.startTime ? Date.parse(downloadItem.startTime) : Date.now();

  return startTimeMs >= startedAtMs - 2000;
}

function isLandInsightsDownload(downloadItem) {
  const downloadUrl = getDownloadUrl(downloadItem);

  try {
    const url = new URL(downloadUrl);

    return /(^|\.)landinsights\.(com|co)$/i.test(url.hostname);
  } catch {
    return /^blob:https:\/\/app\.landinsights\.(com|co)\//i.test(downloadUrl);
  }
}

function isLikelyKmlDownload(downloadItem, startedAtMs) {
  if (!isRecentDownload(downloadItem, startedAtMs)) {
    return false;
  }

  const fileName = getDownloadDisplayName(downloadItem);
  const haystack = [
    fileName,
    downloadItem.filename || "",
    downloadItem.url || "",
    downloadItem.finalUrl || "",
    downloadItem.mime || "",
  ].join(" ");

  return /\.kml(?:$|[?#])/i.test(haystack) || /google[-_\s]*earth|kml/i.test(haystack);
}

function isCandidateLandInsightsKml(downloadItem, startedAtMs) {
  return isLikelyKmlDownload(downloadItem, startedAtMs) || (
    isRecentDownload(downloadItem, startedAtMs) &&
    isLandInsightsDownload(downloadItem) &&
    downloadItem.state === "complete"
  );
}

function summarizeDownload(downloadItem) {
  if (!downloadItem) {
    return "";
  }

  let urlSummary = "";
  const downloadUrl = getDownloadUrl(downloadItem);

  try {
    const url = new URL(downloadUrl);
    urlSummary = `${url.hostname}${url.pathname}`.slice(0, 90);
  } catch {
    urlSummary = downloadUrl.slice(0, 90);
  }

  return [
    getDownloadDisplayName(downloadItem) || "no filename",
    downloadItem.state || "unknown state",
    downloadItem.mime || "no mime",
    urlSummary || "no url",
  ].join(" | ");
}

function summarizeDownloads(downloads) {
  if (!downloads?.length) {
    return "no recent downloads visible to extension";
  }

  return downloads.slice(0, 5).map(summarizeDownload).join(" || ");
}

function searchDownloads(query) {
  return new Promise((resolve) => {
    chrome.downloads.search(query, (items) => {
      resolve(items || []);
    });
  });
}

function createKmlDownloadWatcher(startedAtMs, timeoutMs = 15000) {
  if (!chrome.downloads) {
    return {
      promise: Promise.resolve({
        match: null,
        recentDownloads: [],
        status: "Chrome downloads API unavailable",
      }),
      stop() {},
    };
  }

  let settled = false;
  let timeout = null;
  let resolvePromise = null;
  const observedDownloadIds = new Set();

  function cleanup() {
    chrome.downloads.onCreated.removeListener(handleCreated);
    chrome.downloads.onChanged.removeListener(handleChanged);
    clearTimeout(timeout);
  }

  async function getRecentDownloads() {
    const recentDownloads = await searchDownloads({
      startedAfter: new Date(startedAtMs - 2000).toISOString(),
      orderBy: ["-startTime"],
      limit: 25,
    });

    return recentDownloads.filter((item) => isRecentDownload(item, startedAtMs));
  }

  async function finish(downloadItem, status = "") {
    if (settled) {
      return;
    }

    settled = true;
    const recentDownloads = await getRecentDownloads();
    cleanup();
    resolvePromise({
      match: downloadItem || null,
      recentDownloads,
      status,
    });
  }

  async function inspectDownload(id) {
    observedDownloadIds.add(id);
    const items = await searchDownloads({ id });
    const match = items.find((item) => isCandidateLandInsightsKml(item, startedAtMs));

    if (match?.state === "complete") {
      finish(match, "matched completed KML/Land Insights download");
    }
  }

  function handleCreated(downloadItem) {
    if (downloadItem?.id) {
      observedDownloadIds.add(downloadItem.id);
    }

    if (isCandidateLandInsightsKml(downloadItem, startedAtMs) && downloadItem.state === "complete") {
      finish(downloadItem, "matched KML/Land Insights download on create");
      return;
    }

    if (isCandidateLandInsightsKml(downloadItem, startedAtMs)) {
      inspectDownload(downloadItem.id);
    }
  }

  function handleChanged(delta) {
    if (delta?.state?.current === "complete") {
      inspectDownload(delta.id);
    }
  }

  const promise = new Promise((resolve) => {
    resolvePromise = resolve;

    chrome.downloads.onCreated.addListener(handleCreated);
    chrome.downloads.onChanged.addListener(handleChanged);

    timeout = setTimeout(async () => {
      const recentDownloads = await getRecentDownloads();
      const match = recentDownloads.find(
        (item) => isCandidateLandInsightsKml(item, startedAtMs) && item.state === "complete",
      );

      finish(
        match || null,
        observedDownloadIds.size
          ? `saw ${observedDownloadIds.size} download event(s), but none matched a completed KML`
          : "no download events observed before timeout",
      );
    }, timeoutMs);
  });

  return {
    promise,
    stop: cleanup,
  };
}

async function fetchKmlText(kmlUrl, fileName = "") {
  if (!kmlUrl) {
    return null;
  }

  const url = new URL(kmlUrl);
  const likelyKmlFileName = /\.kml(?:$|[?#])/i.test(fileName || "");

  if (url.protocol === "blob:") {
    throw new Error("KML download used a blob URL that cannot be fetched from the extension worker.");
  }

  const pathname = decodeURIComponent(url.pathname).toLowerCase();
  const format = (url.searchParams.get("format") || "").toLowerCase();
  const type = (url.searchParams.get("type") || "").toLowerCase();
  const fileType = (url.searchParams.get("fileType") || "").toLowerCase();
  const exportType = (url.searchParams.get("exportType") || "").toLowerCase();
  const isLandInsightsKmlUrl =
    /^app\.landinsights\.(com|co)$/i.test(url.hostname) &&
    (
      pathname.endsWith(".kml") ||
      /\/kml(?:\/|$)/i.test(pathname) ||
      [format, type, fileType, exportType].includes("kml") ||
      likelyKmlFileName
    );

  if (!isLandInsightsKmlUrl) {
    throw new Error("Ignored non-KML URL.");
  }

  const response = await fetch(kmlUrl, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`KML fetch failed with HTTP ${response.status}.`);
  }

  const text = await response.text();

  if (!/<kml[\s>]/i.test(text)) {
    throw new Error("KML URL did not return a KML document.");
  }

  return text;
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

async function ensureKmlBridge(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["page-kml-bridge.js"],
    world: "MAIN",
  });
}

async function resolveBlobKmlFromPage(tabId, blobUrl, fileName) {
  if (!blobUrl) {
    throw new Error("Missing KML blob URL.");
  }

  await ensureKmlBridge(tabId);

  const result = await chrome.tabs.sendMessage(tabId, {
    type: "phase2:resolve-blob-kml",
    blobUrl,
    fileName,
  });

  if (!result?.ok || !result?.kmlText) {
    throw new Error(result?.error || "Land Insights tab could not read the KML blob URL.");
  }

  return {
    kmlText: String(result.kmlText || ""),
    fileName: String(result.fileName || fileName || ""),
  };
}

async function extractCurrentPage(tabId) {
  await ensureKmlBridge(tabId);

  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: "phase2:extract-current-page",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");

    if (!message.includes("Receiving end does not exist")) {
      throw error;
    }

    await ensureContentScript(tabId);
    await ensureKmlBridge(tabId);

    return await chrome.tabs.sendMessage(tabId, {
      type: "phase2:extract-current-page",
    });
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) {
    return;
  }

  let kmlDownloadWatcher = null;

  try {
    if (!LAND_INSIGHTS_HOST_PATTERN.test(tab.url)) {
      throw new Error("Open a Land Insights parcel page first, then click the extension.");
    }

    kmlDownloadWatcher = createKmlDownloadWatcher(Date.now());
    const browserPage = await extractCurrentPage(tab.id);

    if (!browserPage?.sourceUrl) {
      throw new Error("The page extractor did not return a source URL.");
    }

    const externalSearchLaunch = await openExternalListingSearchTabs(browserPage, tab);
    browserPage.externalSearchOpenedByExtension = externalSearchLaunch.opened.length > 0;
    browserPage.externalSearchLaunchStatus = externalSearchLaunch.status;
    browserPage.externalSearchTargets = externalSearchLaunch.opened;

    await chrome.tabs.create({
      url: buildGuidedClaudeCaptureUrl(browserPage, externalSearchLaunch),
      active: true,
      windowId: tab.windowId,
      openerTabId: tab.id,
    });
  } catch (error) {
    console.error("[Phase2 Extractor] Failed to send parcel to lab.", error);
    const message = error instanceof Error ? error.message : "Unknown extension error.";

    await chrome.tabs.create({
      url: `${APP_BASE_URL}/mcp-test?error=${encodeURIComponent(message)}`,
      active: true,
    });
  } finally {
    kmlDownloadWatcher?.stop();
  }
});
