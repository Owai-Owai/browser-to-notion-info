# Notion starter template

The extension's first-time setup offers **Use the Notion template** and **Use my existing database**.

## Public template

[Open the starter template](https://owai.notion.site/Browser-to-Notion-Starter-template-41ccff4f3d6d81b5a373c956d33462b0)

This is an empty, publicly duplicatable page created separately from the owner's working bookmark library. Search-engine indexing was left off. Its **Bookmarks** database and reading board contain no personal bookmarks.

## New-user flow

1. Choose **Use the Notion template** in the extension.
2. Open the template and choose Notion's **Duplicate** action at the top right. The icon may appear as two overlapping squares.
3. Add the copy to your own workspace, then confirm this in the extension.
4. Connect Notion and grant access to the new copy and its database.
5. Open **Bookmarks** inside your copy, copy its database link, and check that link in the extension.
6. The extension matches all five starter fields using the property IDs from your own copy. Review or customize the mappings if needed.
7. Choose Chrome folders and enable sync. Existing imports remain optional.

| Bookmark information | Template property | Type |
| --- | --- | --- |
| Website title | Name | Title |
| Website link | URL | URL |
| Folder path | Bookmark Folder | Text |
| Bookmark date | Bookmarked At | Date |
| Reading state | Status | Status: To read / Reading / Read |

The default state is **To read**. Users move their own entries to **Reading** or **Read** in Notion.

## Maintenance

- The public URL and original page/database/source IDs are in `shared/notion-template.ts`. These are public identifiers, not credentials.
- The published original is rejected by the UI and connection service as a sync destination. Users must connect their own duplicate.
- Existing installations retain their current settings; the additional draft fields are optional for stored-state compatibility.
- Existing-database setup keeps its current mapping behavior. Optional fields are automatically suggested only for the template path.
- Renamed or missing starter fields fall back to manual review. They are never silently mapped by position.
- Changing template content updates the published original, not copies already owned by users.

Notion's duplication instructions: [Duplicate public pages](https://www.notion.com/help/duplicate-public-pages).
