const APP_BASE_URL = "https://comptoolv2.onrender.com";
const EXTENSION_INTAKE_TOKEN = "ce8f050fdb583135eac2c16a889bd0146a09f783958f49cde341903706c5f79f";
const LAND_INSIGHTS_HOST_PATTERN = /^https:\/\/app\.landinsights\.(com|co)\//i;

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

  let progressTabId = null;
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

    const progressTab = await openProgressTab(browserPage.sourceUrl || tab.url);
    progressTabId = progressTab.id || null;

    let kmlText = browserPage.kmlText || "";

    if (!kmlText && browserPage.kmlUrl) {
      try {
        kmlText = (await fetchKmlText(browserPage.kmlUrl)) || "";
        browserPage.kmlCaptureStatus = "KML URL fetched by extension";
      } catch (kmlError) {
        const message = kmlError instanceof Error ? kmlError.message : "KML fetch failed.";
        browserPage.kmlCaptureStatus = `${browserPage.kmlCaptureStatus || "KML URL detected"}; ${message}`;
      }
    }

    if (!kmlText && kmlDownloadWatcher) {
      const downloadCapture = await kmlDownloadWatcher.promise;
      const kmlDownload = downloadCapture?.match || null;

      if (kmlDownload) {
        const downloadUrl = kmlDownload.finalUrl || kmlDownload.url || "";
        const downloadFileName = getDownloadDisplayName(kmlDownload) || browserPage.kmlFileName || "";

        try {
          if (isBlobUrl(downloadUrl)) {
            const resolvedBlob = await resolveBlobKmlFromPage(tab.id, downloadUrl, downloadFileName);
            kmlText = resolvedBlob.kmlText || "";
            browserPage.kmlFileName = resolvedBlob.fileName || downloadFileName || browserPage.kmlFileName;
            browserPage.kmlCaptureStatus = "KML blob download read from Land Insights tab";
          } else {
            kmlText = (await fetchKmlText(downloadUrl, downloadFileName)) || "";
            browserPage.kmlFileName = downloadFileName || browserPage.kmlFileName;
            browserPage.kmlCaptureStatus = "KML download detected and fetched by extension";
          }
        } catch (downloadError) {
          const message = downloadError instanceof Error ? downloadError.message : "KML download fetch failed.";
          browserPage.kmlFileName = downloadFileName || browserPage.kmlFileName;
          browserPage.kmlCaptureStatus = `KML downloaded by Chrome, but could not be attached automatically; ${message}`;
        }
      } else {
        const downloadSummary = summarizeDownloads(downloadCapture?.recentDownloads || []);
        const watcherStatus = downloadCapture?.status || "download watcher returned no match";
        browserPage.kmlCaptureStatus = `${browserPage.kmlCaptureStatus || "KML capture not attached"}; ${watcherStatus}; ${downloadSummary}`;
      }
    }

    const parcelLink = browserPage.compReportUrl || browserPage.sourceUrl;

    const result = await postBrowserCapture({
      parcelLink,
      browserPage,
      listingLinks: browserPage.listingLinks || [],
      kmlText,
      kmlFileName: browserPage.kmlFileName || "",
    });

    if (!result?.artifactId) {
      throw new Error("The Phase 2 lab did not return an artifact ID.");
    }

    await navigateResultTab(
      progressTabId,
      `${APP_BASE_URL}/phase2/loading?artifact=${encodeURIComponent(result.artifactId)}`,
    );
  } catch (error) {
    console.error("[Phase2 Extractor] Failed to send parcel to lab.", error);
    const message = error instanceof Error ? error.message : "Unknown extension error.";

    await navigateResultTab(
      progressTabId,
      `${APP_BASE_URL}/phase2?error=${encodeURIComponent(message)}`,
    );
  } finally {
    kmlDownloadWatcher?.stop();
  }
});
