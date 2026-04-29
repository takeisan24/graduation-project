# Current Implementation Task List

## Purpose

This file tracks the remaining implementation tasks after the routing and connections canonicalization pass.

## Completed

- canonical section route map expanded for active sections
- route normalization and URL/store sync improved
- sidebar navigation switched to route-aware section navigation
- connections fetch path canonicalized to `/api/connections`
- disconnect flow switched to `DELETE /api/connections/[id]`
- canonical internal connection-start route added for thesis-friendly integration flow
- connections store moved closer to API-first first-load behavior
- Drafts -> Create overwrite risk reduced with `forceNewPost` handoff
- calendar store can now hydrate scheduled posts from `GET /api/schedule`
- calendar view now refreshes scheduled data during planner sync cycles
- scheduled post mutate/check routes now live under `/api/schedule/...`
- calendar and failed-post reschedule/delete flows now re-hydrate from schedule data instead of manually owning durable calendar truth
- backend drafts can now be listed through `/api/drafts` and merged into the Drafts UI
- backend drafts reopened from Drafts now save back through project draft routes
- Create now maintains a canonical workspace project context and surfaces it in the workspace chrome
- new drafts saved directly from Create now create backend drafts via `/api/projects/[id]/drafts`
- backend draft lineage now survives Create chat, publish, and schedule flows
- backend drafts leave the Drafts list when their status changes to scheduled or posted
- failed posts can now reopen directly into Create instead of using retry-as-editor fallback
- Published, Failed, and System Analytics sections have been tightened around operational summaries

## Current State

### 1. Draft Workflow Continuity

Status:

- completed for the current Create/Drafts workflow
- reopened backend drafts keep `draftId/projectId` context
- Create-saved drafts now canonicalize to backend project draft routes by default
- local-only fallback is retained only as a resilience path when backend sync is unavailable

### 2. Calendar Source Of Truth Cleanup

Status:

- completed for durable scheduled-post mutations
- `GET /api/schedule` is the durable schedule source
- schedule check/update/delete flows now use `/api/schedule/...`
- local calendar state remains only for temporary planner UI mechanics and final-status history

## Follow-Up Monitoring

### 3. Workspace Polish

- keep monitoring whether a future explicit “new project” UX is needed for users who intentionally want to split workspaces
- keep future schedule features aligned with `/api/schedule` as the canonical namespace
- keep platform naming canonicalized as `X` on user-facing surfaces while preserving legacy alias compatibility in API/store paths

### 4. Legacy Billing Field Isolation

- continue ignoring legacy `creditsRemaining`, `upgradeRequired`, `usage`, and `subscription` fields in FE logic
- avoid reintroducing billing semantics in new code paths

## Verification Snapshot

- build, lint, and direct typecheck are currently clean
- Playwright smoke coverage currently passes for `landing.spec.ts`, `navigation.spec.ts`, `connections.spec.ts`, `dashboard.spec.ts`, and `create-sections-api.spec.ts`
- public locale-routing and unauthenticated protection flows should continue to be smoke-tested after route/section renames
- OAuth popup, authenticated connection management, and cross-section reopen flows still require manual verification against a real signed-in session
