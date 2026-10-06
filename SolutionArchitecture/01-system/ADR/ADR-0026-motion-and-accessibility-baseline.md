# ADR-0026 — Motion Vocabulary and the WCAG AA Accessibility Baseline

**Status:** Accepted
**Date:** 2026-09-06
**Traces to:** UI Design System §8, §13, §14, §15 · `P15` · `NFR-MAINT-05`

---

## 1. Context and Problem Statement

[`Technology Stack.md`](../Technology%20Stack.md) names Framer Motion, and [`UI Design System.md`](../../03-frontend/UI%20Design%20System.md) §8 constrains motion tightly: 150–250ms, `ease-out`, and only fade, opacity, colour transition, and small elevation changes. Bounce, elastic motion, rotation, and dramatic zoom are named and forbidden. §15 sets the target feeling — calm, trustworthy, focused — and states the interface *"should never feel playful, noisy, or visually overwhelming."* §8 closes with the intent: *"Animations should feel almost invisible."*

Framer Motion can do all of that, and it can equally do every effect §8 forbids — spring physics is its default transition, and a spring is a bounce. Adding the library without a rule adopts its defaults, which point the opposite way from the specification.

There is a second, larger gap. §14 lists an accessibility baseline — WCAG AA contrast, visible keyboard focus, keyboard navigability, semantic HTML, screen-reader compatibility, 44×44px minimum touch targets — and insists it is *"a baseline requirement rather than an optional enhancement."* A baseline that is checked only by review is not a baseline. And §14 does not mention `prefers-reduced-motion` at all, even though animation is a documented accessibility concern for vestibular disorders — an omission this record should close rather than inherit.

## 2. Decision Drivers

- §8 — a specific, narrow motion vocabulary with named prohibitions.
- §14 — accessibility as a baseline, verified rather than assumed.
- §15 — motion must never make the interface feel playful or noisy.
- `P15` / `NFR-MAINT-05` — a rule that depends on memory erodes; the useful form is one a tool checks.
- [ADR-0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md) — Radix already supplies focus management, keyboard navigation, and ARIA semantics, so most of §14 is inherited rather than built.

## 3. Considered Options

### Motion

**Option 1 — Framer Motion, restricted to a shared set of named motion presets.** *(chosen)*

- **Pros:** Motion becomes a small vocabulary rather than a per-component decision, which is how §8's constraints survive contact with feature work. Presets encode the duration, easing, and permitted properties once. Framer Motion handles orchestration, presence/exit animation, and reduced-motion detection well.
- **Cons:** A JavaScript animation library for effects that are mostly CSS-expressible. Its spring default must be actively overridden, and a developer who reaches past the presets gets the wrong behaviour with no error.

**Option 2 — CSS transitions and Tailwind's animation utilities only; Framer Motion dropped.**

- **Pros:** No animation library at all. §8's entire permitted vocabulary — fade, opacity, colour, small elevation — is exactly what CSS transitions do well. Smallest bundle, and `prefers-reduced-motion` is a plain media query.
- **Cons:** Exit and presence animations are awkward without a library, and Radix's own animated components integrate with one. Also drops a technology the stack line names, which needs a stronger reason than "mostly sufficient."

**Option 3 — Framer Motion, unrestricted.**

- **Cons:** Its defaults are springs, and a spring is the bounce §8 forbids. Without a rule, motion diverges component by component and §15's calm target is lost quietly. Rejected.

### Accessibility

**Option A — Inherit from Radix, add automated checks, and treat §14 as a build gate.** *(chosen)* — the frontend counterpart of [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md).

**Option B — Manual review against the §16 checklist.** Good practice, no enforcement; the same null option `P15` describes failing.

## 4. Decision Outcome

**Chosen: Option 1 + Option A.**

**Motion presets** — the only motion vocabulary in the application:

