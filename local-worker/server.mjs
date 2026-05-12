import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

await loadDotEnv();

const PORT = Number(process.env.COMPTOOL_WORKER_PORT || 4777);
const COMPTOOL_BASE_URL = trimTrailingSlash(
  process.env.COMPTOOL_BASE_URL || "https://comptool-mcp-lab.onrender.com",
);
const EXTENSION_INTAKE_TOKEN = process.env.EXTENSION_INTAKE_TOKEN || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const WORKER_HEADLESS = /^true$/i.test(process.env.WORKER_HEADLESS || "");
const WORKER_LOGIN_WAIT_MS = Number(process.env.WORKER_LOGIN_WAIT_MS || 5 * 60 * 1000);
const WORKER_CAPTCHA_WAIT_MS = Number(process.env.WORKER_CAPTCHA_WAIT_MS || 10 * 60 * 1000);
const WORKER_CAPTCHA_SETTLE_MS = Number(process.env.WORKER_CAPTCHA_SETTLE_MS || 6000);
const WORKER_CAPTCHA_INTERIM_POST = !/^false$/i.test(
  process.env.WORKER_CAPTCHA_INTERIM_POST || "true",
);
const WORKER_KEEP_BROWSER_OPEN_ON_BLOCK = !/^false$/i.test(
  process.env.WORKER_KEEP_BROWSER_OPEN_ON_BLOCK || "true",
);
const WORKER_KEEP_OPEN_ON_DETECT = !/^false$/i.test(
  process.env.WORKER_KEEP_OPEN_ON_DETECT || "true",
);
const WORKER_MLS_AUTOMATION_ENABLED = !/^false$/i.test(process.env.WORKER_MLS_AUTOMATION_ENABLED || "true");
const WORKER_MLS_MAX_COMP_CLICKS = Number(process.env.WORKER_MLS_MAX_COMP_CLICKS || 3);
const WORKER_MLS_COMP_CLICKS_ENABLED = !/^false$/i.test(
  process.env.WORKER_MLS_COMP_CLICKS_ENABLED || "true",
);
const WORKER_EXTERNAL_LISTING_MAX_PAGES = Number(process.env.WORKER_EXTERNAL_LISTING_MAX_PAGES || 4);
const WORKER_BROWSER_PROFILE =
  process.env.WORKER_BROWSER_PROFILE ||
  path.join(os.homedir(), "AppData", "Local", "DewClawCompTool", "browser-profile");

const jobs = new Map();
let activeJob = Promise.resolve();
let retainedBrowserContext = null;

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

async function loadDotEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const content = await readFile(envPath, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...rest] = trimmed.split("=");

      if (!process.env[key]) {
        process.env[key] = rest.join("=").trim();
      }
    }
  } catch {
    // .env is optional.
  }
}

function jsonResponse(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Comp-Tool-Extension-Token, Authorization",
  });
  response.end(body);
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  return raw ? JSON.parse(raw) : {};
}

function createJob(payload) {
  const job = {
    id: randomUUID(),
    status: "queued",
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    error: "",
    payload,
    result: null,
    currentStep: null,
    captchaState: null, // "detected" | "resolved" | "timeout" | null
    captchaSteps: [],
    keepBrowserOpen: false,
  };

  jobs.set(job.id, job);
  activeJob = activeJob.then(() => processJob(job)).catch(() => processJob(job));

  return job;
}

async function processJob(job) {
  job.status = "running";
  job.startedAt = new Date().toISOString();
  console.log(`[job] ${job.id} started for ${job.payload?.parcelLink || "unknown parcel"}`);

  try {
    const result = await runVisualEnrichment(job.payload, job);
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.result = result;
    console.log(`[job] ${job.id} completed (captchaState=${job.captchaState || "none"}).`);
  } catch (error) {
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.error = error instanceof Error ? error.message : String(error || "Unknown worker error.");
    console.error(`[job] ${job.id} failed: ${job.error}`);
  }
}

async function fetchArtifact(artifactId, baseUrl = COMPTOOL_BASE_URL, intakeToken = EXTENSION_INTAKE_TOKEN) {
  const response = await fetch(`${baseUrl}/api/phase2/browser-intake/${artifactId}`, {
    method: "GET",
    headers: buildCompToolHeaders(intakeToken),
  });

  if (!response.ok) {
    throw new Error(`Could not load CompTool artifact ${artifactId}: HTTP ${response.status}`);
  }

  return response.json();
}

function buildCompToolHeaders(intakeToken = EXTENSION_INTAKE_TOKEN) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (intakeToken) {
    headers["X-Comp-Tool-Extension-Token"] = intakeToken;
  }

  return headers;
}

async function postMcpCapture(
  artifactId,
  capture,
  baseUrl = COMPTOOL_BASE_URL,
  intakeToken = EXTENSION_INTAKE_TOKEN,
) {
  const response = await fetch(
    `${baseUrl}/api/phase2/browser-intake/${artifactId}/mcp`,
    {
      method: "POST",
      headers: buildCompToolHeaders(intakeToken),
      body: JSON.stringify(capture),
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `CompTool MCP attach failed: HTTP ${response.status}`);
  }

  return payload;
}

function createWorkerJobContext(job) {
  if (!job) {
    return null;
  }

  return {
    markStep(step) {
      job.currentStep = step;
    },
    markCaptcha(state, label, waitedMs = 0) {
      job.captchaState = state;
      job.currentStep = `human-check:${label}`;
      job.keepBrowserOpen = state !== "resolved" || WORKER_KEEP_OPEN_ON_DETECT;
      job.captchaSteps.push({
        state,
        label,
        waitedMs,
        at: new Date().toISOString(),
      });
    },
  };
}

