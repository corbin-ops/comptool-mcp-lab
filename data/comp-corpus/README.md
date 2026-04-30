# DewClaw Comp Corpus

This folder is the preprocessing layer for the comp tool. It converts the DewClaw PDF training docs into a retrieval-friendly corpus instead of forcing the model to reason over raw PDFs directly.

## Source priority

1. `complete_handbook_merged`
   Use as the default authority for general comping logic.
2. `pricing_trendline_mastery`
   Use for normal flip pricing and PPA trendline decisions.
3. `subdivision_mastery`
   Use when split potential or lot design matters.
4. `deliverable_format_v3_final`
   Use to shape the final output format only.
5. `complete_supplemental_reference`
   Use for visual land-type identification support.
6. `rural_properties`
   Use as a special-case rural adjustment reference.
7. `subdivision_advanced_part10`
   Use for hidden-value and edge-case subdivision calls.

`complete_handbook_v3_duplicate` is intentionally excluded from retrieval because it appears to overlap heavily with the merged handbook and would create redundant context.

## Generated artifacts

- [manifest.json](/C:/Users/JOW/Documents/New%20project/data/comp-corpus/manifest.json)
  Document inventory, metadata, and page counts.
- [source-priority.json](/C:/Users/JOW/Documents/New%20project/data/comp-corpus/source-priority.json)
  Retrieval order and source-selection rules.
- [chunks.jsonl](/C:/Users/JOW/Documents/New%20project/data/comp-corpus/chunks.jsonl)
  Page-level chunk records for embeddings or prompt stuffing.
- `text/*.txt`
  Full extracted text per source document for QA and manual review.

## Rebuild

Run:

```powershell
python scripts/build-comp-corpus.py
```

The script expects the source PDFs in `~/Downloads` by default and writes the generated corpus into this folder.
