import type Database from 'better-sqlite3';
import express from 'express';
import { createHealthRouter } from './routes/health.js';

export function createApp(db: Database.Database) {
  const app = express();

  app.use(express.json());
  app.use('/api', createHealthRouter(db));

  return app;
}
