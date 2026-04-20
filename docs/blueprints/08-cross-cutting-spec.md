# Cross-Cutting Product Spec

## Purpose

This spec defines the rules that should apply across all sections so the product feels like one coherent system instead of a collection of unrelated pages.

## Information Architecture Rules

- each section must have one dominant purpose,
- each state should expose one primary CTA,
- companion panels should support the main workspace instead of competing with it,
- long explanatory copy should be reserved for true empty states only.

## App Shell Rules

- sidebar navigation should remain stable,
- topbar should provide global context only,
- page headers should be short,
- content areas should favor full-width workspaces over stacked dashboard cards.

## Visual Language Rules

- avoid commercial SaaS language,
- prioritize workflow language,
- use visual density carefully,
- keep cards flatter and fewer when inside workspaces,
- keep panel spacing consistent across Create, Calendar, and secondary sections.

## Language Rules

Prefer these words:

- workflow
- schedule
- integration
- publish
- analytics
- recovery
- workspace

Avoid these words:

- credit
- buy
- plan
- upgrade
- billing
- quota

## Loading State Rules

- list screens should use skeletons or compact placeholders,
- generation or save actions should show progress and disabled buttons,
- never let a user wonder whether a request is still running.

## Error Handling Rules

Every major action should have:

- a user-facing error message,
- a retry or recovery path where possible,
- a non-destructive fallback state.

Major error categories:

- auth expired
- upload failed
- AI generation failed
- schedule failed
- publish failed
- popup blocked
- status sync delayed

## Empty State Rules

Empty states should:

- explain what is missing,
- expose one primary next step,
- remain visually compact,
- never feel like a separate landing page embedded in the app.

## Cross-Section Handoff Rules

The following handoffs should remain clear and intentional:

- Drafts -> Create
- Drafts -> Calendar
- Calendar -> Create
- Failed -> Create
- Analytics -> Failed / Calendar / Integration Center
- Integration Center -> Create / Calendar readiness

When moving between sections, preserve relevant context such as:

- selected draft,
- selected date,
- selected platform,
- current project.

## Data Ownership Rules

Server data should be authoritative for:

- projects
- drafts
- schedule
- connections
- published posts
- failed posts

Local state should be limited to UI mechanics, not domain truth.

## Thesis Demo Rules

When in doubt, optimize the UX for:

- clear workflow demonstration,
- credibility of integration,
- visibility of system state,
- minimal explanation burden during defense.
