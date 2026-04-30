# Phase 2 Visual Agent Plan

## Purpose

This document defines Phase 2 of the Comp Tool project.

Phase 1 is the structured comp workflow:

- manual or semi-manual inputs
- DewClaw retrieval and prompt logic
- comp output
- feedback capture
- CRM handoff

Phase 2 is a separate build:

- browser-based navigation
- visual inspection of Land Insights and listing pages
- structured extraction of visual findings
- feeding those findings into comp logic

This document exists to keep scope clear and prevent Phase 2 from being treated like a small patch to Phase 1.

## Phase 2 Objective

Build a browser-based visual parcel inspector that can:

- open a parcel and related listing pages
- inspect the visible map and listing photos
- detect basic visual signals that materially affect comping
- return structured findings for the comp workflow

The goal is not to fully replace human judgment in v1.

The goal is to make visual research repeatable enough to support better comp decisions.

## Why Phase 2 Exists

The current Comp Tool can work with:

- structured inputs
- DewClaw training materials
- manual notes
- comp feedback

The current Comp Tool does **not** yet:

- visually inspect the Land Insights map
- navigate page tabs and buttons like Claude MCP / browser computer use
- inspect listing photos directly
- separate vacant land from structure-driven comps based on visual inspection

Corbin has identified this visual layer as critical to comp accuracy. That makes Phase 2 the next major build, not a minor update.

## Core Problem Statement

If the system cannot see:

- terrain
- area type
- access clues
- structure clues
- listing photo context

then it can miss the most important comping signals.

Phase 2 solves that by adding a perception and navigation layer before comp reasoning.

## Phase 2 Product Definition

Phase 2 is best defined as:

**A visual research agent that observes a live real-estate workflow in the browser and returns structured findings that improve comp accuracy.**

It is not just a smarter form.

It is not just more prompt engineering.

It is a separate system layer.

## Mental Model

Phase 2 has 4 layers.

### 1. Perception

What the system can see:

- parcel page
- map view
- road frontage clues
- terrain clues
- surroundings
- listing photos
- structure signals

### 2. Navigation

How the system moves through the workflow:

- open parcel link
- navigate key Land Insights tabs
- inspect the map area
- open Redfin / Zillow / other listing links
- move through listing photos

### 3. Extraction

What the system turns into structured notes:

- likely property type
- likely rural / suburban / urban setting
- likely terrain type
- structure present / not obvious / unclear
- frontage/access signal visible / unclear
- visual anomalies
- things to verify

### 4. Reasoning

How those extracted findings affect the comp:

- comp as vacant land
- comp as structure / vacant land
- reduce confidence
- route to verify first
- flag contamination risk

## Success Criteria

Phase 2 MVP succeeds if it can:

- open the right page reliably
- inspect visible map/page context
- inspect listing photos when relevant
- produce structured visual notes
- help the user distinguish between vacant land and structure-influenced parcels

Phase 2 MVP does **not** need:

- perfect autonomous valuation
- zero-failure navigation
- full production-scale automation

## Non-Goals for Phase 2 MVP

These are explicitly out of scope for the first prototype:

- fully automatic Smarter Contact to comp without review
- perfect end-to-end comping
- production-grade reliability across every edge case
- replacing all analyst verification
- formal Land Insights API integration

## Required Inputs

For Phase 2 MVP:

- parcel link
- optional listing links
- optional manual notes

Future versions may also include:

- lead thread summary
- asking price
- property type hint
- prior feedback corrections

## Required Outputs

The visual agent should return a structured observation set before full comping.

Minimum output:

- parcel page reached: yes / no
- listing pages reached: yes / no
- likely setting: rural / suburban / urban / unclear
- likely terrain: flat / sloped / mixed / unclear
- structure signal: present / not obvious / unclear
- access/frontage signal: visible / unclear
- notable risks
- confidence level
- verify-next items

Optional output:

- screenshot references
- page navigation log
- listing-photo notes

## Phase Breakdown

### Phase 2A: Visual Parcel Inspector

Goal:

- open the parcel page
- inspect visible parcel/map context
- return a structured visual summary

