# UI Design System — Enterprise Commerce Platform (ECP)

**Document type:** Frontend design specification (normative)
**Status:** Accepted — §1 restated under *Ma (間)*; §2–§16 unchanged in substance from the version [ADR-0021](../01-system/ADR/ADR-0021-tailwind-shadcn-radix-styling-system.md), [ADR-0022](../01-system/ADR/ADR-0022-ma-design-tokens.md), and [ADR-0026](../01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md) were decided against
**Audience:** Frontend Engineering, Design, Architecture Review, QA
**Related documents:** [Frontend Architecture](./Frontend%20Architecture.md) · [ADR-0019](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0021](../01-system/ADR/ADR-0021-tailwind-shadcn-radix-styling-system.md) · [ADR-0022](../01-system/ADR/ADR-0022-ma-design-tokens.md) · [ADR-0024](../01-system/ADR/ADR-0024-frontend-state-management.md) · [ADR-0025](../01-system/ADR/ADR-0025-httponly-cookie-session.md) · [ADR-0026](../01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md)

---

## 1. Design Philosophy — Ma (間)

Ma (間) is a Japanese design philosophy that celebrates the meaningful use of empty space rather than the absence of content. In a UI/UX context, every element is intentionally placed, allowing generous whitespace to create rhythm, balance, and clarity. Interfaces inspired by *Ma* avoid visual noise, excessive decoration, and unnecessary interactions, guiding users through calm and deliberate experiences. Typography becomes a primary visual element, layouts breathe with spacious margins, and content is presented in a slow, natural flow that encourages focus instead of urgency.

The visual language embraces simplicity through muted natural color palettes, subtle textures, refined typography, and restrained micro-interactions. Animations are gentle and purposeful, fading and moving with smooth transitions that never compete for attention. Navigation remains minimal and intuitive, while every component exists only if it contributes meaningful value to the user journey. Rather than maximizing information density, the design emphasizes contemplation, readability, and emotional comfort, creating an experience that feels quiet, timeless, and effortlessly elegant. The result is a digital environment that embodies serenity, where negative space becomes an active design element, allowing users to pause, think, and engage with content in a mindful and uninterrupted way.

### 1.1 Core Principles

Every visual element must serve a functional purpose. The interface should foster focus, reduce cognitive load, and create a calm, distraction-free experience.

* Prioritize simplicity over decoration.
* Eliminate unnecessary visual noise.
* Treat whitespace as an active design element — the interval is designed, not left over.
* Maintain visual harmony through consistency.
* Favor subtlety over attention-grabbing effects.
* Allow content to become the primary focus.
* Let the interface set a calm pace; nothing hurries the user.

### 1.2 How This Document Is Used

*Ma* is not a mood board. §2–§16 are the philosophy restated as rules a reviewer, a linter, or a test can check — and where a rule is genuinely mechanical, an ADR has already made it so. Prose specifications are followed until someone is in a hurry; the enforcing record is named beside each section so the rule has somewhere to live besides memory.

| Section | Concern | Enforced by |
|---|---|---|
| §2 · §11 | Negative space, grid, spacing scale | [ADR-0022](../01-system/ADR/ADR-0022-ma-design-tokens.md) — the approved scale is the only scale |
| §3 · §4 | Hierarchy, typography | [ADR-0022](../01-system/ADR/ADR-0022-ma-design-tokens.md) — three type levels, three weights |
| §5 | Colour | [ADR-0022](../01-system/ADR/ADR-0022-ma-design-tokens.md) — five roles, no sixth token |
| §6 · §10 · §12 | Components, consistency, tables | [ADR-0021](../01-system/ADR/ADR-0021-tailwind-shadcn-radix-styling-system.md) — one styling engine, one implementation |
| §7 | Iconography | [ADR-0022](../01-system/ADR/ADR-0022-ma-design-tokens.md) — one icon set |
| §8 · §15 | Motion, emotional register | [ADR-0026](../01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md) — five presets, no springs |
| §9 | Information density | [ADR-0024](../01-system/ADR/ADR-0024-frontend-state-management.md) — screens that do less need less state |
| §13 | Empty and degraded states | [ADR-0019](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md) · [ADR-0026](../01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md) |
| §14 | Accessibility | [ADR-0026](../01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md) — a build gate, not a review comment |
| §16 | Validation checklist | Human judgement — deliberately not automated |

---

## 2. Negative Space and the Layout System

Negative space is the primary compositional material. A layout is judged first by what surrounds an element and only then by the element itself: if a component cannot be given room, the page is carrying too much, and the correct fix is removal rather than compression.

