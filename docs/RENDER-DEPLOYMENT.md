# Archived Render deployment option

Supabase is the chosen public backend. This earlier option is retained for future reference; start with SUPABASE-SETUP.md.

# Public release preparation

The consumer UI is prepared. Publishing still requires deploying the hosted service, configuring the publisher's OAuth connection, and testing a real installation against it. End users should only install the extension, connect Notion, choose a database, and choose bookmark folders.

## Recommended initial deployment

Use the included `render.yaml` to create **one Render Node web service with a persistent disk**. Render supplies an HTTPS `onrender.com` address, so a custom domain is optional. The service stores SQLite under `/var/data`; an ephemeral/free filesystem would lose credentials and save records on redeploy. The Blueprint selects a **paid Starter service and a 1 GB disk**. Review the current price in Render before creating it. No service has been provisioned by this work.

This is a single-instance initial release. Keep `numInstances: 1`; multiple instances need a shared database and distributed save coordination first. Disk-backed redeployments briefly interrupt service; extension queues retry safely. Keep the disk and encryption key together across redeployments.

Use one active extension installation per destination database for this initial release. Users in the same Notion workspace can connect independently and use separate collections; concurrent saves from multiple installations into the same database are not coordinated.

The client-address configuration follows [Render's edge architecture](https://render.com/articles/how-render-handles-ddos-attacks) and [Cloudflare's connecting-IP header](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip).

Sources: [Render web services](https://render.com/docs/web-services), [persistent disks and limitations](https://render.com/docs/disks), [Blueprint configuration](https://render.com/docs/blueprint-spec), and [Node version configuration](https://render.com/docs/node-version).

## Publisher setup

1. Put the project in a Git repository linked to Render. Keep `.env.local`, `.env.public.local`, `.data`, build output, and release archives out of the repository.
2. Reserve/create the Chrome Web Store draft and obtain its assigned extension ID and public key. Set `extension.config.json` to that public key before the final public build. Do not assume the local development key will match the store's assigned identity. Existing local installations retain the development identity until you deliberately change the key.
3. Create a production Notion OAuth integration owned by the publisher. Users grant it access; they do not create integrations or handle secrets. Enable Read content and Insert content; user information capabilities are unnecessary. Set its registered redirect to `https://YOUR_SERVICE.onrender.com/oauth/callback` using your actual service hostname. Confirm the integration is eligible for authorization by users outside your own workspace in Notion's portal.
4. Create a Render Blueprint using `render.yaml`. Choose the service name/region and confirm the paid resources. Set the values below in Render's environment settings. Use a fresh production encryption key and production OAuth credentials; preserve the current local pilot separately.

| Variable | Value |
| --- | --- |
| SERVICE_PUBLIC_URL | Actual HTTPS origin, with no trailing path |
| NOTION_REDIRECT_URI | The same origin followed by `/oauth/callback` |
| NOTION_CLIENT_ID | Production Notion OAuth client ID |
| NOTION_CLIENT_SECRET | Production client secret, only in Render |
| TOKEN_ENCRYPTION_KEY | 64 hexadecimal characters, generated once and backed up securely |
| ALLOWED_EXTENSION_ID | Assigned store extension ID, exactly 32 letters a–p |
| PUBLISHER_NAME | Actual publisher/operator name for the privacy policy |
| SUPPORT_EMAIL | Monitored support and privacy email address |

Generate the encryption key locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, then paste it directly into the host's secret settings. Do not paste it into chat or a `VITE_*` variable.

The Blueprint binds to `0.0.0.0` on Render's supplied port and serves `/healthz`, `/`, and `/privacy`. HTTPS terminates at Render's proxy. `TRUST_PROXY=true` and `CLIENT_IP_HEADER=cf-connecting-ip` are for this Render/Cloudflare edge deployment; leave proxy trust false when running directly. Before launch, confirm Render forwards that edge-provided address header. If it is absent, rate limits deliberately fall back to the socket address. Reconfigure and verify the trusted address header before using another host or adding another proxy. Authentication attempts are limited per client address; the global number of pending OAuth attempts is bounded separately. API requests accept only the configured extension origin. Each installation owns a separate service session, even when several users connect the same Notion workspace.

## Privacy and store listing

Read the generated `/privacy` page with the real publisher name and support email before launch. It describes bookmark data, Notion/Render sharing, service metadata, retention, deletion, and backups. Verify the stated seven-day hosting backup window matches the deployed backup configuration. Keep the policy aligned with any infrastructure or analytics changes.

The service performs inactive-record cleanup hourly. Active service records are deleted on disconnect; entries already saved in Notion remain. Removing the extension alone does not send a deletion request. Provide support for privacy and deletion requests, including records restored from backups. Do not log OAuth callback query strings, authorization headers, or bookmark bodies in any additional proxy or monitoring system you configure.

Add the public `/privacy` URL to the Web Store's privacy policy field and complete its data disclosures accurately. Suggested purpose: **Save website bookmarks from selected Chrome folders to the user's chosen Notion database.**

Permission explanations:

- **Bookmarks:** read the folder tree and detect bookmarks within the user's chosen scope.
- **Storage:** retain settings, local session, queued bookmarks, and activity.
- **Alarms:** resume queued saves and reconcile missed changes after restarts.
- **Identity:** complete Notion authorization in Chrome's authentication window.
- **Host permission:** contact only the publisher's configured HTTPS connection service.

Sources: [Chrome privacy policy requirements](https://developer.chrome.com/docs/webstore/program-policies/privacy), [Notion OAuth](https://developers.notion.com/guides/authorization/overview), and [extension ID/key setup](https://developer.chrome.com/docs/extensions/reference/manifest/key).

## Build the public extension

Copy `.env.public.example` to `.env.public.local` and replace its address with the actual deployed origin. It contains only a public URL. Then run:

```powershell
npm run build:public
npm run verify:public
```

The public build uses `dist-public`, keeps local `dist` separate, excludes source maps and sample-data behavior, and refuses a localhost or insecure service address. `verify:public` checks the package, contacts the live service, verifies its configured extension ID, and checks the public privacy page. Do not publish a build created with a demonstration hostname.

Load `dist-public` as an unpacked extension in an isolated Chrome profile for the final real test. Use another Notion workspace and a duplicate of the starter template. Verify connect, bookmark save, folder scope, pause/resume, browser restart, optional import, reconnect, and disconnect. Verify two separate installations in the same workspace can connect and disconnect independently. Automated upstream tests do not replace these real-account checks.

After those checks pass, zip only the **contents** of `dist-public` and upload the archive to the Web Store draft. Prepare store screenshots from the installed public build, a support URL/contact, listing copy, and required promotional assets. Do not upload local pilot ZIPs, service source, environment files, SQLite files, or research screenshots with workspace details.

## Remaining launch actions

- Deploy the Blueprint and enter publisher details and production secrets.
- Confirm the store identity and production OAuth redirect.
- Review the live privacy page and complete store disclosures.
- Pass `verify:public` and the real-account checks above.
- Upload the public archive and submit it for store review.

The extension has not been deployed or submitted for store review as part of preparation.
