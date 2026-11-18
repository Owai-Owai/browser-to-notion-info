# Public release

The chosen backend is **Supabase Edge Functions + PostgreSQL**. Follow [SUPABASE-SETUP.md](SUPABASE-SETUP.md) for project creation, secrets, migration, maintenance, deployment, privacy hosting, and the public extension build.

The Supabase project, protected database, hourly cleanup, hosted service, and public privacy site are deployed. The public build and automated/live service checks pass. The owner verified a real Notion authorization and bookmark save using the initial `dist-public` build; Supabase independently recorded the connection and saved operation. An unpublished Chrome Web Store draft now exists with ID `aneibajfligcbdfodclcfelpgcenmojk`.

Version **0.1.1** was accepted by that draft, and a real save under the store identity was verified. The owner also confirmed all hosted behavior checks. The current replacement is **0.1.2**, `release/browser-to-notion-public-0.1.2.zip`, which corrects singular folder labels and supplies the required store-icon padding. Public package tests and live verification pass.

The store images are ready in `release/store-assets`: three verified 1280x800 screenshots and a padded 128x128 icon. They show the actual UI components with fictional local data. Listing copy, reviewer instructions, and data-handling facts are in [STORE-LISTING.md](STORE-LISTING.md).

For the hosted test, load **`dist-public`** in a separate Chrome profile. In the profile used for the earlier hosted test, remove its old test extension, load the new `dist-public`, and connect Notion again. Its ID should now be `aneibajfligcbdfodclcfelpgcenmojk`. **`dist`** remains the local pilot build, uses `npm run service`, and retains ID `gfedamiejepepigapmomljgcpjoioiak`. Render's earlier option is archived in [RENDER-DEPLOYMENT.md](RENDER-DEPLOYMENT.md).

## Identity and store disclosures

Use the store-assigned public key in `extension.config.json.key` and match the extension ID in Supabase's `ALLOWED_EXTENSION_ID`. `localKey` preserves the separate local pilot identity. Supply your public policy URL in the Web Store developer dashboard and complete data disclosures accurately. [Chrome key instructions](https://developer.chrome.com/docs/extensions/reference/manifest/key), [privacy requirements](https://developer.chrome.com/docs/webstore/program-policies/privacy).

Suggested purpose: **Save website bookmarks from selected Chrome folders to the user's chosen Notion database.**

| Permission | Purpose |
| --- | --- |
| bookmarks | Read the folder tree and detect eligible bookmarks |
| storage | Retain settings, queued work, a service session, and activity |
| alarms | Resume work and reconcile changes after restarts |
| identity | Complete Notion authorization through Chrome |
| Configured HTTPS host | Contact the publisher's connection service |

## Validate and package

```powershell
npm run typecheck
npm run lint
npm test
npm run check:supabase
npm run build:supabase
npm run build
npm run test:e2e
npm run build:public
npm run test:public-package
npm run verify:public
npm run package:store
```

The final commands require your real public addresses. Test the installed public build against real Notion, then run `npm run package:store`. It creates `release/browser-to-notion-public-VERSION.zip` from `dist-public` and omits the development-only manifest `key` from the upload ZIP. The unpacked build keeps its key for a stable development ID. The command verifies the packaged assets and checks the resulting archive. Prepare store screenshots, publisher/support details, listing copy, and required assets. Do not upload local-pilot ZIPs, service source, environment files, SQLite files, or research screenshots with workspace details.

Save/refresh claims and write intents live in PostgreSQL, so separate function instances coordinate through durable records. A save with an uncertain result stays under reconciliation. Pending bookmarks remain in Chrome while the provider is unavailable.

The backend and privacy site are live, automated store-identity checks pass, and the owner completed live testing. Uploading 0.1.2, filling the listing/disclosures, reviewing the final draft, and submitting it for review remain unfinished.
