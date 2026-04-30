# Comp Tool Testing SOP

## Purpose

This SOP explains how Corbin and the sales team should test the Comp Tool without wasting AI tokens, while still giving Jow and Alerie useful feedback to improve the tool.

The goal is not to prove the tool is perfect. The goal is to find where it is wrong, unclear, too slow, or hard for sales users to trust.

## Scope

This SOP applies to:

- Corbin testing the tool as the final decision maker.
- Sales users testing the tool for call prep and offer guidance.
- Jow and Alerie collecting feedback, bugs, and training examples.

This SOP does not cover full production rollout, Follow Up Boss automation, or Land Insights API integration.

## Testing Modes

Use the cheapest testing mode possible for the question being tested.

| Mode | Uses AI tokens? | Who should use it | Purpose |
| --- | --- | --- | --- |
| Mock / Replay testing | No | Corbin, sales users, Jow, Alerie | Test layout, output clarity, feedback form, and workflow. |
| Prompt preview testing | No | Jow, Alerie, Corbin if needed | Check whether the tool is sending the right context to Claude. |
| Real AI testing | Yes | Corbin, Jow, Alerie only | Validate actual pricing, decision quality, and output accuracy. |

## Roles

### Corbin

Corbin should focus on business judgment:

- Is the decision right?
- Is the market value reasonable?
- Is the offer range usable?
- Would Marie, Emma, or a future AM know what to do next?
- What rule should the AI remember next time?

Corbin should not spend time debugging technical issues. If something breaks, screenshot it and send it to Jow/Alerie.

### Sales Users

Sales users should focus on usability:

- Is the result easy to understand before a call?
- Is the next action clear?
- Are the risks easy to explain to a seller?
- Is anything confusing, too long, or missing?

Sales users should not override business logic unless Corbin has trained them on that scenario.

### Jow / Alerie

Jow and Alerie should focus on system quality:

- Did the form capture the right inputs?
- Did the output follow the expected format?
- Did the AI hallucinate facts?
- Did the feedback save correctly?
- Did the tool produce consistent results across similar properties?

## Testing Rules

- Do not use Real AI mode for UI testing.
- Do not run the same property repeatedly with Real AI unless you are comparing a specific prompt or model change.
- Do not trust parcel-link parsing as final until Land Insights access is solved.
- Do not accept an output if access, flood zone, wetlands, structure status, or road frontage is unclear.
- Always save feedback when the output is wrong or partially wrong.
- If the property is missing key facts, the correct decision should usually be `Verify first`.

## Pre-Test Checklist

Before testing, confirm:

- The tester knows whether they are using Mock, Prompt Preview, or Real AI.
- The property has at least state, county, acreage, asking price, and known facts.
- The tester understands that parcel-link-only testing is not reliable yet.
- The tester has permission to use Real AI mode if tokens will be consumed.
- The tester knows where to save feedback.

## Standard Test Input Format

Use this structure for every test property:

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

Known facts should include anything already known about:

- Road frontage
- Access
- Wooded vs pasture vs cleared land
- Structures, sheds, mobile homes, or houses
- Flood zone
- Wetlands
- Slope or terrain
- Nearby sold comps
- Active comps
- County ordinance or subdivision notes
- Seller motivation or timeline

## Phase 1: No-Token Workflow Test

Use Mock / Replay mode first.

Steps:

1. Open the Comp Tool.
2. Enter or load a sample property.
3. Confirm the input fields are understandable.
4. Confirm State is selected before County.
5. Confirm County dropdown updates based on State.
6. Generate or view the sample output.
7. Review the decision summary tiles first.
8. Confirm the output can be understood in under 30 seconds.
9. Save feedback if anything is confusing.

Pass criteria:

- Tester understands the decision at a glance.
- Tester can identify market value and offer without scrolling deeply.
- Tester can identify the immediate next action.
- Tester can identify the top risks.
- Tester knows where to leave feedback.

Fail criteria:

- Tester has to read the full deliverable to understand the decision.
- Output is too long for call prep.
- Offer is unclear.
- Risks are buried.
- Next action is vague.

## Phase 2: Prompt Preview Test

Use Prompt Preview before Real AI when changing instructions or data.

Steps:

1. Enter a complete property test case.
2. Generate the prompt packet only.
3. Review the retrieved context.
4. Confirm the prompt includes the right mode, state, county, acreage, asking price, and known facts.
5. Confirm the prompt tells the AI to return short decision summaries.
6. Confirm the prompt tells the AI to use `Verify first` when facts are missing.

Pass criteria:

- Prompt contains the correct property facts.
- Prompt includes relevant DewClaw rules.
- Prompt does not invent Land Insights facts.
- Prompt is specific enough for Claude to return structured output.

