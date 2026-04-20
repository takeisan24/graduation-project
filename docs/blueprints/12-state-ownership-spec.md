# State Ownership Spec

## Purpose

This spec clarifies which store or data source owns which state so future autonomous code changes do not create new source-of-truth conflicts.

## State Ownership Principles

- server-backed domain data should not be recreated in multiple local stores,
- local state should manage interaction mechanics, not business truth,
- section stores should stay focused on one screen concern,
- store-to-store coupling should be minimized and explicit.

## Current Codebase Observations

### Navigation

`useNavigationStore` currently owns:

- active section
- wizard step
- sidebar open state
- language

This is appropriate for shell-level UI state.

### Drafts

`useDraftsStore` currently persists draft posts in localStorage only and explicitly says it does not save to the database.

At the same time, backend project draft APIs exist:

- `/api/projects/[id]/drafts`
- `/api/projects/[id]/drafts/[draftId]`

This is a source-of-truth conflict.

### Calendar

`useCalendarStore` persists `calendarEvents` in localStorage and performs direct delete and reschedule actions against API endpoints.

At the same time, schedule APIs exist:

- `/api/schedule`
- `/api/schedule/[draftId]`

This indicates another source-of-truth conflict.

### Connections

`useConnectionsStore` is intended to own connected accounts, but it depends on `connectionsCache`, which currently fetches `/api/late/connections`, not the canonical `/api/connections` route tree.

### Published And Failed

`usePublishedPostsStore` and `useFailedPostsStore` already behave more like proper server-backed operational stores, but they still use localStorage fallbacks and sync calendar status from those lists.

## Target Ownership Map

### Global UI Store

`useNavigationStore`

Should own:

- current section
- sidebar state
- wizard step
- UI language

Should not own:

- section domain entities

### Create Domain Stores

Create-focused stores may own:

- current open posts
- editor input
- AI side panel state
- source panel state
- upload modal states
- lightbox states

But canonical domain data should still come from:

- project workspace API
- project drafts API
- media asset API

### Drafts Domain

Canonical owner should become:

- backend project draft routes

Local store can temporarily own:

- client-only fallback drafts
- optimistic draft edits

But the list shown in the Drafts section should eventually be API-backed.

### Calendar Domain

Canonical owner should become:

- schedule API

Local calendar store can own:

- selected date
- view mode
- drag interaction state
- local event layout metadata

It should not own schedule truth permanently.

### Connections Domain

Canonical owner should become:

- connections API

Local connections store can own:

- cached connected accounts
- loading state
- last fetch result

### Published And Failed Domain

Canonical owners:

- `GET /api/posts/published`
- `GET /api/posts/failed`

Local stores can own:

- pagination state
- loading state
- local fallback cache

## Cross-Store Side Effects

The codebase currently has cross-store writes such as:

- Create publish flow updating calendar, published, and failed stores
- Published and Failed stores syncing calendar event status
- global pending-post watcher interacting with multiple stores

These should remain explicit and documented. They are useful, but they increase coupling.

## Recommended Refactor Direction

1. make APIs canonical for drafts, schedule, and connections
2. turn local stores into view or cache layers
3. reduce direct localStorage-first workflows
4. keep cross-store updates behind narrow helper functions

## Success Criteria

State ownership is correct when:

- every domain entity has one obvious canonical source,
- local UI stores no longer compete with backend data,
- future autonomous changes can reason about one source of truth per workflow area.
