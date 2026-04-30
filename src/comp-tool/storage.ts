import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  CompEvaluateResponse,
  CompFeedbackPayload,
  CompFeedbackRecord,
} from "@/comp-tool/types";

function sanitizeFileSegment(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

const FEEDBACK_DIR = path.join(process.cwd(), "data", "feedback");

export async function saveCompEvaluationArtifact(response: CompEvaluateResponse) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const provider = response.generation.provider ?? response.generation.status;
  const evaluationDir = path.join(process.cwd(), "data", "evaluations");

  await mkdir(evaluationDir, { recursive: true });

  const filename = `${timestamp}-${sanitizeFileSegment(provider)}.json`;
  const absolutePath = path.join(evaluationDir, filename);
  const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, "/");

  await writeFile(absolutePath, JSON.stringify(response, null, 2), "utf-8");

  return relativePath;
}

export async function saveCompFeedbackArtifact(payload: CompFeedbackPayload) {
  const timestamp = new Date().toISOString();
  const id = timestamp.replace(/[:.]/g, "-");
  const record: CompFeedbackRecord = {
    id,
    createdAt: timestamp,
    ...payload,
  };

  await mkdir(FEEDBACK_DIR, { recursive: true });

  const filename = `${id}-${sanitizeFileSegment(payload.rating)}.json`;
  const absolutePath = path.join(FEEDBACK_DIR, filename);
  const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, "/");

  await writeFile(absolutePath, JSON.stringify(record, null, 2), "utf-8");

  return {
    record,
    artifactPath: relativePath,
  };
}

function isUsefulFeedbackMemory(record: CompFeedbackRecord) {
  return Boolean(
    record.ruleToRemember ||
      record.whatShouldChange ||
      record.correctDecision ||
      record.correctMarketValue ||
      record.correctOpeningOffer,
  );
}

export async function loadCompFeedbackMemory(limit = 8) {
  try {
    const files = await readdir(FEEDBACK_DIR);
    const records = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          try {
            const content = await readFile(path.join(FEEDBACK_DIR, file), "utf-8");
            return JSON.parse(content) as CompFeedbackRecord;
          } catch {
            return null;
          }
        }),
    );

    return records
      .filter((record): record is CompFeedbackRecord => Boolean(record && isUsefulFeedbackMemory(record)))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(0, limit));
  } catch {
    return [];
  }
}
