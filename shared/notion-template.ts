/** Public, empty starter copy. These IDs never point at a user's library. */
export const notionTemplate = {
  url: "https://owai.notion.site/Browser-to-Notion-Starter-template-41ccff4f3d6d81b5a373c956d33462b0",
  pageId: "41ccff4f3d6d81b5a373c956d33462b0",
  databaseId: "41ccff4f3d6d81bf9dbbe19aa227af03",
  dataSourceId: "41ccff4f3d6d8108999d000beb58e73e",
} as const;

/** Reject the published original: every user must connect their own duplicate. */
export function isOriginalTemplateLink(link: string): boolean {
  try {
    const id = new URL(link).pathname.replaceAll("-", "").match(/[a-f\d]{32}\/?$/i)?.[0].replace(/\/$/, "").toLowerCase();
    return !!id && isOriginalTemplateId(id);
  } catch { return false; }
}

export function isOriginalTemplateId(id: string): boolean {
  const normalized = id.replaceAll("-", "").toLowerCase();
  return [notionTemplate.pageId, notionTemplate.databaseId, notionTemplate.dataSourceId].some(original => original === normalized);
}
