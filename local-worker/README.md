# DewClaw CompTool Local Worker

Internal companion app for one-click CompTool visual enrichment.

The Chrome extension captures the Land Insights page first, then quietly asks this
local worker to run a deeper MCP-style visual inspection on the user's computer.
This matters because the user's computer can stay logged into Land Insights.

## Setup

Fast path for internal testing:

1. Copy `.env.example` to `.env` and fill the hosted token/API key values.
2. Double-click `Start CompTool Local Worker.cmd` from the repo root.
3. Leave the terminal open while testing.

Manual setup:

```powershell
cd "D:\Users\JOW\Documents\New project\comptool-mcp-lab\local-worker"
npm install
npm run install:browsers
Copy-Item .env.example .env
notepad .env
npm start
```

Required `.env` values:

- `COMPTOOL_BASE_URL`: hosted CompTool URL.
- `EXTENSION_INTAKE_TOKEN`: must match Render's extension token.
- `ANTHROPIC_API_KEY`: optional but recommended for vision-based JSON generation.
- `WORKER_LOGIN_WAIT_MS`: how long the worker waits on a Land Insights login screen. Default is 5 minutes.

## Internal User Flow

1. Start this worker once at the beginning of the day.
2. Keep the worker terminal open.
3. Open Land Insights and stay logged in.
4. Click the CompTool extension on a parcel/report page.
5. The dashboard opens immediately.
6. If the worker is running, the same dashboard artifact gets enhanced in the background.

## First Login

The worker uses its own Playwright browser profile. On the first run it may open a
Land Insights login page. Log in there once. The worker will wait up to 5 minutes,
then reload the parcel and continue automatically.

If login takes longer than 5 minutes, run the same parcel again after logging in.

## Health Check

```text
http://127.0.0.1:4777/health
```
