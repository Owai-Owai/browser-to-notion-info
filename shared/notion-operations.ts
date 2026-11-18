import { z } from 'zod';
import { ApiError } from './api-error.ts';
import type { ConfiguredDestination, Bookmark, Destination } from './schema.ts';
import { isOriginalTemplateLink } from './notion-template.ts';
export const recordSchema = z.record(z.string(), z.unknown());
const textSchema = z.array(z.object({ plain_text: z.string().optional(), text: z.object({ content: z.string() }).optional() }));
const pageSchema = z.object({ id: z.string(), url: z.string(), properties: z.record(z.string(), z.object({ type: z.string(), url: z.string().nullable().optional() }).passthrough()) });
const querySchema = z.object({ results: z.array(pageSchema), has_more: z.boolean(), next_cursor: z.string().nullable() });
const propertySchema = z.object({
  id: z.string(), name: z.string(), type: z.string(),
  status: z.object({ options: z.array(z.object({ id: z.string(), name: z.string() })) }).optional(),
  select: z.object({ options: z.array(z.object({ id: z.string(), name: z.string() })) }).optional(),
});
const sourceSchema = z.object({ id: z.string(), title: textSchema.optional(), properties: z.record(z.string(), propertySchema) });


export function notionId(link: string) {
  let url: URL;
  try { url = new URL(link); } catch { throw new ApiError(400, { code: "validation", message: "Paste a complete Notion board or database link." }); }
  if (url.protocol !== "https:" || !["notion.so", "notion.site", "notion.com"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new ApiError(400, { code: "validation", message: "Use an HTTPS Notion board or database link." });
  const match = url.pathname.match(/([a-f\d]{32}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})\/?$/i);
  if (!match) throw new ApiError(400, { code: "validation", message: "Copy the source database link from Notion and paste it here." });
  return match[1].replaceAll("-", "");
}


export type NotionRequest<C> = (connection: C, path: string, body?: unknown, method?: string) => Promise<unknown>;

/** Database mapping and Notion payload rules are shared by local and hosted services. */
export function notionOperations<C>(request: NotionRequest<C>) {
  async function resolveDestinations(connection: C, link: string): Promise<Destination[]> {
    if (isOriginalTemplateLink(link)) throw new ApiError(400, { code: "destination", message: "Duplicate the starter template into your workspace, then paste the Bookmarks database link from your own copy." });
    const id = notionId(link);
    let sources: { id: string; name?: string }[];
    try {
      const database = z.object({ data_sources: z.array(z.object({ id: z.string(), name: z.string().optional() })) }).parse(await request(connection, `/databases/${id}`));
      sources = database.data_sources;
    } catch (error) {
      if (!(error instanceof ApiError) || error.failure.code !== "destination") throw error;
      try { const source = sourceSchema.parse(await request(connection, `/data_sources/${id}`)); sources = [{ id: source.id }]; }
      catch { throw new ApiError(400, { code: "destination", message: "Share the source database with this integration, then paste its database link. A page containing a linked board may need the original source link." }); }
    }
    const result: Destination[] = [];
    for (const source of sources) {
      const data = sourceSchema.parse(await request(connection, `/data_sources/${source.id}`));
      result.push({ id: data.id, name: data.title?.map(part => part.plain_text ?? part.text?.content ?? "").join("") || source.name || "Untitled collection", url: link,
        properties: Object.values(data.properties).map(property => ({ id: property.id, name: property.name, type: property.type, options: property.status?.options ?? property.select?.options ?? [] })),
      });
    }
    if (!result.length) throw new ApiError(400, { code: "destination", message: "This database does not contain an accessible data source." });
    return result;
  }

  async function validateMapping(connection: C, destination: ConfiguredDestination) {
    const data = sourceSchema.parse(await request(connection, `/data_sources/${destination.id}`));
    const props = Object.values(data.properties);
    const requireType = (id: string | undefined, types: string[]) => {
      if (id && !props.some(property => property.id === id && types.includes(property.type))) throw new ApiError(400, { code: "schema", message: "A mapped Notion property was removed or changed type. Update your property mappings." });
    };
    requireType(destination.mapping.titleId, ["title"]); requireType(destination.mapping.urlId, ["url"]);
    requireType(destination.mapping.folderId, ["rich_text"]); requireType(destination.mapping.dateId, ["date"]);
    requireType(destination.mapping.statusId, ["status", "select"]);
    if (destination.mapping.statusId) {
      const property = props.find(prop => prop.id === destination.mapping.statusId)!;
      const options = property.status?.options ?? property.select?.options ?? [];
      if (!options.some(option => option.id === destination.mapping.statusValue)) throw new ApiError(400, { code: "schema", message: "Choose an existing status/category value in your mappings." });
    }
    return props;
  }

  async function findPages(connection: C, destination: ConfiguredDestination, urls: string[]) {
    const pages: z.infer<typeof pageSchema>[] = [];
    let cursor: string | null = null;
    do {
      const response: unknown = await request(connection, `/data_sources/${destination.id}/query`, {
        page_size: 100, ...(cursor ? { start_cursor: cursor } : {}),
        filter: { or: urls.map(url => ({ property: destination.mapping.urlId, url: { equals: url } })) },
      });
      const data = querySchema.parse(response); pages.push(...data.results); cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);
    return pages;
  }

  async function createPage(connection: C, destination: ConfiguredDestination, bookmark: Bookmark) {
    const { mapping } = destination;
    if (bookmark.url.length > 2000 || bookmark.title.length > 2000 || (mapping.folderId && bookmark.folderPath.length > 2000)) throw new ApiError(400, { code: "item", message: "This bookmark exceeds a Notion field limit (2,000 characters). Shorten its title/path or save a shorter website URL." });
    const properties: Record<string, unknown> = {
      [mapping.titleId]: { title: [{ text: { content: bookmark.title } }] },
      [mapping.urlId]: { url: bookmark.url },
    };
    if (mapping.folderId) properties[mapping.folderId] = { rich_text: [{ text: { content: bookmark.folderPath } }] };
    if (mapping.dateId) properties[mapping.dateId] = { date: { start: new Date(bookmark.dateAdded).toISOString() } };
    if (mapping.statusId && mapping.statusValue) {
      const property = destination.properties.find(prop => prop.id === mapping.statusId);
      if (property) properties[mapping.statusId] = { [property.type]: { id: mapping.statusValue } };
    }
    return z.object({ id: z.string(), url: z.string().url() }).parse(await request(connection, "/pages", { parent: { type: "data_source_id", data_source_id: destination.id }, properties }));
  }

  return { resolveDestinations, validateMapping, findPages, createPage };
}
