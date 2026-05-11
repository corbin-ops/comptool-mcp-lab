import { NextResponse } from "next/server";

import { createPendingPhase2Artifact } from "@/phase2/artifact-runner";
import {
  buildRequestFromClaudeMcp,
  parseClaudeMcpPayload,
} from "@/phase2/claude-mcp-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON request body." }, { status: 400 });
  }

  const capture = parseClaudeMcpPayload(payload);

  if (!capture.parcelLink) {
    return NextResponse.json(
      { error: "parcelLink, compReportUrl, or dataPlatformUrl is required." },
      { status: 400 },
    );
  }

  const parsed = buildRequestFromClaudeMcp(capture);
  const artifact = await createPendingPhase2Artifact(parsed);

  return NextResponse.json({
    ok: true,
    artifactId: artifact.id,
    dashboardUrl: `/phase2?artifact=${encodeURIComponent(artifact.id)}`,
    createdAt: artifact.createdAt,
    result: artifact.result,
    compEvaluationStatus: artifact.compEvaluationStatus,
  });
}
