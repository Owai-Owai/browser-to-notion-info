# Product Requirements Document: Browser to Notion Sync

**Version:** 0.1  
**Status:** Draft for review  
**Date:** 18 November 2026  
**Platform:** Chrome extension for desktop

## 1. Product summary

Browser to Notion Sync automatically saves websites bookmarked in Chrome to a Notion database chosen by the user. The user connects Notion, pastes their board or database link, chooses which Chrome bookmark folders to include, and enables syncing.

The extension fits the user's existing bookmarking habit. Saving a website with Chrome's star button or bookmark shortcut becomes enough to save that website in Notion too.

**Core promise:** Bookmark a website in Chrome and find it in your chosen Notion collection, with a clear status if saving is delayed or needs attention.

### Confirmed requirements

- Build a Chrome extension.
- Automatically send bookmarked websites to Notion.
- Accept the user's Notion board/database link as the destination.
- Access bookmark folders the user has already created in Chrome.

### Proposed MVP defaults

The following choices make this draft actionable; they have not yet been confirmed by the user.

- One connected Notion workspace and one active destination per Chrome profile.
- One-way capture from Chrome to Notion. Later bookmark edits and deletions are not mirrored in the MVP.
- Support both all-folder syncing and selected-folder syncing.
- Existing bookmarks are imported only after the user reviews and starts an import.
- Save bookmark metadata and the website link; full-page clipping is outside the MVP.
- Use Notion authorization rather than asking users to paste an integration secret.
- Support a private desktop pilot first. Public distribution, pricing, and commercial launch timing remain undecided.

## 2. Problem and audience

People save useful websites in Chrome but organize research, reading lists, and project resources in Notion. Moving a bookmark into Notion manually duplicates effort and makes the two collections drift apart. Existing bookmark folders already provide useful organization that should carry into the saving workflow.

The primary user is an individual who uses Chrome bookmarks and maintains a Notion database for saved resources. Researchers, students, designers, developers, and other knowledge workers are potential audiences, but these segments are hypotheses rather than validated research findings.

**Job to be done:** When I bookmark a useful website, save its link and basic context in my Notion collection so I can organize and retrieve it later without entering it twice.

There are no user interviews, usage metrics, or competitive findings behind this draft. The initial problem evidence is the user's stated need.

## 3. Goals and boundaries

### Goals

1. Make new bookmark capture automatic after setup.
2. Let users choose the Notion destination through a familiar pasted link.
3. Support existing Chrome folders and nested folders.
4. Import an existing bookmark collection without uncontrolled bulk writes.
5. Make delayed, failed, and successful saves easy to understand.
6. Prevent duplicate entries during normal operation and recovery.

### Outside the MVP

- Two-way synchronization or creating Chrome bookmarks from Notion.
- Propagating bookmark title, URL, folder, or deletion changes after a successful save.
- Mapping different folders to different Notion destinations.
- Creating a Notion database or redesigning the user's board automatically.
- Full article text, screenshots, PDFs, page previews, or authenticated page content.
- AI summaries, automatic tags, or content recommendations.
- Firefox, Safari, mobile browsers, or incognito operation.
- Collaboration features, billing, and a standalone web dashboard.
- Monitoring bookmarks on devices where the extension is not installed and running.

## 4. Core user journeys

### 4.1 Initial setup

1. Install the extension and open setup.
2. Read a brief explanation of bookmark access and what data will be sent to Notion.
3. Connect Notion and authorize access to the intended destination.
4. Paste a Notion board or database link.
5. Review the resolved destination name and choose a data source if necessary.
6. Map the bookmark title and URL to compatible Notion properties. Optionally map folder path, bookmark date, and a default board status/category.
7. Choose **All bookmark folders** or **Selected folders**. Display the existing folder tree with nested folders.
8. Choose **New bookmarks only** or **Import existing bookmarks too**. Show an import preview when applicable.
9. Review the destination, folder scope, and import count; select **Enable sync**.
10. Show a ready state. Offer a first-save walkthrough without creating a synthetic Notion entry automatically.

### 4.2 Save a new website

