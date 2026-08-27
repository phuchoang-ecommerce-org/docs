#!/usr/bin/env node
/**
 * Compiles every PlantUML file in the repo to an SVG sitting right next to its
 * source (e.g. docs/BA-docs/diagrams/uc-customer-identity.puml
 * -> docs/BA-docs/diagrams/uc-customer-identity.svg).
 *
 * Requires the `plantuml` CLI on PATH (macOS: `brew install plantuml graphviz`).
 *
 * Usage:
 *   node util/toSvg.js              # convert every .puml file in the repo
 *   node util/toSvg.js a.puml       # convert only the given file(s)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IGNORED_DIRS = new Set(['node_modules', '.git', '.github']);

function findPumlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) findPumlFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.puml')) {
      results.push(fullPath);
    }
  }
  return results;
}

function resolveTargets(args) {
  if (args.length === 0) return findPumlFiles(ROOT);
  return args.map((p) => path.resolve(process.cwd(), p));
}

// The Homebrew `plantuml` wrapper locates its own bundled JDK, so a missing or
// stubbed `java` on PATH is not itself a problem -- only a missing `plantuml` is.
function assertPlantUmlAvailable() {
  const probe = spawnSync('plantuml', ['-version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.error('Error: the `plantuml` CLI is required but was not found on PATH.');
    console.error('  macOS:  brew install plantuml graphviz');
    console.error('  Debian: sudo apt-get install plantuml graphviz');
    process.exit(1);
  }
  const version = (probe.stdout || '').split('\n')[0].trim();
  if (version) console.log(`${version}\n`);
}

function main() {
  const targets = resolveTargets(process.argv.slice(2));

  if (targets.length === 0) {
    console.log('No .puml files found.');
    return;
  }

  assertPlantUmlAvailable();

  let failed = 0;

  for (const pumlPath of targets) {
    const svgPath = pumlPath.replace(/\.puml$/i, '.svg');
    // -o takes a directory; passing the source's own directory keeps the SVG
    // as a sibling of the .puml so relative markdown links stay stable.
    const result = spawnSync(
      'plantuml',
      ['-tsvg', '-nometadata', '-o', path.dirname(pumlPath), pumlPath],
      { encoding: 'utf8' }
    );

    if (result.status !== 0 || !fs.existsSync(svgPath)) {
      failed += 1;
      console.error(`FAILED ${path.relative(ROOT, pumlPath)}`);
      const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      if (detail) console.error(detail);
      continue;
    }

    console.log(`${path.relative(ROOT, pumlPath)} -> ${path.relative(ROOT, svgPath)}`);
  }

  console.log(`\n${targets.length - failed}/${targets.length} diagram(s) compiled.`);
  if (failed > 0) process.exit(1);
}

main();
