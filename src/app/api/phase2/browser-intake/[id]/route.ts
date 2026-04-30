import { NextResponse } from "next/server";

import {
  readVisualBrowserIntakeArtifact,
  updateVisualBrowserIntakeArtifact,
} from "@/phase2/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_PENDING_MS = 3 * 60 * 1000;

function parseTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let artifact = await readVisualBrowserIntakeArtifact(id);

  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
  }

  const startedAt = parseTime(artifact.compEvaluationStartedAt) ?? parseTime(artifact.createdAt);
  const isStalePending =
    artifact.compEvaluationStatus === "pending" &&
    startedAt !== null &&
    Date.now() - startedAt > STALE_PENDING_MS;

  if (isStalePending) {
    artifact =
      (await updateVisualBrowserIntakeArtifact(artifact.id, {
        compEvaluationStatus: "failed",
        compEvaluationCompletedAt: new Date().toISOString(),
        compEvaluationError:
          "AI generation exceeded 3 minutes and was marked failed. Please recapture or retry this parcel.",
      })) ?? artifact;
  }

  return NextResponse.json(artifact);
}
