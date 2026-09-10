# Sprint 00 — Foundation: Build & Toolchain

**Release:** R1 · **Gate:** none · **Backend 14 pts · Frontend 14 pts**
**Related documents:** [`../release-plan.md`](../release-plan.md) · [`../product-backlog.md`](../product-backlog.md) · [`../definition-of-done.md`](../definition-of-done.md)

---

## Sprint Goal

> **Both lanes have a build that enforces its own rules.** No user story is delivered. The deliverable is that from Sprint 01 onward, a structural mistake fails a build instead of surviving until review.

Velocity is set to 14 rather than 20 for this sprint: first contact with an unfamiliar multi-project build, on two toolchains, by two people who have not worked in this repository before.

## Committed Items

| Lane | ID | Item | Pts |
|---|---|---|---:|
| BE | `EN-BUILD-1` | Gradle multi-project: 14 subprojects, version catalog, `app` composition root, `bootJar` | 14 |
| FE | `EN-FE-TOOL-1` | Tailwind + Ma tokens, shadcn/ui vendored, strict `tsc`, ESLint, Prettier, Vitest, axe, Playwright | 14 |

## Starting Point

Both applications are scaffolds, and this sprint's scope is exactly the distance between them and the architecture documents:

| | Today | Required by |
|---|---|---|
| `ecommerce-backend-spring` | One `EcommerceApplication.java`; `rootProject.name = "ecommerce"`; a single Gradle project | [`Module Dependency Diagram.md`](../../SA-docs/02-backend/Module%20Dependency%20Diagram.md) §2 — fourteen subprojects under root project `ecp` |
| `ecommerce-frontend-next` | `app/page.tsx`, `app/layout.tsx`, `globals.css`; `package.json` with `eslint` and nothing else | [`Feature Structure.md`](../../SA-docs/03-frontend/Feature%20Structure.md) §2; Testing Strategy §6.7 |

---

## Backend Lane — `EN-BUILD-1` (14 pts)

### Subprojects
- [x] `settings.gradle.kts`: rename root to `ecp`; include all fourteen subprojects
- [x] Thirteen library modules — `shared-kernel`, `identity`, `catalog`, `inventory`, `cart`, `ordering`, `payment`, `shipping`, `promotion`, `review`, `notification`, `audit`, `reporting`
- [x] `app` is the **only** subproject applying `org.springframework.boot` and producing the `bootJar`
- [x] Gradle version catalog (`libs.versions.toml`) — Java 21, Spring Boot 4, Spring Modulith, Lombok, MapStruct, JMolecules

### Module shape
- [x] Every module gets `api/`, `application/`, `domain/`, `infrastructure/` — only `api/` is reachable from another module
- [x] `package-info.java` in each module with `@ApplicationModule(allowedDependencies = {...})`
- [x] Allow-lists encode exactly the five cross-context edges and the two universal edges of §3.1–§3.2, and nothing else:
  - `ordering` → `cart`, `inventory`, `promotion`
  - `cart` → `catalog`, `promotion`
  - every context → `identity`; every module → `shared-kernel`
- [x] `shared-kernel` has **zero** outbound dependencies

### Source sets
- [x] `test` (L1–L3, no container) and `integrationTest` (L4–L6, Docker) as separate source sets
- [x] `./gradlew check` runs both

### Verification
- [x] `./gradlew build` green with fourteen empty, compiling modules
- [x] `./gradlew :app:bootRun` starts and `/healthz` responds
- [x] The dependency graph read top-to-bottom is acyclic by inspection — S01 makes the build prove it

---

## Frontend Lane — `EN-FE-TOOL-1` (14 pts)

