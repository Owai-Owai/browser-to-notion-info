# Optional usage analytics

The owner selected PostHog with explicit opt-in. Version 0.1.3 adds the controls and delivery code. Existing installations migrate with sharing **off**. Local pilot builds do not offer usage sharing.

## Activation status

The dedicated **Browser to Notion** project is not created yet. The connected Owai organization has one non-demo project (`Default project`) and a one-project allowance. No existing project was changed, no paid upgrade was started, and no live product events were sent. The owner must choose a separate organization, the existing project, or a plan that permits another project before activation.

The source changes are prepared for review. Do not distribute 0.1.3 until the project, forwarding service, published privacy policy, and store disclosures are configured and verified together. Version 0.1.2 remains the saved Web Store draft.

## Data flow and consent

The optional checkbox appears in the final setup step and Settings. It saves consent in Chrome local storage. The service worker creates a random installation UUID when the user first opts in. This is pseudonymous, not an identified account or a count of people. Disconnecting or reinstalling resets it. Opting out retains the ID for deletion requests, clears unsent events, aborts an active request where possible, and stops collection. An already-sent request can finish.

The worker sends strict, manually defined events to the existing authenticated Supabase route, `/v1/analytics`. Supabase forwards to PostHog. There is no analytics SDK, autocapture, session replay, person profile, or additional Chrome host permission. It does not forward client IPs or request headers. GeoIP enrichment is disabled and `$ip` is null. No URLs, titles, folder names, Notion identifiers/content, credentials, or raw errors are accepted by the analytics schema.

| Event | Allowed additional properties | Meaning |
| --- | --- | --- |
| `bns_usage_enabled` | none | User explicitly turns sharing on |
| `bns_sync_enabled` | `firstSetup` boolean | Setup/configuration succeeds while opted in |
| `bns_bookmark_saved` | `source`: automatic/import; `result`: saved/duplicate | A save finishes or an existing URL is found |
| `bns_save_failed` | finite `category` enum | First failed attempt in a save/retry cycle |
| `bns_import_started` | none | User starts an import |
| `bns_sync_paused` | none | User pauses sync |
| `bns_sync_resumed` | none | User resumes sync |

Every event has the extension version, event UUID and timestamp. The envelope contains `consent: true` and the random installation ID. Property names and values are allowlisted by Zod on both sides. Unknown fields reject the batch.

## Reliability and retention

The local queue holds at most 100 events, in batches of 25. Pending events expire after seven days when the extension runs. UUIDs stay unchanged on retries for provider deduplication. Successful requests wait at least 30 seconds before another batch; failures wait five minutes. Service-worker restarts may postpone delivery. Analytics runs separately from bookmark saving; failures cannot change save outcomes.

The service requires the extension origin and a valid connection session. A service-only PostgreSQL RPC limits each connection to 1,000 forwarded events per hour. It stores only a counter and expiry, with deletion cascading on disconnect. This cap can drop analytics from large imports. Consent, blocked connections, offline usage, queue caps, and provider ingestion delays all limit measurement coverage.

No operator-configured automatic PostHog expiry is promised yet. The published policy must state the actual setting. For deletion requests, ask for the Usage data ID from Settings, delete events for that distinct ID through PostHog's supported deletion workflow, and verify completion. Do not request Notion credentials. Disconnecting deletes service records; it does not automatically delete already-ingested PostHog events.

## Configure and deploy after project selection

1. Create or select the confirmed project. Use its project capture token, **not a personal API key**. Keep it in the ignored `.env.supabase.local`:

   ```dotenv
   POSTHOG_PROJECT_TOKEN=YOUR_PROJECT_CAPTURE_TOKEN
   POSTHOG_HOST=https://us.i.posthog.com
   ```

   Use `https://eu.i.posthog.com` for an EU project. Only these ingestion hosts are allowed. Never put the token in a `VITE_` variable or extension files.
2. Run tests, type checking, lint, the public build, Supabase build and Deno check. Apply `202611180002_usage_rate_limit.sql` with `npx supabase db push --remote --yes` after inspecting the dry run.
3. Upload secrets and deploy only `notion-sync` using the commands in [SUPABASE-SETUP.md](SUPABASE-SETUP.md).
4. Generate the privacy page (`npm run privacy:build`), copy the generated privacy page to the repository root `privacy.html`, and publish through the existing GitHub Pages main branch. Verify the actual live page mentions optional PostHog analytics before distributing the new build.
5. Use an isolated installation and synthetic content to verify no analytics before consent, opted-in delivery through Supabase, and no new events after opt-out. Confirm events reach the selected PostHog project; an ingestion HTTP success alone is insufficient. Keep synthetic verification events separate from real adoption metrics.
6. Create the dashboard below, run each query, and verify it. Package 0.1.3 and update the existing Web Store draft and disclosures. Do not submit the obsolete no-analytics disclosures.

## Dashboard: Browser to Notion usage

These are proposed definitions, not approved Data Catalog metrics. Before saving reusable metrics, inspect the target project's catalog and reuse matching approved definitions where present. All tiles measure **opted-in installations**, not all extension users. Exclude separately marked synthetic verification data.

- **Weekly active installations:** weekly distinct installation IDs with `bns_bookmark_saved`, including saved and duplicate outcomes. A person using two profiles can count twice.
- **New saves and duplicates:** daily event counts of `bns_bookmark_saved`, split by `result`. Duplicate results are successful checks, not new Notion entries.
- **Failure categories:** `bns_save_failed` counts split by category. This is first-attempt failure frequency, not a final save-failure rate or an availability SLO.
- **Setup to first new save:** ordered funnel from `bns_sync_enabled` with `firstSetup=true` to `bns_bookmark_saved` with `result=saved`, within seven days. It covers users who opted in before completing setup; opting in later provides no retrospective setup data.
- **Weekly saving retention:** installations with `bns_bookmark_saved` returning to the same event in later weeks. Start with eight weeks; short launch history will leave later weeks empty.
- **Imports started:** weekly counts of `bns_import_started`; importing zero eligible bookmarks can still produce this event.

PostHog references: [manual capture API](https://posthog.com/docs/api/capture), [collection controls](https://posthog.com/docs/privacy/data-collection), [events without person profiles](https://posthog.com/docs/data/anonymous-vs-identified-events).
