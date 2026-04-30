import Link from "next/link";

const referenceSections = [
  {
    id: "decision",
    title: "Decision",
    bullets: [
      "Hot lead: seller ask and property quality support immediate pursuit.",
      "Warm lead: workable, but needs negotiation or verification.",
      "Nurture: not ready now, but worth follow-up.",
      "Verify first: value may be there, but missing facts could materially change the number.",
      "Pass: pricing, risk, or missing upside does not justify time.",
    ],
  },
  {
    id: "market-value",
    title: "Market Value",
    bullets: [
      "Market value should be a specific number when the data supports it.",
      "Price per acre should be explained through acreage, county, land type, and comp logic.",
      "Low confidence means the number is preliminary, not final offer authority.",
      "Data quality grade reflects how complete the comp inputs are.",
    ],
  },
  {
    id: "offer",
    title: "Offer",
    bullets: [
      "Opening offer is the first practical number to say or send.",
      "Target offer is the preferred acquisition price.",
      "Max offer is the ceiling before escalation.",
      "Walk-away price is the point where the deal likely stops making sense.",
      "Script angle gives the caller the simplest negotiation framing.",
    ],
  },
  {
    id: "others",
    title: "Others",
    bullets: [
      "Follow Up Boss note is meant to be pasted into the CRM.",
      "Call prep tells the caller what to confirm first.",
      "Verification checklist is the analyst's next work queue.",
      "Warnings usually mean the output depends on missing or weak data.",
      "Parcel-link parsing is best effort only unless Land Insights provides supported integration access.",
    ],
  },
];

export default function ReferencesPage() {
  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">References</p>
          <h1>Comp output guide</h1>
          <p>Short definitions for the dashboard sections and how the team should read them.</p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" href="/">
            Back to comp tool
          </Link>
        </div>
      </section>

      <section className="reference-grid">
        {referenceSections.map((section) => (
          <article key={section.id} id={section.id} className="panel reference-card">
            <p className="eyebrow">{section.id.replace("-", " ")}</p>
            <h2>{section.title}</h2>
            <ul className="flat-list">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
