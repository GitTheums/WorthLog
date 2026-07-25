import type { Migration } from '../migrate.js';
import { migration001Initial } from './001_initial.js';

export const migrations: readonly Migration[] = [migration001Initial];
