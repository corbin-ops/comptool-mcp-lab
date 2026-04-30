# Claude Co-Work Instructions: DewClaw Comp Tool v2

Use this as the handoff context for continuing development with Claude or another AI coding assistant.

## Current Project

- Project: DewClaw Comp Tool v2
- Local path: `C:\Users\JOW\Documents\New project\comp-tool-v2`
- Alternate synced copy may exist at: `D:\Users\JOW\Documents\New project\comp-tool-v2`
- GitHub repo: `https://github.com/corbin-ops/comptoolv2`
- Current local branch: `codex/local-preview`
- Production branch: `main`
- Important: Do not push or deploy unless Jow explicitly asks.

## Product Goal

Build a land comping tool for DewClaw that helps Corbin, Marie, Emma, and future acquisition managers evaluate rural/off-market land leads faster.

The tool should:

- Take Land Insights parcel data captured from the browser extension.
- Use DewClaw logic and AI to produce a simple comp decision.
- Keep output short, practical, and easy to read at a glance.
- Let Corbin review outputs and submit feedback so the system can improve over time.

## What Changed From the Original Plan

Land Insights confirmed they do not provide API access, developer access, webhooks, or private integrations.

Because of that:

- Do not build around a Land Insights API.
- Do not assume a parcel URL alone can reliably provide all property data.
- The current practical path is browser-extension-assisted capture from the open Land Insights comp report.
- Claude MCP/browser visual navigation is a possible future Phase 2/Phase 3 direction, but it is currently on hold.

## Current Workflow

Target user flow:

1. User opens the Land Insights comp report.
2. User clicks the Chrome extension.
3. Extension captures visible property/report data from the page.
4. Extension sends captured data to the Comp Tool v2 dashboard.
5. Dashboard computes a DewClaw-style comp using AI.
6. User reviews the result and submits feedback/evaluation.

## Current AI/Business Rules

Very important rule from Corbin:

- Never use Land Insights numbers as the actual comp valuation.
- Land Insights data is source context only.
- Market value, offer range, and decision must come from DewClaw logic and AI reasoning.

Corbin wants the output to focus on:

- Decision: `Hot lead`, `Warm lead`, `Nurture`, `Verify first`, or `Pass`
- One-line decision summary
- Market value
- Offer range, clearly framed as 50% to 70%
- Immediate next action
- Top risks
- Short bullet explanations, not long essays

## Current Phase Status

What is already built:

- Next.js app for Comp Tool v2.
- `/phase2` browser intake dashboard.
- Chrome extension workflow started and published unlisted in Chrome Web Store.
- Browser intake artifacts are saved locally under `data/phase2-browser-intake`.
- Feedback/evaluation saves locally through the feedback API.
- Claude/Anthropic API integration is already set up.
- MCP context intake scaffold exists locally, but it is paused.

Important local-only commit:

- `cb83891 Start phase2 MCP context intake`

Do not continue MCP unless Jow says so.

## Immediate Next Task

Jow asked to improve the output dashboard before deployment.

Implement these UI changes:

1. Remove the large detailed cards titled `LI CompResults` and `DewClaw CompResults`.
2. Replace that area with a larger `Feedback Evaluation` section.
3. Make the feedback field big enough that Corbin does not need to scroll inside a tiny box.
4. Add a testing progress bar showing how many comps Corbin has conducted.
5. Use `1000 comps` as the testing-phase goal.
6. Exclude Jow/local test records as much as possible from the count.

Recommended implementation:

- Keep the top decision/dashboard summary visible.
- Move the feedback form into a wide full-width section below the main result summary.
- Add a progress card near the feedback section:
  - Example: `Corbin testing progress: 16 / 1000 comps`
  - Show a horizontal progress bar.
  - Show excluded local/test artifacts if possible.

## Suggested Files to Inspect

- `src/phase2/playground.tsx`
- `src/app/globals.css`
- `src/app/api/comp/feedback/route.ts`
- `src/app/api/phase2/browser-intake/[id]/route.ts`
- `src/phase2/types.ts`

Likely code area to remove/replace in `src/phase2/playground.tsx`:

```tsx
<section className="phase2-detail-columns" aria-label="Detailed comp result cards">
  <LandInsightsCompResults result={result} artifactMeta={artifactMeta} />

  <CompToolV1Output
    result={compEvaluation}
    status={compEvaluationStatus}
    error={compEvaluationError}
    fields={result.structuredFields}
  />
</section>
```

Replace with something like:

```tsx
<TestingProgressCard progress={testingProgress} />
<WideFeedbackEvaluation result={compEvaluation} artifactId={artifactMeta?.id} />
```

## Testing Progress Count

Recommended local API:

- Add route: `src/app/api/phase2/testing-progress/route.ts`
- Read files from: `data/phase2-browser-intake`
- Count valid comp artifacts.
- Exclude obvious local/test files:
  - `local-ui-test`
  - `localhost`
  - `example.com`
  - `sample`

Note:

- True IP-based exclusion is not reliable unless the app starts saving tester identity or request metadata going forward.
- For now, local artifact filtering is acceptable for the testing-phase progress visualization.

## Feedback Storage Warning

Current feedback/evaluation storage is local file-based.

That means:

- On local machine: feedback saves locally.
- On Render: files may be ephemeral depending on service/storage configuration.
- For real remote-user testing, Google Sheets or a database is safer.

Google Sheets direction was discussed but not fully implemented yet.

## Development Rules

Please follow these rules:

- Do not touch production `main` unless instructed.
- Keep v1/live production safe.
- Work on `codex/local-preview` or another feature branch.
- Do not push unless Jow asks.
- Do not remove the MCP scaffold unless asked; just leave it unused.
- Use small, focused patches.
- Run local checks before handoff:
  - `npm run typecheck` if available
  - `npm run build` if practical
- If `next-env.d.ts` changes to reference `.next/dev/types/routes.d.ts`, restore it before committing.

## Communication Style For Jow

Jow prefers:

- Short, clear explanations.
- Practical next steps.
- No overcomplicated theory unless needed.
- Tell him what changed, where to test, and whether it is safe to deploy.

When giving status updates, say things like:

- "This is local only, not pushed yet."
- "This keeps production safe."
- "You can test at `/phase2`."
- "If the UI feels right, next step is pushing to GitHub and redeploying Render."

## Copy-Paste Prompt For Claude

Use this prompt when starting Claude:

```text
You are co-working on the DewClaw Comp Tool v2 Next.js project.

Current repo path:
C:\Users\JOW\Documents\New project\comp-tool-v2

Current branch:
codex/local-preview

Do not push, deploy, or touch production unless Jow explicitly asks.

The current priority is to improve the Phase 2 output dashboard:
1. Remove the large detailed LI CompResults and DewClaw CompResults cards.
2. Replace that area with a larger Feedback Evaluation section.
3. Make the feedback textarea large enough for long Corbin reviews.
4. Add a progress bar showing Corbin testing progress toward 1000 comps.
5. Count local browser-intake artifacts from data/phase2-browser-intake and exclude obvious local/test artifacts.

Important business rule:
Never use Land Insights comp numbers as valuation. Land Insights data is source context only. DewClaw/AI logic must produce market value, offer range, and decision.

MCP/browser visual navigation work exists as a scaffold but is currently on hold. Do not continue MCP unless Jow asks.

Start by inspecting:
- src/phase2/playground.tsx
- src/app/globals.css
- src/app/api/comp/feedback/route.ts
- src/app/api/phase2/browser-intake/[id]/route.ts

Keep the change local and focused. After editing, run typecheck/build if available and summarize exactly what changed.
```

