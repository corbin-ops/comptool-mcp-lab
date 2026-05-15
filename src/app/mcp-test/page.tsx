import Link from "next/link";

import { McpTestClient } from "./mcp-test-client";

export const dynamic = "force-dynamic";

export default function McpTestPage() {
  return (
    <main className="page-shell">
      <section className="hero-panel compact-hero-panel">
        <div>
          <p className="eyebrow">Guided Claude Capture</p>
          <h1>Claude handoff + JSON intake</h1>
          <p>
            Copy the prepared prompt into Claude in Chrome, paste Claude&apos;s raw JSON return
            here, and let CompTool generate the DewClaw result.
          </p>
        </div>

        <div className="hero-actions">
          <Link className="secondary-button" href="/manual">
            Manual comp
          </Link>
          <Link className="secondary-button" href="/phase2">
            Dashboard
          </Link>
        </div>
      </section>

      <McpTestClient />
    </main>
  );
}
