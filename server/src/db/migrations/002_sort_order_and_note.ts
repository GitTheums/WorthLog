import type { Migration } from '../migrate.js';

export const migration002SortOrderAndNote: Migration = {
  version: 2,
  name: 'sort_order_and_note',
  up(db) {
    db.exec(`
      ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE snapshots ADD COLUMN note TEXT;
    `);

    const categories = db
      .prepare(
        `
          SELECT id
          FROM categories
          ORDER BY name COLLATE NOCASE ASC
        `,
      )
      .all() as Array<{ id: string }>;

    const updateSortOrder = db.prepare(
      `
        UPDATE categories
        SET sort_order = ?
        WHERE id = ?
      `,
    );

    categories.forEach((category, index) => {
      updateSortOrder.run(index, category.id);
    });
  },
};
