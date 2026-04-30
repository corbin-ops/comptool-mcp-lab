# Changelog

All notable changes to CompTool V2 are documented here.

## [0.1.1] — 2026-04-28

### Changed
- AI valuation prompt now weights days-on-market (DOM) and listing recency to detect hot vs cold markets, and surfaces a hot/neutral/cold tempo signal in the Decision Summary or Extra Notes.
- Offer strategy guidance: lean toward the upper end of the market value range in hot markets, anchor lower with wider negotiation room in cold markets.
- Comps older than 12 months are now treated as supporting evidence only, not primary anchors.
