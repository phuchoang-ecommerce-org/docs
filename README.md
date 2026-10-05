# Enterprise Commerce Platform — Documentation

This repo is the source of truth for Enterprise Commerce Platform (ECP) documentation. The [`frontend`](https://github.com/phuchoang-ecommerce-org/frontend) and [`backend`](https://github.com/phuchoang-ecommerce-org/backend) repos mount it at `docs/` as a git submodule. Both use the shared OpenAPI contract in `SA-docs/04-shared/OpenAPI/`.

| Folder | What it holds |
|---|---|
| [`BA-docs/`](./BA-docs/README.md) | Business problems, requirements, use cases, and user stories |
| [`SA-docs/`](./SA-docs/README.md) | Architecture, contracts, data, security, and technical decisions |
| [`PM-docs/`](./PM-docs/README.md) | Backlog, release plan, delivery process, and integration gates |
| `util/` | Documentation build scripts |

<a id="building-the-documentation"></a>

## Build

Markdown is the source. The Astro reader renders every Markdown document and Mermaid diagram. PlantUML diagrams compile to committed SVG files.

```bash
# from util/
npm run dev                  # browse the documentation locally at http://localhost:4321
npm run build                # build the static Astro reader to util/dist/
npm run preview              # preview the static build
npm run diagrams:build       # every *.puml -> a sibling *.svg  (needs the `plantuml` CLI)

npm run docs:openapi:lint    # validate the OpenAPI contract
npm run docs:openapi:bundle  # bundle it to OpenAPI/dist/ (not committed)
```

Requires Node.js and the `plantuml` CLI. Install `plantuml` and `graphviz` with Homebrew on macOS or `apt` on Debian.

Commit `.md`, `.puml`, and compiled `.svg` files. Do not commit Astro's generated `util/dist/`, copied `util/public/docs/`, or bundled OpenAPI output.

## Submodule use

From `frontend` or `backend`:
```bash
git submodule update --init --recursive
```
Update the pinned docs commit manually with `git submodule update --remote docs`, then commit the submodule change.
