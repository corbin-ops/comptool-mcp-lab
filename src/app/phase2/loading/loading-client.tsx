"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { VisualBrowserIntakeArtifact } from "@/phase2/types";

type LoadingClientProps = {
  artifactId: string;
  source: string;
};

function getStatusText(artifact: VisualBrowserIntakeArtifact | null, seconds: number) {
  if (!artifact) {
    return "Starting capture...";
  }

  if (artifact.compEvaluationStatus === "pending") {
    return seconds > 20
      ? "Opening the dashboard while DewClaw finishes in the background..."
      : "Parcel captured. Opening dashboard...";
  }

  if (artifact.compEvaluationStatus === "failed") {
    return "Comp generation finished with an error. Opening the result page...";
  }

  return "Comp result is ready. Opening dashboard...";
}

function parseDateMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatElapsedTime(ms: number | null) {
  if (ms === null || ms < 0) {
    return "not tracked";
  }

  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function getTimingText(artifact: VisualBrowserIntakeArtifact | null) {
  if (!artifact) {
    return "";
  }

  const startedAt =
    parseDateMs(artifact.compEvaluationStartedAt) ??
    (artifact.compEvaluationStatus === "pending" ? parseDateMs(artifact.createdAt) : null);
  const completedAt = parseDateMs(artifact.compEvaluationCompletedAt);

  if (!startedAt) {
    return "AI time: not tracked";
  }

  if (artifact.compEvaluationStatus === "pending" && !completedAt) {
    return `AI running: ${formatElapsedTime(Date.now() - startedAt)}`;
  }

  return `AI time: ${formatElapsedTime((completedAt ?? Date.now()) - startedAt)}`;
}

export function Phase2LoadingClient({ artifactId, source }: LoadingClientProps) {
  const [artifact, setArtifact] = useState<VisualBrowserIntakeArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!artifactId) {
      return;
    }

    let isActive = true;

    async function loadArtifact() {
      try {
        const response = await fetch(`/api/phase2/browser-intake/${artifactId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Waiting for the browser capture artifact...");
        }

        const payload = (await response.json()) as VisualBrowserIntakeArtifact;

        if (!isActive) {
          return;
        }

        setArtifact(payload);
        setError(null);

        window.location.assign(`/phase2?artifact=${encodeURIComponent(artifactId)}`);
      } catch (caughtError) {
        if (!isActive) {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : "Still waiting...");
      }
    }

    void loadArtifact();
    const interval = window.setInterval(() => {
      void loadArtifact();
    }, 3000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [artifactId]);

  const statusText = getStatusText(artifact, seconds);
  const shownSource = useMemo(() => {
    if (source) {
      return source;
    }

    return artifact?.request.browserPage?.sourceUrl || artifact?.request.parcelLink || "";
  }, [artifact, source]);

  return (
    <section className="phase2-loading-panel" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />

      <p className="eyebrow">CompTool V2</p>
      <h1>Preparing comp result</h1>
      <p>
        Capturing the Land Insights parcel first. The dashboard opens as soon as the capture is
        ready, while the DewClaw AI result keeps generating in the background.
      </p>

      <div className="loading-steps" aria-label="Comp generation progress">
        <span className={artifact ? "is-complete" : ""}>Parcel captured</span>
        <span className={artifact ? "is-complete" : ""}>Building V1 request</span>
        <span className={artifact?.compEvaluationStatus === "pending" ? "is-active" : ""}>
          DewClaw AI running
        </span>
      </div>

      <p className="loading-status">{statusText}</p>
      {artifact ? <p className="auth-note">{getTimingText(artifact)}</p> : null}
      {error ? <p className="auth-note">{error}</p> : null}
      {artifact?.compEvaluationError ? (
        <p className="auth-error">{artifact.compEvaluationError}</p>
      ) : null}
      {shownSource ? <p className="muted-copy loading-source">Source: {shownSource}</p> : null}
      {artifactId ? <p className="muted-copy">Artifact: {artifactId}</p> : null}

      <div className="hero-actions loading-actions">
        {artifactId ? (
          <Link className="secondary-button" href={`/phase2?artifact=${encodeURIComponent(artifactId)}`}>
            Open current result
          </Link>
        ) : null}
        <Link className="light-button" href="/phase2">
          Open dashboard
        </Link>
      </div>
    </section>
  );
}
