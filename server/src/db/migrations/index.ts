import type { Migration } from '../migrate.js';
import { migration001Initial } from './001_initial.js';
import { migration002SortOrderAndNote } from './002_sort_order_and_note.js';
import { migration003SecuritySettings } from './003_security_settings.js';

export const migrations: readonly Migration[] = [
  migration001Initial,
  migration002SortOrderAndNote,
  migration003SecuritySettings,
];
