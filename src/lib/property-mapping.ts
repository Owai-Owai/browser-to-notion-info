import type { Destination, Mapping } from "../../shared/schema";

/** Always use IDs from the user's database: duplicated Notion properties get new IDs. */
export function suggestMapping(destination: Destination, useTemplate = false): Partial<Mapping> {
  const unique = (type: string) => {
    const matches = destination.properties.filter(property => property.type === type);
    return matches.length === 1 ? matches[0].id : undefined;
  };
  const mapping: Partial<Mapping> = { titleId: unique("title"), urlId: unique("url") };
  if (!useTemplate) return mapping;
  const named = (name: string, types: string[]) => destination.properties.find(property => property.name === name && types.includes(property.type));
  const status = named("Status", ["status", "select"]);
  return {
    titleId: named("Name", ["title"])?.id ?? mapping.titleId,
    urlId: named("URL", ["url"])?.id ?? mapping.urlId,
    folderId: named("Bookmark Folder", ["rich_text"])?.id,
    dateId: named("Bookmarked At", ["date"])?.id,
    statusId: status?.id,
    statusValue: status?.options.find(option => option.name === "To read")?.id,
  };
}
