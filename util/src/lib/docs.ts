import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

export type Document = {
  path: string;
  title: string;
  summary: string;
  section: string;
};

export type FolderNode = {
  name: string;
  path: string;
  children: FolderNode[];
  document?: Document;
};

export function countDocuments(node: FolderNode): number {
  return node.document ? 1 : node.children.reduce((total, child) => total + countDocuments(child), 0);
}

const root = new URL('../../../../', import.meta.url).pathname;
const ignored = new Set(['.git', '.github', 'node_modules', 'util', 'dist']);

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (entry.name.startsWith('.') || ignored.has(entry.name)) return [];
    const target = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(target);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [target] : [];
  }));
  return nested.flat();
}

function firstUsefulLine(markdown: string): string {
  const line = markdown.split(/\r?\n/).find((value) => value.trim() && !value.startsWith('#') && !value.startsWith('|') && !value.startsWith('```'));
  return (line || 'Open this document to continue reading.')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>]/g, '')
    .trim()
    .slice(0, 150);
}

export async function getDocuments(): Promise<Document[]> {
  const files = await markdownFiles(root);
  const documents = await Promise.all(files.map(async (file) => {
    const source = await readFile(file, 'utf8');
    const filePath = relative(root, file).split(sep).join('/');
    const heading = source.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const section = filePath.includes('/') ? filePath.split('/')[0] : 'Overview';
    return {
      path: filePath,
      title: heading || filePath.replace(/\.md$/i, '').split('/').pop() || 'Untitled document',
      summary: firstUsefulLine(source),
      section,
    };
  }));
  return documents.sort((a, b) => a.path.localeCompare(b.path));
}

export async function getDocument(path: string): Promise<(Document & { source: string }) | undefined> {
  const documents = await getDocuments();
  const document = documents.find((candidate) => candidate.path === path);
  if (!document) return undefined;
  return {
    ...document,
    source: await readFile(join(root, path), 'utf8'),
  };
}

export function buildFolderTree(documents: Document[]): FolderNode {
  const rootNode: FolderNode = { name: 'docs-extract', path: '', children: [] };

  for (const document of documents) {
    const parts = document.path.split('/');
    let branch = rootNode;
    for (const [index, part] of parts.entries()) {
      const path = parts.slice(0, index + 1).join('/');
      let node = branch.children.find((child) => child.name === part);
      if (!node) {
        node = { name: part, path, children: [] };
        branch.children.push(node);
      }
      if (index === parts.length - 1) node.document = document;
      branch = node;
    }
  }

  const sortTree = (node: FolderNode) => {
    node.children.sort((left, right) => {
      const leftIsFolder = left.children.length > 0;
      const rightIsFolder = right.children.length > 0;
      if (leftIsFolder !== rightIsFolder) return leftIsFolder ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
    node.children.forEach(sortTree);
  };
  sortTree(rootNode);
  return rootNode;
}
