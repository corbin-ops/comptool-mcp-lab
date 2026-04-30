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
          <p className="eyebrow">Phase 2 Lab</p>
          <h1>Visual Parcel Inspector</h1>
          <p>
            Staging workflow for browser-assisted comping. Open the Land Insights comp report,
            click the extension, send the parcel into V2, then review the DewClaw + AI result.
          </p>
        </div>

        <div className="hero-actions">
          <Link className="secondary-button" href="/">
            Back to comp tool
          </Link>
        </div>
      </section>

      <VisualParcelInspectorPlayground />
    </main>
  );
}
