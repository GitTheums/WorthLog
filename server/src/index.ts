import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp();

app.listen(config.PORT, () => {
  console.log(`WorthLog API listening on http://localhost:${String(config.PORT)}`);
});
