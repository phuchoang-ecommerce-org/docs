# ADR-0022 — The Zen Design System Expressed as Tokens

**Document type:** Architecture Decision Record
**Status:** Accepted
**Date:** 2026-09-06
**Deciders:** Solution Architecture
**Traces to:** `P15` · `NFR-MAINT-05` · UI Design System §2–§14
**Related documents:** [UI Design System](../../03-frontend/UI%20Design%20System.md) · [ADR-0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md)

---

## 1. Context and Problem Statement

[`UI Design System.md`](../../03-frontend/UI%20Design%20System.md) is a complete and unusually specific design specification: a 12-column grid on an 8-point scale, a maximum content width of 1200–1440px, exact spacing values, a five-role palette with hex codes, three permitted font weights, precise radii and control heights, and a WCAG AA accessibility baseline. It also closes with a validation checklist (§16) intended to be applied before any UI element is introduced.

It is prose. Prose specifications are followed until someone is in a hurry, and §11's instruction — *"Avoid arbitrary spacing values that disrupt consistency"* — is precisely the kind of rule that decays silently. Nothing in a codebase prevents `padding: 25px`.

[ADR-0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md) established Tailwind as the single styling engine and its theme as the single token source. This record decides what goes in that theme, and resolves the two open choices the specification deliberately left as candidate lists: §4 offers four typefaces, and §7 offers three icon libraries, each requiring one to be picked and used consistently.

## 2. Decision Drivers

- §11 — the approved spacing scale must be the *available* scale, not merely the recommended one.
- §5 — at most one primary, one accent, neutral greys, background, and surface; competing accents are forbidden.
- §3 — three hierarchy levels, established by typography, spacing, and contrast rather than by colour variation.
- §14 — WCAG AA contrast, visible focus, 44×44px minimum touch targets, as a baseline.
- §4 and §7 — a single typeface and a single icon set must be chosen; mixing is explicitly forbidden.
- `P15` — a rule that a tool enforces survives; one that depends on memory does not.

## 3. Considered Options

**Option 1 — Replace Tailwind's default theme with the Zen tokens, so off-system values do not exist.** *(chosen)*

- **Pros:** The approved scale becomes the only scale — `p-25` is not a class, so §11 holds mechanically. The palette has five roles and no more, so §5's "multiple competing accent colours" is structurally impossible. Component code reads in design vocabulary (`bg-surface`, `text-primary`) rather than in hex, so a token change propagates everywhere at once.
- **Cons:** Tailwind's default numeric spacing scale is familiar to developers; overriding it means the well-known `p-4` no longer means what they expect. Every token addition is a deliberate act, which is the point but also friction.

**Option 2 — Extend Tailwind's defaults with Zen tokens alongside them.**

- **Pros:** Familiar defaults retained; a developer can reach for either; less initial configuration.
- **Cons:** Both scales are then available, so nothing prevents the off-system one — §11 is back to a review comment. This is the option that looks harmless and quietly defeats the whole record.

**Option 3 — CSS custom properties as the token layer, with Tailwind referencing them.**

- **Pros:** Tokens become inspectable at runtime and themeable without a rebuild; a natural path to a future dark mode or white-label theming.
- **Cons:** Two indirection layers to maintain today for a benefit nothing currently requires — the specification describes one light theme, and SRS §8's deferred capabilities do not include theming. Partially adopted anyway for the colour palette, where runtime theming is most plausible.

**Option 4 — Keep the specification as prose and rely on the §16 checklist in review.**

- **Cons:** The null option, and the one `P15` describes failing. §16 is a good reviewer's checklist and a poor enforcement mechanism.

## 4. Decision Outcome

**Chosen: Option 1**, with colour tokens additionally exposed as CSS custom properties so a future theme is not foreclosed.

**Spacing** — §2, §11. The Tailwind spacing scale is **replaced**, not extended:

