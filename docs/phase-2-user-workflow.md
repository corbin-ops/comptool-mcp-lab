# Unified CompTool User Workflow

## Purpose

This document defines the consolidated CompTool workflow after merging the V1 manual
tool, V2 browser-assisted dashboard, and Claude MCP lab into one repo.

## Repo Roles

`comptool-mcp-lab` is now the active source of truth.

Legacy folders remain useful as backups, but should not receive new feature work:

- `comp-tool`: original V1 manual app
- `comp-tool-v2`: Phase 2 staging app before MCP consolidation

## Main Routes

- `/phase2`: primary visual comp dashboard
- `/manual`: classic manual comp dashboard
- `/mcp-test`: Claude MCP prompt + JSON intake tester
- `/sop`: user testing SOP
- `/references`: DewClaw reference view

## Recommended Sales User Flow

1. Open the Land Insights parcel page or comp report.
2. Click the Chrome extension.
3. The extension extracts visible parcel fields, comparable rows, links, and diagnostics.
4. The extension sends the capture into `/api/phase2/browser-intake`.
5. The extension opens `/phase2/loading?artifact=<id>`.
6. The dashboard opens `/phase2?artifact=<id>` with the preliminary DewClaw result.
7. The user reviews the decision, market value, offer range, risks, and next action.
8. The user saves feedback if Corbin wants to calibrate the result.

## Analyst MCP Enrichment Flow

Use this only when the result needs deeper visual inspection.

1. Open the dashboard result.
2. Click **Improve with Claude MCP**.
3. Copy the prepared prompt into Claude MCP.
4. Claude MCP visually inspects Land Insights map layers, MLS comps, and photos.
5. Paste Claude's raw JSON return into `/mcp-test`.
6. CompTool saves the MCP evidence and opens the enriched `/phase2?artifact=<id>` result.

## Manual Fallback Flow

Use `/manual` when:

- there is no Land Insights page available
- the extension fails
- Corbin wants to correct or calibrate a previous comp
- a sales user only has basic parcel facts and notes

Manual mode still uses the same DewClaw corpus and comp engine, but it depends more
heavily on user-provided facts.

## Current Practical Limitations

- Land Insights does not provide API access.
- The Chrome extension can capture visible DOM/table data, but does not visually reason by itself.
- Claude MCP is the current visual reasoning layer for terrain, MLS photos, and map context.
- KML auto-attach can be blocked by Chrome blob/download behavior, so manual KML upload may still be needed.
- Render local JSON storage is not durable unless a persistent disk is attached.

## Quality Rules

- Do not use Land Insights AI comp numbers as market value.
- Preserve weird comps as evidence when useful: family transfers, quit claim deeds, landlocked cases, wrong acreage, and major issues may become price floors, price ceilings, or weak context.
- Separate vacant land logic from structure/vacant-land logic.
- Flag missing or unclear visual evidence instead of hiding uncertainty.

## Immediate Consolidation Status

- V1 manual dashboard is available at `/manual`.
- V2 visual dashboard is available at `/phase2`.
- MCP prompt/JSON intake is available at `/mcp-test`.
- Extension is pointed to the MCP lab Render service.
- New development should happen only in this repo.
