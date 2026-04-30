# Phase 2 Test Case Template

Use this file to define the first 5 to 10 parcel cases for the Visual Parcel Inspector.

The purpose of this test set is not valuation yet.

The purpose is to verify that the system can:

- open the parcel page
- inspect visible parcel and map context
- identify broad visual signals consistently
- return structured findings

## Case Template

```text
Case ID:
Parcel Link:
Listing Links:
Notes:

Expected Output:
- Parcel page reached: yes / no
- Area type: rural / suburban / urban / unclear
- Terrain type: flat / sloped / mixed / unclear
- Structure signal: present / not obvious / unclear
- Access or frontage signal: present / not obvious / unclear
- Visual risks:
- Verify next:
- Confidence: low / medium / high
```

## Recommended Starter Mix

- 1 easy rural parcel
- 1 suburban or edge parcel
- 1 heavily wooded parcel
- 1 pasture or cleared parcel
- 1 parcel with possible structure
- 1 access-risk parcel
- 1 parcel with obvious visual ambiguity

## Example Starter Case

```text
Case ID: P2-001
Parcel Link:
Listing Links:
Notes: Known rural parcel. No confirmed structure data. Goal is to validate whether the visual inspector can classify broad setting and terrain.

Expected Output:
- Parcel page reached: yes
- Area type: rural
- Terrain type: mixed
- Structure signal: unclear
- Access or frontage signal: unclear
- Visual risks:
  - access not confirmed
  - structure status not confirmed
- Verify next:
  - confirm road frontage
  - confirm whether any improvement exists
- Confidence: medium
```
