from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader


MAX_CHARS = 1800
OVERLAP_CHARS = 220


@dataclass(frozen=True)
class SourceDocument:
    doc_id: str
    filename: str
    category: str
    priority_rank: int
    use_for: str
    status: str = "active"
    notes: str = ""


SOURCE_DOCUMENTS: tuple[SourceDocument, ...] = (
    SourceDocument(
        doc_id="complete_handbook_merged",
        filename="DewClaw_Complete_Handbook_Merged.pdf",
        category="core_methodology",
        priority_rank=1,
        use_for="Primary comping methodology and decision framework.",
        notes="Treat as the canonical handbook for general valuation rules.",
    ),
    SourceDocument(
        doc_id="pricing_trendline_mastery",
        filename="DewClaw_Pricing_Trendline_Mastery_Guide.pdf",
        category="pricing",
        priority_rank=2,
        use_for="Normal flip pricing, trendline construction, and weighting logic.",
    ),
    SourceDocument(
        doc_id="subdivision_mastery",
        filename="DewClaw_Subdivision_Mastery_Guide.pdf",
        category="subdivision",
        priority_rank=3,
        use_for="Subdivision decisions, lot design, and hidden-value analysis.",
    ),
    SourceDocument(
        doc_id="deliverable_format_v3_final",
        filename="DewClaw_Deliverable_Format_v3_FINAL.pdf",
        category="output_format",
        priority_rank=4,
        use_for="Final evaluation output schema and section ordering.",
        notes="This explicitly supersedes earlier deliverable formats.",
    ),
    SourceDocument(
        doc_id="complete_supplemental_reference",
        filename="DewClaw_Complete_Supplemental_Reference.pdf",
        category="visual_reference",
        priority_rank=5,
        use_for="Visual land-type identification and supporting field heuristics.",
    ),
    SourceDocument(
        doc_id="rural_properties",
        filename="DewClaw_RURAL_PROPERTIES.pdf",
        category="special_case",
        priority_rank=6,
        use_for="Rural discount rules and extreme-access adjustments.",
    ),
    SourceDocument(
        doc_id="subdivision_advanced_part10",
        filename="PART10_SUBDIVISION_ADVANCED (1).pdf",
        category="special_case",
        priority_rank=7,
        use_for="Advanced subdivision edge cases and hidden value scenarios.",
    ),
    SourceDocument(
        doc_id="complete_handbook_v3_duplicate",
        filename="DewClaw_Complete_Handbook_V3 (1).pdf",
        category="duplicate_reference",
        priority_rank=99,
        use_for="Legacy duplicate copy of the handbook.",
        status="exclude",
        notes="Very likely redundant with the merged handbook. Keep for audit, not retrieval.",
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract DewClaw PDF training documents into a comp-tool corpus."
    )
    parser.add_argument(
        "--downloads-dir",
        type=Path,
        default=Path.home() / "Downloads",
        help="Directory containing the source PDFs.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data") / "comp-corpus",
        help="Directory where the corpus artifacts should be written.",
    )
    return parser.parse_args()


def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\u00a0", " ")
    text = (
        text.replace("â€”", "-")
        .replace("â€“", "-")
        .replace("â€˜", "'")
        .replace("â€™", "'")
        .replace("â€œ", '"')
        .replace("â€�", '"')
        .replace("â€¦", "...")
    )
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def first_non_empty_lines(text: str, limit: int = 4) -> list[str]:
    lines = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        lines.append(line)
        if len(lines) >= limit:
            break
    return lines


