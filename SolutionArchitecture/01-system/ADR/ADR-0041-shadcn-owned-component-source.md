# ADR-0041 — shadcn/ui Source for the Shared Component Library

**Status:** Accepted

**Date:** 2026-10-26

**Traces to:** `P15` · `NFR-MAINT-05` · UI Design System §5, §6, §10, §14

**Supersedes:** [ADR-0040](./ADR-0040-radix-tailwind-component-system.md)

## Context

The frontend already has typed shared components in `src/components/ui/`, backed by Radix UI and Tailwind CSS. The product direction now calls for shadcn/ui as the owned component source. The existing Ma tokens and public component contracts remain useful.

## Decision

- Use the shadcn/ui CLI with its Radix base and copy source into `src/components/ui/primitives/`. Keep `src/components/ui/` wrappers as the stable project API, preserving existing names, typed props, variants, and intent-based callbacks.
- Tailwind CSS remains the only styling engine. Adapt copied source to the Ma palette, Inter typography, approved spacing scale, 10px control radius, 12px card radius, 44px interactive targets, and visible focus. The existing theme is authoritative; CLI defaults do not add another theme or dark palette.
- Radix remains the behavior layer for dialogs, menus, selects, and choice controls. Shared components remain free of data access and business rules.
- Add only the primitives needed by shared components. Review generated source and dependencies before updating, and verify keyboard, focus, labels, error states, reduced motion, Storybook interactions, and production builds.

## Rejected option

Keep hand-built Radix and native controls without shadcn/ui. This avoids copied source and CLI maintenance, but no longer meets the chosen component-source direction and makes common controls depend on parallel local implementations.

## Consequences

The project owns copied source and must review upstream fixes explicitly. The internal primitive layer adds code and dependencies, while the public wrappers limit migration cost for feature code. Ma tokens and accessible behavior remain the acceptance criteria for every generated component.
