import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type { CompEvaluateResponse } from "@/comp-tool/types";
import type {
  VisualBrowserIntakeArtifact,
  VisualParcelInspectorRequest,
  VisualParcelInspectorResult,
} from "@/phase2/types";

const PHASE2_ARTIFACT_DIR = path.join(process.cwd(), "data", "phase2-browser-intake");

function getArtifactPath(id: string) {
  return path.join(PHASE2_ARTIFACT_DIR, `${id}.json`);
}

export async function saveVisualBrowserIntakeArtifact(args: {
  request: VisualParcelInspectorRequest;
  result: VisualParcelInspectorResult;
  compEvaluationStatus?: VisualBrowserIntakeArtifact["compEvaluationStatus"];
  compEvaluationStartedAt?: string | null;
  compEvaluationCompletedAt?: string | null;
  compEvaluation?: CompEvaluateResponse | null;
  compEvaluationError?: string | null;
}) {
  await mkdir(PHASE2_ARTIFACT_DIR, { recursive: true });

  const artifact: VisualBrowserIntakeArtifact = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    request: args.request,
    result: args.result,
    compEvaluationStatus: args.compEvaluationStatus ?? (args.compEvaluation ? "completed" : "pending"),
    compEvaluationStartedAt: args.compEvaluationStartedAt ?? null,
    compEvaluationCompletedAt: args.compEvaluationCompletedAt ?? null,
    compEvaluation: args.compEvaluation ?? null,
    compEvaluationError: args.compEvaluationError ?? null,
  };

  await writeFile(getArtifactPath(artifact.id), JSON.stringify(artifact, null, 2), "utf8");

  return artifact;
}

export async function readVisualBrowserIntakeArtifact(id: string) {
  const safeId = id.trim();

  if (!/^[a-zA-Z0-9-]+$/.test(safeId)) {
    return null;
  }

  try {
    const content = await readFile(getArtifactPath(safeId), "utf8");
    return JSON.parse(content) as VisualBrowserIntakeArtifact;
  } catch {
    return null;
  }
}

export async function updateVisualBrowserIntakeArtifact(
  id: string,
  patch: Partial<
    Pick<
      VisualBrowserIntakeArtifact,
      | "request"
      | "result"
      | "compEvaluationStatus"
      | "compEvaluationStartedAt"
      | "compEvaluationCompletedAt"
      | "compEvaluation"
      | "compEvaluationError"
    >
  >,
) {
  const artifact = await readVisualBrowserIntakeArtifact(id);

  if (!artifact) {
    return null;
  }

  const updatedArtifact: VisualBrowserIntakeArtifact = {
    ...artifact,
    ...patch,
  };

  await writeFile(getArtifactPath(artifact.id), JSON.stringify(updatedArtifact, null, 2), "utf8");

  return updatedArtifact;
}
