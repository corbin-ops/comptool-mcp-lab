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
const WORKER_BROWSER_PROFILE =
  process.env.WORKER_BROWSER_PROFILE ||
  path.join(os.homedir(), "AppData", "Local", "DewClawCompTool", "browser-profile");

const jobs = new Map();
let activeJob = Promise.resolve();

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
  };

  jobs.set(job.id, job);
  activeJob = activeJob.then(() => processJob(job)).catch(() => processJob(job));

  return job;
}

async function processJob(job) {
  job.status = "running";
  job.startedAt = new Date().toISOString();

  try {
    const result = await runVisualEnrichment(job.payload);
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.result = result;
  } catch (error) {
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.error = error instanceof Error ? error.message : String(error || "Unknown worker error.");
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

async function runVisualEnrichment(payload) {
  const artifactId = String(payload.artifactId || "").trim();
  const parcelLink = String(payload.parcelLink || "").trim();
  const baseUrl = trimTrailingSlash(payload.baseUrl || COMPTOOL_BASE_URL);
  const intakeToken = String(payload.extensionToken || EXTENSION_INTAKE_TOKEN || "").trim();

  if (!artifactId) {
    throw new Error("artifactId is required.");
  }

  if (!parcelLink) {
    throw new Error("parcelLink is required.");
  }

  const artifact = await fetchArtifact(artifactId, baseUrl, intakeToken);
  const inspection = await inspectParcelInBrowser(parcelLink);
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

async function inspectParcelInBrowser(parcelLink) {
  await mkdir(WORKER_BROWSER_PROFILE, { recursive: true });
  const context = await chromium.launchPersistentContext(WORKER_BROWSER_PROFILE, {
    headless: WORKER_HEADLESS,
    viewport: { width: 1440, height: 1000 },
  });

  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto(parcelLink, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);

    const title = await page.title().catch(() => "Land Insights");
    const finalUrl = page.url();
    const pageText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
    const screenshotBase64 = await page.screenshot({ type: "png", fullPage: false }).then((buffer) =>
      buffer.toString("base64"),
    );

    return {
      title,
      finalUrl,
      pageText,
      screenshotBase64,
      loginRequired: /\/login/i.test(finalUrl) || /sign in|log in/i.test(pageText),
      diagnostics: [
        `Worker opened parcel: ${finalUrl}`,
        `Worker captured visible text length: ${pageText.length}`,
        `Worker screenshot captured: ${screenshotBase64 ? "yes" : "no"}`,
      ],
    };
  } finally {
    await context.close();
  }
}

function buildFallbackCapture({ artifact, parcelLink, inspection }) {
  const browserPage = artifact?.request?.browserPage || {};
  const fields = {
    ...(browserPage.extractedFields || {}),
    ...extractFieldsFromText(inspection.pageText),
  };

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
    comparableRows: browserPage.comparableRows || artifact?.result?.comparableRows || [],
    listingLinks: browserPage.listingLinks || artifact?.request?.listingLinks || [],
    externalListingEvidence: [],
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
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: inspection.screenshotBase64,
              },
            },
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
