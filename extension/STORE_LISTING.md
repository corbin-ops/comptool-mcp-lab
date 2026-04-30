# Chrome Web Store Listing Draft

## Name

Dew Claw CompTool Capture

## Short description

Capture Land Insights parcel data and send it to CompTool V2 for internal comp review.

## Detailed description

Dew Claw CompTool Capture is an internal workflow extension for Dew Claw sales and acquisitions users.

When an authorized user is logged into Land Insights and opens a parcel comp report, the extension captures the visible parcel fields, comparable rows, listing links, and page context from that active tab. It sends the captured payload to the hosted CompTool V2 dashboard, where the team can review the generated comp result, map support, risks, and next actions.

This extension is intended for internal Dew Claw use only. It does not replace analyst review, legal review, county verification, title review, or final acquisition approval.

## Category

Productivity

## Visibility recommendation

Unlisted for the first team rollout.

## Privacy policy URL

https://comptoolv2.onrender.com/privacy

## Permission justification

activeTab: Lets the extension capture the current Land Insights tab only after the user clicks the extension.

scripting: Lets the extension inject the capture script if the content script is not already available on the active Land Insights page.

tabs: Lets the extension read the active tab URL and open or update the CompTool V2 loading/result tab.

Host permissions for app.landinsights.com and app.landinsights.co: Limits page capture to the Land Insights app.

Host permission for comptoolv2.onrender.com: Lets the extension send the captured payload to CompTool V2.

## Privacy practices draft

Data collected:

- Website content from the active Land Insights parcel page
- Website URL / page title
- Property and comparable sale data visible on the page
- Owner/contact/property details when visible on the page

Data usage:

- Internal comp review
- Internal workflow debugging and quality control
- No advertising
- No sale of data
- No unrelated profiling
- Extension data is used only to provide or improve the CompTool V2 parcel-comp workflow and is handled according to the Chrome Web Store User Data Policy, including Limited Use requirements.
