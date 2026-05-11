# Dew Claw Phase 2 Extractor

This Chrome extension is the current MVP for the browser-assisted CompTool workflow.

## What it does

1. Runs on a logged-in `app.landinsights.com` or `app.landinsights.co` parcel page or comp report
2. Extracts structured parcel fields from the Land Insights page
3. Extracts comparable rows and visible Redfin/Zillow/Realtor links from the comp table
4. Detects the Land Insights **Comp Report** button/link when available
5. Captures the Land Insights **KML** export when available
6. Posts that payload to CompTool MCP Lab at `https://comptool-mcp-lab.onrender.com/api/phase2/browser-intake`
7. The app saves a preliminary browser-capture artifact and queues the DewClaw evaluation
8. Opens the dashboard result for the sales user
9. If deeper visual review is needed, an analyst can use the dashboard's MCP enrichment button
10. The final dashboard uses the browser capture, optional MCP visual evidence, and the DewClaw corpus

## Current limitations

- Visual inspection is still heuristic. The final comp evaluation now uses the existing CompTool V1 engine.
- The extractor is now DOM-based, but it still depends on Land Insights page structure staying similar.
- KML capture works best when Land Insights provides either a direct KML link or a browser-generated KML blob from the KML button.
- If Land Insights changes the KML button implementation, the extension will still send parcel fields and diagnostics, but KML may require another capture fallback.
- The extension itself still does not inspect map pixels or listing photos directly; it opens the dashboard first, and MCP enrichment remains an analyst/admin step when deeper visual inspection is needed.
- The app URL is hardcoded to `https://comptool-mcp-lab.onrender.com` in `background.js`.
- The hosted intake token in `background.js` must match `EXTENSION_INTAKE_TOKEN` in Render.
- The extension is intended for internal Dew Claw testing against the unified CompTool MCP app.
- The Chrome Web Store privacy policy URL is `https://comptool-mcp-lab.onrender.com/privacy`.

## How to load it in Chrome for local testing

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder:

   `D:\Users\JOW\Documents\New project\comptool-mcp-lab\extension`

## How to test it

1. Start the local app:

   ```bash
   cd "D:\Users\JOW\Documents\New project\comptool-mcp-lab"
   npm run dev
   ```

2. Open a logged-in Land Insights parcel comp report in Chrome
3. Click the extension icon
4. The extension should:

   - extract parcel fields
   - extract comparable rows
   - send them to the hosted CompTool MCP app
   - open the hosted dashboard result

5. A new tab should open at:

   `https://comptool-mcp-lab.onrender.com/phase2/loading?artifact=<id>&source=<url>`

6. Review the dashboard result. Use **Improve with Claude MCP** only when deeper visual inspection is needed.

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
4. The dashboard opens with the preliminary DewClaw result
5. If needed, an analyst clicks **Improve with Claude MCP**
6. Claude MCP inspects Land Insights map layers, MLS comps, and photos, then the analyst submits the JSON back into the dashboard workflow
