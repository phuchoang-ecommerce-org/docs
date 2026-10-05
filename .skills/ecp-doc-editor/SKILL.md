---
name: ecp-doc-editor
description: Draft, shorten, or review English Markdown for the ECP documentation set. Use for BA, PM, and SA documents that must keep their technical meaning while removing tutorials, repetition, boilerplate, and formulaic AI-style prose. Do not use for source code, API schemas, or a request that requires preserving prose verbatim.
---

# ECP Documentation Editor

Produce compact technical documentation for readers who already know the named technologies, architectures, patterns, and design methods.

## Scope

Apply this skill to prose in `BA-docs/`, `PM-docs/`, `SA-docs/`, and the repository `README.md`.

- Treat `BA-docs/requirement.md` as an immutable record. Do not edit it unless the user explicitly overrides this rule.
- Do not edit OpenAPI, JSON Schema, PlantUML, Mermaid, generated HTML, or implementation code unless the user includes it in scope.
- Preserve the document's language. The current ECP documentation is English, so use the English rules below unless the user asks for another language.

## Editing goal

Keep text that changes a decision or an implementation. Remove text that only explains a familiar concept or makes the document sound complete.

A useful paragraph should provide at least one of these:

- requirement or invariant;
- decision, constraint, or trade-off;
- exact behavior, interface, or failure case;
- owner, status, sequence, or exit condition;
- evidence, metric, or verification method;
- project-specific reason or traceability link.

Delete or merge the paragraph when it provides none of them.

## Workflow

1. Read the full target before editing. Read linked project files only when needed to protect meaning or resolve duplication.
2. Identify the document's job and its target reader in one sentence. Use that sentence as the scope test; do not add it to the document unless it helps the reader.
3. Mark each section mentally as `keep`, `compress`, `move`, or `delete`:
   - `keep`: project-specific facts, rules, contracts, decisions, risks, evidence, and exceptions;
   - `compress`: repeated context, long navigation text, and prose that restates a table or diagram;
   - `move`: detail that is valid but belongs in a named source-of-truth document;
   - `delete`: textbook explanations, rhetoric, generic benefits, filler transitions, and summary paragraphs with no new fact.
4. Rewrite the smallest coherent unit. Prefer a short paragraph, table, or direct list over many small titled sections.
5. Check every identifier, link, number, status, normative word, and exception against the source text.
6. Run the editorial review in [references/editorial-checklist.md](references/editorial-checklist.md).

Do not use a fixed compression target. A requirements table may already be dense; an index or architecture introduction may shrink substantially.

## Language level

Write mainly at CEFR B1 level:

- use common verbs: `is`, `has`, `uses`, `sends`, `stores`, `fails`, `blocks`;
- keep one main claim per sentence;
- prefer active voice when the actor matters;
- put the condition before the result when it prevents ambiguity;
- use a short term again instead of inventing a synonym;
- use headings that name the subject, not the reader's journey.

Keep advanced terms when they are the shortest exact wording, such as `idempotency`, `optimistic locking`, `bounded context`, `non-disclosure`, or `read-your-writes`. Do not explain standard technical terms to the target reader. Explain only project-specific meanings, local conventions, or a term whose exact meaning affects compliance.

Use C1 or C2 wording only when simpler wording would lose a technical, legal, security, or business distinction. Do not raise the language level merely to vary the prose.

## Preserve meaning

Never weaken or silently change:

- `MUST`, `SHOULD`, `MAY`, `never`, `only`, and other normative terms;
- IDs such as `P1`, `FR-*`, `NFR-*`, `UC-*`, `US-*`, `ADR-*`, `AC-*`, and gate IDs;
- quantities, limits, dates, timings, roles, statuses, and ownership;
- source-of-truth statements, accepted risk, assumptions, and unverified claims;
- positive and negative paths;
- links, anchors, code spans, tables, diagram blocks, and citation targets.

Do not turn `UNVERIFIED`, `BLOCKED`, an assumption, or a draft into a positive claim. Do not invent rationale, evidence, examples, or implementation details to make a section feel complete.

If two sources conflict, report the conflict. Do not merge them into a new rule.

## Document types

- **Index or README:** keep navigation, source-of-truth rules, build commands, and repository boundaries. Link to details instead of summarizing each file at length.
- **Requirement or SRS:** keep each statement atomic, testable, and solution-neutral unless the source defines a technical constraint.
- **Use case or user story:** keep actors, preconditions, observable steps, exception paths, postconditions, and acceptance criteria. Remove domain tutorials and repeated business rationale.
- **ADR:** keep status, project context, decision, rejected options, consequences, and verification. Remove explanations of the architecture pattern itself.
- **Architecture or contract document:** keep boundaries, data ownership, protocols, failure behavior, security rules, limits, and operational procedures. Remove general technology introductions.
- **Product or delivery plan:** keep scope, order, owner, timing, gate, dependency, risk, and re-planning rule. Remove generic Scrum guidance.

## Structure

- Start with the fact, rule, or decision. Skip scene-setting.
- Use prose for a short causal explanation.
- Use a list for independent items or steps.
- Use a table only when readers compare the same fields across rows.
- Keep a single `#` title and do not skip heading levels.
- Remove a section that contains only another heading.
- Avoid a separate conclusion, next-step, benefits, or future-work section unless it records a real decision, owner, date, or unresolved item.
- Avoid repeating the same map, count, or rule in an index and its source document. Link to the source of truth.
- Use complete sentences in prose. Concise does not mean telegraphic.

## Output behavior

When editing files, preserve unrelated content and make focused changes. After the edit, report:

- files changed;
- the main content removed or merged;
- facts or constraints deliberately preserved;
- unresolved conflicts or claims that need owner confirmation.

Do not narrate the writing process inside the document. Do not add claims such as “this version is concise,” “the following section explains,” or “the document now provides.”
