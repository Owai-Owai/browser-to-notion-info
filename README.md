# Browser to Notion

A Manifest V3 Chrome extension that saves website bookmarks to a chosen Notion database. Built with React, TypeScript, Tailwind CSS, and official shadcn/ui components.

The everyday popup shows status, destination, and the latest save. A separate tab holds setup, folder selection, property mappings, imports, and activity.

First-time setup includes a [ready-made Notion template](https://owai.notion.site/Browser-to-Notion-Starter-template-41ccff4f3d6d81b5a373c956d33462b0). Users duplicate it before connecting Notion, then the extension matches the title, URL, folder, date, and reading-status fields. See [the template guide](docs/NOTION-TEMPLATE.md).

For public distribution, use [Supabase setup](docs/SUPABASE-SETUP.md) and the [release guide](docs/PUBLIC-RELEASE.md). Supabase Edge Functions run the OAuth service and PostgreSQL stores encrypted credentials and save records. Users need no local service, Supabase account, or integration keys. `npm run build:public` creates a separate HTTPS package in `dist-public`; the local pilot remains available below.

Version 0.1.3 adds optional, default-off PostHog usage sharing. It sends manually defined feature events and save outcomes under a random installation ID, without bookmark details or Notion content. Activation is pending selection of a dedicated PostHog organization/project; see [analytics setup and measurement definitions](docs/ANALYTICS.md). The saved Web Store draft is still 0.1.2. Do not distribute 0.1.3 until analytics, the published privacy policy, and store disclosures are verified together.

## Run the private pilot

Requires Node.js 24 or newer, npm, desktop Chrome, and a Notion workspace.

```powershell
npm install
npm run setup:local
npm run build
```

1. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this project's `dist` folder.
2. Follow [the local Notion setup guide](docs/LOCAL-SETUP.md) to create an OAuth integration and add its credentials to `.env.local`. Do not share or commit that file.
3. Run `npm run service` in a terminal and leave it running.
4. Open the extension, connect Notion, paste the source database/board link, map its title and URL properties, and choose bookmark folders.
5. Enable sync. Existing bookmarks are imported only if you explicitly preview and start an import.

The integration's client secret and Notion tokens stay in the local service. The extension receives a revocable service session. The service binds only to `127.0.0.1` and only accepts the configured extension origin.

## Development and checks

```powershell
npm run dev          # labelled sample-data design preview
npm run service      # real local OAuth / Notion service
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

In the design preview, open `/options.html` or `/popup.html`. Sample data never sends requests to Notion. Real bookmark access and sync are available in the built, loaded extension.

The Playwright configuration uses Microsoft Edge by default on this Windows machine. Install Edge or adjust `channel` in `playwright.config.ts` for another local browser.

Rebuild and reload the unpacked extension after source changes. `extension.config.json.key` matches the public build to the Chrome Web Store identity; `localKey` preserves the local pilot's separate ID. These public keys are not credentials.

Run `npm run verify:source` before committing. Private environment files, databases, builds, local screenshots, and downloaded research references stay outside Git. The repository's root `index.html` and `privacy.html` serve the existing GitHub Pages information site.

## Behavior

- Includes selected folder roots and their descendants, or all bookmark folders.
- Saves HTTP/HTTPS URLs, bookmark titles, and configured folder/date/status fields.
- Captures new bookmarks and existing bookmarks moved into scope. Optional imports include an explicit preview.
- Establishes a baseline so enabling future-only sync does not export old bookmarks.
- Preserves a local queue across worker and browser restarts. Pausing retains eligible new captures.
- Checks existing Notion URL properties, serializes writes, and stores an encrypted-service operation ledger for retry recovery.
- Retains ambiguous writes for reconciliation rather than repeating a possibly successful creation.
- Keeps later bookmark edits and deletions from changing saved Notion entries.

## Files

- `src/background`: Chrome events, durable queue, reconciliation, service RPC.
- `src/components`: popup, setup, folder picker, property mapping, settings, and activity.
- `src/components/ui`: official shadcn/ui Radix component source, installed by the CLI. The `cn` import uses the project's shared helper.
- `server`: local OAuth callback, encrypted SQLite credentials, destination resolution, duplicate checks, and Notion writes.
- `supabase/functions`: hosted HTTP/Notion service and PostgreSQL repository boundary.
- `supabase/migrations`: private tables, service-only RPC, atomic authorization/save/refresh claims, and expiry.
- `shared`: Zod validation shared by extension and service.
- `tests`: queue/destination/duplicate behavior and browser interface checks.
- `PRD.md` and `UI-RESEARCH.md`: product requirements and adopted design patterns. Downloaded research references remain local.

## Current boundaries

The local pilot supports one installation per destination and runs while Chrome and the local service are open. The Supabase backend coordinates concurrent function instances with database claims. Uncertain writes can remain in **Checking previous save** until their result becomes visible in Notion; the app never blindly creates another entry to clear that state. Ambiguous linked-board URLs require copying the source database link.

The service uses Notion API version `2025-09-03`, including data source parents. A real OAuth connection and save require your Notion integration configuration and access grant. Automated tests use a controlled upstream boundary and do not establish live Notion compatibility by themselves.

Completed local activity expires after 30 days. Unfinished work remains. Service sessions and credentials expire after 90 inactive days. Explicit disconnect removes application records and credentials from active SQLite tables; local disk backups and forensic recovery of deleted SQLite pages are under your computer's control. No cloud backup or analytics service is configured.

## Documentation used

- [shadcn/ui Vite setup](https://ui.shadcn.com/docs/installation/vite)
- [shadcn/ui Radix components](https://ui.shadcn.com/docs/components/radix/button)
- [Chrome Bookmarks API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)
- [Chrome identity flow](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [Notion OAuth](https://developers.notion.com/guides/authorization/overview)
- [Notion page creation](https://developers.notion.com/reference/post-page)
