import { retrieveCompContext } from "@/comp-tool/corpus";
import { generateCompDeliverable } from "@/comp-tool/model";
import { enrichCompRequestFromParcelLink } from "@/comp-tool/parcel-link";
import { buildCompPromptPackage } from "@/comp-tool/prompt";
import { loadCompFeedbackMemory, saveCompEvaluationArtifact } from "@/comp-tool/storage";
import {
  parseCompEvaluateRequest,
  type CompParcelEnrichment,
  type CompEvaluateResponse,
} from "@/comp-tool/types";

type BuildCompEvaluationOptions = {
  skipParcelEnrichment?: boolean;
  parcelEnrichment?: CompParcelEnrichment | null;
  warnings?: string[];
};

export async function buildCompEvaluationResponse(
  payload: unknown,
  options: BuildCompEvaluationOptions = {},
): Promise<CompEvaluateResponse> {
  const originalRequest = parseCompEvaluateRequest(payload);
  const enrichment = options.skipParcelEnrichment
    ? {
        request: originalRequest,
        parcelEnrichment: options.parcelEnrichment ?? null,
        warnings: options.warnings ?? [],
      }
    : await enrichCompRequestFromParcelLink(originalRequest);
  const resolvedRequest = enrichment.request;
  const retrieval = await retrieveCompContext(resolvedRequest);
  const feedbackMemory = await loadCompFeedbackMemory();
  const warnings = [...enrichment.warnings, ...retrieval.warnings];
  const promptPackage = buildCompPromptPackage(
    resolvedRequest,
    retrieval.retrievalQuery,
    retrieval.chunks,
    feedbackMemory,
  );
  const generation = await generateCompDeliverable(promptPackage);

  const response: CompEvaluateResponse = {
    request: resolvedRequest,
    originalRequest,
    parcelEnrichment: enrichment.parcelEnrichment,
    warnings,
    promptPackage,
    retrieval: {
      topK: resolvedRequest.topK,
      recommendedSources: retrieval.recommendedSources,
      chunks: retrieval.chunks,
    },
    generation,
  };

  if (generation.status === "not_configured" && generation.error) {
    response.warnings.push(generation.error);
  }

  if (generation.status === "failed" && generation.error) {
    response.warnings.push(`Model generation failed: ${generation.error}`);
  }

  try {
    response.generation.artifactPath = await saveCompEvaluationArtifact(response);
  } catch (error) {
    response.warnings.push(
      `Could not save the evaluation artifact: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  return response;
}