### Grid

* Use a 12-column responsive grid.
* Adopt an 8-point spacing system throughout the application.
* Maximum content width: **1200–1440px**.
* Provide generous outer margins to avoid visual congestion.

Content is never stretched to fill the viewport. On a wide display the margin grows and the measure stays readable; the empty band on either side is the design working, not space wasted.

### Spacing

Whitespace must communicate hierarchy and improve readability rather than merely filling empty areas. Spacing carries the grouping that a border or a background tint would otherwise have to carry — which is why this system needs so few of either.

| Element           | Value   |
| ----------------- | ------- |
| Component spacing | 16–24px |
| Section spacing   | 64–96px |
| Card padding      | 24–32px |
| Page padding      | 32–48px |

The gap between sections is four times the gap within one. That ratio is what separates a page that reads in parts from a page that reads as an undifferentiated wall.

Avoid densely packed layouts.

---

## 3. Visual Hierarchy

Limit the hierarchy to three primary levels.

| Level   | Purpose         |
| ------- | --------------- |
| Level 1 | Page Title      |
| Level 2 | Section Heading |
| Level 3 | Body Content    |

Hierarchy should primarily be established through:

* Typography
* Spacing
* Contrast

Avoid relying on excessive color variation. Colour is the smallest lever in this system and the first one abused; a fourth level almost always means the screen is doing two jobs and should be split (§9).

---

## 4. Typography as the Primary Visual Element

With decoration removed, type carries the interface. Typeface, weight, measure, and leading are the visual design, not a finishing pass over it.

### Typeface

Use a single modern sans-serif font family.

Recommended options:

* Inter
* IBM Plex Sans
* Noto Sans
* Geist

One family is chosen and used everywhere; mixing families is not permitted. [ADR-0022](../01-system/ADR/ADR-0022-ma-design-tokens.md) records which of the four was selected and why.

### Font Weights

Use only:

* 400
* 500
* 600

Avoid:

* Black
* ExtraBold
* Decorative fonts

Emphasis comes from weight and space, never from shouting. A 600 beside a 400, separated by 24px, outranks any amount of colour.

### Line Height

* Body: 1.5–1.7
* Headings: 1.2–1.3

Generous leading is the same principle as generous margin, applied inside the paragraph.

---

## 5. Color System

Use a restrained color palette. Colours are muted and natural — the interface should read as paper and ink under daylight, not as a screen demanding attention.

Maximum:

* 1 Primary Color
* 1 Accent Color
* Neutral grayscale
* Background color
* Surface color

Example palette:

| Role       | Example |
| ---------- | ------- |
| Background | #F8F8F6 |
| Surface    | #FFFFFF |
| Primary    | #1E3A5F |
| Accent     | #6B8E7A |
| Border     | #E5E5E5 |

Avoid:

* Neon colors
* Excessive gradients
* Highly saturated palettes
* Multiple competing accent colors

The accent is a colour of small quantity. It marks one thing per view; used across several, it stops marking anything. Every foreground/background pair must satisfy §14 — the measured contrast ratios, and the resulting restriction on where the accent may carry text, are recorded in [ADR-0022](../01-system/ADR/ADR-0022-ma-design-tokens.md).

**Texture.** Where surface differentiation is needed, prefer a barely perceptible tonal shift or a 1px border over a shadow or a tint. A texture that is noticed as texture is too strong.

---

## 6. Components

### Cards

* Border radius: 12px
* Thin 1px border
* Minimal or no shadow
* Consistent internal padding

Cards should separate information without dominating attention. The separation is done by the space between cards; the border only confirms it.

---

### Buttons

Primary buttons should communicate confidence without excessive emphasis.

Specifications:

* Height: 40–44px
* Border radius: 10px
* Solid fill
* Simple hover state
* No scaling animation

Hover effects should modify only:

* Background brightness
* Border color
* Shadow (subtle)

---

### Inputs

* Neutral border
* 1px outline
* Clear focus ring
* No animated borders
* Minimal visual styling

Form controls should prioritize usability over decoration. The focus ring is the one place in this system where visibility outranks subtlety — it is an accessibility requirement (§14), not a decorative state.

---

## 7. Iconography

Use a single outline icon library consistently.

Recommended:

* Lucide
* Heroicons
* Phosphor

Avoid mixing multiple icon styles within the same interface. Icons are weighted to sit beside text, not to compete with it; an icon that reads louder than its own label is the wrong icon. [ADR-0022](../01-system/ADR/ADR-0022-ma-design-tokens.md) records the chosen set.

---

## 8. Motion Design

