(() => {
  const BRIDGE_VERSION = "0.1.11";

  if (window.__dewclawKmlCaptureBridgeVersion === BRIDGE_VERSION) {
    return;
  }

  window.__dewclawKmlCaptureBridgeVersion = BRIDGE_VERSION;
  window.__dewclawKmlCaptureBridgeInstalled = true;

  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  const originalAnchorDispatchEvent = HTMLAnchorElement.prototype.dispatchEvent;
  const originalFetch = window.fetch.bind(window);
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;
  const blobsByUrl = new Map();
  let activeCapture = null;

  function looksLikeKmlText(text) {
    return /<kml[\s>]/i.test(text || "") || /Exported from LandInsights/i.test(text || "");
  }

  function looksLikeKmlFileName(value) {
    return /\.kml(?:$|[?#])/i.test(value || "") || /kml/i.test(value || "");
  }

  function publishTextForCapture(capture, text, fileName, source) {
    if (!capture || !looksLikeKmlText(text)) {
      return;
    }

    window.postMessage(
      {
        source: "dewclaw-comp-tool",
        type: "kml-captured",
        captureId: capture.id,
        fileName: fileName || "",
        kmlText: text,
        captureSource: source,
      },
      "*",
    );
  }

  function publishText(text, fileName, source) {
    publishTextForCapture(activeCapture, text, fileName, source);
  }

  function publishBlob(blob, fileName, source) {
    const capture = activeCapture;

    if (!capture || !(blob instanceof Blob)) {
      return;
    }

    blob
      .text()
      .then((text) => {
        publishTextForCapture(capture, text, fileName, source);
      })
      .catch(() => {});
  }

  async function readBlobText(blob) {
    if (!(blob instanceof Blob)) {
      return "";
    }

    return blob.text();
  }

  function publishBlobUrlFetchResult(requestId, payload) {
    window.postMessage(
      {
        source: "dewclaw-comp-tool",
        type: "kml-blob-url-fetched",
        requestId,
        ...payload,
      },
      "*",
    );
  }

  async function fetchBlobUrlForExtension(blobUrl, fileName, requestId) {
    try {
      const cachedBlob = blobsByUrl.get(blobUrl);
      const text = cachedBlob
        ? await readBlobText(cachedBlob)
        : await fetch(blobUrl).then((response) => response.text());

      if (!looksLikeKmlText(text)) {
        publishBlobUrlFetchResult(requestId, {
          ok: false,
          error: cachedBlob
            ? "Cached blob did not contain KML text."
            : "Blob URL did not contain KML text.",
        });
        return;
      }

      publishBlobUrlFetchResult(requestId, {
        ok: true,
        fileName: fileName || "",
        kmlText: text,
        source: cachedBlob ? "cached-blob" : "blob-url-fetch",
      });
    } catch (error) {
      publishBlobUrlFetchResult(requestId, {
        ok: false,
        error: error instanceof Error ? error.message : "Blob URL fetch failed.",
      });
    }
  }

  function publishDataUrl(href, fileName, source) {
    const capture = activeCapture;

    if (!capture || !String(href || "").startsWith("data:")) {
      return false;
    }

    try {
      const [metadata, encodedPayload = ""] = String(href).split(",", 2);
      const isBase64 = /;base64/i.test(metadata || "");
      const text = isBase64
        ? atob(encodedPayload)
        : decodeURIComponent(encodedPayload);

      publishText(text, fileName, source);
      return looksLikeKmlText(text);
    } catch {
      return false;
    }
  }

  function captureAnchorDownload(anchor, source) {
    try {
      const href = String(anchor?.href || "");
      const download = String(anchor?.download || "");
      const blob = blobsByUrl.get(href);

      if (!activeCapture || !looksLikeKmlFileName(download || href)) {
        return false;
      }

      if (blob) {
        publishBlob(blob, download, source);
        return true;
      }

      return publishDataUrl(href, download, source);
    } catch {
      return false;
    }
  }

  URL.createObjectURL = function createObjectURLWithKmlCapture(blob) {
    const url = originalCreateObjectURL(blob);

    try {
      if (blob instanceof Blob) {
        blobsByUrl.set(url, blob);

        if (activeCapture) {
          publishBlob(blob, "", "createObjectURL");
        }
      }
    } catch {}

    return url;
  };

  HTMLAnchorElement.prototype.click = function clickWithKmlCapture(...args) {
    captureAnchorDownload(this, "anchor-click");

    return originalAnchorClick.apply(this, args);
  };

  HTMLAnchorElement.prototype.dispatchEvent = function dispatchEventWithKmlCapture(event) {
    if (event?.type === "click") {
      captureAnchorDownload(this, "anchor-dispatch-click");
    }

    return originalAnchorDispatchEvent.call(this, event);
  };

  document.addEventListener(
    "click",
    (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (anchor) {
        captureAnchorDownload(anchor, "document-click");
      }
    },
    true,
  );

  window.fetch = async function fetchWithKmlCapture(...args) {
    const response = await originalFetch(...args);

    try {
      if (activeCapture) {
        const requestUrl =
          typeof args[0] === "string"
            ? args[0]
            : args[0]?.url || "";
        const contentType = response.headers?.get?.("content-type") || "";

        response
          .clone()
          .text()
          .then((text) => {
            if (looksLikeKmlText(text)) {
              publishText(text, requestUrl.split("/").pop() || "", `fetch:${contentType || "unknown"}`);
            }
          })
          .catch(() => {});
      }
    } catch {}

    return response;
  };

  XMLHttpRequest.prototype.open = function openWithKmlCapture(method, url, ...args) {
    this.__dewclawKmlRequestUrl = String(url || "");
    return originalXhrOpen.call(this, method, url, ...args);
  };

  XMLHttpRequest.prototype.send = function sendWithKmlCapture(...args) {
    try {
      if (activeCapture) {
        this.addEventListener("loadend", () => {
          try {
            const text = typeof this.responseText === "string" ? this.responseText : "";

            if (looksLikeKmlText(text)) {
              publishText(
                text,
                String(this.__dewclawKmlRequestUrl || "").split("/").pop() || "",
                "xhr",
              );
            }
          } catch {}
        });
      }
    } catch {}

    return originalXhrSend.apply(this, args);
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "dewclaw-comp-tool") {
      return;
    }

    if (event.data?.type === "arm-kml-capture") {
      activeCapture = {
        id: event.data.captureId,
      };

      window.setTimeout(() => {
        if (activeCapture?.id === event.data.captureId) {
          activeCapture = null;
        }
      }, Number(event.data.timeoutMs || 3500));
    }

    if (event.data?.type === "fetch-kml-blob-url") {
      fetchBlobUrlForExtension(
        String(event.data.blobUrl || ""),
        String(event.data.fileName || ""),
        String(event.data.requestId || ""),
      );
    }
  });
})();
