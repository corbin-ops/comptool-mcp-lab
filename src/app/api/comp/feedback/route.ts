import { NextResponse } from "next/server";

import { saveCompFeedbackArtifact } from "@/comp-tool/storage";
import type {
  CompFeedbackPayload,
  CompFeedbackRating,
  CompFeedbackSource,
} from "@/comp-tool/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readRating(value: unknown): CompFeedbackRating {
  return value === "yes" || value === "partial" || value === "no" ? value : "partial";
}

function readSource(value: unknown): CompFeedbackSource {
  return value === "phase2" ? "phase2" : "comp_tool";
}

function parseFeedbackPayload(payload: unknown): CompFeedbackPayload {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

  return {
    artifactPath: readString(record.artifactPath),
    phase2ArtifactId: readString(record.phase2ArtifactId),
    source: readSource(record.source),
    rating: readRating(record.rating),
    correctDecision: readString(record.correctDecision),
    correctMarketValue: readString(record.correctMarketValue),
    correctOpeningOffer: readString(record.correctOpeningOffer),
    whatWasWrong: readString(record.whatWasWrong),
    whatShouldChange: readString(record.whatShouldChange),
    ruleToRemember: readString(record.ruleToRemember),
    reviewerName: readString(record.reviewerName),
  };
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON request body." }, { status: 400 });
  }

  const feedback = parseFeedbackPayload(payload);

  if (!feedback.artifactPath && !feedback.phase2ArtifactId) {
    return NextResponse.json(
      { error: "Missing artifactPath or phase2ArtifactId for the evaluated comp." },
      { status: 400 },
    );
  }

  if (!feedback.whatWasWrong && !feedback.whatShouldChange && !feedback.ruleToRemember) {
    return NextResponse.json(
      { error: "Add feedback before saving. At minimum, explain what was wrong or what should change." },
      { status: 400 },
    );
  }

  const saved = await saveCompFeedbackArtifact(feedback);

  return NextResponse.json({
    ok: true,
    artifactPath: saved.artifactPath,
    record: saved.record,
  });
}