1. The user bookmarks a website using Chrome's normal bookmarking controls.
2. The extension checks that the bookmark is in scope and has a supported URL.
3. The extension durably queues the bookmark, checks for an existing destination entry, and creates an entry when needed.
4. The popup shows **Saved to Notion** with a link to the resulting entry, or a useful pending/error state.

Example: A website saved in `Research > Design systems` becomes a Notion entry with its bookmark title, URL, and that folder path if the folder property is mapped.

### 4.3 Import an existing collection

1. Open settings and choose **Import existing bookmarks**.
2. Choose folders and review the number of candidate bookmarks, duplicates, and unsupported links.
3. Start the import deliberately.
4. Track saved, already present, skipped, pending, and failed counts.
5. Pause or cancel the remaining work. Entries already created stay in Notion.
6. Resume unfinished work or retry failed items without restarting completed saves.

### 4.4 Recover from a failed save

1. The popup indicates **Waiting for connection**, **Reconnect Notion**, or **Destination needs attention**.
2. The user can inspect the reason and the affected item count.
3. Temporary errors retry automatically. Access or configuration errors wait for repair.
4. After recovery, pending work resumes against its original destination without creating another entry for a completed save.

## 5. Functional requirements

**P0:** Required for the MVP. **P1:** Improvement after the core flow is reliable. **P2:** Future consideration.

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| FR-01 | P0 | Connect and disconnect Notion. | Setup supports authorization, cancellation, failure, reconnection, and disconnect. A pasted link alone never counts as authorization. |
| FR-02 | P0 | Accept a Notion board/database URL. | Resolve supported links to the writable underlying data source. Show the destination name before enabling sync. Invalid, inaccessible, or ambiguous links receive a recovery action. |
| FR-03 | P0 | Validate destination properties. | Require compatible title and URL properties. Let users map existing properties by type regardless of their names. Never silently change the database schema. |
| FR-04 | P0 | Display existing bookmark folders. | Show the current Chrome profile's folder hierarchy, including nested folders and supported browser-managed containers. Refresh when folders change. |
| FR-05 | P0 | Configure folder scope. | Offer all folders or selected folders. A selected folder includes its descendants. Persist selection by folder ID; a rename does not break selection. |
| FR-06 | P0 | Capture new bookmarks automatically. | After enablement, a supported bookmark created in scope is queued without opening the extension. Allow a short settling period and recheck its final folder before sending. |
| FR-07 | P0 | Capture bookmarks moved into scope. | An existing bookmark moved into an included folder becomes eligible. Moving a folder into an included subtree also evaluates its contents. Existing matches are not recreated. |
| FR-08 | P0 | Import existing bookmarks. | Preview scope and counts, require an explicit start, show progress, and support pause, cancellation, and resume. Import completion accounts for every candidate. |
| FR-09 | P0 | Save core metadata. | Each created entry contains the bookmark title and complete URL. Configured optional metadata and default property values are included. |
| FR-10 | P0 | Avoid duplicate entries. | Repeated events, reimports, retries, and matching URLs in multiple folders produce at most one new entry per URL per destination within the supported scope. Apply the rules in Section 7. |
| FR-11 | P0 | Persist pending work. | Queue records survive popup closure, background worker termination, extension updates, and browser restart. Resume after the browser and extension are running again. |
| FR-12 | P0 | Show sync status and history. | Show connection state, destination, pause state, pending/failed counts, last success, and recent results. Successful results open their Notion entries. |
| FR-13 | P0 | Pause and resume. | Pause stops new outbound writes. Continue recording eligible new bookmarks locally; resume processes them. An already-sent request may finish. |
| FR-14 | P0 | Handle errors visibly. | Classify temporary, authorization, destination, schema, and item-specific errors. Preserve affected work and provide a relevant action. |
| FR-15 | P0 | Change destination safely. | Validate the new destination. Keep old pending work tied to the old destination and offer finish or discard; never silently redirect it. Prior saves remain where they were created. |
| FR-16 | P0 | Respect local scope. | Read bookmark organization as needed, but transmit only eligible bookmark metadata. Never modify or delete Chrome bookmarks. |
| FR-17 | P1 | Improve large-folder navigation. | Add folder search and selection summaries if pilot libraries make tree navigation difficult. |
| FR-18 | P2 | Support multiple destinations. | Allow explicit folder-to-destination mappings with independently visible status. |

