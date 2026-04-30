# Dew Claw Phase 2 Extractor

This Chrome extension is the current MVP for the Phase 2 browser-assisted comp workflow.

## What it does

1. Runs on a logged-in `app.landinsights.com` or `app.landinsights.co` parcel page or comp report
2. Extracts structured parcel fields from the Land Insights page
3. Extracts comparable rows and visible Redfin/Zillow/Realtor links from the comp table
4. Detects the Land Insights **Comp Report** button/link when available
5. Captures the Land Insights **KML** export when available
6. Posts that payload to CompTool V2 at `https://comptoolv2.onrender.com/api/phase2/browser-intake`
7. The local app converts the capture into a CompTool V1 evaluation request
8. Shows a loading page while the comp runs
9. The existing V1 DewClaw algorithm runs local retrieval plus the configured AI model
10. Opens the saved result in `https://comptoolv2.onrender.com/phase2?artifact=...`

## Current limitations

- Visual inspection is still heuristic. The final comp evaluation now uses the existing CompTool V1 engine.
- The extractor is now DOM-based, but it still depends on Land Insights page structure staying similar.
- KML capture works best when Land Insights provides either a direct KML link or a browser-generated KML blob from the KML button.
- If Land Insights changes the KML button implementation, the extension will still send parcel fields and diagnostics, but KML may require another capture fallback.
- This MVP still does not inspect map pixels or listing photos directly.
- The app URL is hardcoded to `https://comptoolv2.onrender.com` in `background.js`.
- The hosted intake token in `background.js` must match `EXTENSION_INTAKE_TOKEN` in Render.
- The extension is intended for internal Dew Claw testing against hosted CompTool V2.
- The Chrome Web Store privacy policy URL is `https://comptoolv2.onrender.com/privacy`.

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

   - open the hosted loading page
   - extract parcel fields
   - extract comparable rows
   - send them to hosted CompTool V2

5. A new tab should open at:

   `https://comptoolv2.onrender.com/phase2?artifact=<id>`

6. Review the V1 dashboard result and loaded browser capture in the Phase 2 lab

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
4. The V2 bridge sends the captured payload through the CompTool V1 DewClaw + AI algorithm
5. Review the dashboard result
