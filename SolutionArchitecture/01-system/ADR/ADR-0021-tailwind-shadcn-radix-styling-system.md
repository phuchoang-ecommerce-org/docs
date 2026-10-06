# ADR-0021 — Tailwind CSS with shadcn/ui on Radix Primitives as the Single Styling and Component System

**Status:** Accepted
**Date:** 2026-09-06
**Traces to:** `P15` · `NFR-MAINT-05` · UI Design System §5, §6, §10, §14

---

## 1. Context and Problem Statement

When this record was written, [`Technology Stack.md`](../Technology%20Stack.md) listed the frontend as *"NextJS, KumaUI, RadixUI, shadcn/ui, Framer Motion."* That line was internally inconsistent, and the inconsistency was not cosmetic:

- **Kuma UI** is a zero-runtime CSS-in-JS library. Styles are authored as props and extracted to CSS at build time. Its own theme is the source of design tokens.
- **shadcn/ui** is a set of components built on Radix primitives and styled with **Tailwind CSS**. Its theme is the Tailwind config.
- **Tailwind was named nowhere** in the repository, despite being a hard dependency of shadcn/ui.

Adopting both means two styling engines, two token sources, and two ways to build the same button. [`UI Design System.md`](../../03-frontend/UI%20Design%20System.md) §10 rules directly against this: *"Maintain a unified design system. Prefer a single implementation for: Button, Card, Input, Table, Modal, Badge, Tooltip."* A design system with two engines cannot satisfy that, because the palette, the 8-point spacing scale, and the radius values would each exist in two places and drift independently.

This record picks one and records the other as rejected.

## 2. Decision Drivers

- `UI Design System.md` §10 — one implementation per component; new variants only when a functional requirement justifies them.
- §5 — a restrained palette (one primary, one accent, neutral greys) that must be defined once and be unbypassable.
- §11 — an approved spacing scale (`8/16/24/32/48/64/96`) with *"avoid arbitrary spacing values that disrupt consistency"* — a rule that needs mechanical support to survive.
- §14 — WCAG AA contrast, visible keyboard focus, keyboard navigability, screen-reader compatibility, and 44×44px minimum touch targets, as a **baseline requirement rather than an optional enhancement**.
- `P15` / `NFR-MAINT-05` — consistency that depends on discipline erodes; consistency that a tool enforces does not.

## 3. Considered Options

**Option 1 — Tailwind CSS + shadcn/ui + Radix as one system; Kuma UI dropped.** *(chosen)*

- **Pros:** One styling engine and one token source — the Tailwind theme — so the §5 palette and §11 spacing scale are defined once. Tailwind's constrained utility set is itself the enforcement mechanism §11 asks for: a developer reaches for `p-6` rather than inventing `padding: 25px`, and off-scale values require deliberate escape. shadcn/ui components are **copied into the repository rather than imported**, so they are project-owned source that can be shaped to the Ma specification rather than themed around. Radix supplies focus management, keyboard navigation, and ARIA semantics for exactly the primitives §14 requires — accessibility comes from the primitive layer rather than from remembering to add it. Excellent Server Component compatibility: Tailwind is build-time CSS with no runtime, which suits [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md).
- **Cons:** Utility classes make JSX verbose and can obscure structure. Copied components are owned — upstream fixes are not automatic. Tailwind's own scale must be overridden to match §11 exactly, or the design system inherits a scale it did not choose.

**Option 2 — Kuma UI as the styling engine, with Radix for behaviour; shadcn/ui dropped.**

- **Pros:** Also zero-runtime, so no styling cost in the browser. Style props keep markup cleaner than long class strings. A typed theme object gives compile-time safety on token names — genuinely appealing given [ADR-0020](./ADR-0020-typescript-strict-mode.md).
- **Cons:** Every component in §10's list — Button, Card, Input, Table, Modal, Badge, Tooltip — must be built from Radix primitives by hand, including all of §14's accessibility work that shadcn/ui already contains. That is the largest single block of avoidable work in the frontend plan. A materially smaller ecosystem and community than Tailwind. Discarding shadcn/ui also discards the reason Radix appears in the stack line at all.

**Option 3 — Keep both: Kuma UI for application layouts, shadcn/ui for the component library.**

- **Pros:** Each is used where it is strongest; no library is discarded.
- **Cons:** The failure this record exists to prevent. Two token sources for one palette and one spacing scale — §5 and §11 become unenforceable, because "the" primary colour would have two definitions. Two engines to load, learn, and debug. §10's single-implementation rule is violated at the foundation.

