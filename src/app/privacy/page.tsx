import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Dew Claw CompTool Capture",
  description: "Privacy policy for the Dew Claw CompTool Capture Chrome extension.",
};

const collectedItems = [
  "The current Land Insights parcel or comp-report URL.",
  "Visible parcel facts, field labels, comparable rows, listing links, page title, and timestamp from the active browser tab.",
  "Property, owner, contact, and transaction details only when those details are already visible on the Land Insights page being captured.",
  "Optional parcel support data attached or generated inside CompTool V2, such as KML boundary details, diagnostics, and comp evaluation output.",
];

const usageItems = [
  "Build an internal land-comp report for Dew Claw sales and acquisitions work.",
  "Show a loading page and final dashboard result in CompTool V2.",
  "Debug extraction accuracy, comparable-row parsing, and AI comp output during internal testing.",
  "Improve the comp workflow using team review and saved artifacts.",
];

const limitItems = [
  "We do not sell extension data.",
  "We do not use extension data for advertising or unrelated user profiling.",
  "We do not collect data from pages outside the allowed Land Insights hosts.",
  "We do not request Google account data or use Google APIs for this extension workflow.",
  "We use extension data only to provide or improve the CompTool V2 parcel-comp workflow and handle it according to the Chrome Web Store User Data Policy, including Limited Use requirements.",
];

export default function PrivacyPage() {
  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Privacy policy</p>
          <h1>Dew Claw CompTool Capture</h1>
          <p>
            Last updated April 28, 2026. This policy covers the Chrome extension
            that sends Land Insights parcel data into CompTool V2.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" href="/">
            Back to comp tool
          </Link>
        </div>
      </section>

      <section className="sop-grid">
        <article className="panel sop-card">
          <p className="eyebrow">What we collect</p>
          <h2>Captured page data</h2>
          <ul className="flat-list">
            {collectedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel sop-card">
          <p className="eyebrow">How we use it</p>
          <h2>Internal comp review</h2>
          <ul className="flat-list">
            {usageItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel sop-card">
          <p className="eyebrow">Limits</p>
          <h2>Data use boundaries</h2>
          <ul className="flat-list">
            {limitItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel sop-card">
          <p className="eyebrow">Storage</p>
          <h2>Security and access</h2>
          <p className="muted-copy">
            Captured data is sent over HTTPS to the hosted CompTool V2 app. The app
            is password protected and intended for authorized Dew Claw users only.
            Saved artifacts may remain in application storage for review, debugging,
            quality control, and future workflow improvement.
          </p>
          <p className="muted-copy">
            For access, correction, deletion, or privacy questions, contact the Dew
            Claw operations owner who manages the CompTool V2 deployment.
          </p>
        </article>
      </section>
    </main>
  );
}
