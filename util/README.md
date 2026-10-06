# Markdown documentation reader

This Astro app turns the Markdown files in its parent directory into a static documentation site. It has no project-specific content or folder list: moving `util/` beside a different documentation repository is enough to reuse it.

## Requirements

- Node.js 20.19 or later (or 22.12 or later)
- npm
- Optional: PlantUML and Graphviz, only when using `npm run diagrams:build`

## Setup

1. Place `util/` directly inside the documentation repository.
2. Add a root `README.md`. Its first level-one heading becomes the site title, homepage heading, reader header, and browser title.
3. Create one top-level directory for each documentation field. Give each field a `README.md`; its first level-one heading appears in **Start with the spine** on the homepage.
4. Run the following commands:

   ```sh
   cd util
   npm install
   npm run dev
   ```

Open the local URL printed by Astro. For production output, run `npm run build`; the static site is written to `util/dist/`.

If you must run the commands from another working directory, set `DOCS_ROOT` to the absolute path of the documentation repository.

## Conventions

- Every Markdown file outside `util/`, hidden directories, and `node_modules/` is published as a document.
- Document titles use the first `# Heading 1`; if it is absent, the file name is used.
- The library uses top-level directory names exactly as they appear on disk. Field labels are not transformed or configured in code.
- The homepage automatically lists each direct child `README.md` at `<field>/README.md`, in path order.
- Non-Markdown files under a field directory, plus non-Markdown files at repository root, are copied to `public/docs/` before the build. Any `dist/` directory is excluded as generated output.
- Relative Markdown links and images resolve to their corresponding generated document and copied asset paths.

## Optional diagrams

`npm run diagrams:build` finds every `.puml` file outside hidden directories and `node_modules/`, then writes a sibling SVG. Install PlantUML and Graphviz first, for example with `brew install plantuml graphviz` on macOS.

## Customizing the interface

The visual copy and styles live under `src/`. They are intentionally generic; the project name, homepage title, field titles, and reader branding derive from Markdown rather than a hard-coded list. Change the root README heading and field README headings to rename the site without editing application code.
