import { CompToolPlayground } from "@/comp-tool/playground";
import Link from "next/link";

export function CompToolPageShell() {
  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Dew Claw Comp Tool</p>
          <h1>Comp dashboard</h1>
          <p>
            Short operator-facing output: decision, market value, offer, and next checks.
          </p>
        </div>

        <div className="hero-actions">
          <Link className="secondary-button" href="/phase2">
            Phase 2 Lab
          </Link>
          <Link className="secondary-button" href="/sop" target="_blank" rel="noreferrer">
            SOP
          </Link>
          <Link className="light-button" href="#evaluation">
            Evaluation
          </Link>
          <Link className="secondary-button" href="/references">
            References
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="secondary-button" type="submit">
              Log out
            </button>
          </form>
        </div>
      </section>

      <CompToolPlayground />
    </main>
  );
}
