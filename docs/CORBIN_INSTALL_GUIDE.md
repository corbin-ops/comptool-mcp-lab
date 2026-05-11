# DewClaw CompTool Internal Install Guide

This installs the local helper app that lets the Chrome extension enrich CompTool results from Corbin's logged-in Land Insights session.

## Install Once

1. Unzip `DewClaw-CompTool-Internal-Installer.zip`.
2. Double-click `Install CompTool Local Worker.cmd`.
3. If Windows asks for permission, allow it.
4. If prompted for a Claude/Anthropic API key, paste it. If you do not have one yet, press Enter and skip.
5. Wait until the installer says `Install complete`.

The installer creates a desktop shortcut named:

```text
Start DewClaw CompTool Worker
```

## Daily Use

1. Double-click `Start DewClaw CompTool Worker`.
2. Keep the terminal window open.
3. Open Chrome and stay logged into Land Insights.
4. Open a Land Insights parcel or comp report.
5. Click the DewClaw CompTool Chrome extension.
6. The dashboard opens immediately.
7. If the local worker is running, the same dashboard result updates in the background with deeper evidence.

## First Land Insights Login

The worker uses a separate browser profile from normal Chrome. On the first run,
it may open Land Insights and ask for login.

If that happens:

1. Log into Land Insights in the worker browser window.
2. Do not close the worker terminal.
3. The worker will wait up to 5 minutes, reload the parcel, and continue.
4. If it times out, click the CompTool extension on the parcel again after login.

## Confirm It Is Running

Open this URL:

```text
http://127.0.0.1:4777/health
```

If it shows `"ok": true`, the worker is running.

## Chrome Extension

Use the published unlisted Chrome Web Store extension when available.

For local testing only:

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click Load Unpacked.
4. Select the `extension` folder from the unzipped package.

## Notes

- The hosted dashboard still opens even if the worker is not running.
- The local worker needs the user's logged-in Land Insights session to inspect pages that require login.
- The first version automates the handoff and visual enrichment foundation. The deeper MLS photo clicking workflow will be added on top of this local worker.
