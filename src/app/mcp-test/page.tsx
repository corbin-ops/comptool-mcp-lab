import Link from "next/link";

import { McpTestClient } from "./mcp-test-client";

export const dynamic = "force-dynamic";

export default function McpTestPage() {
  return (
    <main className="page-shell">
      <section className="hero-panel compact-hero-panel">
        <div>
          <p className="eyebrow">Claude MCP Lab</p>
          <h1>MCP intake tester</h1>
          <p>
            Paste a Claude MCP JSON return, submit it to the lab intake endpoint, and open the
            generated visual comp dashboard.
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
