# Chrome Web Store listing draft

Prepared for the hosted Browser to Notion build. Review this copy and the actual dashboard disclosures before submission.

Unpublished draft ID: `aneibajfligcbdfodclcfelpgcenmojk`. The owner confirmed version 0.1.2 and the listing are saved. Version 0.1.3 adds optional usage sharing and is being prepared; [analytics activation](ANALYTICS.md) and updated disclosures must be verified before replacing the draft or submitting it.

## Listing copy

**Name:** Browser to Notion

**Short description:** Automatically save bookmarks from selected Chrome folders to your Notion database.

**Detailed description:**

Keep useful websites in your Notion library as you bookmark them in Chrome.

Browser to Notion saves new website bookmarks from the Chrome folders you choose to your own Notion database. Start with the ready-made Notion template or connect an existing database.

- Choose the bookmark folders to sync, including their subfolders.
- Save the website title, URL, folder, bookmark date, and an optional default status using your chosen Notion properties.
- Preview an optional import of existing bookmarks before adding them.
- Check saving progress and open saved entries from Activity.
- Pause and resume syncing when you need to.
- Check for existing URLs to help prevent duplicate entries.

Connect your Notion account and authorize your chosen database. No local connection service is required for the hosted version.

The extension saves bookmark information. It does not capture article content or read browsing history. Saved entries are snapshots; later bookmark edits and deletions do not change entries already saved in Notion. Chrome must be open for syncing, and pending bookmarks wait when the connection is unavailable.

Optional usage sharing is off by default. If you opt in, PostHog receives feature events and save outcomes under a random installation ID, without bookmark details or Notion content. You can turn it off in Settings.

## Publisher and links

- Publisher/operator: Owai
- Support email: owaiowai30@gmail.com
- Privacy policy: https://owai-owai.github.io/browser-to-notion-info/privacy.html
- Public information page: https://owai-owai.github.io/browser-to-notion-info/
- Starter template: https://owai.notion.site/Browser-to-Notion-Starter-template-41ccff4f3d6d81b5a373c956d33462b0

## Single purpose and permission justifications

**Single purpose:** Save website bookmarks from selected Chrome folders to the user's chosen Notion database.

| Permission | Justification |
| --- | --- |
| bookmarks | Read the browser's bookmark folder tree and eligible bookmark metadata, and detect bookmark events for the selected scope. |
| storage | Retain local settings, selected folders, the service session, pending saves, activity, and optional usage-sharing consent/queued events across browser sessions. |
| alarms | Resume pending work and reconcile bookmark changes when the extension worker wakes. |
| identity | Use Chrome's authorization flow to connect the user's Notion account. |
| https://vgmltpmcqulxrbjnsflj.supabase.co/* | Send authorization requests and selected bookmark metadata to the publisher's hosted connection service, which calls Notion. If the user opts in, also send limited usage events for forwarding to PostHog. |

The extension bundles its executable code. It does not download remote executable code; remote requests exchange API data.

## Listing images

Upload the images from `release/store-assets` in the Store listing image fields:

1. `settings-1280x800.jpg` — connected workspace, destination, selected folders, mappings, and import.
2. `folders-1280x800.jpg` — folder selection with inherited subfolders.
3. `activity-1280x800.jpg` — saved entries and duplicate prevention.

Use `icon-128.png` for the store icon. The screenshots use the real UI components with fictional data and contain no private bookmark or workspace details. Dimensions were checked against [Chrome's image requirements](https://developer.chrome.com/docs/webstore/images).

## Data handling for dashboard disclosures

Use these actual practices when completing the dashboard's data categories and certifications:

- Selected bookmark titles, URLs, folder paths, and dates pass through the Supabase service to the authorized Notion database.
- Local Chrome storage retains the service session, configuration, bookmark snapshots, pending work, and activity.
- The service retains encrypted Notion credentials, workspace identifiers/names, hashed service credentials, temporary authorization records, and a save ledger with hashed destination/website keys and Notion entry identifiers/links.
- Provider traffic logs may include IP addresses, request URLs, and timings. Temporary connection-rate limits use an IP address or its hash.
- Usage sharing is off by default for all installations. Users can explicitly opt in during setup or Settings, and opt out at any time. PostHog then receives a random installation ID, event UUID/time/version, and allowlisted sync/save/import events. No bookmark details, Notion content, credentials, raw errors, session recordings, or automatic click capture are included. Mark optional feature-use data consistently with the dashboard's User activity category and explain it in the published policy.
- Opting out clears unsent usage events and stops future collection. Previously shared events require a deletion request using the Usage data ID; disconnecting alone does not erase PostHog history.
- There are no advertising, tracking-pixel, or data-sale features.
- Retention and deletion behavior is described in the published privacy policy.

Match the dashboard's current category descriptions to these practices. A lack of the browser `history` permission does not by itself determine how a disclosure category should be answered.

## Reviewer test instructions

1. Install the extension and open its setup screen.
2. Use your own Notion account. Duplicate the linked starter template, or choose an existing database with title and URL properties.
3. Connect Notion and grant access to your template copy/database.
4. Complete destination mapping and choose a test bookmark folder. Leave existing-bookmark import off for the first test.
5. Enable sync, then bookmark an HTTPS website in the selected folder.
6. Check Activity and the Notion database for the saved entry. The bookmark folder/date/default status are included when mapped.
7. Pause syncing, add another bookmark, and resume to check pending work.
8. Disconnect in Settings when finished. Previously saved Notion entries remain in the user's database.

No shared reviewer account or publisher credentials are required. The hosted connection service must remain available throughout review.

## Remaining release work

- [x] Verify a real Notion authorization and bookmark save using `dist-public` and Supabase.
- [x] Reconnect and verify a real save with the store-assigned ID in version 0.1.1.
- [x] Complete the hosted checks: folder scope, pause/resume, browser restart, optional import, reconnect, and disconnect.
- [x] Upload version 0.1.0 as an unpublished draft item. The upload manifest omits `key`; the unpacked build retains it.
- [x] Obtain and verify the draft's assigned extension ID/public key, then update the public build and Supabase's `ALLOWED_EXTENSION_ID`.
- [x] Rebuild version 0.1.1, repeat the matching-identity checks, and create the replacement ZIP.
- [x] Upload version 0.1.1 to the existing draft's Package tab.
- [x] Prepare version 0.1.2 and the listing images with verified dimensions.
- [x] Upload version 0.1.2 and save its listing/disclosures (owner confirmed).
- [ ] Activate and verify the dedicated PostHog project, publish the updated policy, then package and upload 0.1.3.
- [ ] Update the saved listing/disclosures for optional analytics and review the final listing.
- [ ] Submit the completed item for Chrome Web Store review.

Uploading a draft does not publish the extension. The current ZIP updates the existing draft and is not evidence of a completed store release.

Official guidance: [Upload and publish an item](https://developer.chrome.com/docs/webstore/publish), [obtain the store-assigned public key](https://developer.chrome.com/docs/extensions/reference/manifest/key).
