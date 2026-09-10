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
- [ ] `settings.gradle.kts`: rename root to `ecp`; include all fourteen subprojects
- [ ] Thirteen library modules — `shared-kernel`, `identity`, `catalog`, `inventory`, `cart`, `ordering`, `payment`, `shipping`, `promotion`, `review`, `notification`, `audit`, `reporting`
- [ ] `app` is the **only** subproject applying `org.springframework.boot` and producing the `bootJar`
- [ ] Gradle version catalog (`libs.versions.toml`) — Java 21, Spring Boot 4, Spring Modulith, Lombok, MapStruct, JMolecules

### Module shape
- [ ] Every module gets `api/`, `application/`, `domain/`, `infrastructure/` — only `api/` is reachable from another module
- [ ] `package-info.java` in each module with `@ApplicationModule(allowedDependencies = {...})`
- [ ] Allow-lists encode exactly the five cross-context edges and the two universal edges of §3.1–§3.2, and nothing else:
  - `ordering` → `cart`, `inventory`, `promotion`
  - `cart` → `catalog`, `promotion`
  - every context → `identity`; every module → `shared-kernel`
- [ ] `shared-kernel` has **zero** outbound dependencies

### Source sets
- [ ] `test` (L1–L3, no container) and `integrationTest` (L4–L6, Docker) as separate source sets
- [ ] `./gradlew check` runs both

### Verification
- [ ] `./gradlew build` green with fourteen empty, compiling modules
- [ ] `./gradlew :app:bootRun` starts and `/healthz` responds
- [ ] The dependency graph read top-to-bottom is acyclic by inspection — S01 makes the build prove it

---

## Frontend Lane — `EN-FE-TOOL-1` (14 pts)

### Type safety
- [ ] `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- [ ] `tsc --noEmit` wired as an npm script and build-failing

### Styling and the design system
- [ ] Tailwind configured; the *Ma* token set of [`ADR-0022`](../../SA-docs/01-system/ADR/ADR-0022-ma-design-tokens.md) is the single source in `styles/`
- [ ] shadcn/ui vendored into `components/ui/` as **owned, editable source** — not consumed as a dependency
- [ ] Prettier + `prettier-plugin-tailwindcss`. Formatting stops being a review topic

### Lint
- [ ] `eslint-config-next` + `typescript-eslint` recommended-type-checked
- [ ] `no-explicit-any` as an **error**; `no-unsafe-*` enabled
- [ ] Security bans: `dangerouslySetInnerHTML`, `outline: none`
- [ ] Design-system bans: Tailwind arbitrary values (`p-[25px]`), raw hex in component source
- [ ] `eslint-plugin-boundaries` encoding import rules `I-1`–`I-8`
- [ ] `dependency-cruiser` for the graph-level cycle check a per-file rule cannot see

### Folder skeleton
- [ ] `app/`, `components/ui/`, `components/layout/`, `lib/api/`, `lib/session/`, `lib/observability/`, `lib/utils/`, `stores/`, `styles/`, `tests/e2e/`
- [ ] **`features/` stays empty.** Folders are created on demand — an empty folder documents an intention rather than a fact

### Test stack
- [ ] Vitest + Testing Library
- [ ] `axe` available in component tests
- [ ] Playwright installed with one smoke spec that loads `/`
- [ ] Token-contrast assertion harness over the `ADR-0022` token pairs — measured ratios, not eyeballed

### Verification
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` all green
- [ ] A deliberate `features/a` → `features/b` import **fails lint**, then passes once removed. This demonstration is the deliverable

---

## Integration Risk

**None — the lanes do not meet this sprint.** The risk is a different one: that the boundary rules are deferred to "once there's code to check." Both lanes install their gates before writing a line of domain code, because a boundary rule added afterwards is a refactor rather than a gate ([`Feature Structure.md`](../../SA-docs/03-frontend/Feature%20Structure.md) §1 on `P15`).

## Definition of Done

- [ ] `./gradlew check` green
- [ ] `npm run lint && npm run typecheck && npm run test` green
- [ ] Both planted-violation demonstrations performed at the Sprint Review, on the running build
- [ ] `README` in each application states how to run it

## Review Notes

<!-- filled at Sprint Review -->

## Retrospective

**Went well:**
**Change one thing:**
**Action:**
