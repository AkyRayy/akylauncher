import { z } from 'zod';

export const VersionManifestSchema = z.object({
  latest: z.object({ release: z.string(), snapshot: z.string() }),
  versions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['release', 'snapshot', 'old_beta', 'old_alpha']),
      url: z.string().url(),
      releaseTime: z.string()
    })
  )
});
export type VersionManifest = z.infer<typeof VersionManifestSchema>;

const DownloadSchema = z.object({
  sha1: z.string(),
  size: z.number(),
  url: z.string().url()
});

const OsRuleSchema = z.object({
  action: z.enum(['allow', 'disallow']),
  os: z
    .object({
      name: z.enum(['windows', 'linux', 'osx']).optional(),
      arch: z.string().optional()
    })
    .optional(),
  features: z.record(z.boolean()).optional()
});
export type OsRule = z.infer<typeof OsRuleSchema>;

const LibrarySchema = z.object({
  name: z.string(),
  downloads: z
    .object({
      artifact: DownloadSchema.extend({ path: z.string() }).optional(),
      classifiers: z.record(DownloadSchema.extend({ path: z.string() })).optional()
    })
    .optional(),
  natives: z.record(z.string()).optional(),
  rules: z.array(OsRuleSchema).optional()
});
export type Library = z.infer<typeof LibrarySchema>;

const ArgValueSchema = z.union([z.string(), z.array(z.string())]);
const ConditionalArgSchema = z.union([
  z.string(),
  z.object({ rules: z.array(OsRuleSchema), value: ArgValueSchema })
]);
export type ConditionalArg = z.infer<typeof ConditionalArgSchema>;

export const VersionJsonSchema = z.object({
  id: z.string(),
  type: z.string(),
  mainClass: z.string(),
  assets: z.string().optional(),
  assetIndex: z.object({ id: z.string(), url: z.string().url(), sha1: z.string() }).optional(),
  downloads: z.object({ client: DownloadSchema }).optional(),
  libraries: z.array(LibrarySchema),
  arguments: z
    .object({
      game: z.array(ConditionalArgSchema).optional(),
      jvm: z.array(ConditionalArgSchema).optional()
    })
    .optional(),
  minecraftArguments: z.string().optional(),
  javaVersion: z.object({ majorVersion: z.number() }).optional(),
  inheritsFrom: z.string().optional()
});
export type VersionJson = z.infer<typeof VersionJsonSchema>;

export const AssetIndexSchema = z.object({
  objects: z.record(z.object({ hash: z.string(), size: z.number() }))
});
export type AssetIndex = z.infer<typeof AssetIndexSchema>;
