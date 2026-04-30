import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  CompEvaluateRequest,
  CompMode,
  CompPropertyTypeFocus,
  RecommendedCompSource,
  RetrievedCompChunk,
} from "@/comp-tool/types";

type CorpusManifestRecord = {
  doc_id: string;
  filename: string;
  source_path: string;
  category: string;
  priority_rank: number;
  status: string;
  use_for: string;
  notes: string;
  page_count: number;
  word_count: number;
  title_lines: string[];
};

type CorpusChunkRecord = {
  chunk_id: string;
  doc_id: string;
  category: string;
  priority_rank: number;
  status: string;
  page_number: number;
  chunk_index: number;
  word_count: number;
  text: string;
};

type SourcePriorityFile = {
  retrieval_order: Array<{
    doc_id: string;
    category: string;
    priority_rank: number;
    use_for: string;
  }>;
};

type IndexedChunk = CorpusChunkRecord & {
  tokenCounts: Map<string, number>;
};

type LoadedCorpus = {
  manifest: CorpusManifestRecord[];
  chunks: IndexedChunk[];
  sourcePriority: SourcePriorityFile;
};

const DEFAULT_CORPUS_DIR = path.join(process.cwd(), "data", "comp-corpus");
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "there",
  "this",
  "to",
  "up",
  "use",
  "what",
  "when",
  "with",
]);

const MODE_CATEGORY_WEIGHTS: Record<CompMode, Record<string, number>> = {
  general: {
    core_methodology: 2.5,
    pricing: 1.8,
    subdivision: 1.6,
    visual_reference: 1.2,
    special_case: 1.1,
    output_format: 0.75,
    duplicate_reference: 0.05,
  },
  pricing: {
    pricing: 2.8,
    core_methodology: 1.9,
    visual_reference: 1.3,
    subdivision: 1.0,
    special_case: 1.0,
    output_format: 0.65,
    duplicate_reference: 0.05,
  },
  subdivision: {
    subdivision: 2.9,
    special_case: 2.0,
    core_methodology: 1.7,
    pricing: 1.2,
    visual_reference: 1.1,
    output_format: 0.65,
    duplicate_reference: 0.05,
  },
  rural: {
    special_case: 2.7,
    core_methodology: 1.8,
    pricing: 1.4,
    visual_reference: 1.2,
    subdivision: 1.0,
    output_format: 0.55,
    duplicate_reference: 0.05,
  },
  deliverable: {
    output_format: 3.2,
    core_methodology: 1.4,
    pricing: 1.0,
    subdivision: 0.95,
    visual_reference: 0.8,
    special_case: 0.75,
    duplicate_reference: 0.05,
  },
};

const MODE_DOC_BOOSTS: Partial<Record<CompMode, Partial<Record<string, number>>>> = {
  pricing: {
    pricing_trendline_mastery: 1.5,
    complete_handbook_merged: 1.1,
  },
  subdivision: {
    subdivision_mastery: 1.65,
    subdivision_advanced_part10: 1.45,
  },
  rural: {
    rural_properties: 1.75,
  },
  deliverable: {
    deliverable_format_v3_final: 1.9,
  },
};

let corpusPromise: Promise<LoadedCorpus> | null = null;

function getCorpusDir() {
  return process.env.COMP_CORPUS_DIR?.trim()
    ? path.resolve(process.cwd(), process.env.COMP_CORPUS_DIR.trim())
    : DEFAULT_CORPUS_DIR;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9$./%-]+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function buildTokenCounts(tokens: string[]) {
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return counts;
}

async function loadCorpus() {
  const corpusDir = getCorpusDir();
  const [manifestRaw, chunksRaw, sourcePriorityRaw] = await Promise.all([
    readFile(path.join(corpusDir, "manifest.json"), "utf-8"),
    readFile(path.join(corpusDir, "chunks.jsonl"), "utf-8"),
    readFile(path.join(corpusDir, "source-priority.json"), "utf-8"),
  ]);

  const manifest = JSON.parse(manifestRaw) as CorpusManifestRecord[];
  const sourcePriority = JSON.parse(sourcePriorityRaw) as SourcePriorityFile;
  const chunks = chunksRaw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CorpusChunkRecord)
    .map((chunk) => ({
      ...chunk,
      tokenCounts: buildTokenCounts(tokenize(chunk.text)),
    }));

  return { manifest, chunks, sourcePriority };
}

async function getCorpus() {
  if (!corpusPromise) {
    corpusPromise = loadCorpus();
  }

  return corpusPromise;
}

function buildModeHint(mode: CompMode) {
  switch (mode) {
    case "pricing":
      return "market value comps price per acre ppa trendline comp weighting market value acreage";
    case "subdivision":
      return "subdivision split lots lot design frontage road access hidden value road building flagpole";
    case "rural":
      return "rural access remoteness maintenance poor roads middle of nowhere discount";
    case "deliverable":
      return "10 section deliverable market value offer price lead stage classification key comps";
    default:
      return "land valuation comping workflow market value comps pricing subdivision notes";
  }
}

function buildPropertyTypeHint(propertyTypeFocus: CompPropertyTypeFocus) {
  switch (propertyTypeFocus) {
    case "vacant_land":
      return "vacant land only exclude house comps exclude housing contamination structures are verify items";
    case "structure_vacant_land":
      return "structure vacant land mixed-use parcel house shed barn improvements separate land value from structure impact";
    default:
      return "broad comp auto-detect structures flag housing contamination risk if present";
  }
}

