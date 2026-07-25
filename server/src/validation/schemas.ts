import { z } from 'zod';

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'color must be a six-digit hex value like #2563EB');

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, 'name is required')
  .max(100, 'name must be at most 100 characters');

export const iconSchema = z
  .string()
  .trim()
  .min(1, 'icon is required')
  .max(100, 'icon must be at most 100 characters');

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

export const dashboardRangeSchema = z.enum(['1m', '3m', '1y', 'all']);

export const createCategoryBodySchema = z.object({
  name: categoryNameSchema,
  color: hexColorSchema,
  icon: iconSchema,
});

export const updateCategoryBodySchema = z
  .object({
    name: categoryNameSchema.optional(),
    color: hexColorSchema.optional(),
    icon: iconSchema.optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field must be provided',
  );

export const reorderCategoriesBodySchema = z.object({
  categoryIds: z.array(z.uuid()).min(1),
});

export const snapshotValueSchema = z.object({
  categoryId: z.uuid(),
  amountCents: z.number().int().nonnegative(),
});

export const putSnapshotBodySchema = z.object({
  note: z.string().max(2000).nullable().optional(),
  values: z.array(snapshotValueSchema).min(1),
});

export const patchSettingsBodySchema = z
  .object({
    currency: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .regex(/^[A-Za-z]{3}$/, 'currency must be a 3-letter code')
      .optional(),
    defaultRange: dashboardRangeSchema.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one setting must be provided',
  );

export const backupValueSchema = z.object({
  id: z.uuid(),
  snapshotId: z.uuid(),
  categoryId: z.uuid(),
  amountCents: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const backupSnapshotSchema = z.object({
  id: z.uuid(),
  date: isoDateSchema,
  note: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  values: z.array(backupValueSchema),
});

export const backupCategorySchema = z.object({
  id: z.uuid(),
  name: categoryNameSchema,
  color: hexColorSchema,
  icon: iconSchema,
  sortOrder: z.number().int().nonnegative(),
  archivedAt: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const backupSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const backupExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().min(1),
  settings: z.array(backupSettingSchema),
  categories: z.array(backupCategorySchema),
  snapshots: z.array(backupSnapshotSchema),
});

export type BackupExport = z.infer<typeof backupExportSchema>;
