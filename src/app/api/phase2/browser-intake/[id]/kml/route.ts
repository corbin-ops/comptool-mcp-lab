import { NextResponse } from "next/server";

import { buildCompEvaluationResponse } from "@/comp-tool/evaluate";
import {
  buildCompRequestFromPhase2Capture,
  buildPhase2ParcelEnrichment,
} from "@/phase2/comp-bridge";
import { runVisualParcelInspector } from "@/phase2/inspector";
import {
  readVisualBrowserIntakeArtifact,
  updateVisualBrowserIntakeArtifact,
} from "@/phase2/storage";
import type {
  VisualParcelInspectorRequest,
  VisualParcelInspectorResult,
} from "@/phase2/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_KML_BYTES = 2 * 1024 * 1024;

function isKmlText(value: string) {
  return /<kml[\s>]/i.test(value) || /<coordinates>/i.test(value);
}

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function runCompEvaluation(
  parsed: VisualParcelInspectorRequest,
  result: VisualParcelInspectorResult,
) {
  const compRequest = buildCompRequestFromPhase2Capture(parsed, result);

  return buildCompEvaluationResponse(compRequest, {
    skipParcelEnrichment: true,
    parcelEnrichment: buildPhase2ParcelEnrichment(parsed, result),
  });
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

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a KML file upload." }, { status: 400 });
  }

  const file = formData.get("file");
  let kmlText = readString(formData.get("kmlText"));
  let kmlFileName = readString(formData.get("kmlFileName"));

  if (file instanceof File) {
    if (file.size > MAX_KML_BYTES) {
      return NextResponse.json(
        { error: "KML file is too large. Please upload a file under 2 MB." },
        { status: 400 },
      );
    }

    kmlText = await file.text();
    kmlFileName = file.name || kmlFileName;
  }

  kmlText = kmlText.trim();

  if (!kmlText) {
    return NextResponse.json({ error: "KML file is empty." }, { status: 400 });
  }

  if (!isKmlText(kmlText)) {
    return NextResponse.json(
      { error: "Uploaded file does not look like a KML export." },
      { status: 400 },
    );
  }

  const updatedRequest = {
    ...artifact.request,
    kmlText,
    kmlFileName,
    browserPage: artifact.request.browserPage
      ? {
          ...artifact.request.browserPage,
          kmlFileName,
          kmlCaptureStatus: "KML manually uploaded to CompTool result page",
        }
      : artifact.request.browserPage,
  };

  const result = await runVisualParcelInspector(updatedRequest);
  const startedAt = new Date().toISOString();

  await updateVisualBrowserIntakeArtifact(artifact.id, {
    request: updatedRequest,
    result,
    compEvaluationStatus: "pending",
    compEvaluationStartedAt: startedAt,
    compEvaluationCompletedAt: null,
    compEvaluation: null,
    compEvaluationError: null,
  });

  try {
    const compEvaluation = await runCompEvaluation(updatedRequest, result);
    const updatedArtifact = await updateVisualBrowserIntakeArtifact(artifact.id, {
      request: updatedRequest,
      result,
      compEvaluation,
      compEvaluationStatus:
        compEvaluation.generation.status === "completed" ? "completed" : "failed",
      compEvaluationStartedAt: startedAt,
      compEvaluationCompletedAt: new Date().toISOString(),
      compEvaluationError: compEvaluation.generation.error,
    });

    return NextResponse.json(updatedArtifact);
  } catch (error) {
    const updatedArtifact = await updateVisualBrowserIntakeArtifact(artifact.id, {
      request: updatedRequest,
      result,
      compEvaluationStatus: "failed",
      compEvaluationStartedAt: startedAt,
      compEvaluationCompletedAt: new Date().toISOString(),
      compEvaluationError:
        error instanceof Error ? error.message : "The comp evaluation failed after KML upload.",
    });

    return NextResponse.json(updatedArtifact);
  }
}