**Option 4 — CSS Modules with hand-written CSS and Radix primitives.**

- **Pros:** No framework opinion; plain CSS; smallest dependency surface; custom properties are a perfectly good token mechanism.
- **Cons:** Nothing constrains a developer to the §11 scale — arbitrary values are exactly as easy to write as approved ones, which is the discipline-dependent consistency `P15` says will erode. All §10 components and all §14 accessibility work are hand-built. Discards both libraries the stack line names.

## 4. Decision Outcome

**Chosen: Option 1.** **Tailwind CSS** is the styling engine, **shadcn/ui** is the component layer, **Radix UI** provides behaviour and accessibility primitives. **Kuma UI is rejected and removed from the stack.**

```nano
  Radix UI          behaviour · focus management · keyboard nav · ARIA   (§14)
      ↓
  shadcn/ui         component source, copied into the repo and owned    (§6, §10)
      ↓
  Tailwind theme    the one token source: palette · spacing · type      (§5, §11) → ADR-0022
```

| Commitment | Detail |
|---|---|
| One styling engine | Tailwind. No CSS-in-JS, no second theme object, no parallel token source. |
| One component implementation | Per `UI Design System.md` §10, for Button, Card, Input, Table, Modal, Badge, and Tooltip. A new variant requires a functional justification, per §10's closing rule. |
| Components are owned source | shadcn/ui components are copied in and edited to match the Ma specification directly — §6's 12px card radius, 10px button radius, 40–44px button height, 1px borders, minimal shadow — rather than themed from outside. |
| Accessibility comes from Radix | Focus management, keyboard navigation, and ARIA semantics are inherited from the primitive, so §14 is a baseline property rather than a per-component checklist. |
| Tailwind's default theme is replaced, not extended | The default spacing, colour, and radius scales are overridden by the tokens of [ADR-0022](./ADR-0022-ma-design-tokens.md), so an off-system value is not merely discouraged but absent. |
| Arbitrary values are lint-flagged | `p-[25px]` and `text-[#123456]` fail lint. This is the mechanical support §11 needs to hold. |

**Why Radix survives while Kuma UI does not:** the stack line names both, but they answer different questions. Radix answers *behaviour and accessibility*; Kuma UI answers *styling*. Styling has two candidate answers and can only have one. Radix has no competitor in the list and is a dependency of the chosen component layer, so it stays.

## 5. Consequences

### Positive

- §5's palette and §11's spacing scale have exactly one definition, so "avoid arbitrary spacing values" becomes a lint failure rather than a review comment.
- §14's accessibility baseline is inherited from Radix rather than re-implemented per component, which is the difference between a baseline and an aspiration.
- Zero styling runtime, so the component layer costs nothing in the browser — consistent with [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md)'s performance intent.
- §10's single-implementation rule is achievable, because there is one place a Button can be defined.

### Negative

- **`Technology Stack.md` had to change.** Its frontend line named Kuma UI and omitted Tailwind; leaving it would have contradicted this record. It now reads *"NextJS, TypeScript, TailwindCSS, RadixUI, shadcn/ui, Framer Motion"* — updated as part of adopting this ADR and [ADR-0020](./ADR-0020-typescript-strict-mode.md).
- **Copied components are owned components.** Upstream shadcn/ui improvements and accessibility fixes are not automatic; adopting them is a deliberate, manual merge. This is the price of being able to shape them to the Ma specification.
- **Utility-class verbosity is real.** Long `className` strings make JSX harder to scan, and the mitigation — extracting variants into the component rather than repeating utilities at call sites — is a discipline, not a tool.
- **Radix and Framer Motion are client-side**, so most components in §10's list will be Client Components ([ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md)). The Server Component benefit accrues to page composition and data fetching, not to the component library.

### Neutral / follow-on

- The concrete token values are [ADR-0022](./ADR-0022-ma-design-tokens.md); this record decides the engine, that one decides the contents.
- Motion is bound to §8's vocabulary by [ADR-0026](./ADR-0026-motion-and-accessibility-baseline.md).
- Icon library selection is made in [ADR-0022](./ADR-0022-ma-design-tokens.md) alongside the typeface, since §7 requires a single consistent set.

## 6. Related Decisions

[ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0020](./ADR-0020-typescript-strict-mode.md) · [ADR-0022](./ADR-0022-ma-design-tokens.md) · [ADR-0026](./ADR-0026-motion-and-accessibility-baseline.md)
