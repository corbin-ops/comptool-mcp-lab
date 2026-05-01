import { buildCompEvaluationResponse } from "@/comp-tool/evaluate";
import {
  buildCompRequestFromPhase2Capture,
  buildPhase2ParcelEnrichment,
} from "@/phase2/comp-bridge";
import { runVisualParcelInspector } from "@/phase2/inspector";
import {
  saveVisualBrowserIntakeArtifact,
  updateVisualBrowserIntakeArtifact,
} from "@/phase2/storage";
import type {
  VisualBrowserIntakeArtifact,
  VisualParcelInspectorRequest,
  VisualParcelInspectorResult,
} from "@/phase2/types";

export async function runCompEvaluationForArtifact(
  artifactId: string,
  parsed: VisualParcelInspectorRequest,
  result: VisualParcelInspectorResult,
) {
  const startedAt = new Date().toISOString();
  await updateVisualBrowserIntakeArtifact(artifactId, {
    compEvaluationStartedAt: startedAt,
    compEvaluationCompletedAt: null,
  });

  try {
    const compRequest = buildCompRequestFromPhase2Capture(parsed, result);
    const compEvaluation = await buildCompEvaluationResponse(compRequest, {
      skipParcelEnrichment: true,
      parcelEnrichment: buildPhase2ParcelEnrichment(parsed, result),
    });

    await updateVisualBrowserIntakeArtifact(artifactId, {
      compEvaluation,
      compEvaluationStatus:
        compEvaluation.generation.status === "completed" ? "completed" : "failed",
      compEvaluationStartedAt: startedAt,
      compEvaluationCompletedAt: new Date().toISOString(),
      compEvaluationError: compEvaluation.generation.error,
    });
  } catch (error) {
    await updateVisualBrowserIntakeArtifact(artifactId, {
      compEvaluationStatus: "failed",
      compEvaluationStartedAt: startedAt,
      compEvaluationCompletedAt: new Date().toISOString(),
      compEvaluationError:
        error instanceof Error ? error.message : "The comp evaluation failed.",
    });
  }
}

export async function createPendingPhase2Artifact(parsed: VisualParcelInspectorRequest) {
  const result = await runVisualParcelInspector(parsed);
  const artifact = await saveVisualBrowserIntakeArtifact({
    request: parsed,
    result,
    compEvaluationStatus: "pending",
    compEvaluationStartedAt: null,
    compEvaluationCompletedAt: null,
    compEvaluation: null,
  });

  void runCompEvaluationForArtifact(artifact.id, parsed, result);

  return artifact satisfies VisualBrowserIntakeArtifact;
}
