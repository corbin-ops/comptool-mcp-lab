# CompTool Consolidation Map

## Decision

Use `comptool-mcp-lab` as the consolidated CompTool codebase.

## Why This Repo Wins

- Includes the V1 manual comp engine and `/api/comp/*` routes.
- Includes the V2 Phase 2 browser-assisted dashboard and `/api/phase2/*` routes.
- Includes the Claude MCP prompt builder and MCP JSON intake endpoint.
- Includes the Chrome extension handoff flow.
- Includes the latest DewClaw comping corpus and source-priority setup.
- Has a single compile flow through `npm run compile:all`.

## Legacy Repo Treatment

| Folder | Status | Keep For |
| --- | --- | --- |
| `comp-tool` | Archived backup | Original V1 reference |
| `comp-tool-v2` | Archived backup | Old Phase 2/KML experiment history |
| `comptool-mcp-lab` | Active | All future CompTool development |

## Unified Route Map

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/phase2` |
| `/phase2` | Main visual/MCP dashboard |
| `/manual` | Manual V1-style comp dashboard |
| `/mcp-test` | Claude MCP prompt and JSON intake |
| `/sop` | User testing SOP |
| `/references` | DewClaw reference context |
| `/privacy` | Chrome Web Store privacy policy |

## Deployment Map

| Piece | Current Target |
| --- | --- |
| Web app | Render service `comptool-mcp-lab` |
| Extension intake | `https://comptool-mcp-lab.onrender.com/api/phase2/browser-intake` |
| MCP tester | `https://comptool-mcp-lab.onrender.com/mcp-test` |
| Extension package | `dist/comptoolv2-extension-*.zip` |

## Cutover Guardrails

- Do not delete the old folders until Corbin has tested the unified app.
- Do not point the Chrome extension back to `comptoolv2.onrender.com`.
- Do not promote the unified app as stable until several real comps are saved and reviewed.
- Move feedback/artifact storage to persistent storage before relying on it for long-term training.