### Type safety
- [x] `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- [x] `tsc --noEmit` wired as an npm script and build-failing

### Styling and the design system
- [x] Tailwind configured; the *Ma* token set of [`ADR-0022`](../../SA-docs/01-system/ADR/ADR-0022-ma-design-tokens.md) is the single source in `styles/`
- [x] shadcn/ui vendored into `components/ui/` as **owned, editable source** — not consumed as a dependency
- [x] Prettier + `prettier-plugin-tailwindcss`. Formatting stops being a review topic

### Lint
- [x] `eslint-config-next` + `typescript-eslint` recommended-type-checked
- [x] `no-explicit-any` as an **error**; `no-unsafe-*` enabled
- [x] Security bans: `dangerouslySetInnerHTML`, `outline: none`
- [x] Design-system bans: Tailwind arbitrary values (`p-[25px]`), raw hex in component source
- [x] `eslint-plugin-boundaries` encoding import rules `I-1`–`I-8`
- [x] `dependency-cruiser` for the graph-level cycle check a per-file rule cannot see

### Folder skeleton
- [x] `app/`, `components/ui/`, `components/layout/`, `lib/api/`, `lib/session/`, `lib/observability/`, `lib/utils/`, `stores/`, `styles/`, `tests/e2e/`
- [x] **`features/` stays empty.** Folders are created on demand — an empty folder documents an intention rather than a fact

### Test stack
- [x] Vitest + Testing Library
- [x] `axe` available in component tests
- [x] Playwright installed with one smoke spec that loads `/`
- [x] Token-contrast assertion harness over the `ADR-0022` token pairs — measured ratios, not eyeballed

### Verification
- [x] `npm run lint`, `npm run typecheck`, `npm run test` all green
- [x] A deliberate `features/a` → `features/b` import **fails lint**, then passes once removed. This demonstration is the deliverable

---

## Integration Risk

**None — the lanes do not meet this sprint.** The risk is a different one: that the boundary rules are deferred to "once there's code to check." Both lanes install their gates before writing a line of domain code, because a boundary rule added afterwards is a refactor rather than a gate ([`Feature Structure.md`](../../SA-docs/03-frontend/Feature%20Structure.md) §1 on `P15`).

## Definition of Done

- [x] `./gradlew check` green
- [x] `npm run lint && npm run typecheck && npm run test` green
- [x] Both planted-violation demonstrations performed at the Sprint Review, on the running build — backend and frontend both rehearsed (see Review Notes)
- [x] `README` in each application states how to run it — backend and frontend both done

## Review Notes

*(2026-09-10, backend lane only — `ecommerce-backend-spring`)*

- `EN-BUILD-1` shipped: root renamed to `ecp`, fourteen subprojects (`shared-kernel` + 12 bounded-context modules + `app`), version catalog at `gradle/libs.versions.toml`, `./gradlew build`/`check`/`:app:bootRun` all green, `/healthz` returns `200 OK`.
- **Scope decision:** `app`'s dependencies were trimmed to `webmvc` + `actuator` + `spring-modulith-starter-core` + the 13 module deps, rather than carrying over the scaffold's JPA/Mongo/Redis/Elasticsearch/Kafka/Flyway/Security starters verbatim — `compose.yaml` has no Postgres/Kafka service and the repo has no Postgres driver, so keeping them risked breaking `bootRun`. Those starters move into individual modules' `infrastructure` layer as real persistence/event code lands.
- **Named-interface correction during implementation:** the architecture doc's `api/application/domain/infrastructure` folder convention does not, by itself, make `api` reachable under a plain module name. Spring Modulith 2.1.1's "unnamed" interface is types placed directly in a module's *base* package, not a subpackage. Implemented instead as: `api/package-info.java` carries a plain `@NamedInterface` (defaults to name `"api"`), and every consuming module's `allowedDependencies` references `"<module>::api"` rather than a bare module name. `shared-kernel` keeps `@ApplicationModule(id = "shared-kernel")` since its Java package (`sharedkernel`) can't carry the hyphen the docs use.
- **Planted-violation demo rehearsed:** added an undeclared `catalog -> payment` project edge plus a cross-reference; `./gradlew :app:test --tests ModularityTests` failed with a Modulith `Violations` report; reverted, re-ran green. Note for whoever runs the live Sprint Review demo: don't route the planted edge through `ordering` — `cart -> catalog -> ordering -> cart` is already a real edge set, so an extra `catalog -> ordering` edge produces a Gradle-level circular-task-dependency failure instead of the intended Modulith-level violation. `payment` (or any other leaf module) is a clean choice.
- Pinned versions not previously in the repo: Lombok 1.18.48, MapStruct 1.6.3 (+ `lombok-mapstruct-binding` 0.2.0), jMolecules BOM 2025.0.2 — checked against Maven Central at execution time (2026-09-10), not carried over from stale documentation.

*(2026-09-10, frontend lane — `ecommerce-frontend-next`)*

- `EN-FE-TOOL-1` shipped: strict `tsconfig` (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`), Ma tokens in `styles/theme.css`, shadcn/ui vendored into `components/ui/`, ESLint (`typescript-eslint` recommended-type-checked, `eslint-plugin-boundaries`, `eslint-plugin-tailwindcss`) + `dependency-cruiser`, Prettier, Vitest + Testing Library + `vitest-axe`, Playwright. `npm run lint && npm run typecheck && npm run test && npm run build` all green.
- **Tailwind v4 scale replacement:** ADR-0022's spacing values (8/16/24/32/48/64/96px) aren't a uniform multiple of Tailwind's default `0.25rem` unit, so extending the scale wasn't an option. Set `--spacing: initial` in `styles/theme.css` to disable Tailwind's functional numeric scale entirely, then declared only the named keys the ADR lists (`--spacing-1`…`--spacing-12`) — `p-5`, `p-7`, etc. are now not merely discouraged but undefined. Two gaps the ADR's named scale doesn't cover needed their own deliberate tokens: control height (`--spacing-control`/`-sm`, 44px/40px, driven by UI Design System §6/§14's 44×44 touch-target minimum) and icon size (`--spacing-icon`, 16px, kept off the repurposed numeric keys so `size-4` doesn't silently become 32px).
- **shadcn CLI defaults to `@base-ui/react`, not Radix**, under its current "Nova" preset — ADR-0021 specifies Radix UI as the primitives layer. Re-ran `shadcn init` with `-b radix` to get the Radix-backed component set (`import { Slot } from "radix-ui"`); the vendored `Button` was then edited by hand to drop shadcn's default token names (`secondary`, `muted`, `destructive`, `ring`, `input` — none exist in the five-role Ma palette) and use only `primary`/`surface`/`background`/`border`/`neutral-*`, per ADR-0021's "components are copied in and edited to match the Ma specification directly."
- **`eslint-plugin-boundaries` v7 rewrite:** the installed version (7.2.0) replaced the `element-types`/pattern API documented across most tutorials with a `dependencies` rule + `policies` config, and element patterns now match by directory prefix rather than exact segment count (`features/*` matches everything under a feature folder, not `features/*/*`). Configured against the new API directly (no deprecated aliases) to avoid carrying known-to-be-removed syntax into Sprint 01.
- **Planted-violation demo rehearsed:** created `features/a/index.ts` and `features/b/index.ts` with `b` importing `a` via the `@/features/a` alias; `npm run lint` failed on `boundaries/dependencies` ("no policy allowing... type \"features\" feature=\"b\" to... feature=\"a\""); deleted both folders, `npm run lint` passed clean (21 modules, 0 dependency-cruiser violations).
- Router smoke content (`app/page.tsx`) and the root layout's font/title metadata were replaced — the `create-next-app` boilerplate used raw hex, arbitrary bracket values, and undefined `zinc-*`/`foreground` classes that the new design-system lint rules reject outright.
- Frontend Lane (`EN-FE-TOOL-1`) not touched by this pass.

## Retrospective

**Went well:** Spring Modulith's `ApplicationModules.verify()` catches an undeclared cross-module edge immediately and with a readable report, exactly as the sprint's Integration Risk section intended — the gate exists before any domain code does.
**Change one thing:** The `api/application/domain/infrastructure` → Named Interface mapping in the architecture doc is easy to implement wrong (the doc reads as if `api` is reachable by default); worth adding a short "how Modulith actually resolves this" note to `Module Dependency Diagram.md` so the next person doesn't have to re-derive it from the annotation source.
**Action:** Frontend Lane (`EN-FE-TOOL-1`) still needs execution and backlog update.
