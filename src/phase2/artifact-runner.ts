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

function getOffMarketAbortReason(parsed: VisualParcelInspectorRequest, result: VisualParcelInspectorResult) {
  const targets = parsed.browserPage?.externalSearchTargets ?? [];
  const offMarketTargets = targets.filter(
    (target) =>
      target.abortComping ||
      target.offMarketDetected ||
      /off[\s-]*market/i.test(`${target.listingState ?? ""} ${target.status ?? ""} ${target.detectionText ?? ""}`),
  );

  if (offMarketTargets.length) {
    const sources = offMarketTargets
      .map((target) => `${target.source || "external"}${target.searchQuery ? ` (${target.searchQuery})` : ""}`)
      .join(", ");

    return `Comping aborted: Off Market detected on ${sources}. Open a usable active/sold/pending comp before running DewClaw valuation.`;
  }

  if ((result.diagnostics ?? []).some((item) => /abortComping=true|abort comping:.*off[\s-]*market/i.test(item))) {
    return "Comping aborted: Off Market was detected in external listing evidence. Open a usable active/sold/pending comp before running DewClaw valuation.";
  }

  const claudeEvidenceText = [
    parsed.notes ?? "",
    parsed.browserPage?.pageText ?? "",
    ...(parsed.browserListings ?? []).map((listing) => listing.pageText ?? ""),
  ].join("\n");

  if (/abortComping=true|abort comping:.*off[\s-]*market|off[\s-]*market detected/i.test(claudeEvidenceText)) {
    return "Comping aborted: Claude/Redfin/Zillow evidence detected Off Market. Open a usable active/sold/pending comp before running DewClaw valuation.";
  }

  return "";
}

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
    const offMarketAbortReason = getOffMarketAbortReason(parsed, result);

    if (offMarketAbortReason) {
      await updateVisualBrowserIntakeArtifact(artifactId, {
        compEvaluationStatus: "failed",
        compEvaluationStartedAt: startedAt,
        compEvaluationCompletedAt: new Date().toISOString(),
        compEvaluationError: offMarketAbortReason,
      });
      return;
    }

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
