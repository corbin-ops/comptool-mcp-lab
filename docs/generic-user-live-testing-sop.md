# Comp Tool Live Testing SOP for Users

## Purpose

This SOP explains how testers should use the Comp Tool during live testing and how to leave useful feedback.

The goal is to test whether the tool is clear, useful, and accurate enough to support sales and acquisitions work.

## Who Should Use This

This SOP is for any assigned tester, including:

- Sales users
- Lead managers
- Acquisition support
- Operations team members
- Managers reviewing output quality

## What Testers Are Responsible For

Testers should check:

- Whether the output is easy to understand.
- Whether the decision makes sense.
- Whether the market value and offer range seem usable.
- Whether the immediate next action is clear.
- Whether the top risks are accurate.
- Whether anything is missing, confusing, or wrong.

Testers are not responsible for fixing bugs or changing the tool.

## Before You Start

Confirm these items before testing:

- You have the Comp Tool link.
- You can log in.
- You know how many properties you are assigned to test.
- You know whether you are testing live AI output or sample output.
- You have enough property notes to test properly.
- You know where the feedback section is.

## Required Input Fields

Fill out as much as possible.

```text
Mode:
Parcel Link:
State:
County:
Acreage:
Asking Price:
Primary Question:
Known Facts / Notes:
```

Known Facts / Notes should include anything you already know about:

- Road frontage
- Access
- Wooded, pasture, cleared, or mixed land
- Nearby comps
- Structures or improvements
- Flood zone
- Wetlands
- Slope or terrain
- Seller motivation
- Any issue that may change price or offer strategy

If you do not know something, do not guess. Leave it out or write that it needs verification.

## Testing Steps

1. Open the Comp Tool.
2. Select the correct mode.
3. Enter the parcel link if available.
4. Select the state.
5. Select the county.
6. Enter acreage.
7. Enter asking price.
8. Add the primary question.
9. Add known facts and notes.
10. Generate the comp.
11. Review the decision summary tiles first.
12. Review the details only if needed.
13. Save feedback after reviewing the output.

## What To Review First

Focus on the one-glance decision summary:

- Decision
- Market Value
- Offer
- Next Action
- Top Risks
- Data Quality

If the summary is not clear within 30 seconds, mark that in feedback.

## How To Judge The Output

Use this simple rating:

| Rating | Meaning |
| --- | --- |
| Yes | The output is usable and mostly correct. |
| Partially | Some parts are useful, but something needs correction. |
| No | The output is wrong, unsafe, or not usable. |

## When To Mark "Yes"

Mark `Yes` when:

- The decision makes sense.
- Market value seems reasonable.
- Offer range is usable.
- Next action is clear.
- Risks are reasonable.
- No major facts appear invented.

## When To Mark "Partially"

Mark `Partially` when:

- The decision is close but not perfect.
- The value or offer may need adjustment.
- The output missed one important risk.
- The wording is confusing.
- The next action is too vague.

## When To Mark "No"

Mark `No` when:

- The AI invents facts.
- The decision is clearly wrong.
- The offer range is not usable.
- The output ignores obvious risk.
- The tool gives a confident answer even though important facts are missing.
- The output would cause a bad call, bad offer, or bad business decision.

## Feedback Rules

Always save feedback when the result is `Partially` or `No`.

For good results, feedback is optional but helpful.

Useful feedback should answer:

- What was wrong?
- What should the tool have said?
- What rule should it remember next time?

Bad feedback:

```text
This is wrong.
```

Good feedback:

```text
It marked this as Warm Lead, but access was not verified. It should be Verify First until road frontage or legal access is confirmed.
```

## Feedback Form Example

```text
Was this output correct? Partially
Correct decision: Verify first
Correct market value: $74,000
Correct opening offer: $37,000
What was wrong? The decision was too confident without confirming access.
What should change? Default to Verify First if legal access is unclear.
Rule to remember next time: Missing access should block Warm Lead unless seller ask is clearly low enough to justify deeper review.
Reviewer: Your name
```

## What Not To Do

- Do not test the same property repeatedly unless asked.
- Do not guess missing facts.
- Do not use the output as final truth if data quality is low.
- Do not ignore major risk just because the decision tile looks good.
- Do not send feedback only in Slack if the feedback form is available.

## When To Escalate

Tell Jow or Alerie if:

- The app does not load.
- The tool errors.
- Feedback does not save.
- The result changes wildly for the same input.
- The AI invents facts.
- The output is too long or hard to use.

Tell Corbin or a manager if:

- You disagree with the business decision.
- You are unsure what the correct offer should be.
- The property has unusual value-add, access, or subdivision issues.

## Testing Summary To Send After Your Session

Post this in Slack after testing:

```text
Comp Tool Testing Summary

Tester:
Date:
Number of properties tested:
Number marked Yes:
Number marked Partially:
Number marked No:

Biggest issue found:

Most useful part of the tool:

Recommended improvement:
```

## How Jow Gets Testing Results Later

Every saved feedback form creates a testing record. After the testing window ends, Jow should pull the saved records and summarize:

- Number of tests completed
- Number of `Yes`, `Partially`, and `No` ratings
- Common issues
- Common missing facts
- Wrong decision examples
- Bad value or offer examples
- Rules Corbin corrected
- Highest-priority fixes

Recommended reporting windows:

- After 24 hours for first smoke test results.
- After 3 days for early pattern review.
- After 1 week for launch-readiness review.

## Current Result Collection Method

Current feedback is saved as JSON files in:

```text
data/feedback
```

This works for local testing. For Render/live testing, feedback must be stored somewhere durable before relying on it.

Recommended durable options:

- Best simple option: save feedback to Google Sheets.
- Best product option: save feedback to Supabase or another database.
- Temporary Render option: use a Render persistent disk.

## Recommended Next Improvement

Add an internal `Testing Results` page for Jow and Alerie.

That page should show:

- Date range filter
- Tester filter
- Rating filter
- Total tests
- Yes / Partially / No counts
- Common issues
- Export CSV button
- Links to original comp artifacts

This avoids manually opening JSON files after every testing cycle.
