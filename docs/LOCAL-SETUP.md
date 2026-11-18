# Local pilot setup

## 1. Prepare the extension

Run these commands from the project folder:

```powershell
npm install
npm run setup:local
npm run build
```

`setup:local` creates `.env.local` if it does not exist and preserves existing values. It generates a local encryption key and prints the extension ID, without printing any secret. Keep the encryption key: replacing it makes previously stored service credentials unreadable.

Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select `dist`. The extension ID should match the ID printed by setup. `localKey` in `extension.config.json` keeps the pilot stable across rebuilds; older configurations fall back to `key`. The separate `key` field controls the hosted public build's store identity.

## 2. Create a Notion OAuth integration

Open [Notion's integration settings](https://www.notion.com/profile/integrations). Create a connection/integration for **Browser to Notion** using a workspace you control.

Choose an OAuth-capable integration. A public integration can use OAuth across workspaces; a scoped OAuth integration can be appropriate for your own workspace if offered by the current portal. Use the official [OAuth setup instructions](https://developers.notion.com/guides/authorization/overview) if the portal labels differ. An internal static-token integration does not use this app's OAuth flow.

Configure:

- **Read content**: needed to inspect the destination schema and find existing URLs.
- **Insert content**: needed to create bookmark entries.
- User information capabilities are unnecessary for the core flow.
- Register this exact OAuth redirect URI: `http://localhost:4318/oauth/callback`.

Use the hostname `localhost`, not the numeric IP address `127.0.0.1`: Notion's redirect validator rejects IP addresses. The localhost URL was accepted in the portal during setup verification. After typing it, press Enter to add it to the Redirect URIs list.

The extension's service URL remains `http://127.0.0.1:4318`; only the OAuth callback uses `localhost`. Both refer to the local service, which accepts either loopback hostname. If upgrading from the original guide, run `npm run setup:local` once to correct the old callback line while preserving your credentials, then restart `npm run service`.

Copy the OAuth **client ID** and **client secret** into the corresponding fields in the project's `.env.local` file:

```dotenv
NOTION_CLIENT_ID=YOUR_CLIENT_ID
NOTION_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

Leave `TOKEN_ENCRYPTION_KEY`, `ALLOWED_EXTENSION_ID`, the service URL, and the callback URI as generated. Enter credentials directly into that local file. Do not paste them into chat or browser UI fields.

## 3. Prepare your Notion destination

For a new collection, choose **Use the Notion template** in the extension and follow the [starter-template guide](NOTION-TEMPLATE.md). Duplicate the public template into your own workspace before authorizing Notion, then use the **Bookmarks** database link from your own copy.

If you already have a collection, choose **Use my existing database** and prepare the fields below.

Use an existing database, optionally displayed as a board. It needs:

| Property | Type | Needed |
| --- | --- | --- |
| A title/name field | Title | Required |
| A website field | URL | Required |
| A folder field | Text | Optional |
| A bookmark-date field | Date | Optional |
| A status/category field | Status or Select | Optional |

Property names can be anything; map them in setup. The extension does not create or modify the database schema. If a board has filters, a saved entry may be hidden until its properties match. Set an optional default status/category or use the direct entry link in Activity.

Copy the **source database** link. A full board-view link with the database ID in its path also works. For a board embedded on another page, use **Open source database** and copy that link if the containing page's link is rejected.

## 4. Start and connect

```powershell
npm run service
```

Leave this terminal running. The service should say that Notion OAuth is configured. If it asks for configuration, check `.env.local` and restart the service after editing it.

In the extension:

1. Select **Set up sync**, then **Connect Notion**.
2. In Notion's authorization window, select/grant access to the destination database or an appropriate parent page.
3. Return to setup and paste the source database/board link.
4. Check the link, confirm title/URL mappings, and optionally include folder/date/status fields.
5. Choose all folders or select specific Chrome folder roots. Descendant folders are included.
6. Leave existing import off for future-only capture, or preview the existing import before enabling.
7. Enable sync and add a real HTTP/HTTPS bookmark to an included Chrome folder.
8. Verify that the entry appears in Notion and the popup or Activity links to it.

This final real save is the live integration check. Never substitute a design-preview success for it.

## Troubleshooting

| Message | Action |
| --- | --- |
| Local service unavailable | Run `npm run service` on this computer. Verify port 4318 is available. |
| Origin rejected | Compare the loaded extension ID with `ALLOWED_EXTENSION_ID` in `.env.local`. Rebuild after regenerating a public key. |
| Notion not configured | Add the OAuth client ID/secret to `.env.local`, then restart the service. |
| Destination inaccessible | Grant the integration access in Notion, or reconnect and select the database during authorization. |
| Missing URL property | Add a URL property to the source database and check the link again. |
| Property changed | Update the mapping in Settings. Pending entries for that same destination receive the repaired mappings and resume; previously saved entries are untouched. |
| Checking previous save | The create response was uncertain. Check Notion and use **Check previous save**. No automatic second creation is attempted. |

Disconnect through Settings while the local service is running to remove its active credentials and application records. This leaves the database entries already saved in Notion intact.
