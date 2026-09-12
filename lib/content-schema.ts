import { z } from 'zod';

const id = z.string().min(1).max(100).optional();
export const contentPackageSchema = z.object({
  schemaVersion: z.literal('1.0'),
  title: z.string().min(1).max(120),
  source: z.string().max(120).default('manual'),
  summary: z.string().max(1000).default(''),
  scenes: z
    .array(
      z.object({
        id,
        title: z.string().min(1).max(100),
        chapter: z.string().max(60).default('Chapter 1'),
        description: z.string().max(2000).default(''),
        objective: z.string().max(1000).default(''),
        clues: z.array(z.string().max(500)).max(30).default([]),
        keeperNotes: z.string().max(4000).default(''),
      }),
    )
    .max(30)
    .default([]),
  cast: z
    .array(
      z.object({
        id,
        name: z.string().min(1).max(80),
        kind: z.enum(['npc', 'mob']),
        description: z.string().max(1000).default(''),
        motivation: z.string().max(500).default(''),
        hook: z.string().max(500).default(''),
        hidden: z.boolean().default(true),
        hp: z.number().int().min(0).max(999).nullable().default(null),
        stats: z
          .object({
            str: z.number().int().min(0).max(999).optional(),
            con: z.number().int().min(0).max(999).optional(),
            siz: z.number().int().min(0).max(999).optional(),
            dex: z.number().int().min(0).max(999).optional(),
            int: z.number().int().min(0).max(999).optional(),
            pow: z.number().int().min(0).max(999).optional(),
            fighting: z.number().int().min(0).max(100).optional(),
            damage: z.string().max(80).optional(),
            armor: z.string().max(100).optional(),
            sanityLoss: z.string().max(80).optional(),
          })
          .default({}),
      }),
    )
    .max(50)
    .default([]),
  handouts: z
    .array(
      z.object({
        id,
        title: z.string().min(1).max(100),
        body: z.string().max(5000),
        revealed: z.boolean().default(false),
      }),
    )
    .max(30)
    .default([]),
  encounters: z
    .array(
      z.object({
        id,
        title: z.string().min(1).max(100),
        hook: z.string().max(1000).default(''),
        opposition: z.string().max(1000).default(''),
        clue: z.string().max(1000).default(''),
        complication: z.string().max(1000).default(''),
        stakes: z.string().max(1000).default(''),
        difficulty: z.string().max(200).default('Regular'),
        sanityLoss: z.string().max(80).default('None'),
      }),
    )
    .max(20)
    .default([]),
  metadata: z.record(z.string(), z.string().max(500)).default({}),
});
export type ContentPackage = z.infer<typeof contentPackageSchema>;
export const integrationScopes = [
  'context:read',
  'imports:write',
  'assets:write',
] as const;

export const assetKindSchema = z.enum([
  'map',
  'token',
  'portrait',
  'handout',
  'sticker',
]);
export type AssetKind = z.infer<typeof assetKindSchema>;
