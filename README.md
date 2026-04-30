# DewClaw CompTool MCP Lab

Experimental Claude MCP visual-inspection lab for DewClaw CompTool.

This repo is intentionally separate from the active V2 testing app so MCP experiments do not disrupt Corbin/team testing.

## Current Goal

Build a Claude MCP-assisted workflow that can inspect Land Insights visually and return a stable source-data packet shaped like the current Land Insights table capture.

The first MCP return contract lives in:

- `src/phase2/claude-mcp-return.ts`
- `docs/claude-mcp-li-table-return-structure.md`

## Important Rule

Do not use Land Insights AI comp numbers as DewClaw valuation.

Land Insights is source context only. DewClaw/AI logic must produce the final market value, offer range, and decision.

## Local Setup

```powershell
npm install
npm run dev
```

Open:

```text
http://localhost:3003
```

## Render

Suggested Render service name:

```text
comptool-mcp-lab
```

This lab should be deployed separately from `comptoolv2`.
