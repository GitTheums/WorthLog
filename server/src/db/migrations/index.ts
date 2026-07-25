import type { Migration } from '../migrate.js';
import { migration001Initial } from './001_initial.js';
import { migration002SortOrderAndNote } from './002_sort_order_and_note.js';

export const migrations: readonly Migration[] = [
  migration001Initial,
  migration002SortOrderAndNote,
];