async function runVisualEnrichment(payload, job = null) {
  const artifactId = String(payload.artifactId || "").trim();
  const parcelLink = String(payload.parcelLink || "").trim();
  const baseUrl = trimTrailingSlash(payload.baseUrl || COMPTOOL_BASE_URL);
  const intakeToken = String(
    payload.workerAttachToken || payload.extensionToken || EXTENSION_INTAKE_TOKEN || "",
  ).trim();

  if (!artifactId) {
    throw new Error("artifactId is required.");
  }

  if (!parcelLink) {
    throw new Error("parcelLink is required.");
  }

  const artifact = await fetchArtifact(artifactId, baseUrl, intakeToken);
  const workerCtx = createWorkerJobContext(job);
  const inspection = await inspectParcelInBrowser(parcelLink, workerCtx, artifact);
  const fallbackCapture = buildFallbackCapture({ artifact, parcelLink, inspection });
  const capture = ANTHROPIC_API_KEY
    ? await buildVisionCapture({ artifact, parcelLink, inspection, fallbackCapture })
    : fallbackCapture;
  const attachResult = await postMcpCapture(artifactId, capture, baseUrl, intakeToken);

  return {
    artifactId,
    baseUrl,
    dashboardUrl: attachResult.dashboardUrl,
    captureSource: ANTHROPIC_API_KEY ? "anthropic_vision" : "fallback_dom_capture",
    diagnostics: capture.diagnostics,
  };
}

async function getWorkerBrowserContext() {
  if (retainedBrowserContext) {
    try {
      retainedBrowserContext.pages();
      return retainedBrowserContext;
    } catch {
      retainedBrowserContext = null;
    }
  }

  await mkdir(WORKER_BROWSER_PROFILE, { recursive: true });
  const context = await chromium.launchPersistentContext(WORKER_BROWSER_PROFILE, {
    headless: WORKER_HEADLESS,
    viewport: { width: 1440, height: 1000 },
  });

  retainedBrowserContext = context;
  context.on("close", () => {
    if (retainedBrowserContext === context) {
      retainedBrowserContext = null;
    }
  });

  return context;
}

