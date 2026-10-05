import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve(import.meta.dirname, '..');
const destination = resolve(import.meta.dirname, 'public', 'docs');

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const directory of ['BA-docs', 'SA-docs', 'PM-docs']) {
  await cp(resolve(source, directory), resolve(destination, directory), {
    recursive: true,
    filter: (path) => !path.endsWith('.md') && !path.includes('/OpenAPI/dist'),
  });
}
