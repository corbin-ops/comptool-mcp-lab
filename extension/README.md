# Dew Claw Phase 2 Extractor

This Chrome extension is the current MVP for the Phase 2 browser-assisted comp workflow.

## What it does

1. Runs on a logged-in `app.landinsights.com` or `app.landinsights.co` parcel page or comp report
2. Extracts structured parcel fields from the Land Insights page
3. Extracts comparable rows and visible Redfin/Zillow/Realtor links from the comp table
4. Detects the Land Insights **Comp Report** button/link when available
5. Captures the Land Insights **KML** export when available
6. Posts that payload to CompTool MCP Lab at `https://comptool-mcp-lab.onrender.com/api/phase2/browser-intake`
7. The app saves a preliminary browser-capture artifact and queues the DewClaw evaluation
8. Opens the MCP tester with the parcel link already inserted into the Claude MCP prompt
9. User pastes that prompt into Claude MCP, lets Claude inspect Land Insights MLS comps/photos, then submits the returned JSON
10. The final dashboard uses the MCP visual evidence plus the DewClaw corpus

## Current limitations

- Visual inspection is still heuristic. The final comp evaluation now uses the existing CompTool V1 engine.
- The extractor is now DOM-based, but it still depends on Land Insights page structure staying similar.
- KML capture works best when Land Insights provides either a direct KML link or a browser-generated KML blob from the KML button.
- If Land Insights changes the KML button implementation, the extension will still send parcel fields and diagnostics, but KML may require another capture fallback.
- The extension itself still does not inspect map pixels or listing photos directly; it prepares the Claude MCP handoff that performs the deeper visual inspection.
- The app URL is hardcoded to `https://comptool-mcp-lab.onrender.com` in `background.js`.
- The hosted intake token in `background.js` must match `EXTENSION_INTAKE_TOKEN` in Render.
- The extension is intended for internal Dew Claw testing against hosted CompTool V2.
- The Chrome Web Store privacy policy URL is `https://comptool-mcp-lab.onrender.com/privacy`.

## How to load it in Chrome for local testing

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder:

   `/Users/jj/Documents/New project/comp-tool-v2/extension`

## How to test it

1. Start the local app:

   ```bash
   cd "/Users/jj/Documents/New project/comp-tool-v2"
   ./scripts/dev-local.sh
   ```

2. Open a logged-in Land Insights parcel comp report in Chrome
3. Click the extension icon
4. The extension should:

   - extract parcel fields
   - extract comparable rows
   - send them to hosted CompTool V2
   - open the hosted MCP tester with the parcel link already inserted

5. A new tab should open at:

   `https://comptool-mcp-lab.onrender.com/mcp-test?parcelLink=<url>&artifact=<id>`

6. Copy the prepared prompt into Claude MCP, paste the returned JSON into the MCP tester, then review the dashboard result

## How to package it for Chrome Web Store upload

From the repo root, run:

```bash
npm run build:extension
```

Upload the generated zip from `dist/` in the Chrome Web Store Developer Dashboard.
Use **Unlisted** for the first sales-team rollout unless the team explicitly wants a
public listing.

## Agreed user workflow

1. Open the Land Insights parcel page or comp report
2. Click the extension
3. CompTool extracts the Comp Report link, KML, parcel fields, and comp rows
4. The MCP tester opens with a ready-to-copy Claude MCP prompt
5. Claude MCP inspects Land Insights map layers, MLS comps, and photos, then returns JSON
6. Paste JSON into the MCP tester and review the DewClaw dashboard result
