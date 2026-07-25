import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageJsonPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'package.json',
);

interface PackageJson {
  version?: string;
}

export function getAppVersion(): string {
  const raw = readFileSync(packageJsonPath, 'utf8');
  const pkg = JSON.parse(raw) as PackageJson;
  return pkg.version ?? '0.0.0';
}
