import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/index.js';

const config = loadConfig();
const db = openDatabase(config.DATA_DIR);
const app = createApp(db, { dataDir: config.DATA_DIR });

app.listen(config.PORT, () => {
  console.log(
    `WorthLog API listening on http://localhost:${String(config.PORT)}`,
  );
});
