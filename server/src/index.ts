import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/index.js';

function resolveClientDistDir(
  nodeEnv: string,
  configured?: string,
): string | undefined {
  if (configured) {
    return configured;
  }

  if (nodeEnv !== 'production') {
    return undefined;
  }

  const candidate = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'client',
    'dist',
  );

  return existsSync(join(candidate, 'index.html')) ? candidate : undefined;
}

const config = loadConfig();
const db = openDatabase(config.DATA_DIR);
const clientDistDir = resolveClientDistDir(
  config.NODE_ENV,
  config.CLIENT_DIST_DIR,
);
const app = createApp(db, {
  dataDir: config.DATA_DIR,
  ...(clientDistDir ? { clientDistDir } : {}),
});

app.listen(config.PORT, () => {
  const mode = clientDistDir
    ? `API + frontend (${clientDistDir})`
    : 'API only';
  console.log(
    `WorthLog listening on http://localhost:${String(config.PORT)} [${mode}]`,
  );
});
