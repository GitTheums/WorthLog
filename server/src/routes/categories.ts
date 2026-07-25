import type Database from 'better-sqlite3';
import { Router } from 'express';
import type { UpdateCategoryInput } from '../db/types.js';
import {
  createCategory,
  deleteCategory,
  listCategories,
  reorderCategories,
  updateCategory,
} from '../db/repositories/categories.js';
import { sendData } from '../http/response.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  createCategoryBodySchema,
  reorderCategoriesBodySchema,
  updateCategoryBodySchema,
} from '../validation/schemas.js';

function toUpdateCategoryInput(
  body: ReturnType<typeof updateCategoryBodySchema.parse>,
): UpdateCategoryInput {
  const input: UpdateCategoryInput = {};

  if (body.name !== undefined) {
    input.name = body.name;
  }
  if (body.color !== undefined) {
    input.color = body.color;
  }
  if (body.icon !== undefined) {
    input.icon = body.icon;
  }
  if (body.sortOrder !== undefined) {
    input.sortOrder = body.sortOrder;
  }
  if (body.archived !== undefined) {
    input.archived = body.archived;
  }

  return input;
}

export function createCategoriesRouter(db: Database.Database): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler((req, res) => {
      const includeArchivedParam = req.query['includeArchived'];
      const includeArchived =
        typeof includeArchivedParam === 'string' &&
        includeArchivedParam.toLowerCase() === 'true';

      const categories = listCategories(db, { includeArchived });
      sendData(res, categories);
    }),
  );

  router.post(
    '/reorder',
    asyncHandler((req, res) => {
      const body = reorderCategoriesBodySchema.parse(req.body);
      const categories = reorderCategories(db, body.categoryIds);
      sendData(res, categories);
    }),
  );

  router.post(
    '/',
    asyncHandler((req, res) => {
      const body = createCategoryBodySchema.parse(req.body);
      const category = createCategory(db, body);
      sendData(res, category, 201);
    }),
  );

  router.patch(
    '/:id',
    asyncHandler((req, res) => {
      const body = updateCategoryBodySchema.parse(req.body);
      const category = updateCategory(
        db,
        String(req.params['id']),
        toUpdateCategoryInput(body),
      );
      sendData(res, category);
    }),
  );

  router.delete(
    '/:id',
    asyncHandler((req, res) => {
      deleteCategory(db, String(req.params['id']));
      res.status(204).send();
    }),
  );

  return router;
}
