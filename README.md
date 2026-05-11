# DewClaw CompTool

Unified DewClaw land comping workspace.

This repo now consolidates the original manual CompTool, the Phase 2 browser-assisted
dashboard, and the Claude MCP visual-inspection workflow into one codebase.

## What Lives Here

- **Manual comp flow:** `/manual`
  - Classic operator-input dashboard.
  - Uses DewClaw corpus retrieval plus the configured AI model.
- **Visual/MCP dashboard:** `/phase2`
  - Main browser-assisted dashboard.
  - Receives Land Insights browser captures from the Chrome extension.
  - Shows parcel evidence, comparable rows, QA status, and DewClaw output.
- **Claude MCP intake tester:** `/mcp-test`
  - Builds the Claude MCP inspection prompt.
  - Accepts Claude MCP JSON and turns it into a dashboard artifact.
- **SOP and references:** `/sop`, `/references`
  - Testing procedure and DewClaw reference context for users.
- **Chrome extension:** `extension/`
  - Captures visible Land Insights parcel/report data.
  - Opens the dashboard result first for non-technical users.
  - Keeps Claude MCP enrichment available as an analyst/admin follow-up.

## Current Source Of Truth

Use this repo for all new CompTool development:

```text
D:\Users\JOW\Documents\New project\comptool-mcp-lab
```

Legacy folders should be treated as backups only:

```text
comp-tool      -> original V1 manual app
comp-tool-v2   -> Phase 2 staging app before MCP consolidation
```

## Critical Rule

Never use Land Insights AI comp/pricing numbers as DewClaw market value.

Land Insights is a source/navigation layer. DewClaw logic, retrieved training context,
and verified visual evidence must drive the final market value, offer range, decision,
and next action.

## Local Setup

```powershell
npm install
npm run dev
```

Open:

```text
http://localhost:3003
```

Useful routes:

```text
http://localhost:3003/phase2
http://localhost:3003/manual
http://localhost:3003/mcp-test
http://localhost:3003/sop
http://localhost:3003/references
```

## One-Click Compile

Double-click this file from the project folder:

```text
Compile Everything.cmd
```

Or run the same flow from PowerShell:

```powershell
npm run compile:all
```

This rebuilds the DewClaw corpus, runs TypeScript checks, builds the web app, and
packages the Chrome extension into `dist`.

## Render

Current Render service name:

```text
comptool-mcp-lab
```

The app currently writes test artifacts to local JSON files. For durable live testing,
move the Render service to a paid plan and attach a persistent disk or move feedback
storage into Google Sheets.
