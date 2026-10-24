# ADR-0040 — Radix UI and Tailwind CSS Component System

**Status:** Accepted

**Date:** 2026-10-24

**Supersedes:** [ADR-0021](./ADR-0021-tailwind-shadcn-radix-styling-system.md)

## Context

The frontend now builds UI with Next.js, Radix UI, and TailwindCSS. ADR-0021 also required shadcn/ui component source. That rule no longer matches the project direction.

## Decision

- Build shared components in `src/components/ui/` as project-owned source. Use Radix primitives for dialogs, menus, selects, and choice controls. Use native HTML for buttons, inputs, cards, tables, and other simple parts.
- Use TailwindCSS as the only styling system. Keep the approved colors, spacing, type, and radius in one Tailwind theme.
- Keep Radix behavior and keyboard support in shared wrappers. Feature components pass data and actions to those wrappers; the wrappers do not fetch data or decide business rules.
- Do not install shadcn/ui or copy its component source into the project.
- Check focus, keyboard use, labels, errors, and touch targets on each wrapper.

See [Radix UI Behavior](../../03-frontend/Component-Design/radix-ui-behavior.md), [Shared Component Specification](../../03-frontend/Component-Design/component-specification.md), and [Design System](../../03-frontend/UI-UX/Design-System.md) for the build rules.

## Result

The team owns each shared component and its tests. Radix UI supplies the needed interaction behavior; TailwindCSS supplies its appearance. New Radix releases need review before wrapper updates.