async function inspectParcelInBrowser(parcelLink, ctx = null, artifact = null) {
  const context = await getWorkerBrowserContext();
  const page = context.pages()[0] || (await context.newPage());
  let keepBrowserOpen = false;

  try {
    ctx?.markStep?.("open parcel");
    await page.goto(parcelLink, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);

    const diagnostics = [];
    const navigationLog = [];
    let finalUrl = page.url();
    let pageText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
    let loginRequired = isLoginRequired(finalUrl, pageText);
    let mlsWorkflow = {
      diagnostics: [],
      navigationLog: [],
      pageText: "",
      screenshots: [],
      compEvidence: [],
      keepBrowserOpen: false,
    };
    let externalListingWorkflow = {
      diagnostics: [],
      navigationLog: [],
      pageText: "",
      screenshots: [],
      evidence: [],
      keepBrowserOpen: false,
    };

    if (loginRequired && !WORKER_HEADLESS && WORKER_LOGIN_WAIT_MS > 0) {
      console.log("Worker reached Land Insights login. Waiting for user login...");
      diagnostics.push(
        `Worker detected a login screen and waited up to ${Math.round(WORKER_LOGIN_WAIT_MS / 1000)} seconds for manual login.`,
      );

      const loginResult = await waitForManualLogin(page, parcelLink);
      diagnostics.push(...loginResult.diagnostics);

      finalUrl = page.url();
      pageText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
      loginRequired = isLoginRequired(finalUrl, pageText);
    }

    const initialHumanCheck = await waitForHumanCheck(page, diagnostics, navigationLog, "parcel load", ctx);
    if (initialHumanCheck.detected && WORKER_KEEP_OPEN_ON_DETECT) {
      keepBrowserOpen = true;
    }

    if (!loginRequired && !initialHumanCheck.blocked && WORKER_MLS_AUTOMATION_ENABLED) {
      mlsWorkflow = await runLandInsightsMlsWorkflow(page, ctx);
      keepBrowserOpen = keepBrowserOpen || Boolean(mlsWorkflow.keepBrowserOpen);
      finalUrl = page.url();
      pageText = [
        pageText,
        mlsWorkflow.pageText ? `MLS workflow visible text:\n${mlsWorkflow.pageText}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }

    if (!initialHumanCheck.blocked) {
      const fieldsForListingSearch = {
        ...(artifact?.request?.browserPage?.extractedFields || {}),
        ...extractFieldsFromText(pageText),
      };
      const listingTargets = collectExternalListingTargets(artifact, fieldsForListingSearch);
      externalListingWorkflow = await runExternalListingWorkflow(context, listingTargets, ctx);
      keepBrowserOpen = keepBrowserOpen || Boolean(externalListingWorkflow.keepBrowserOpen);
      pageText = [
        pageText,
        externalListingWorkflow.pageText
          ? `External Redfin/Zillow listing evidence:\n${externalListingWorkflow.pageText}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    } else {
      externalListingWorkflow.diagnostics.push(
        "External listing workflow: skipped because initial Land Insights human check did not clear.",
      );
      externalListingWorkflow.navigationLog.push("External listing pass skipped until Land Insights human check clears.");
    }

    const title = await page.title().catch(() => "Land Insights");
    const screenshotBase64 = await page.screenshot({ type: "png", fullPage: false }).then((buffer) =>
      buffer.toString("base64"),
    );

    return {
      title,
      finalUrl,
      pageText,
      screenshotBase64,
      screenshots: [
        { label: "final_worker_view", data: screenshotBase64 },
        ...externalListingWorkflow.screenshots,
        ...mlsWorkflow.screenshots,
      ].filter((item) => item.data),
      mlsCompEvidence: mlsWorkflow.compEvidence,
      externalListingEvidence: externalListingWorkflow.evidence,
      loginRequired,
      diagnostics: [
        ...diagnostics,
        ...mlsWorkflow.diagnostics,
        ...externalListingWorkflow.diagnostics,
        `Worker opened parcel: ${finalUrl}`,
        `Worker captured visible text length: ${pageText.length}`,
        `Worker screenshot captured: ${screenshotBase64 ? "yes" : "no"}`,
      ],
      navigationLog: [...navigationLog, ...mlsWorkflow.navigationLog, ...externalListingWorkflow.navigationLog],
    };
  } finally {
    if (keepBrowserOpen && WORKER_KEEP_BROWSER_OPEN_ON_BLOCK) {
      console.log("Worker browser left open for manual Land Insights verification.");
    } else {
      await context.close();
    }
  }
}

function isLoginRequired(finalUrl, pageText) {
  return /\/login/i.test(finalUrl || "") || /\b(sign in|log in|login)\b/i.test(pageText || "");
}

async function isHumanCheckRequired(page) {
  const finalUrl = page.url();
  const pageText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  const frameUrls = page.frames().map((frame) => frame.url()).join(" ");
  const combined = `${finalUrl}\n${pageText}\n${frameUrls}`.toLowerCase();

  const textHit = /\b(i am not a robot|captcha|recaptcha|hcaptcha|turnstile|verify you are human|human verification|checking if the site connection is secure|press & hold|complete the security check)\b/i.test(
    combined,
  );

  if (textHit) {
    return true;
  }

  // Selector-based detection (cheap; short timeouts so we don't stall).
  const selectorHits = await Promise.all([
    page.locator('iframe[src*="recaptcha"]').first().isVisible({ timeout: 400 }).catch(() => false),
    page.locator('iframe[src*="hcaptcha"]').first().isVisible({ timeout: 400 }).catch(() => false),
    page.locator('iframe[src*="challenges.cloudflare.com"]').first().isVisible({ timeout: 400 }).catch(() => false),
    page.locator('iframe[title*="captcha" i]').first().isVisible({ timeout: 400 }).catch(() => false),
    page.locator('[data-sitekey]').first().isVisible({ timeout: 400 }).catch(() => false),
    page.locator('#challenge-form, #cf-challenge-running').first().isVisible({ timeout: 400 }).catch(() => false),
  ]);

  return selectorHits.some(Boolean);
}

async function waitForHumanCheck(page, diagnostics, navigationLog, label, ctx = null) {
  if (!(await isHumanCheckRequired(page))) {
    return { blocked: false, resolved: false, detected: false, waitedMs: 0 };
  }

  const waitSeconds = Math.round(WORKER_CAPTCHA_WAIT_MS / 1000);
  const startedAt = Date.now();
  console.log(`[captcha] detected at step="${label}" - pausing up to ${waitSeconds}s for manual solve`);
  diagnostics.push(`[captcha] detected during ${label}; waiting up to ${waitSeconds} seconds for manual solve.`);
  navigationLog.push(`Pause for manual human check during ${label}.`);

  if (ctx?.markCaptcha) {
    try {
      ctx.markCaptcha("detected", label);
    } catch {
      // Never let job-state callbacks break captcha flow.
    }
  }

  if (ctx?.postInterim) {
    try {
      await ctx.postInterim(label);
    } catch (error) {
      console.log(`[post] interim captcha-pending failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  const deadline = startedAt + WORKER_CAPTCHA_WAIT_MS;
  let lastTickLogged = 0;

  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);

    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    if (elapsedSec - lastTickLogged >= 15) {
      console.log(`[captcha] waiting (${elapsedSec}s / ${waitSeconds}s) at step="${label}"`);
      lastTickLogged = elapsedSec;
    }

    if (!(await isHumanCheckRequired(page))) {
      // Settle: wait for any redirect/load to complete, then re-check.
      await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(WORKER_CAPTCHA_SETTLE_MS);

      if (await isHumanCheckRequired(page)) {
        // False clearance: challenge reappeared, so keep waiting.
        continue;
      }

      const waitedMs = Date.now() - startedAt;
      console.log(`[captcha] resolved after ${waitedMs}ms at step="${label}"`);
      diagnostics.push(`[captcha] resolved during ${label} after ${waitedMs}ms; continuing worker flow.`);
      navigationLog.push(`Human check resolved during ${label}.`);

      if (ctx?.markCaptcha) {
        try {
          ctx.markCaptcha("resolved", label, waitedMs);
        } catch {
          // ignore
        }
      }

      return { blocked: false, resolved: true, detected: true, waitedMs };
    }
  }

  const waitedMs = Date.now() - startedAt;
  console.log(`[captcha] timeout at step="${label}" after ${waitedMs}ms - browser left open for manual recovery`);
  diagnostics.push(`[captcha] timeout during ${label} after ${waitedMs}ms. Browser left open for manual recovery.`);
  navigationLog.push(`Human check timeout during ${label}.`);

  if (ctx?.markCaptcha) {
    try {
      ctx.markCaptcha("timeout", label, waitedMs);
    } catch {
      // ignore
    }
  }

  return { blocked: true, resolved: false, detected: true, waitedMs };
}

async function waitForManualLogin(page, parcelLink) {
  const diagnostics = [];
  const deadline = Date.now() + WORKER_LOGIN_WAIT_MS;

  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    const currentText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");

    if (!isLoginRequired(currentUrl, currentText)) {
      diagnostics.push("Worker login resolved; reloading the parcel link.");

      if (currentUrl !== parcelLink) {
        await page.goto(parcelLink, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(3000);
      }

      return { loggedIn: true, diagnostics };
    }
  }

  diagnostics.push("Worker login wait timed out. Log into the worker browser, then rerun the comp.");

  return { loggedIn: false, diagnostics };
}

async function runLandInsightsMlsWorkflow(page, ctx = null) {
  const diagnostics = [];
  const navigationLog = [];
  const screenshots = [];
  const compEvidence = [];
  let keepBrowserOpen = false;

  function noteHumanCheck(result) {
    if (result.detected && WORKER_KEEP_OPEN_ON_DETECT) {
      keepBrowserOpen = true;
    }
  }

  async function capture(label) {
    const data = await page.screenshot({ type: "png", fullPage: false }).then((buffer) =>
      buffer.toString("base64"),
    ).catch(() => "");

    if (data) {
      screenshots.push({ label, data });
      diagnostics.push(`MLS workflow screenshot captured: ${label}`);
    }
  }

  try {
    navigationLog.push("MLS workflow: start Land Insights visual comp setup.");
    await openDataPlatformIfAvailable(page, diagnostics, navigationLog);
    const platformHumanCheck = await waitForHumanCheck(page, diagnostics, navigationLog, "Data Platform load", ctx);
    noteHumanCheck(platformHumanCheck);
    if (platformHumanCheck.blocked) {
      keepBrowserOpen = true;
      return {
        diagnostics,
        navigationLog,
        pageText: await page.locator("body").innerText({ timeout: 5000 }).catch(() => ""),
        screenshots,
        compEvidence,
        keepBrowserOpen,
      };
    }

    await capture("before_mls_layer_setup");

    const dataLayersOpened = await clickFirstVisibleText(page, [
      "Data Layers",
      "Layers",
      "Map Layers",
    ]);

    diagnostics.push(
      dataLayersOpened
        ? "MLS workflow: Data Layers panel opened or clicked."
        : "MLS workflow: Data Layers control was not found.",
    );
    navigationLog.push(
      dataLayersOpened
        ? "Click Data Layers."
        : "Data Layers click skipped because no matching control was visible.",
    );

    await page.waitForTimeout(1200);
    const dataLayerHumanCheck = await waitForHumanCheck(page, diagnostics, navigationLog, "Data Layers", ctx);
    noteHumanCheck(dataLayerHumanCheck);
    if (dataLayerHumanCheck.blocked) {
      keepBrowserOpen = true;
      return {
        diagnostics,
        navigationLog,
        pageText: await page.locator("body").innerText({ timeout: 5000 }).catch(() => ""),
        screenshots,
        compEvidence,
        keepBrowserOpen,
      };
    }
    if (dataLayerHumanCheck.resolved) {
      const reopened = await clickFirstVisibleText(page, [
        "Data Layers",
        "Layers",
        "Map Layers",
      ]);
      diagnostics.push(
        reopened
          ? "MLS workflow: reopened Data Layers after human check."
          : "MLS workflow: could not reopen Data Layers after human check.",
      );
      navigationLog.push(
        reopened
          ? "Reopen Data Layers after human check."
          : "Data Layers reopen after human check was not visible.",
      );
      await page.waitForTimeout(1200);
    }

    for (const layer of [
      "All Hazards",
      "Standard Due Diligence",
      "MLS Data",
      "MLS Comps",
    ]) {
      const clicked = await clickFirstVisibleText(page, [layer]);
      diagnostics.push(
        clicked
          ? `MLS workflow: layer/control clicked: ${layer}`
          : `MLS workflow: layer/control not found: ${layer}`,
      );
      navigationLog.push(
        clicked
          ? `Click layer/control: ${layer}.`
          : `Could not find layer/control: ${layer}.`,
      );
      await page.waitForTimeout(700);
      const layerHumanCheck = await waitForHumanCheck(page, diagnostics, navigationLog, layer, ctx);
      noteHumanCheck(layerHumanCheck);
      if (layerHumanCheck.blocked) {
        keepBrowserOpen = true;
        return {
          diagnostics,
          navigationLog,
          pageText: await page.locator("body").innerText({ timeout: 5000 }).catch(() => ""),
          screenshots,
          compEvidence,
          keepBrowserOpen,
        };
      }
    }

    const acreageClicked = await clickFirstVisibleText(page, [
      "Acreage Range Mode",
      "Auto",
      "Acreage Range",
    ]);
    diagnostics.push(
      acreageClicked
        ? "MLS workflow: acreage range control clicked."
        : "MLS workflow: acreage range control not found; kept current setting.",
    );
    navigationLog.push(
      acreageClicked
        ? "Click acreage range control / Auto if visible."
        : "Acreage range control unavailable.",
    );

    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(1500);
    const finalHumanCheck = await waitForHumanCheck(page, diagnostics, navigationLog, "MLS layer setup", ctx);
    noteHumanCheck(finalHumanCheck);
    if (finalHumanCheck.blocked) {
      keepBrowserOpen = true;
      return {
        diagnostics,
        navigationLog,
        pageText: await page.locator("body").innerText({ timeout: 5000 }).catch(() => ""),
        screenshots,
        compEvidence,
        keepBrowserOpen,
      };
    }

    await capture("after_mls_layer_setup");

    const mlsText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
    compEvidence.push(...buildHeuristicCompEvidenceFromText(mlsText));
    diagnostics.push(`MLS workflow: heuristic comp evidence count=${compEvidence.length}`);
    navigationLog.push("Capture visible map/MLS text after layer setup.");

    return {
      diagnostics,
      navigationLog,
      pageText: mlsText,
      screenshots,
      compEvidence,
      keepBrowserOpen,
    };
  } catch (error) {
    diagnostics.push(
      `MLS workflow failed safely: ${error instanceof Error ? error.message : "unknown error"}`,
    );

    return {
      diagnostics,
      navigationLog,
      pageText: await page.locator("body").innerText({ timeout: 5000 }).catch(() => ""),
      screenshots,
      compEvidence,
      keepBrowserOpen,
    };
  }
}

async function openDataPlatformIfAvailable(page, diagnostics, navigationLog) {
  const currentUrl = page.url();

  if (/\/data(?:\?|#|$)/i.test(currentUrl)) {
    diagnostics.push("MLS workflow: already on Data Platform page.");
    navigationLog.push("Already on Data Platform map page.");
    return;
  }

  const clicked = await clickFirstVisibleText(page, [
    "View on Data Platform",
    "Data Platform",
    "View Data Platform",
  ]);

  if (!clicked) {
    diagnostics.push("MLS workflow: no Data Platform button found; staying on current page.");
    navigationLog.push("Data Platform button not found.");
    return;
  }

  diagnostics.push("MLS workflow: clicked Data Platform button.");
  navigationLog.push("Click View on Data Platform.");
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function clickFirstVisibleText(page, labels) {
  for (const label of labels) {
    const locators = [
      page.getByRole("button", { name: new RegExp(escapeRegExp(label), "i") }).first(),
      page.getByText(new RegExp(escapeRegExp(label), "i")).first(),
      page.locator(`[aria-label*="${cssAttributeEscape(label)}" i]`).first(),
      page.locator(`[title*="${cssAttributeEscape(label)}" i]`).first(),
    ];

    for (const locator of locators) {
      try {
        if (await locator.isVisible({ timeout: 700 })) {
          await locator.click({ timeout: 2500 });
          return true;
        }
      } catch {
        // Try the next locator. Land Insights controls can be canvas-heavy.
      }
    }
  }

  return false;
}

function collectExternalListingTargets(artifact, fields = {}) {
  const browserPage = artifact?.request?.browserPage || {};
  const comparableRows = browserPage.comparableRows || artifact?.result?.comparableRows || [];
  const rawListingLinks = [
    ...(browserPage.listingLinks || []),
    ...(artifact?.request?.listingLinks || []),
    ...comparableRows.map((row) => row?.listingUrl || ""),
  ];
  const targets = [];
  const seen = new Set();

  for (const link of rawListingLinks) {
    const url = normalizeExternalListingUrl(link);

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    targets.push({
      url,
      source: inferExternalListingSource(url),
      kind: "listing",
      searchQuery: "",
    });

    if (targets.length >= WORKER_EXTERNAL_LISTING_MAX_PAGES) {
      return targets;
    }
  }

  const searchQuery = buildExternalListingSearchQuery(fields);

  if (!searchQuery) {
    return targets;
  }

  for (const target of buildExternalListingSearchTargets(searchQuery)) {
    if (seen.has(target.url)) {
      continue;
    }

    seen.add(target.url);
    targets.push(target);

    if (targets.length >= WORKER_EXTERNAL_LISTING_MAX_PAGES) {
      break;
    }
  }

  return targets;
}

function normalizeExternalListingUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);

    if (!/(\.|^)(redfin|zillow|realtor)\.com$/i.test(url.hostname)) {
      return "";
    }

    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function inferExternalListingSource(url) {
  const value = String(url || "").toLowerCase();

  if (value.includes("redfin.com")) {
    return "redfin";
  }

  if (value.includes("zillow.com")) {
    return "zillow";
  }

  if (value.includes("realtor.com")) {
    return "realtor";
  }

  return "unknown";
}

function buildExternalListingSearchQuery(fields = {}) {
  const address = String(fields.address || fields.propertyAddress || "").trim();
  const apn = String(fields.apn || "").trim();
  const county = String(fields.county || "").trim();
  const state = String(fields.state || "").trim();

  if (apn) {
    return [apn, county, state].filter(Boolean).join(" ");
  }

  if (address) {
    return [address, county, state].filter(Boolean).join(" ");
  }

  return [county, state].filter(Boolean).join(" ");
}

function buildExternalListingSearchTargets(searchQuery) {
  const encoded = encodeURIComponent(searchQuery);
  const zillowPath = encodeURIComponent(searchQuery).replace(/%20/g, "-");

  return [
    {
      url: `https://www.zillow.com/homes/${zillowPath}_rb/`,
      source: "zillow",
      kind: "search",
      searchQuery,
    },
    {
      url: `https://www.redfin.com/?searchInputBox=${encoded}`,
      source: "redfin",
      kind: "search",
      searchQuery,
    },
  ];
}

async function runExternalListingWorkflow(context, targets, ctx = null) {
  const diagnostics = [];
  const navigationLog = [];
  const screenshots = [];
  const evidence = [];
  const pageTextParts = [];
  let keepBrowserOpen = false;

  if (!targets.length) {
    diagnostics.push("External listing workflow: required Redfin/Zillow pass had no listing URL, APN, or address target.");
    navigationLog.push("External listing pass skipped because no Redfin/Zillow search target was available.");
    return { diagnostics, navigationLog, screenshots, evidence, pageText: "", keepBrowserOpen };
  }

  diagnostics.push(`External listing workflow: inspecting ${targets.length} Redfin/Zillow/Realtor target(s).`);
  navigationLog.push("Start required external listing evidence pass.");

  for (const [index, target] of targets.entries()) {
    const page = await context.newPage();
    let pageKeptOpen = false;

    try {
      ctx?.markStep?.(`external-listing:${target.source}`);
      navigationLog.push(
        target.kind === "search"
          ? `Open ${target.source} search for ${target.searchQuery}.`
          : `Open ${target.source} listing: ${target.url}.`,
      );

      await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(3500);

      const humanCheck = await waitForHumanCheck(
        page,
        diagnostics,
        navigationLog,
        `${target.source} ${target.kind}`,
        ctx,
      );

      if (humanCheck.detected && WORKER_KEEP_OPEN_ON_DETECT) {
        keepBrowserOpen = true;
        pageKeptOpen = true;
      }

      if (humanCheck.blocked) {
        keepBrowserOpen = true;
        pageKeptOpen = true;
        evidence.push(buildBlockedExternalListingEvidence(target));
        continue;
      }

      const title = await page.title().catch(() => target.source);
      const finalUrl = page.url();
      const text = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
      const screenshotBase64 = await page.screenshot({ type: "png", fullPage: false }).then((buffer) =>
        buffer.toString("base64"),
      ).catch(() => "");
      const label = `external_listing_${index + 1}_${target.source}_${target.kind}`;

      if (screenshotBase64) {
        screenshots.push({ label, data: screenshotBase64 });
      }

      pageTextParts.push([
        `External target ${index + 1}: ${target.source} ${target.kind}`,
        `URL: ${finalUrl}`,
        `Title: ${title}`,
        String(text || "").slice(0, 3500),
      ].join("\n"));
      evidence.push(buildExternalListingEvidenceFromPage({ target, finalUrl, title, text }));
      diagnostics.push(
        `External listing workflow: captured ${target.source} ${target.kind} (${text.length} chars, screenshot=${screenshotBase64 ? "yes" : "no"}).`,
      );
    } catch (error) {
      diagnostics.push(
        `External listing workflow: ${target.source} ${target.kind} failed safely: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      evidence.push(buildFailedExternalListingEvidence(target, error));
    } finally {
      if (!pageKeptOpen) {
        await page.close().catch(() => {});
      }
    }
  }

  return {
    diagnostics,
    navigationLog,
    screenshots,
    evidence,
    pageText: pageTextParts.join("\n\n---\n\n"),
    keepBrowserOpen,
  };
}

function buildExternalListingEvidenceFromPage({ target, finalUrl, title, text }) {
  const value = String(text || "");
  const facts = extractListingFacts(value, title);
  const photoSignals = extractPhotoSignals(value);
  const isSearch = target.kind === "search";

  return {
    source: target.source,
    url: finalUrl || target.url,
    searchQuery: target.searchQuery || "",
    matchQuality: isSearch ? "possible_match" : "confirmed_match",
    compRole: "weak_context",
    matchedSignals: [
      isSearch ? "Opened required APN/address search page." : "Opened listing URL captured from Land Insights.",
      ...facts.slice(0, 4),
    ],
    photoObservations: photoSignals.length
      ? photoSignals
      : ["External page was opened and screenshotted for visual review; visible photo details may require model review."],
    listingFacts: facts,
    risks: [
      isSearch
        ? "Search result page may contain multiple properties; model should not treat it as a confirmed comp without visible match signals."
        : "Listing page capture still needs DewClaw comp-role classification.",
    ],
  };
}

function buildBlockedExternalListingEvidence(target) {
  return {
    source: target.source,
    url: target.url,
    searchQuery: target.searchQuery || "",
    matchQuality: "possible_match",
    compRole: "weak_context",
    matchedSignals: ["External listing page required manual human verification."],
    photoObservations: ["External photos could not be captured until the human check clears."],
    listingFacts: [],
    risks: ["Human check blocked full Redfin/Zillow evidence capture."],
  };
}

function buildFailedExternalListingEvidence(target, error) {
  return {
    source: target.source,
    url: target.url,
    searchQuery: target.searchQuery || "",
    matchQuality: "possible_match",
    compRole: "weak_context",
    matchedSignals: [],
    photoObservations: [],
    listingFacts: [],
    risks: [
      `External listing capture failed: ${error instanceof Error ? error.message : "unknown error"}`,
    ],
  };
}

function extractListingFacts(text, title = "") {
  const value = normalizeSpace(`${title || ""} ${text || ""}`);
  const facts = [];
  const patterns = [
    /\$[\d,]+(?:\.\d+)?/g,
    /\b\d+(?:\.\d+)?\s*ac(?:res?)?\b/gi,
    /\b(active|pending|sold|for sale|off market)\b/gi,
    /\b\d+\s*days?\s+on\s+(?:market|zillow|redfin)\b/gi,
    /\b(?:wooded|pasture|cleared|vacant land|mobile home|house|barn|shed|waterfront|road frontage)\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const fact = normalizeSpace(match[0]);

      if (fact && !facts.includes(fact)) {
        facts.push(fact);
      }

      if (facts.length >= 10) {
        return facts;
      }
    }
  }

  return facts;
}

function extractPhotoSignals(text) {
  const value = String(text || "").toLowerCase();
  const observations = [];

  if (/\bphotos?\b|\bimage\b|\bgallery\b/.test(value)) {
    observations.push("Listing page exposes a photo/gallery section in the captured view.");
  }

  if (/\bwooded|trees?|timber\b/.test(value)) {
    observations.push("Text suggests wooded/tree coverage.");
  }

  if (/\bpasture|cleared|field|open land\b/.test(value)) {
    observations.push("Text suggests cleared, pasture, field, or open land.");
  }

  if (/\bhouse|home|cabin|mobile home|barn|shed|structure\b/.test(value)) {
    observations.push("Text may indicate a structure signal; verify whether this contaminates vacant-land comping.");
  }

  return observations;
}

function buildHeuristicCompEvidenceFromText(text) {
  const value = String(text || "");
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const evidence = [];
  const seen = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const context = lines.slice(Math.max(0, index - 2), index + 4).join(" | ");
    const hasPrice = /\$[\d,]+/.test(context);
    const hasAcreage = /\b\d+(?:\.\d+)?\s*ac(?:res?)?\b/i.test(context);
    const hasMlsSignal = /\b(mls|sold|active|pending|acre|ppa|dom|comp)\b/i.test(context);

    if (!hasPrice || !hasAcreage || !hasMlsSignal) {
      continue;
    }

    const key = normalizeSpace(context).slice(0, 160);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    evidence.push({
      source: "landinsights_mls",
      url: "",
      searchQuery: "",
      matchQuality: "possible_match",
      compRole: evidence.length === 0 ? "anchor" : "weak_context",
      matchedSignals: ["Visible MLS comp text included price and acreage."],
      photoObservations: [
        "Photo/card details were not fully opened by the worker yet; use as preliminary visual evidence.",
      ],
      listingFacts: [key],
      risks: ["Needs Corbin review until MLS photo/detail clicking is fully calibrated."],
    });

    if (evidence.length >= WORKER_MLS_MAX_COMP_CLICKS) {
      break;
    }
  }

  return evidence;
}

function normalizeSpace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cssAttributeEscape(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildFallbackCapture({ artifact, parcelLink, inspection }) {
  const browserPage = artifact?.request?.browserPage || {};
  const fields = {
    ...(browserPage.extractedFields || {}),
    ...extractFieldsFromText(inspection.pageText),
  };
  const comparableRows = browserPage.comparableRows || artifact?.result?.comparableRows || [];
  const externalListingEvidence = [
    ...(inspection.externalListingEvidence || []),
    ...(inspection.mlsCompEvidence || []),
    ...buildFallbackExternalEvidenceFromRows(comparableRows),
  ].slice(0, Math.max(WORKER_MLS_MAX_COMP_CLICKS + WORKER_EXTERNAL_LISTING_MAX_PAGES, 6));

  return {
    schemaVersion: "claude-mcp-li-table-v1",
    source: "claude_mcp",
    capturedAt: new Date().toISOString(),
    parcelLink,
    compReportUrl: browserPage.compReportUrl || parcelLink,
    dataPlatformUrl: inspection.finalUrl || browserPage.finalUrl || parcelLink,
    pageTitle: inspection.title || browserPage.pageTitle || "Land Insights",
    fields,
    fieldCaptures: Object.entries(fields).map(([key, value]) => ({
      key,
      label: key,
      value: String(value || ""),
      status: value ? "captured" : "missing",
      sourceTab: "data_platform",
      confidence: value ? "medium" : "low",
      notes: "Captured by local worker fallback extraction.",
    })),
    comparableRows,
    listingLinks: collectExternalListingTargets(artifact, fields).map((target) => target.url),
    externalListingEvidence,
    visualClassification: {
      areaType: inferAreaType(inspection.pageText),
      terrainType: inferTerrainType(inspection.pageText),
      structureSignal: inferStructureSignal(fields, inspection.pageText),
      accessOrFrontageSignal: fields.roadFrontage ? "present" : "unclear",
      confidence: ANTHROPIC_API_KEY ? "medium" : "low",
      visualRisks: inspection.loginRequired
        ? ["Worker reached a login screen; log into Land Insights in the worker browser and retry."]
        : ["Fallback extraction used DOM text and one screenshot; visual photo inspection may be incomplete."],
      verifyNext: [
        "Confirm access/frontage and usable acreage.",
        "Inspect MLS comp photos if final pricing confidence is low.",
      ],
    },
    navigationLog: [
      "Local worker opened the Land Insights parcel link.",
      ...(inspection.navigationLog || []),
      "Local worker captured visible text and a screenshot.",
      ANTHROPIC_API_KEY
        ? "Anthropic vision refinement was enabled."
        : "Anthropic vision refinement was skipped because no API key was configured.",
    ],
    diagnostics: [
      ...inspection.diagnostics,
      inspection.loginRequired ? "Login screen detected by local worker." : "",
    ].filter(Boolean),
    rawObservationNotes:
      "Local worker generated this source packet automatically. Treat as MCP-style evidence, not final valuation.",
  };
}

function buildFallbackExternalEvidenceFromRows(rows) {
  return (rows || [])
    .filter((row) => row && (row.price || row.acreage || row.pricePerAcre || row.rawCells?.length))
    .slice(0, WORKER_MLS_MAX_COMP_CLICKS)
    .map((row, index) => ({
      source: row.source === "redfin" || row.source === "zillow" || row.source === "realtor"
        ? row.source
        : "landinsights_mls",
      url: row.listingUrl || "",
      searchQuery: row.rawCells?.join(" ") || "",
      matchQuality: "possible_match",
      compRole: index === 0 ? "anchor" : "weak_context",
      matchedSignals: [
        row.price ? `Price: ${row.price}` : "",
        row.acreage ? `Acreage: ${row.acreage}` : "",
        row.pricePerAcre ? `PPA: ${row.pricePerAcre}` : "",
        row.status ? `Status: ${row.status}` : "",
      ].filter(Boolean),
      photoObservations: [
        "Comp row captured, but worker did not fully verify photos yet.",
      ],
      listingFacts: [
        row.city ? `City: ${row.city}` : "",
        row.daysOnMarket ? `DOM: ${row.daysOnMarket}` : "",
        ...(row.rawCells || []).slice(0, 6),
      ].filter(Boolean),
      risks: ["Treat as preliminary until MLS/card photos are reviewed."],
    }));
}

function extractFieldsFromText(text) {
  const fields = {};
  const normalized = String(text || "").replace(/\r/g, "");
  const countyState = normalized.match(/([A-Z][A-Za-z .'-]+ County),\s*([A-Z]{2})\b/);
  const apn = normalized.match(/\bAPN[:\s]+([A-Z0-9 .-]+)/i);
  const acres = normalized.match(/\b(\d+(?:\.\d+)?)\s*acres?\b/i);
  const gps = normalized.match(/(-?\d{1,3}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})/);

  if (countyState) {
    fields.county = countyState[1].trim();
    fields.state = countyState[2].trim();
  }

  if (apn) {
    fields.apn = apn[1].trim();
  }

  if (acres) {
    fields.acreage = acres[1].trim();
  }

  if (gps) {
    fields.gps = `${gps[1]}, ${gps[2]}`;
  }

  for (const label of [
    ["roadFrontage", /Road Frontage\s+([^\n]+)/i],
    ["wetlands", /Wetlands\s+([^\n]+)/i],
    ["floodZone", /Flood Zone\s+([^\n]+)/i],
    ["hoa", /\bHOA\s+([^\n]+)/i],
    ["hasStructure", /Has Structure\s+([^\n]+)/i],
    ["currentLandUse", /Current Land Use\s+([^\n]+)/i],
    ["lastPurchasePrice", /Last Purchase Price\s+([^\n]+)/i],
    ["propertyTax", /Property Tax\s+([^\n]+)/i],
  ]) {
    const [key, pattern] = label;
    const match = normalized.match(pattern);

    if (match) {
      fields[key] = match[1].trim();
    }
  }

  return fields;
}

function inferAreaType(text) {
  const value = String(text || "").toLowerCase();

  if (/downtown|city|urban|subdivision|neighborhood/.test(value)) {
    return "suburban";
  }

  if (/rural|county road|farm|pasture|timber|wooded|vacant land/.test(value)) {
    return "rural";
  }

  return "unclear";
}

function inferTerrainType(text) {
  const value = String(text || "").toLowerCase();

  if (/slope|sloped|steep|contour|hill/.test(value)) {
    return "sloped";
  }

  if (/flat|level|pasture|field/.test(value)) {
    return "flat";
  }

  return "unclear";
}

function inferStructureSignal(fields, text) {
  const value = `${fields.hasStructure || ""} ${fields.structures || ""} ${text || ""}`.toLowerCase();

  if (/has structure\s+yes|structure present|house|mobile home|shed|barn/.test(value)) {
    return "present";
  }

  if (/has structure\s+no|structures\s+0|0 sqft/.test(value)) {
    return "not_obvious";
  }

  return "unclear";
}

async function buildVisionCapture({ artifact, parcelLink, inspection, fallbackCapture }) {
  const prompt = [
    "You are the DewClaw CompTool local visual worker.",
    "Return raw JSON only using the provided schema.",
    "Do not use Land Insights AI comp/pricing numbers as market value.",
    "Use the screenshot and page text only as source evidence.",
    "If the screenshot does not clearly show a fact, mark it unclear.",
    "Preserve unusual comp evidence as floor/ceiling/context instead of rejecting it automatically.",
    "Use the MLS/map screenshots to identify whether MLS comps or comp cards are visible.",
    "Redfin/Zillow/Realtor evidence is a required pass, not optional.",
    "Use external listing screenshots/text to inspect visible photos, descriptions, acreage, status, and comp fit.",
    "If an external target is only a search page, treat it as weak context unless the visible page clearly confirms the matching property.",
    "When comp rows/cards/photos/details are visible, fill externalListingEvidence with 1-3 strongest comps.",
    "Every externalListingEvidence item must include compRole: anchor, price_floor, price_ceiling, weak_context, or unrelated.",
    "If only a row is visible but photos are not opened, say that in photoObservations and risks.",
    "",
    "Parcel link:",
    parcelLink,
    "",
    "Existing browser capture fields:",
    JSON.stringify(artifact?.request?.browserPage?.extractedFields || {}, null, 2),
    "",
    "Existing comparable rows:",
    JSON.stringify(artifact?.request?.browserPage?.comparableRows || [], null, 2).slice(0, 12000),
    "",
    "Local worker heuristic MLS evidence:",
    JSON.stringify(inspection.mlsCompEvidence || [], null, 2).slice(0, 8000),
    "",
    "Local worker external Redfin/Zillow/Realtor evidence:",
    JSON.stringify(inspection.externalListingEvidence || [], null, 2).slice(0, 10000),
    "",
    "Local worker navigation log:",
    JSON.stringify(inspection.navigationLog || [], null, 2).slice(0, 4000),
    "",
    "Visible page text excerpt:",
    String(inspection.pageText || "").slice(0, 18000),
    "",
    "Return this exact JSON shape, filling what you can and keeping unknowns empty/unclear:",
    JSON.stringify(fallbackCapture, null, 2),
  ].join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 5000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...buildAnthropicImageBlocks(inspection.screenshots || [
              { label: "final_worker_view", data: inspection.screenshotBase64 },
            ]),
          ],
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || `Anthropic vision call failed: HTTP ${response.status}`);
  }

  const text = (payload.content || [])
    .map((item) => (item.type === "text" ? item.text : ""))
    .join("\n")
    .trim();
  const parsed = JSON.parse(extractJsonObject(text));

  return {
    ...fallbackCapture,
    ...parsed,
    diagnostics: [
      ...(fallbackCapture.diagnostics || []),
      ...(Array.isArray(parsed.diagnostics) ? parsed.diagnostics : []),
      "Anthropic vision JSON generated by local worker.",
    ],
  };
}

function buildAnthropicImageBlocks(screenshots) {
  return selectScreenshotsForVision(screenshots || [])
    .filter((item) => item?.data)
    .flatMap((item) => [
      { type: "text", text: `Screenshot: ${item.label || "worker_view"}` },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: item.data,
        },
      },
    ]);
}

function selectScreenshotsForVision(screenshots) {
  const available = (screenshots || []).filter((item) => item?.data);
  const selected = [];

  for (const group of [
    available.filter((item) => /final_worker_view/i.test(item.label || "")),
    available.filter((item) => /external_listing/i.test(item.label || "")),
    available.filter((item) => /after_mls_layer_setup/i.test(item.label || "")),
    available.filter((item) => /before_mls_layer_setup/i.test(item.label || "")),
    available,
  ]) {
    for (const item of group) {
      if (!selected.includes(item)) {
        selected.push(item);
      }

      if (selected.length >= 6) {
        return selected;
      }
    }
  }

  return selected;
}

function extractJsonObject(value) {
  const text = String(value || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced) {
    return fenced[1].trim();
  }

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Anthropic response did not contain a JSON object.");
  }

  return text.slice(first, last + 1);
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      jsonResponse(response, 204, {});
      return;
    }

    const url = new URL(request.url || "/", `http://127.0.0.1:${PORT}`);

    if (request.method === "GET" && url.pathname === "/health") {
      jsonResponse(response, 200, {
        ok: true,
        service: "dewclaw-comptool-local-worker",
        baseUrl: COMPTOOL_BASE_URL,
        anthropicVision: Boolean(ANTHROPIC_API_KEY),
        browserProfile: WORKER_BROWSER_PROFILE,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/jobs") {
      const payload = await readJsonBody(request);
      const job = createJob(payload);
      jsonResponse(response, 202, {
        ok: true,
        jobId: job.id,
        status: job.status,
      });
      return;
    }

    const jobMatch = url.pathname.match(/^\/jobs\/([a-zA-Z0-9-]+)$/);

    if (request.method === "GET" && jobMatch) {
      const job = jobs.get(jobMatch[1]);

      if (!job) {
        jsonResponse(response, 404, { error: "Job not found." });
        return;
      }

      jsonResponse(response, 200, job);
      return;
    }

    jsonResponse(response, 404, { error: "Route not found." });
  } catch (error) {
    jsonResponse(response, 500, {
      error: error instanceof Error ? error.message : String(error || "Unknown worker error."),
    });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`DewClaw CompTool local worker running at http://127.0.0.1:${PORT}`);
  console.log(`CompTool target: ${COMPTOOL_BASE_URL}`);
  console.log(`Anthropic vision: ${ANTHROPIC_API_KEY ? "enabled" : "disabled"}`);
});
