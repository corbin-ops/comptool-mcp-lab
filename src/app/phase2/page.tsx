import Link from "next/link";

import { VisualParcelInspectorPlayground } from "@/phase2/playground";

export const dynamic = "force-dynamic";

type Phase2PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Phase2Page({ searchParams }: Phase2PageProps) {
  const params = await searchParams;
  const artifact = params?.artifact;
  const hasArtifact = typeof artifact === "string" && Boolean(artifact.trim());

  return (
    <main className="page-shell">
      <section className={`hero-panel${hasArtifact ? " compact-hero-panel" : ""}`}>
        <div>
          <p className="eyebrow">Claude MCP Lab</p>
          <h1>Visual comp dashboard</h1>
          <p>
            Experimental dashboard for Land Insights visual review, MCP-style source capture,
            and DewClaw comp reasoning without touching the active V2 testing app.
          </p>
        </div>

        <div className="hero-actions">
          <Link className="secondary-button" href="/sop" target="_blank" rel="noreferrer">
            SOP
          </Link>
        </div>
      </section>

      <VisualParcelInspectorPlayground />
    </main>
  );
}