Fail criteria:

- Prompt is missing acreage, county, asking price, or known facts.
- Prompt includes wrong state/county.
- Prompt encourages the AI to assume access, flood zone, wetlands, or subdivision potential.

## Phase 3: Real AI Accuracy Test

Use Real AI only after the form and prompt look correct.

Recommended batch size:

- Corbin: 5 to 10 properties per review session.
- Sales users: 2 to 3 properties only, unless approved.
- Jow/Alerie: enough to validate one specific feature or bug fix.

Steps:

1. Select the correct mode.
2. Enter the property details.
3. Add detailed known facts.
4. Generate the comp.
5. Review the decision summary tiles first.
6. Compare output against Corbin's expected judgment.
7. Review the full deliverable only if the summary is questionable.
8. Save feedback for every wrong or partially wrong result.

Pass criteria:

- Decision is correct or defensible.
- Market value is within an acceptable range based on available comps.
- Offer range is usable for sales.
- Top risks are accurate.
- Next action is specific.

Fail criteria:

- AI gives a confident decision while facts are missing.
- AI invents facts not provided in the input.
- AI misses obvious risk.
- AI gives a bad offer strategy.
- AI ignores asking price.
- AI treats off-market property like an on-market listing.

## Feedback Procedure

Use the Training Feedback section after each reviewed output.

Required feedback when output is wrong:

- Was this output correct? `Partially` or `No`
- Correct decision
- Correct market value, if known
- Correct opening offer, if known
- What was wrong?
- What should change?
- Rule to remember next time
- Reviewer name

Example feedback:

```text
Was this output correct? Partially
Correct decision: Verify first
Correct market value: $74,000
Correct opening offer: $37,000
What was wrong? It called this a Warm Lead, but legal access was not verified.
What should change? The tool should not recommend calling this workable until access is confirmed.
Rule to remember next time: If access is missing or unclear, default to Verify first unless the seller ask is clearly below target offer range.
Reviewer: Corbin
```

## Scoring Rubric

Use this simple score for each Real AI test.

| Score | Meaning | Action |
| --- | --- | --- |
| 5 | Accurate and usable | Keep as good example. |
| 4 | Mostly right, minor wording issue | Save optional feedback. |
| 3 | Directionally right but needs correction | Save feedback. |
| 2 | Major business logic issue | Save feedback and flag to Jow/Alerie. |
| 1 | Unsafe or misleading | Stop using this output and flag immediately. |

## Test Case Mix

Every serious test batch should include:

- 1 clean normal property.
- 1 overpriced seller.
- 1 below-market seller.
- 1 access-risk property.
- 1 rural/low-demand property.
- 1 pasture or cleared property.
- 1 wooded vacant land property.
- 1 property with possible structure issue.
- 1 possible subdivision/value-add property.

Do not only test easy properties.

## Escalation Rules

Escalate to Jow/Alerie immediately if:

- The app errors or does not load.
- Feedback does not save.
- The same input returns wildly different outputs.
- The AI invents facts.
- The AI returns a confident recommendation with missing access or zoning data.
- The output is too long or unusable for sales calls.

Escalate to Corbin if:

- The team disagrees on the correct decision.
- The pricing rule is unclear.
- The issue is business logic, not technical behavior.

## Token Control Rules

- Use Mock / Replay for layout and workflow testing.
- Use Prompt Preview for prompt and retrieval testing.
- Use Real AI only for final judgment testing.
- Do not run Real AI more than once per property unless a specific change is being validated.
- Batch feedback instead of repeatedly regenerating.
- If a result is wrong, save feedback first before running another version.

## Daily Testing Summary Format

At the end of each test session, post this summary:

```text
Comp Tool Testing Summary

Tester:
Date:
Mode tested:
Number of properties tested:
Number of Real AI runs:

Results:
- Passed:
- Partially correct:
- Failed:

Main issues found:
- 

Rules Corbin corrected:
- 

Recommended next fix:
- 
```

## Launch Readiness Criteria

The Comp Tool is ready for controlled team use when:

- Corbin approves the decision summary format.
- At least 20 Real AI test cases have been reviewed.
- At least 80 percent of Real AI outputs are scored 4 or 5.
- No score 1 issues remain unresolved.
- Sales users can understand the output in under 30 seconds.
- Feedback records are saving reliably.
- Token usage is controlled and monitored.

## Current Limitation

Land Insights does not currently provide API access. Parcel-link-only automation should be treated as experimental until a reliable read-only access method exists.

For now, testers should manually provide the important property facts in Known Facts / Notes instead of assuming the parcel link will provide everything.
