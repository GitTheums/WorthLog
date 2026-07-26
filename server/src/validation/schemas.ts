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

function isValidCalendarDate(value: string): boolean {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine(isValidCalendarDate, 'date must be a valid calendar date');

export const dashboardRangeSchema = z.enum(['1m', '3m', '1y', 'all']);

export const pinSchema = z
  .string()
  .regex(/^\d{4,8}$/, 'PIN must be 4 to 8 numeric digits');

export const pinBodySchema = z.object({
  pin: pinSchema,
});

export const changePinBodySchema = z.object({
  currentPin: pinSchema,
  newPin: pinSchema,
});

export const removePinBodySchema = z.object({
  currentPin: pinSchema,
});

export const amountCentsSchema = z
  .number()
  .int()
  .nonnegative()
  .max(
    Number.MAX_SAFE_INTEGER,
    'amountCents must be at most Number.MAX_SAFE_INTEGER',
  );

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
  amountCents: amountCentsSchema,
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
  amountCents: amountCentsSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const backupSnapshotSchema = z.object({
  id: z.uuid(),
  date: isoDateSchema,
  note: z.string().max(2000).nullable(),
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
