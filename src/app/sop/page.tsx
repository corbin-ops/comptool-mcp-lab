import Link from "next/link";

const quickRules = [
  "Fill out state, county, acreage, asking price, primary question, and known facts before generating.",
  "Do not guess missing facts. If access, flood zone, wetlands, or structures are unknown, write that they need verification.",
  "Review the decision summary tiles first: Decision, Market Value, Offer, Next Action, Top Risks, and Data Quality.",
  "If the result is wrong or partially wrong, submit the feedback form before running another test.",
  "Escalate immediately if the AI invents facts, gives unsafe confidence, or feedback does not save.",
];

const reviewChecks = [
  "Decision: Is the lead Hot, Warm, Nurture, Verify First, or Pass?",
  "Market Value: Does the value seem reasonable based on the facts provided?",
  "Offer: Is the opening offer usable for a real seller conversation?",
  "Next Action: Would a sales user know exactly what to do next?",
  "Top Risks: Did the tool catch the issues that could change pricing or decision?",
  "Data Quality: Is the output honest when important facts are missing?",
];

const ratings = [
  {
    label: "Yes",
    meaning: "The output is usable and mostly correct.",
    useWhen: "Decision, value, offer, next action, and risks are clear enough to use.",
  },
  {
    label: "Partially",
    meaning: "Some parts are useful, but something needs correction.",
    useWhen: "The direction is close, but value, offer, risk, wording, or next action needs work.",
  },
  {
    label: "No",
    meaning: "The output is wrong, unsafe, or not usable.",
    useWhen: "The AI invents facts, ignores major risk, or gives a bad business recommendation.",
  },
];

const escalationRules = [
  "The app does not load or errors.",
  "Feedback does not save.",
  "The same input returns wildly different outputs.",
  "The AI invents facts not entered by the tester.",
  "The output is too long, unclear, or not useful for a sales call.",
  "The team disagrees on the correct business decision.",
];

export default function SopPage() {
  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Testing SOP</p>
          <h1>Comp Tool live testing guide</h1>
          <p>
            Generic procedure for sales, operations, and managers testing the Comp Tool.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" href="/">
            Back to comp tool
          </Link>
          <Link className="light-button" href="/#evaluation">
            Go to evaluation
          </Link>
        </div>
      </section>

      <section className="sop-grid">
        <article className="panel sop-card">
          <p className="eyebrow">Start here</p>
          <h2>Tester responsibility</h2>
          <p className="muted-copy">
            Testers are checking whether the tool is clear, usable, and accurate enough to
            support sales and acquisitions work. Testers are not responsible for fixing bugs.
          </p>
          <ul className="flat-list">
            {quickRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>

        <article className="panel sop-card">
          <p className="eyebrow">Inputs</p>
          <h2>Required test fields</h2>
          <pre className="compact-pre">{`Mode:
Parcel Link:
State:
County:
Acreage:
Asking Price:
Primary Question:
Known Facts / Notes:`}</pre>
          <p className="muted-copy">
            Known facts should include road frontage, access, wooded vs pasture, comps,
            structures, flood zone, wetlands, terrain, seller motivation, and any issue that
            could change price.
          </p>
        </article>

        <article className="panel sop-card">
          <p className="eyebrow">Review</p>
          <h2>What to check first</h2>
          <ul className="flat-list">
            {reviewChecks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </article>

        <article className="panel sop-card">
          <p className="eyebrow">Ratings</p>
          <h2>How to judge output</h2>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rating</th>
                  <th>Meaning</th>
                  <th>Use when</th>
                </tr>
              </thead>
              <tbody>
                {ratings.map((rating) => (
                  <tr key={rating.label}>
                    <td>{rating.label}</td>
                    <td>{rating.meaning}</td>
                    <td>{rating.useWhen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel sop-card">
          <p className="eyebrow">Feedback</p>
          <h2>What good feedback looks like</h2>
          <p className="muted-copy">
            Always save feedback when the result is Partially or No. Good feedback explains what
            was wrong, what should change, and what rule the tool should remember.
          </p>
          <pre className="compact-pre">{`Was this output correct? Partially
Correct decision: Verify first
Correct market value: $74,000
Correct opening offer: $37,000
What was wrong? The decision was too confident without confirming access.
What should change? Default to Verify First if legal access is unclear.
Rule to remember next time: Missing access should block Warm Lead unless seller ask is clearly low enough.
Reviewer: Your name`}</pre>
        </article>

        <article className="panel sop-card">
          <p className="eyebrow">Escalation</p>
          <h2>When to flag it</h2>
          <ul className="flat-list">
            {escalationRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>

        <article className="panel sop-card wide-sop-card">
          <p className="eyebrow">Results</p>
          <h2>How results are collected</h2>
          <p className="muted-copy">
            Every submitted feedback form creates a testing record. After 24 hours, 3 days, or
            1 week, Jow can summarize total tests, Yes / Partially / No counts, common issues,
            wrong decision examples, bad value or offer examples, and rules corrected by Corbin.
          </p>
          <p className="muted-copy">
            For live Render testing, feedback should be stored in durable storage such as Google
            Sheets, Supabase, or a Render persistent disk before relying on the results.
          </p>
        </article>
      </section>
    </main>
  );
}
