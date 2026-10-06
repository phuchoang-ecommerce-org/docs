import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';

const source = process.env.DOCS_ROOT ? resolve(process.env.DOCS_ROOT) : resolve(import.meta.dirname, '..');
const destination = resolve(import.meta.dirname, 'public', 'docs');
const utilityDirectory = basename(import.meta.dirname);

async function containsMarkdown(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(entries.map(async (entry) => {
    if (entry.name.startsWith('.')) return false;
    if (entry.isFile()) return entry.name.toLowerCase().endsWith('.md');
    return entry.isDirectory() && entry.name !== 'dist' && containsMarkdown(resolve(directory, entry.name));
  }));
  return contents.some(Boolean);
}

const fields = (await readdir(source, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== utilityDirectory);

const documentFields = (await Promise.all(
  fields.map(async (entry) => ({ entry, isDocumentField: await containsMarkdown(resolve(source, entry.name)) })),
)).filter(({ isDocumentField }) => isDocumentField);
const rootAssets = (await readdir(source, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && !entry.name.toLowerCase().endsWith('.md'));

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

await Promise.all(rootAssets.map((entry) => cp(resolve(source, entry.name), resolve(destination, entry.name))));

for (const { entry } of documentFields) {
  await cp(resolve(source, entry.name), resolve(destination, entry.name), {
    recursive: true,
    filter: (path) => {
      const pathParts = relative(source, path).split(sep);
      return !path.toLowerCase().endsWith('.md') && !pathParts.includes('dist');
    },
  });
}