export function buildRetrievalQuery(input: CompEvaluateRequest) {
  const parts = [
    input.question && `Question: ${input.question}`,
    input.parcelLink && `Parcel link: ${input.parcelLink}`,
    input.county && `County: ${input.county}`,
    input.state && `State: ${input.state}`,
    input.acreage && `Acreage: ${input.acreage}`,
    input.sellerAskingPrice && `Seller asking price: ${input.sellerAskingPrice}`,
    input.knownFacts && `Known facts: ${input.knownFacts}`,
    `Property type focus: ${buildPropertyTypeHint(input.propertyTypeFocus)}`,
    `Mode focus: ${buildModeHint(input.mode)}`,
  ];

  return parts.filter(Boolean).join(" | ");
}

function scoreChunk(chunk: IndexedChunk, queryTokens: string[], mode: CompMode) {
  const categoryWeight = MODE_CATEGORY_WEIGHTS[mode][chunk.category] ?? 1;
  const docBoost = MODE_DOC_BOOSTS[mode]?.[chunk.doc_id] ?? 1;
  const matchedTerms = new Set<string>();

  let lexicalScore = 0;

  for (const token of queryTokens) {
    const hits = chunk.tokenCounts.get(token) ?? 0;

    if (!hits) {
      continue;
    }

    matchedTerms.add(token);
    lexicalScore += 8 + hits * 2;
  }

  if (!lexicalScore) {
    return { score: 0, matchedTerms: [] };
  }

  const priorityBonus = Math.max(0.2, 1.5 - chunk.priority_rank * 0.08);
  const finalScore = lexicalScore * categoryWeight * docBoost + priorityBonus;

  return { score: finalScore, matchedTerms: [...matchedTerms] };
}

function buildFallbackChunks(
  chunks: IndexedChunk[],
  mode: CompMode,
  topK: number,
): RetrievedCompChunk[] {
  const ranked = [...chunks]
    .filter((chunk) => chunk.status === "active")
    .sort((left, right) => {
      const leftWeight =
        (MODE_CATEGORY_WEIGHTS[mode][left.category] ?? 1) *
        (MODE_DOC_BOOSTS[mode]?.[left.doc_id] ?? 1);
      const rightWeight =
        (MODE_CATEGORY_WEIGHTS[mode][right.category] ?? 1) *
        (MODE_DOC_BOOSTS[mode]?.[right.doc_id] ?? 1);

      if (leftWeight !== rightWeight) {
        return rightWeight - leftWeight;
      }

      if (left.priority_rank !== right.priority_rank) {
        return left.priority_rank - right.priority_rank;
      }

      return left.chunk_index - right.chunk_index;
    })
    .slice(0, topK);

  return ranked.map((chunk) => ({
    chunkId: chunk.chunk_id,
    docId: chunk.doc_id,
    category: chunk.category,
    pageNumber: chunk.page_number,
    text: chunk.text,
    score: 0,
    matchedTerms: [],
  }));
}

export async function retrieveCompContext(input: CompEvaluateRequest): Promise<{
  retrievalQuery: string;
  warnings: string[];
  recommendedSources: RecommendedCompSource[];
  chunks: RetrievedCompChunk[];
}> {
  const corpus = await getCorpus();
  const retrievalQuery = buildRetrievalQuery(input);
  const queryTokens = tokenize(retrievalQuery);
  const warnings: string[] = [];

  if (!input.question && !input.knownFacts) {
    warnings.push("Add a property question or notes to improve retrieval quality.");
  }

  if (!input.county || !input.state) {
    warnings.push("County and state are blank, so area-specific guidance may be weaker.");
  }

  const recommendedSources = corpus.sourcePriority.retrieval_order
    .filter((source) => (MODE_CATEGORY_WEIGHTS[input.mode][source.category] ?? 0) > 0.7)
    .slice(0, 5)
    .map((source) => ({
      docId: source.doc_id,
      category: source.category,
      priorityRank: source.priority_rank,
      useFor: source.use_for,
    }));

  if (!queryTokens.length) {
    warnings.push(
      "No useful retrieval tokens were found, so the fallback context packet is being used.",
    );

    return {
      retrievalQuery,
      warnings,
      recommendedSources,
      chunks: buildFallbackChunks(corpus.chunks, input.mode, input.topK),
    };
  }

  const scoredChunks = corpus.chunks
    .filter((chunk) => chunk.status === "active")
    .map((chunk) => {
      const { score, matchedTerms } = scoreChunk(chunk, queryTokens, input.mode);

      return {
        chunk,
        score,
        matchedTerms,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.topK)
    .map<RetrievedCompChunk>(({ chunk, score, matchedTerms }) => ({
      chunkId: chunk.chunk_id,
      docId: chunk.doc_id,
      category: chunk.category,
      pageNumber: chunk.page_number,
      text: chunk.text,
      score: Number(score.toFixed(2)),
      matchedTerms: [...new Set(matchedTerms)].slice(0, 12),
    }));

  return {
    retrievalQuery,
    warnings,
    recommendedSources,
    chunks:
      scoredChunks.length
        ? scoredChunks
        : buildFallbackChunks(corpus.chunks, input.mode, input.topK),
  };
}
