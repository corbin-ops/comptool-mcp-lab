import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import type { VisualBrowserIntakeArtifact } from "@/phase2/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHASE2_ARTIFACT_DIR = path.join(process.cwd(), "data", "phase2-browser-intake");
const TESTING_GOAL = 1000;

function includesAny(value: string, needles: string[]) {
  const normalized = value.toLowerCase();

  return needles.some((needle) => normalized.includes(needle));
}

function isLocalOrSampleArtifact(filename: string, artifact: VisualBrowserIntakeArtifact) {
  const searchableText = [
    filename,
    artifact.id,
    artifact.request.parcelLink,
    artifact.request.notes,
    artifact.request.browserPage?.sourceUrl,
    artifact.request.browserPage?.pageTitle,
    artifact.request.browserPage?.sourceApp,
  ]
    .filter(Boolean)
    .join(" ");

  return includesAny(searchableText, [
    "local-ui-test",
    "localhost",
    "127.0.0.1",
    "example.com",
    "sample",
    "test-only",
    "jow-test",
  ]);
}

export async function GET() {
  let files: string[] = [];

  try {
    files = (await readdir(PHASE2_ARTIFACT_DIR)).filter((file) => file.endsWith(".json"));
  } catch {
    return NextResponse.json({
      goal: TESTING_GOAL,
      totalComps: 0,
      excludedLocalTests: 0,
      artifactCount: 0,
      percentComplete: 0,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  let totalComps = 0;
  let excludedLocalTests = 0;

  await Promise.all(
    files.map(async (file) => {
      try {
        const content = await readFile(path.join(PHASE2_ARTIFACT_DIR, file), "utf8");
        const artifact = JSON.parse(content) as VisualBrowserIntakeArtifact;

        if (isLocalOrSampleArtifact(file, artifact)) {
          excludedLocalTests += 1;
          return;
        }

        totalComps += 1;
      } catch {
        excludedLocalTests += 1;
      }
    }),
  );

  return NextResponse.json({
    goal: TESTING_GOAL,
    totalComps,
    excludedLocalTests,
    artifactCount: files.length,
    percentComplete: Math.min(100, Math.round((totalComps / TESTING_GOAL) * 1000) / 10),
    lastUpdatedAt: new Date().toISOString(),
  });
}
