import type Database from 'better-sqlite3';
import { Router } from 'express';
import { ValidationError } from '../db/errors.js';
import { listCategories } from '../db/repositories/categories.js';
import {
  deleteSnapshotByDate,
  getSnapshotDetailsByDate,
  listSnapshotDetails,
  upsertSnapshot,
} from '../db/repositories/snapshots.js';
import { HttpError } from '../http/errors.js';
import { sendData } from '../http/response.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  isoDateSchema,
  putSnapshotBodySchema,
} from '../validation/schemas.js';

function parseOptionalDate(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a YYYY-MM-DD string`);
  }

  return isoDateSchema.parse(value);
}

export function createSnapshotsRouter(db: Database.Database): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler((req, res) => {
      const from = parseOptionalDate(req.query['from'], 'from');
      const to = parseOptionalDate(req.query['to'], 'to');

      if (from !== undefined && to !== undefined && from > to) {
        throw new ValidationError('"from" must be on or before "to"');
      }

      const options: { from?: string; to?: string } = {};
      if (from !== undefined) {
        options.from = from;
      }
      if (to !== undefined) {
        options.to = to;
      }

      sendData(res, listSnapshotDetails(db, options));
    }),
  );

  router.get(
    '/:date',
    asyncHandler((req, res) => {
      const date = isoDateSchema.parse(req.params['date']);
      const snapshot = getSnapshotDetailsByDate(db, date);

      if (!snapshot) {
        throw new HttpError(
          404,
          'SNAPSHOT_NOT_FOUND',
          `Snapshot ${date} was not found`,
        );
      }

      sendData(res, snapshot);
    }),
  );

  router.put(
    '/:date',
    asyncHandler((req, res) => {
      const date = isoDateSchema.parse(req.params['date']);
      const body = putSnapshotBodySchema.parse(req.body);

      const categoryIds = body.values.map((value) => value.categoryId);
      if (new Set(categoryIds).size !== categoryIds.length) {
        throw new ValidationError('values must not contain duplicate category IDs');
      }

      const activeCategories = listCategories(db);
      const activeIds = new Set(activeCategories.map((category) => category.id));

      if (categoryIds.length !== activeIds.size) {
        throw new ValidationError(
          'values must include exactly one entry for every active category',
        );
      }

      for (const categoryId of categoryIds) {
        if (!activeIds.has(categoryId)) {
          throw new ValidationError(
            `Category ${categoryId} is not an active category`,
          );
        }
      }

      const existing = getSnapshotDetailsByDate(db, date);
      const snapshot = upsertSnapshot(db, {
        date,
        note: body.note ?? null,
        values: body.values,
      });

      sendData(res, snapshot, existing ? 200 : 201);
    }),
  );

  router.delete(
    '/:date',
    asyncHandler((req, res) => {
      const date = isoDateSchema.parse(req.params['date']);
      deleteSnapshotByDate(db, date);
      res.status(204).send();
    }),
  );

  return router;
}
