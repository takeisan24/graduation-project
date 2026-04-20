# Navigation And Routing Spec

## Purpose

This spec defines canonical section routing, navigation ownership, and cross-section context transfer.

## Current Codebase Observation

The current codebase contains a routing inconsistency:

- `SectionsManager` still supports:
  - `create`
  - `calendar`
  - `drafts`
  - `published`
  - `failed`
  - `settings`
  - `api-dashboard`
- but `lib/navigation/sectionRoutes.ts` currently canonicalizes only:
  - `create`
  - `calendar`
  - `drafts`

This means the route model is currently narrower than the rendered section model.

## Canonical Route Decision

The product should use canonical section routes for every active section that remains in the thesis-facing app.

Recommended canonical section list:

- `/create`
- `/calendar`
- `/drafts`
- `/published`
- `/failed`
- `/api-dashboard`
- `/settings`

If the thesis-facing surface eventually hides some sections from normal navigation, the routes may still exist but should remain canonical and consistent.

## Navigation Ownership

### Route

The route should be the source of truth for the current section.

### Store

`useNavigationStore.activeSection` should mirror the route for layout and rendering convenience, but it should not drift away from the URL.

### Section change actions

All UI-level section changes should go through a single route-aware helper, such as `useSectionNavigation`, once the canonical route map is expanded again.

## Required Fixes Based On Current Codebase

### 1. Expand `sectionRoutes.ts`

It currently only maps to `create/calendar/drafts`.

It should include:

- published
- failed
- api-dashboard
- settings

### 2. Normalize aliases carefully

Legacy or alternate route names such as:

- `account`
- `accounts`
- `api`

should normalize to canonical destinations without changing the visible section model incorrectly.

## Cross-Section Context Handoffs

### Drafts -> Create

Pass:

- `draftId`
- `projectId`
- preferred `platform`

### Calendar -> Create

Pass:

- `scheduledPostId` or `draftId`
- selected `date`
- selected `platform`

### Failed -> Create

Pass:

- failed post reference
- original content
- media context
- recovery mode intent

### Create -> Calendar

Pass:

- selected date if schedule was just created
- scheduled draft or post id

### Analytics -> Operational screens

Pass:

- active filter context where possible

## Route States To Preserve

The app should preserve or be able to restore:

- active section
- selected project
- selected draft
- selected date in calendar
- filter selections

where doing so improves workflow continuity.

## Breadcrumb And Header Rules

- route and visible section header must always match,
- active sidebar highlight must follow the route,
- no screen should render one section while the URL points to another.

## Error Cases

### Unknown section route

- normalize to a safe default, usually `/create`

### Legacy alias route

- normalize once and push canonical route

### Auth-required route without session

- redirect to sign-in flow

## Success Criteria

Navigation is correct when:

- the route, sidebar highlight, and rendered section always agree,
- every supported section has a canonical route,
- cross-section handoffs preserve enough context to keep the workflow smooth.
