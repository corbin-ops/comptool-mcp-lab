import { Phase2LoadingClient } from "@/app/phase2/loading/loading-client";

export const dynamic = "force-dynamic";

type Phase2LoadingPageProps = {
  searchParams?: Promise<{
    artifact?: string;
    source?: string;
  }>;
};

export default async function Phase2LoadingPage({ searchParams }: Phase2LoadingPageProps) {
  const params = await searchParams;
  const artifactId = params?.artifact?.trim() || "";
  const source = params?.source?.trim() || "";

  return (
    <main className="phase2-loading-shell">
      <Phase2LoadingClient artifactId={artifactId} source={source} />
    </main>
  );
}