def chunk_text(text: str, max_chars: int = MAX_CHARS, overlap_chars: int = OVERLAP_CHARS) -> list[str]:
    clean = " ".join(text.split())
    if not clean:
        return []

    chunks: list[str] = []
    start = 0
    length = len(clean)

    while start < length:
        target_end = min(length, start + max_chars)
        end = target_end

        if target_end < length:
            boundary = clean.rfind(" ", start + int(max_chars * 0.65), target_end)
            if boundary > start:
                end = boundary

        chunk = clean[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= length:
            break

        next_start = max(0, end - overlap_chars)
        if next_start <= start:
            next_start = end
        start = next_start

    return chunks


def word_count(text: str) -> int:
    return len(text.split())


def extract_pages(pdf_path: Path) -> list[str]:
    reader = PdfReader(str(pdf_path))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(normalize_text(text))
    return pages


def build_doc_manifest(
    source: SourceDocument,
    pdf_path: Path,
    pages: list[str],
) -> dict:
    combined = "\n\n".join(page for page in pages if page)
    title_lines = first_non_empty_lines(pages[0] if pages else "")
    return {
        "doc_id": source.doc_id,
        "filename": source.filename,
        "source_path": str(pdf_path),
        "category": source.category,
        "priority_rank": source.priority_rank,
        "status": source.status,
        "use_for": source.use_for,
        "notes": source.notes,
        "page_count": len(pages),
        "word_count": word_count(combined),
        "title_lines": title_lines,
    }


def iter_chunk_records(
    source: SourceDocument,
    pages: list[str],
) -> Iterable[dict]:
    chunk_index = 0
    for page_number, page_text in enumerate(pages, start=1):
        if not page_text:
            continue

        page_chunks = chunk_text(page_text)
        for page_chunk_position, chunk in enumerate(page_chunks, start=1):
            chunk_index += 1
            yield {
                "chunk_id": f"{source.doc_id}-p{page_number:03d}-c{page_chunk_position:02d}",
                "doc_id": source.doc_id,
                "category": source.category,
                "priority_rank": source.priority_rank,
                "status": source.status,
                "page_number": page_number,
                "chunk_index": chunk_index,
                "word_count": word_count(chunk),
                "text": chunk,
            }


def build_source_priority(manifest: list[dict]) -> dict:
    active_docs = [
        {
            "doc_id": doc["doc_id"],
            "category": doc["category"],
            "priority_rank": doc["priority_rank"],
            "use_for": doc["use_for"],
        }
        for doc in manifest
        if doc["status"] == "active"
    ]
    excluded_docs = [
        {
            "doc_id": doc["doc_id"],
            "reason": doc["notes"] or "Excluded from retrieval.",
        }
        for doc in manifest
        if doc["status"] != "active"
    ]
    return {
        "retrieval_order": active_docs,
        "excluded_from_retrieval": excluded_docs,
        "rules": [
            "Use the merged handbook as the default authority for general comping logic.",
            "Use the pricing mastery guide to deepen normal flip pricing decisions.",
            "Use the subdivision mastery guide for split potential, lot layout, and road-access logic.",
            "Use the deliverable format document to shape the final output, not to make valuation decisions.",
            "Use rural and advanced subdivision documents as special-case overrides when the subject clearly fits those scenarios.",
            "Do not retrieve the duplicate handbook copy unless you are auditing changes between versions.",
        ],
    }


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_jsonl(path: Path, records: Iterable[dict]) -> int:
    count = 0
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1
    return count


def write_full_text(output_dir: Path, doc_id: str, pages: list[str]) -> None:
    joined = []
    for page_number, page_text in enumerate(pages, start=1):
        joined.append(f"[PAGE {page_number}]\n{page_text}\n")
    (output_dir / "text" / f"{doc_id}.txt").write_text("\n".join(joined), encoding="utf-8")


def main() -> None:
    args = parse_args()
    ensure_directory(args.output_dir)
    ensure_directory(args.output_dir / "text")

    manifest: list[dict] = []
    chunk_records: list[dict] = []

    for source in SOURCE_DOCUMENTS:
        pdf_path = args.downloads_dir / source.filename
        if not pdf_path.exists():
            raise FileNotFoundError(f"Missing source PDF: {pdf_path}")

        pages = extract_pages(pdf_path)
        manifest.append(build_doc_manifest(source, pdf_path, pages))
        chunk_records.extend(iter_chunk_records(source, pages))
        write_full_text(args.output_dir, source.doc_id, pages)

    source_priority = build_source_priority(manifest)

    write_json(args.output_dir / "manifest.json", manifest)
    write_json(args.output_dir / "source-priority.json", source_priority)
    write_json(
        args.output_dir / "stats.json",
        {
            "document_count": len(manifest),
            "active_document_count": sum(1 for doc in manifest if doc["status"] == "active"),
            "chunk_count": len(chunk_records),
        },
    )
    write_jsonl(args.output_dir / "chunks.jsonl", chunk_records)

    print(
        json.dumps(
            {
                "output_dir": str(args.output_dir.resolve()),
                "document_count": len(manifest),
                "chunk_count": len(chunk_records),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