| Preset | Duration | Easing | Properties |
|---|---|---|---|
| `fade` | 150ms | `ease-out` | opacity |
| `fadeRise` | 200ms | `ease-out` | opacity + ≤ 4px translate |
| `colorShift` | 150ms | `ease-out` | colour, background, border |
| `elevate` | 200ms | `ease-out` | shadow, small |
| `overlay` | 250ms | `ease-out` | opacity, for modal and drawer presence |

Rules: **no spring physics** — every transition is duration-based; nothing outside 150–250ms; **no scale, rotation, bounce, or elastic motion**, matching §8 and §6's explicit "no scaling animation" on buttons. Hover changes background brightness, border colour, or a subtle shadow — nothing else. A component needing motion outside these presets is a design question for the system, not a local decision.

**`prefers-reduced-motion` is honoured globally.** When set, transform and elevation motion is removed and only opacity changes remain, at the shortest duration. This closes §14's omission; it is not an optional enhancement.

**Accessibility baseline** — §14, made checkable:

| Requirement | How it holds | Verified by |
|---|---|---|
| WCAG AA contrast | Token-level pairs with measured ratios ([ADR-0022](./ADR-0022-ma-design-tokens.md)) | Contrast assertions in the token test |
| Visible keyboard focus | A focus-ring token applied by every interactive component; **focus outlines are never removed** | Lint rule against `outline: none`; component tests |
| Keyboard navigability | Inherited from Radix primitives ([ADR-0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md)) | Keyboard interaction tests on composite components |
| Semantic HTML | Radix renders correct elements and roles; application markup uses landmarks and headings in order | Automated accessibility linting in CI |
| Screen-reader compatibility | ARIA from Radix; author-supplied names for icon-only controls | Automated checks plus periodic manual testing |
| 44×44px minimum touch target | A minimum-size rule on interactive components; button height 40–44px per §6, with padding making the **hit area** ≥ 44px even where the visual control is 40px | Component tests |
| Reduced motion | Global media-query handling as above | Visual test with the preference set |

**Empty states** follow §13: concise explanation, a primary action, a small supporting icon, no oversized illustration. They are the standard rendering for a failed `Suspense` boundary ([ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md)), so `NFR-AVAIL-02`'s degraded sections have a designed appearance rather than an accidental one.

**Automated checks fail the build**, matching [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)'s treatment of architecture rules. Automated tooling catches a known subset of accessibility defects, not all of them — it is a floor, and periodic manual testing with a screen reader and keyboard-only navigation remains necessary.

## 5. Consequences

### Positive

- §8's vocabulary is enforced by having only five presets, so motion cannot diverge component by component and §15's calm target survives feature work.
- Most of §14 is inherited from Radix rather than re-implemented, which is what makes a baseline realistic rather than aspirational.
- `prefers-reduced-motion` is handled globally, closing a real gap in the specification.
- Failed sections get the §13 empty-state treatment, so `NFR-AVAIL-02` degradation is designed rather than incidental.

### Negative

- **Framer Motion is a substantial dependency for five simple presets.** Option 2 — CSS transitions alone — would cover §8's entire permitted vocabulary at zero bundle cost, and this decision keeps the library largely because the stack names it and because Radix presence animation integrates with it. If bundle size becomes a concern, this is the first thing to reconsider.
- **The preset restriction is enforced by convention, not by the type system.** Nothing stops a developer importing Framer Motion directly and writing a spring; the mitigation is that presets are the easy path and direct imports are lint-flagged.
- **Automated accessibility checks catch a subset.** Passing the build is not the same as being accessible, and treating it as such is the main way a baseline like this decays.
- **The 44×44px rule conflicts with dense layouts**, particularly in admin tables where §12 specifies 48–56px rows. Padding resolves it, but it constrains how tight a control cluster can be.

### Neutral / follow-on

- Manual screen-reader testing cadence is an operational practice, not an architectural decision.
- Whether to drop Framer Motion for CSS transitions is a live open question and would be a new record superseding this one, per [ADR-0001](./ADR-0001-record-architecture-decisions.md).

## 6. Related Decisions

[ADR-0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md) · [ADR-0022](./ADR-0022-ma-design-tokens.md) · [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)
