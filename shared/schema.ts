import { z } from "zod";

export const propertySchema = z.object({
  id: z.string(), name: z.string(), type: z.string(),
  options: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
});
export const mappingSchema = z.object({
  titleId: z.string().min(1), urlId: z.string().min(1),
  folderId: z.string().optional(), dateId: z.string().optional(),
  statusId: z.string().optional(), statusValue: z.string().optional(),
});
export const destinationSchema = z.object({
  id: z.string().min(1), name: z.string(), url: z.string().url(),
  properties: z.array(propertySchema),
});
export const configuredDestinationSchema = destinationSchema.extend({ mapping: mappingSchema });
export const scopeSchema = z.object({ mode: z.enum(["all", "selected"]), folderIds: z.array(z.string()) });
export const connectionSchema = z.object({ token: z.string(), workspaceId: z.string(), workspaceName: z.string() });
export const bookmarkSchema = z.object({
  id: z.string(), title: z.string(), url: z.string(), folderPath: z.string(), dateAdded: z.number(),
});
export const syncRequestSchema = z.object({
  operationId: z.string().uuid(), bookmark: bookmarkSchema,
  destination: configuredDestinationSchema,
});
export const syncResultSchema = z.object({
  status: z.enum(["saved", "duplicate"]), pageId: z.string(), pageUrl: z.string().url(),
  multipleMatches: z.boolean().optional(),
});
export const failureSchema = z.object({
  message: z.string(), code: z.string(), retryAfter: z.number().optional(),
});
export const jobStatusSchema = z.enum(["queued", "saving", "saved", "duplicate", "retry", "attention", "checking", "skipped", "cancelled"]);
export const jobSchema = z.object({
  id: z.string().uuid(), bookmark: bookmarkSchema, destination: configuredDestinationSchema, scope: scopeSchema,
  status: jobStatusSchema, createdAt: z.number(), updatedAt: z.number(), attempts: z.number(),
  retryAt: z.number(), batchId: z.string().optional(), error: failureSchema.optional(),
  result: syncResultSchema.optional(),
});
export const draftSchema = z.object({
  setupMethod: z.enum(["template", "existing"]).optional(),
  templateCopied: z.boolean().optional(),
  step: z.number().default(0), link: z.string().default(""),
  destinations: z.array(destinationSchema).default([]),
  selectedDestinationId: z.string().default(""),
  mapping: mappingSchema.partial().default({}),
  scope: scopeSchema.default({ mode: "selected", folderIds: [] }),
  importExisting: z.boolean().default(false),
});
export const appStateSchema = z.object({
  version: z.literal(1), connection: connectionSchema.optional(),
  destination: configuredDestinationSchema.optional(), scope: scopeSchema,
  enabled: z.boolean(), paused: z.boolean(),
  baseline: z.record(z.string(), z.boolean()), jobs: z.array(jobSchema),
  draft: draftSchema, lastReconciledAt: z.number(),
  lastError: z.string().optional(),
});
export type Property = z.infer<typeof propertySchema>;
export type Mapping = z.infer<typeof mappingSchema>;
export type Destination = z.infer<typeof destinationSchema>;
export type ConfiguredDestination = z.infer<typeof configuredDestinationSchema>;
export type Scope = z.infer<typeof scopeSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type Bookmark = z.infer<typeof bookmarkSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type AppState = z.infer<typeof appStateSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
export type SyncResult = z.infer<typeof syncResultSchema>;
export type Failure = z.infer<typeof failureSchema>;

export const initialState = (): AppState => ({
  version: 1, scope: { mode: "selected", folderIds: [] }, enabled: false, paused: false,
  baseline: {}, jobs: [], draft: draftSchema.parse({ setupMethod: "template" }), lastReconciledAt: 0,
});
export const pendingStatuses: Job["status"][] = ["queued", "saving", "retry", "checking"];
export const terminalStatuses: Job["status"][] = ["saved", "duplicate", "skipped", "cancelled"];

export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state") }),
  z.object({ type: z.literal("folders") }),
  z.object({ type: z.literal("connect") }),
  z.object({ type: z.literal("disconnect") }),
  z.object({ type: z.literal("clearHistory") }),
  z.object({ type: z.literal("draft"), draft: draftSchema }),
  z.object({ type: z.literal("resolve"), link: z.string() }),
  z.object({ type: z.literal("preview"), scope: scopeSchema, destination: configuredDestinationSchema }),
  z.object({ type: z.literal("configure"), scope: scopeSchema, destination: configuredDestinationSchema, importExisting: z.boolean(), discardPending: z.boolean().default(false) }),
  z.object({ type: z.literal("import"), scope: scopeSchema }),
  z.object({ type: z.literal("pause"), paused: z.boolean() }),
  z.object({ type: z.literal("retry"), id: z.string().optional() }),
  z.object({ type: z.literal("cancelImport"), batchId: z.string() }),
]);
export type Command = z.infer<typeof commandSchema>;
export interface FolderNode { id: string; title: string; children: FolderNode[]; bookmarkCount: number }
export interface ImportPreview { eligible: number; alreadyPresent: number; unsupported: number; toSave: number }
