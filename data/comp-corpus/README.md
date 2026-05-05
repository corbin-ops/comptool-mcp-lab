# DewClaw Comp Corpus

This folder is the preprocessing layer for the comp tool. It converts the DewClaw PDF training docs into a retrieval-friendly corpus instead of forcing the model to reason over raw PDFs directly.

## Source priority

1. `dcl_mcp_comping_guide`
   Use as the primary authority for Phase 2 MCP browser workflow, source capture, and visual evidence handling.
2. `dcl_comp_investigation_guide`
   Use as the primary pricing investigation reference for APN checks, Redfin/Zillow investigation, listing-photo review, and comp evidence quality.
3. `dcl_visual_land_analysis_guide`
   Use as the primary visual map-analysis reference for terrain, access, nearby development, and improvement cues.
4. `dcl_visual_field_guide_v3`
   Use as the primary visual field guide for wooded/cleared land, structures, access, and photo cues.
5. `complete_handbook_merged`
   Use as supporting legacy methodology when the newer MCP guides do not cover the issue.
6. `pricing_trendline_mastery`
   Use for normal flip pricing and PPA trendline decisions.
7. `subdivision_mastery`
   Use when split potential or lot design matters.
8. `complete_supplemental_reference`
   Use for supporting visual land-type identification.
9. `rural_properties`
   Use as a special-case rural adjustment reference.
10. `subdivision_advanced_part10`
   Use for hidden-value and edge-case subdivision calls.
11. `deliverable_format_v3_final`
   Use to shape the final output format only.

`dcl_visual_field_guide_v2` is intentionally excluded because V3 supersedes it. `complete_handbook_v3_duplicate` is intentionally excluded because it overlaps heavily with the merged handbook and would create redundant context.

## Generated artifacts

- `manifest.json`
  Document inventory, metadata, and page counts.
- `source-priority.json`
  Retrieval order and source-selection rules.
- `chunks.jsonl`
  Page-level chunk records for embeddings or prompt stuffing.
- `text/*.txt`
  Full extracted text per source document for QA and manual review.

## Rebuild

Run:

```powershell
python scripts/build-comp-corpus.py
```

The script expects source PDFs in `data/source-pdfs` by default and writes the generated corpus into this folder. Raw PDFs are intentionally git-ignored; commit the generated corpus artifacts instead.
