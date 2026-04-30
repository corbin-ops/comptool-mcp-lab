# Phase 2 User Workflow

## Purpose

This document defines the current intended user workflow for the Phase 2 browser-assisted comp flow in `comp-tool-v2`.

`comp-tool` remains the live production app.

`comp-tool-v2` remains the local staging and development workspace until this Phase 2 flow is stable enough to merge or promote.

## Current workflow

1. The user opens the Land Insights comp report for a parcel.
2. The user clicks the Chrome extension.
3. The extension extracts parcel fields and comp-table rows from the active Land Insights page.
4. The extension sends that payload into the local Phase 2 dashboard.
5. Comp Tool V2 converts the captured payload into a CompTool V1 evaluation request.
6. The existing CompTool V1 DewClaw algorithm retrieves the local corpus context and runs the configured AI model.
7. The dashboard returns the V1-style comp result plus the captured parcel support details.

## Meeting update: 2026-04-27

The current direction from Corbin and Jow is to keep V2 extension-first:

- do not wait for formal Land Insights API access
- scrape/capture what the salesperson already sees in the browser
- keep the salesperson workflow simple: open parcel, click extension, review result
- keep the free OpenLayers + USGS map as the MVP map layer
- treat Mapbox as a later upgrade if account setup and usage billing are approved
- start preparing for Corbin-provided annotated comp examples
- start preparing for a state/county/township regulation corpus for subdivision rules

The detailed roadmap note lives in [Corbin CompBot roadmap notes](./corbin-compbot-roadmap-2026-04-27.md).

## Practical user flow

### Step 1: Open Land Insights

The user must already be logged into Land Insights and must already be on the parcel comp report page.

### Step 2: Click the extension

The extension should:

- detect the active Land Insights tab
- extract structured parcel fields
- extract comparable rows and listing links
- send the payload to `http://localhost:3003/api/phase2/browser-intake`

### Step 3: Open the Phase 2 dashboard result

After successful intake, the extension opens:

`http://localhost:3003/phase2?artifact=<id>`

This loads the captured parcel snapshot and the V1 comp evaluation into the V2 dashboard.

### Step 4: Compute the result

The V2 dashboard should evaluate through the existing CompTool V1 engine using:

- extracted Land Insights parcel fields
- extracted comp-table rows
- optional KML export
- optional listing links
- DewClaw V1 retrieval and prompt logic
- configured AI model reasoning

### Step 5: Show the result

The dashboard should show:

- CompTool V1 dashboard result
- decision, market value, offer range, next action, and data-quality summary
- USGS map panel with subject marker, optional KML boundary, and approximate comp radius
- structured parcel fields
- comparable rows
- risks
- verify-next items
- diagnostics

## Environment separation

### Production

- Folder: `/Users/jj/Documents/New project/comp-tool`
- Role: live production tool

### Staging / development

- Folder: `/Users/jj/Documents/New project/comp-tool-v2`
- Role: Phase 2 browser-assisted workflow development

## What is established now

The agreed workflow is no longer:

- user copies parcel details manually into the dashboard first

The agreed workflow is now:

- Land Insights page first
- extension click second
- V2 dashboard intake third
- CompTool V1 DewClaw + AI result fourth

## What is not final yet

- exact AI scoring logic
- final result wording
- final promotion path from V2 into production
- long-term hosted deployment path for the extension workflow
- final Mapbox versus OpenLayers decision
- final regulation-corpus storage and retrieval strategy
- final annotated-comp training format

## Immediate checkpoint before GitHub

Before uploading V2 to GitHub, confirm:

1. the extension consistently opens the correct artifact page
2. parcel fields are extracted correctly
3. comparable rows are extracted correctly
4. the V2 result flow is acceptable for internal testing
5. V1 remains untouched and usable in production