### Notion destination behavior

A board is a view of underlying Notion data. The product writes an entry to the chosen data source and opens it through Notion; it does not treat a view ID as the page-creation parent. Notion documents data source schemas and page creation separately. See [Retrieve a data source](https://developers.notion.com/reference/retrieve-a-data-source) and [Create a page](https://developers.notion.com/reference/post-page).

- Accept standard full database and board-view links in the MVP. Resolve linked-view links when the source can be identified unambiguously through authorized APIs; otherwise guide the user to copy the source database link.
- If several data sources are available, require an explicit choice rather than guessing.
- If a link points to an ordinary page containing several databases, ask for the specific database link.
- A successful entry may be hidden by the board's filters or grouping. Explain this during destination setup and provide a direct entry link after saving. The user can optionally set a compatible status/select value to place new entries in a desired group.
- Do not promise automatic satisfaction of arbitrary view filters or change existing view settings. Notion's [view API](https://developers.notion.com/reference/update-a-view) exposes view filters and configuration separately from page creation.
- If required properties are missing, show the exact property type needed and allow revalidation after the user adds it in Notion.

## 6. Data requirements

### Notion entry

Property names below are suggestions; users can map equivalent existing properties.

| Field | Notion property type | Required | Rule |
| --- | --- | --- | --- |
| Name | Title | Yes | Use the Chrome bookmark title; fall back to the hostname, then URL, if empty. |
| URL | URL | Yes | Preserve the bookmarked website URL. Do not fetch the website to resolve redirects. |
| Bookmark Folder | Rich text | No; recommended | Save the full folder path at capture time, such as `Research > Design systems`. |
| Bookmarked At | Date | No; recommended | Use Chrome's bookmark creation timestamp when available, including for imported bookmarks; otherwise use capture time. |
| Status / Category | Existing status or select | No | Apply the user's configured default value. Do not invent options or alter grouping rules. |

The entry body can remain empty in the MVP. A saved private or login-required website is a reference link; its protected content is not copied.

### Internal records

Store the minimum information needed for operation and recovery:

- Connection reference, workspace identity, destination identity, and property mappings.
- Folder selection, enablement baseline, pause state, and import checkpoints.
- Bookmark source ID, metadata snapshot, destination, and deduplication key.
- Queue state, retry schedule, attempt count, and sanitized failure reason.
- Notion page ID/URL and successful-save timestamp.

Keep raw URLs and titles out of general diagnostic logs and analytics. The operational deduplication ledger may retain the minimum URL/index data required to query and reconcile saves; disclose that storage in setup.

## 7. Capture, duplicate, and lifecycle rules

### Scope and timing

- Support `http://` and `https://` bookmark URLs. Skip browser-internal URLs, local files, bookmarklets, and other schemes with an explanation.
- Do not require the saved website to be open, publicly accessible, or online.
- In **New bookmarks only** mode, establish an initial bookmark baseline without exporting existing entries. Later startup reconciliation must distinguish previously known bookmarks from newly observed or newly moved-in bookmarks.
- Reconcile after browser startup and bookmark import completion so missed events can be recovered. Bookmarks removed before they were ever observed cannot be recovered.
- Recheck folder eligibility before sending a queued item. If it has been deleted or moved out of scope, cancel its unsent save. A request already sent may complete.
- In all-folder mode, include newly created folders. In selected-folder mode, include new descendants but require selection for unrelated new folders.
- A selected folder stays selected if it is renamed or moved because its ID is unchanged. If it is deleted, show that it is missing; never broaden the selection automatically.
- Newly selecting a folder does not silently import its existing contents. Offer the import preview for that scope.

### Duplicate policy

- Treat a destination and a conservatively normalized full URL as the identity of a saved resource.
- Normalize only standard URL serialization, such as scheme/hostname casing and default ports. Preserve path casing, query strings, query order, and fragments; they can identify different content.
- The same URL in multiple Chrome folders produces one destination entry. Preserve the first successful capture's title, folder path, and date; show subsequent saves as **Already in Notion**.
- Check the mapped URL property for existing active Notion entries, including manually created entries. If a match exists, link to it without changing its content. If several matches already exist, avoid another creation and report that existing duplicates were found.
- Serialize create attempts for a destination/URL and retain a durable operation record. If a request times out after a possible write, reconcile against Notion before attempting another creation.
- If the outcome remains uncertain, show **Checking previous save** and retain the item rather than blindly retrying creation. Do not claim exactly-once delivery across every external failure.
- MVP support and duplicate acceptance testing cover one active extension installation per destination. Concurrent independent writers can still race; cross-device coordination is future scope.

### Change behavior

| Event | MVP behavior |
| --- | --- |
| New bookmark in an included folder | Create an entry or identify an existing match. |
| Bookmark or folder moved into scope | Evaluate newly eligible bookmarks and deduplicate before saving. |
| Title or URL changed before sending | Use the latest eligible bookmark snapshot. |
| Title, URL, or folder changed after successful save | Leave the saved Notion entry as captured. The activity view explains that changes are not mirrored. |
| Bookmark deleted after successful save | Keep the Notion entry. |
| Notion entry edited | Keep the user's edits; no change is sent back to Chrome. |
| Notion entry deleted | Do not recreate it automatically. A later explicit import may create it again if no active match exists. |
| Destination changed | Apply it to future captures. Offer an explicit import into the new destination; do not move historical entries. |
| User disconnects Notion | Stop outbound work and new capture, invalidate the product session, remove stored Notion credentials, and clear unsent payloads. Explain that saved Notion entries remain. |
| Extension uninstalled | Local settings/queue are lost. Reinstallation requires setup; backend retention follows Section 10. |

## 8. Reliability and error handling

Use a durable queue with states equivalent to **Queued**, **Saving**, **Saved**, **Already present**, **Waiting to retry**, **Needs attention**, **Skipped**, and **Cancelled**. Pausing suspends processing without losing the underlying state.

| Condition | Required response |
| --- | --- |
| Offline or temporary network failure | Keep work locally and retry after connectivity returns. |
| Notion rate limiting or service overload | Respect `Retry-After`; retain the queue and display that saving is delayed. |
| Temporary server failure | Retry with bounded exponential backoff and jitter. After repeated failures, retain the item and surface **Retry** rather than dropping it. |
| Expired or invalid authorization | Refresh credentials when supported. If recovery fails, stop affected writes and offer **Reconnect Notion**. |
| Missing destination or revoked access | Pause affected work and offer **Check access** or **Change destination**. Do not repeatedly retry an inaccessible destination. |
| Removed property or incompatible schema | Pause affected work, identify the property, and offer **Update mapping**. |
| Invalid/oversized item | Explain the specific field problem. Never truncate or alter the saved URL silently. Other valid items continue. |
| Ambiguous create outcome | Reconcile the previous attempt before creating again. |
| Partial bulk import | Retain per-item outcomes and retry only unfinished or failed work. |
| Local storage exhausted | Stop accepting additional queue payloads, show a persistent actionable error, and preserve existing records. |

Chrome can terminate extension service workers, so work cannot depend on an open popup or in-memory timers alone. See [Chrome service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

Notion's limits can vary, so throughput must adapt to responses rather than assume a fixed rate. See [Notion request limits](https://developers.notion.com/reference/request-limits).

## 9. Interface requirements

### Popup

- Display connection and sync state first.
- Show destination name, included-folder summary, last successful save, and pending/failed counts.
- Provide **Pause/Resume**, **Retry failed**, **Open Notion**, and **Settings** actions.
- Show recent results with a clear destination entry link where available.
- Use a badge for pending work or errors. Routine successful saves should not generate a desktop notification each time.

### Settings

- Manage the Notion connection and destination.
- Configure property mappings and optional default status/category.
- Select folders, preview imports, and monitor import progress.
- Inspect failures and recover without losing valid pending work.
- Provide **Delete extension data and disconnect**, explaining that entries already in Notion remain.

### Usability and accessibility

- Make setup usable without developer tools, API keys, or knowledge of Notion object IDs.
- Use keyboard-operable controls, visible focus states, accessible labels, and status text that does not rely on color.
- Support long bookmark titles, long folder paths, empty folder trees, loading states, and unavailable destinations.
- Distinguish **Saved**, **Already present**, and **Waiting**. Do not present a queued item as saved.

## 10. Privacy, permissions, and architecture constraints

### Permissions and data use

- Use Manifest V3 and the Chrome Bookmarks API. Chrome's `bookmarks` permission grants broad bookmark access and displays a read/change warning; selecting folders is a product-level restriction, not a Chrome-enforced per-folder permission. See [Bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks) and [Chrome permission warnings](https://developer.chrome.com/docs/extensions/reference/permissions-list).
- Request storage and scheduling permissions only as required for persistence and retry. Limit network host access to the product service and necessary authorization endpoints.
- Do not request browsing history, cookies, website-wide content access, or general tab access for the core flow.
- Do not inject scripts into bookmarked websites or fetch their content in the MVP.
- Before enablement, disclose that eligible URLs, titles, folder paths, and timestamps will pass through the product's sync service to the selected Notion destination.
- Never transmit excluded bookmark payloads. Folder enumeration remains local.

### Proposed architecture

Use a Chrome extension for bookmark observation, local selection, queue persistence, and status. Use a small authenticated service for Notion OAuth, credential storage, request coordination, and Notion API calls. A framework, hosting vendor, and database are implementation decisions outside this PRD.

The backend is a proposed security design: Notion's documented OAuth exchange uses a client secret, so the extension package must not contain that secret. See [Notion authorization](https://developers.notion.com/guides/authorization/overview).

Requirements for this approach:

- Encrypt Notion access/refresh tokens at rest and use HTTPS in transit.
- Validate OAuth state, bind callbacks to the initiating installation/session, and use fixed approved redirect URIs.
- Authenticate every sync request and isolate each user's connections and destinations.
- Store only a revocable product session in extension storage; keep Notion credentials in the service.
- Pin and test a supported Notion API version. Resolve destination data sources and map properties using stable IDs where supported.
- Retain unsent work locally without an automatic expiry. Notify the user before any storage-limit recovery could discard work.
- Retain recent activity and sanitized diagnostics for at most 30 days. Keep the minimal deduplication ledger while the connection is active.
- Delete active service credentials and operational records immediately on explicit disconnect/data deletion; remove any residual backup copies within 30 days. Disclose backup retention.
- Treat uninstall cleanup as best effort rather than guaranteed. Expire abandoned product sessions after 90 days without activity and remove associated credentials/operational data; a returning installation reconnects.
- Product analytics are optional for the pilot. Collect only aggregate counts, timings, and error classes; never bookmark content or destination URLs.

## 11. Success criteria

These are proposed pilot targets, not measured results or contractual service guarantees.

| Metric | Definition | Initial target |
| --- | --- | --- |
| Setup completion | Pilot users who enable sync divided by users who start setup | At least 80% |
| Time to first saved bookmark | Setup start to first successful real bookmark, excluding time waiting for user action outside setup | Median under 5 minutes |
| Normal save latency | Eligible capture to confirmed Notion creation, while online, authorized, browser awake, and with no bulk backlog | 95% within 30 seconds |
| Eventual save success | Supported, uncancelled captures saved or matched within 24 hours, with available connectivity and valid authorization during that interval | At least 99% |
| Duplicate creation rate | Extra entries attributable to repeated processing divided by eligible save attempts in the supported single-installation scope | Below 0.1%; zero in controlled acceptance scenarios |
| Import accounting | Import candidates assigned an explicit final outcome or visible pending/error state | 100% |
| Recovery integrity | Queued records preserved in restart, worker termination, and reconnect scenarios | 100% in acceptance testing |
| User confidence | Pilot users can identify the destination and understand a failed save without developer assistance | At least 4 of 5 pilot participants |

Latency targets do not apply while Chrome is closed, the computer is asleep, sync is paused, or an external dependency is unavailable. Bulk imports show real progress and respect external rate limits rather than promise a fixed completion time.

Proposed validation libraries: 10,000 bookmark nodes, nested folders at least 10 levels deep, and a 1,000-bookmark import. Test responsive navigation, queue persistence, progress accuracy, and recovery under those conditions.

## 12. MVP acceptance scenarios

1. **Authorized destination:** Connect Notion, paste a supported board/database link, map properties, select folders, and enable sync. Confirm the destination shown matches the intended collection.
2. **Access failure:** Paste a valid but inaccessible destination. Setup remains incomplete and explains how to grant access or choose another destination.
3. **Basic save:** Create an HTTPS bookmark in an included folder. Exactly one correctly populated entry appears and can be opened from the popup.
4. **Folder exclusion:** Create a bookmark in an excluded folder. No payload for that bookmark reaches the service or Notion.
5. **Nested folders:** Select a parent folder, create a child folder, and bookmark a website inside it. The bookmark is eligible; renaming the selected parent does not break selection.
6. **Folder movement:** Move a bookmark or populated folder into scope. Newly eligible URLs save once. Moving an unsent bookmark out of scope cancels that pending save.
7. **Import safety:** Review an existing collection before import. A second import creates no additional entries for existing URLs; cancellation leaves completed entries intact.
8. **Duplicate recovery:** Replay an event, save the same URL in two folders, and simulate a lost create response. Each case resolves without a second creation or remains visibly under reconciliation.
9. **Offline/restart recovery:** Queue bookmarks offline, terminate the worker, restart Chrome, and reconnect. All still-eligible items resume with accurate outcomes.
10. **External errors:** Simulate rate limits, overload, revoked authorization, a deleted destination, and a changed property type. Each produces the appropriate wait or repair action with no silent item loss.
11. **Pause:** Pause syncing, add bookmarks, and resume. Writes wait during pause and process once after resumption.
12. **Snapshot semantics:** Rename or delete an already-saved Chrome bookmark and edit its Notion entry. The saved Notion content remains under the user's control.
13. **Filtered board:** Save an entry hidden by the board's filter. Report the successful database save with a direct entry link and guidance about the filter.
14. **Destination switch:** Change destination while work is pending. No pending item goes to the new destination without an explicit new import.
15. **Privacy and disconnect:** Inspect requests for an included and excluded bookmark, disconnect, and verify new writes stop and active service credentials/records are removed.
16. **Website compatibility:** Save HTTP/HTTPS links to public, private, and login-required pages without reading their content; show a reason when skipping an unsupported scheme.

## 13. Delivery stages

| Stage | Output | Exit condition |
| --- | --- | --- |
| Product review | Confirm scope, capture semantics, and proposed defaults | Major product decisions are recorded; remaining implementation choices do not change user-facing scope. |
| Feasibility validation | Verify OAuth, supported destination-link formats, property mapping, bookmark events, and ambiguous-write recovery | Each critical dependency is demonstrated with a disposable test collection before full implementation. |
| MVP implementation | Setup, folder selection, automatic capture, explicit import, status, and recovery | All P0 requirements are implemented and acceptance scenarios pass. |
| Private pilot | Real bookmark libraries, setup observations, and reliability measurements | No unresolved data-loss/privacy defects; usability and reliability results support release. |
| Distribution preparation | Packaging, privacy disclosures, support route, and release checks | Public versus private distribution is decided and applicable launch requirements are satisfied. |

No implementation timeline or release date is committed in this draft.

## 14. Risks and decisions to confirm

| Topic | Proposed position | Risk or decision |
| --- | --- | --- |
| Meaning of sync | Capture new/imported bookmarks; preserve saved entries afterward | Users may expect edits and deletions to mirror. Confirm this boundary and explain it in setup. |
| Default folder scope | Present all folders and selected folders during setup; require an explicit choice | Avoid accidental export of unrelated bookmark collections. |
| Existing collection | Opt-in import with preview | Large collections create API load and may contain sensitive URLs. |
| Notion link support | Full database/board links, with guided fallback for ambiguous linked views | Copy-link formats and permissions need feasibility testing. |
| Board visibility | Optional default status/category plus direct entry links | Arbitrary filters can hide an otherwise successful save. |
| Authorization/service | OAuth with a small backend | Adds hosting, account/session lifecycle, and operating costs; confirm suitability for the intended audience. |
| Multiple devices | One active installation per destination for the MVP | Chrome-synced bookmarks or independent writers may race without shared coordination. |
| Commercial scope | Private pilot before deciding distribution and pricing | Public release adds store review, support, and operational requirements. |

These decisions can be reviewed before implementation. Creating this PRD does not authorize or begin building the extension.
