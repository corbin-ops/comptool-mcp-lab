import { NextResponse } from "next/server";

import { runCompEvaluationForArtifact } from "@/phase2/artifact-runner";
import {
  buildRequestFromClaudeMcp,
  parseClaudeMcpPayload,
} from "@/phase2/claude-mcp-adapter";
import { runVisualParcelInspector } from "@/phase2/inspector";
import {
  readVisualBrowserIntakeArtifact,
  updateVisualBrowserIntakeArtifact,
} from "@/phase2/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXTENSION_TOKEN_HEADER = "x-comp-tool-extension-token";

function getConfiguredExtensionToken() {
  return process.env.EXTENSION_INTAKE_TOKEN?.trim() ?? "";
}

function getRequestExtensionToken(request: Request) {
  const explicitToken = request.headers.get(EXTENSION_TOKEN_HEADER)?.trim();

  if (explicitToken) {
    return explicitToken;
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);

  return bearerMatch?.[1]?.trim() ?? "";
}

function canAttachMcpCapture(request: Request, artifactAttachToken = "") {
  const expectedToken = getConfiguredExtensionToken();
  const actualToken = getRequestExtensionToken(request);

  if (artifactAttachToken && actualToken === artifactAttachToken) {
    return true;
  }

  if (!expectedToken) {
    return true;
  }

  return actualToken === expectedToken;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const artifact = await readVisualBrowserIntakeArtifact(id);

  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
  }

  if (!canAttachMcpCapture(request, artifact.mcpAttachToken)) {
    return NextResponse.json({ error: "Missing or invalid worker token." }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a Claude MCP JSON request body." }, { status: 400 });
  }

  const capture = parseClaudeMcpPayload(payload);

  if (!capture.parcelLink) {
    return NextResponse.json(
      { error: "parcelLink, compReportUrl, or dataPlatformUrl is required." },
      { status: 400 },
    );
  }

  const parsed = buildRequestFromClaudeMcp(capture);
  const result = await runVisualParcelInspector(parsed);
  const updatedArtifact = await updateVisualBrowserIntakeArtifact(artifact.id, {
    request: parsed,
    result,
    compEvaluationStatus: "pending",
    compEvaluationStartedAt: null,
    compEvaluationCompletedAt: null,
    compEvaluation: null,
    compEvaluationError: null,
  });

  void runCompEvaluationForArtifact(artifact.id, parsed, result);

  return NextResponse.json({
    ok: true,
    artifactId: artifact.id,
    dashboardUrl: `/phase2?artifact=${encodeURIComponent(artifact.id)}`,
    artifact: updatedArtifact,
  });
}