| Token | Value | Specified use |
|---|---|---|
| `space-1` | 8px | the 8-point base unit |
| `space-2` | 16px | component spacing (§2: 16–24px) |
| `space-3` | 24px | component spacing · card padding (§2: 24–32px) |
| `space-4` | 32px | card padding · page padding (§2: 32–48px) |
| `space-6` | 48px | page padding |
| `space-8` | 64px | section spacing (§2: 64–96px) |
| `space-12` | 96px | section spacing |

`max-w-content` is 1440px with generous outer margins (§2). The grid is 12 columns.

**Colour** — §5. Five roles, no sixth:

| Token | Value | Role |
|---|---|---|
| `background` | `#F8F8F6` | page ground |
| `surface` | `#FFFFFF` | cards, panels |
| `primary` | `#1E3A5F` | primary actions, Level 1 emphasis |
| `accent` | `#6B8E7A` | single accent — never a second one |
| `border` | `#E5E5E5` | 1px borders (§6) |

Plus a neutral grey ramp for text hierarchy. **Every foreground/background pair ships with its measured contrast ratio and must meet WCAG AA** (§14) — `#1E3A5F` on `#F8F8F6` passes comfortably; `#6B8E7A` on `#FFFFFF` does **not** meet AA for body text and is therefore restricted to large text, borders, and non-text indicators. That restriction is a token-level rule, not a per-use judgement.

**Typography** — §4. **Inter** is chosen from the four candidates: it has the widest weight and optical-size support of the four, excellent tabular figures for the price and order-total displays this platform is full of, and a variable-font build that carries all three permitted weights in one file. Weights are limited to **400, 500, 600** — the theme defines no others, so §4's prohibition on Black and ExtraBold is structural. Line height: 1.5–1.7 body, 1.2–1.3 headings. Three type levels only (§3).

**Icons** — §7. **Lucide** is chosen: a single consistent outline set, tree-shakeable, and the set shadcn/ui's own examples use, so the component layer stays visually coherent without reconciliation. No second icon set is added.

**Components** — §6, §12. Card radius 12px, 1px border, minimal or no shadow. Button height 40–44px, radius 10px, solid fill, hover changing background brightness / border / subtle shadow only, and **no scaling animation**. Inputs: neutral 1px border, clear focus ring, no animated borders. Table rows 48–56px with 16–20px horizontal padding, minimal borders, hover highlight only.

**Enforcement.** Arbitrary-value utilities (`p-[25px]`, `text-[#123456]`) fail lint ([ADR-0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md)). A raw hex code in component source is a lint error. Contrast ratios are asserted in the token test rather than checked by eye.

## 5. Consequences

### Positive

- §11's spacing rule holds because off-scale values are not expressible without a deliberate lint suppression.
- §5's single-accent constraint is structural — there is no token for a second accent.
- §14's contrast requirement is verified at the token level, so an inaccessible pair cannot be introduced by a component author who did not think to check.
- Component source reads in design vocabulary, so a palette change is one file.

### Negative

- **Familiar Tailwind spacing no longer applies.** `p-4` means 32px here, not Tailwind's 16px. Every developer arriving with Tailwind experience will get this wrong once, and copy-pasted examples from the wider ecosystem will be subtly off-scale.
- **The accent colour is genuinely constrained by contrast.** `#6B8E7A` cannot carry body text at AA, which limits it to a smaller role than a designer might expect from a named accent. Better recorded here than discovered during an accessibility audit.
- **A rigid token set makes exceptions expensive.** When a genuine one-off need arises, the honest options are to add a token — widening the system for everyone — or to suppress lint. Both are visible, which is the intent, but neither is cheap.
- **Inter and Lucide are decisions made here, not upstream.** The specification offered candidate lists; if a designer prefers Geist or Phosphor, this record is what gets amended.

### Neutral / follow-on

- Dark mode is not in the specification and not decided. Exposing colours as CSS custom properties keeps the door open without building for it.
- Multi-language typography (SRS §8 defers multi-language) may require a second font subset; Inter's script coverage should be checked before that work begins.

## 6. Related Decisions

[ADR-0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md) · [ADR-0026](./ADR-0026-motion-and-accessibility-baseline.md) · [ADR-0019](./ADR-0019-nextjs-app-router-rendering-strategy.md)
