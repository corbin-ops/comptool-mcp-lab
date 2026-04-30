"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Comp Tool Error</p>
        <h1>The app needs a quick fix before it can render</h1>
        <p className="auth-copy">{error.message}</p>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </section>
    </main>
  );
}
