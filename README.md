# Enterprise Commerce Platform — Documentation

This repo is the documentation source of truth for the Enterprise Commerce Platform (ECP). It was split out of the original `phuchoang2005/ecommerce` monorepo into its own repo under the `phuchoang-ecommerce-org` organization, with full git history preserved.

Both the [`frontend`](https://github.com/phuchoang-ecommerce-org/frontend) and [`backend`](https://github.com/phuchoang-ecommerce-org/backend) repos consume this repo as a **git submodule** (mounted at `docs/` in each) — in particular for the shared OpenAPI contract at `SA-docs/04-shared/OpenAPI/`, which the frontend uses for codegen and the backend uses for contract tests.

| Folder | What it holds |
|---|---|
| [`BA-docs/`](./BA-docs/README.md) | Business analysis — what the business needs, why, and what the platform must therefore do |
| [`SA-docs/`](./SA-docs/README.md) | Solution architecture — the technical decisions and technology choices that implement it |
| [`PM-docs/`](./PM-docs/README.md) | Product management — the Scrum plan: product backlog, sprint map, and the frontend/backend integration protocol |
| `util/` | Documentation build scripts |

## Building the Documentation

The Markdown files are the source. Diagrams are PlantUML compiled to SVG; HTML is generated and not committed.

```bash
# from util/
npm run docs:diagrams        # every *.puml -> a sibling *.svg  (needs the `plantuml` CLI)
npm run docs:html            # every *.md   -> a styled, standalone sibling *.html
npm run docs:build           # both, in order

npm run docs:openapi:lint    # validate the OpenAPI contract
npm run docs:openapi:bundle  # bundle it to OpenAPI/dist/ (not committed)
```

**Prerequisites.** `node`, and the `plantuml` CLI for diagrams (`brew install plantuml graphviz` on macOS; `apt-get install plantuml graphviz` on Debian). `util/toSvg.js` reports a clear message if PlantUML is missing.

**What is committed.** The `.md` sources, the `.puml` diagram sources, and the compiled `.svg` files — the SVGs must be committed for diagrams to render on GitHub. The generated `.html` and the bundled OpenAPI are gitignored; regenerate them locally when you want the styled, zoomable reading view.

## Consuming this repo as a submodule

From `frontend` or `backend`:
```bash
git submodule update --init --recursive
```
Bumping the pinned commit when docs change is a manual step: `git submodule update --remote docs && git add docs && git commit`.