Motion should support interaction rather than attract attention. Micro-interactions are restrained: they confirm that something happened and then get out of the way.

Animation duration:

150–250ms

Preferred easing:

ease-out

Suitable animations:

* Fade
* Opacity
* Color transition
* Small elevation changes

Avoid:

* Bounce
* Elastic motion
* Rotation
* Dramatic zoom effects

Animations should feel almost invisible.

Motion also carries the pacing described in §1 — transitions settle rather than snap, and nothing on screen moves to create urgency. The concrete preset vocabulary, the prohibition on spring physics, and `prefers-reduced-motion` handling are in [ADR-0026](../01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md).

---

## 9. Information Density

Each screen should communicate one primary objective.

Example:

Dashboard

* Key Metrics
* Recent Activity
* Quick Actions

Avoid displaying excessive charts, widgets, or tables simultaneously.

Progressive disclosure is preferred over visual overload. Density is the point at which *Ma* is most often lost — every stakeholder has one more thing that belongs on the page, and each addition is individually reasonable. The rule that holds is the one stated: one objective per screen, with the second objective given its own screen rather than a corner of this one.

---

## 10. Consistency

Maintain a unified design system. Prefer a single implementation for: Button, Card, Input, Table, Modal, Badge, Tooltip.

Introduce new component variants only when justified by functional requirements. A variant added for visual preference is the beginning of a second design system, and two systems cannot both be calm.

---

## 11. Visual Rhythm

Spacing should follow a predictable scale.

Approved spacing values:

* 8px
* 16px
* 24px
* 32px
* 48px
* 64px
* 96px

Avoid arbitrary spacing values that disrupt consistency.

Rhythm is what makes generous space read as intentional rather than accidental. A single off-scale value — 25px where 24px belongs — is invisible in isolation and is exactly what erodes the effect across a hundred screens. [ADR-0022](../01-system/ADR/ADR-0022-ma-design-tokens.md) makes the approved scale the only expressible one.

---

## 12. Data Presentation

Tables should prioritize readability.

Recommendations:

* Row height: 48–56px
* Horizontal padding: 16–20px
* Minimal borders
* Hover highlighting only
* Comfortable line spacing

Data should remain easy to scan during prolonged usage. A commerce admin reads these tables for hours; the row height is not decoration but stamina. Rows are separated by space and alignment rather than by a grid of rules — zebra striping and full cell borders are both refused.

---

## 13. Empty States

Every empty state should provide guidance.

Include:

* Concise explanation
* Primary action
* Small supporting icon

Example:

> No students have been created yet.
> Create your first student to begin managing academic records.

Avoid oversized illustrations that distract from the intended action.

An empty screen is not a failure of the design — it is the design at rest, and it should look composed rather than broken. The same pattern renders a section that failed to load, so degradation has a designed appearance ([ADR-0019](../01-system/ADR/ADR-0019-nextjs-app-router-rendering-strategy.md), [ADR-0026](../01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md)).

---

## 14. Accessibility

The interface must satisfy modern accessibility standards.

Requirements:

* WCAG AA color contrast compliance
* Visible keyboard focus indicators
* Keyboard navigability
* Semantic HTML
* Screen reader compatibility
* Minimum touch target: 44×44px
* `prefers-reduced-motion` honoured, per [ADR-0026](../01-system/ADR/ADR-0026-motion-and-accessibility-baseline.md)

Accessibility should be considered a baseline requirement rather than an optional enhancement.

There is no tension between this section and the rest of the document. A muted palette makes contrast harder and therefore makes measuring it mandatory; generous space makes 44×44px targets easy; a calm motion vocabulary is already close to what a reduced-motion preference asks for. Where restraint and accessibility do conflict — a focus ring is never subtle — accessibility wins.

---

## 15. Emotional Experience

The interface should evoke:

* Calmness
* Trust
* Focus
* Clarity
* Professionalism

It should never feel playful, noisy, or visually overwhelming.

The target is an interface that feels quiet, timeless, and effortlessly elegant — one that will not read as dated in five years, because it was never fashionable to begin with. This is the section against which a design that satisfies every measurable rule can still be rejected.

---

## 16. Design Validation Checklist

Before introducing any UI element, verify the following:

* Does this element have a clear functional purpose?
* Would removing it negatively impact the user experience?
* Does it improve clarity rather than add visual complexity?
* Is sufficient whitespace provided around it?
* Does it conform to the established design system?
* Does it reinforce the overall *Ma*-inspired visual language — is the space around it still doing its work?

If the answer to any of these questions is uncertain, the element should be simplified, redesigned, or removed.