Scope:

- Land Insights parcel page only
- basic page navigation
- map context reading
- no full comp generation required at this step

Success criteria:

- works on 5 to 10 sample parcels
- returns repeatable notes

### Phase 2B: Listing Photo Inspector

Goal:

- inspect Redfin / Zillow / relevant listing pages
- read listing photos and surrounding presentation
- detect obvious structure / improvement / context signals

Scope:

- limited listing-photo review
- no deep pricing logic yet

Success criteria:

- returns usable visual notes
- flags structure presence or mismatch risk

### Phase 2C: Visual Findings Into Comp Logic

Goal:

- feed visual findings into DewClaw comp reasoning

Scope:

- merge visual summary with existing comp workflow
- update decision, confidence, and contamination flags

Success criteria:

- visual findings materially improve comp output quality

### Phase 2D: Reliability and Workflow Integration

Goal:

- harden the navigation and make the workflow usable repeatedly

Scope:

- handle navigation failures
- recover from inconsistent page states
- improve repeatability
- support team testing

Success criteria:

- stable enough for a controlled rollout

## Prototype Strategy

Do not start by trying to build the full Claude MCP equivalent.

Start with a proof of concept that answers these questions:

1. Can the system open the parcel reliably?
2. Can it inspect the visible page and map?
3. Can it describe what it saw in a consistent way?
4. Can those notes help separate vacant land from structure-driven parcels?

The first prototype should stop there.

## Recommended MVP Deliverable

The first working Phase 2 prototype should be a:

**Visual Parcel Inspector**

Input:

- parcel link

Actions:

- open parcel page
- inspect the visible parcel page and map context
- optionally open one or two related listing pages

Output:

- area type guess
- terrain notes
- structure signals
- access/frontage signals
- visual anomalies
- confidence
- verify-next items

This MVP can later feed the comp engine.

## Reliability Risks

Phase 2 is difficult mainly because of reliability, not just coding.

Known risks:

- page layouts may change
- buttons may move or rename
- login/session state can break
- maps may load differently
- listings vary by county and source
- unsupported scraping/browser workflows may be fragile
- visual judgments may drift if not constrained well

This is why a prototype-first approach is required.

## Team Roles

### Corbin

- define what visual signals matter most
- review output quality
- correct business decisions
- identify what the agent missed

### Jow

- define the system workflow
- own implementation planning and testing
- translate business needs into repeatable logic

### Alerie

- help with project scoping and workflow design
- help document testing rules and outputs
- support operational rollout and coordination

## Decision Rules for Early Versions

The early visual agent should default to caution.

If visual inspection is unclear:

- mark the result as `Verify first`
- lower confidence
- surface missing visual facts explicitly

Do not let the system behave as if it has certainty when it does not.

## Recommended Timeline Framing

This should be communicated as:

- prototype / proof of concept: small, targeted, fast
- reliable working version: much larger effort

The exact dates depend on tool choice and implementation path, but this should be treated as a phased build, not a single-step update.

## Open Questions

Before implementation starts, these questions need clear answers:

1. Which browser/vision method will be used?
2. What exact screens must the prototype inspect?
3. How many listing pages/photos are required per run?
4. What are the minimum visual signals that count as success?
5. Should the first prototype produce only visual notes, or visual notes plus a draft comp?
6. How much human review is required before using output operationally?

## Recommended Immediate Next Steps

1. Confirm that Phase 2 is a separate scoped build from Phase 1.
2. Approve the MVP definition: `Visual Parcel Inspector`.
3. Define the minimum signal checklist:
   - rural / suburban / urban
   - terrain type
   - structure signal
   - frontage/access signal
   - visual risks
4. Pick 5 to 10 test parcels for the first proof of concept.
5. Build Phase 2A first before attempting full visual comping.

## Bottom Line

Phase 2 should start as a focused visual research prototype, not a full production comp agent.

If it can:

- see the right pages
- inspect the right signals
- describe what it saw clearly
- help separate vacant land from structure-driven parcels

then it is moving in the right direction.

That is the correct starting point.
