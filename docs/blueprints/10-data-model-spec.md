# Data Model Spec

## Purpose

This spec defines the key domain entities that appear across the application and clarifies which fields matter for thesis-facing UX and workflow design.

## Modeling Principles

- model the workflow, not SaaS billing,
- keep domain entities stable across sections,
- avoid coupling UI language to legacy backend billing fields,
- preserve identifiers needed for cross-section handoffs.

## Core Entities

### Project

Represents one content workspace rooted in a source or idea.

Suggested shape:

- `id`
- `userId`
- `name`
- `sourceType`
- `sourceContent`
- `sourceMetadata`
- `createdAt`
- `updatedAt`

Used in:

- Create
- Drafts
- System Analytics

### Draft

Represents one editable piece of platform-specific content.

Observed and recommended shape:

- `id`
- `projectId`
- `platform`
- `textContent`
- `mediaUrls`
- `status`
- `scheduledAt`
- `createdAt`
- `updatedAt`

Important notes:

- the current codebase has both backend `content_drafts` and local `DraftPost` shapes,
- the target model should converge on one canonical draft entity,
- local draft rows should preserve enough data to route back into Create cleanly.

### DraftPost (Current Local Store Shape)

Current local drafts store uses:

- `id: number`
- `platform: string`
- `content: string`
- `time: string`
- `status: string`
- `media?: string[]`

This is useful for temporary persistence, but it is not rich enough to be the long-term canonical server model.

### ScheduledPost

Represents one scheduled publishing job or planned item in the calendar.

Recommended shape:

- `id`
- `draftId`
- `platform`
- `content`
- `scheduledAt`
- `status`
- `lateJobId`
- `connectedAccountId`
- `url`
- `createdAt`
- `updatedAt`

Used in:

- Calendar
- Published
- Failed
- System Analytics

### CalendarEvent

This is the calendar-facing projection of a scheduled item.

It should be treated as a UI representation of schedule state.

Recommended shape:

- `id`
- `scheduledPostId`
- `platform`
- `time`
- `status`
- `noteType`
- `content`
- `url`
- `isPublished`
- `isFailed`

Important note:

- `CalendarEvent` should be derived from canonical schedule or post data wherever possible,
- it should not become a parallel domain model that drifts away from server state.

### PublishedPost

Observed shape in shared types:

- `id`
- `platform`
- `content`
- `time`
- `status`
- `url`
- `profileName`
- `profilePic`
- `engagement`

Thesis-facing emphasis:

- platform
- publish time
- url
- short content preview

### FailedPost

Observed shape in shared types:

- `id`
- `platform`
- `content`
- `date`
- `time`
- `error`
- `errorMessage`
- `profileName`
- `profilePic`
- `url`
- `scheduledAt`
- `lateJobId`
- `getlateAccountId`
- `media`

Thesis-facing emphasis:

- failure reason
- scheduled time
- recovery action
- original content context

### ConnectedAccount

Observed shape in shared types:

- `id`
- `platform`
- `profile_name`
- `late_profile_id`
- `social_media_account_id`
- `profile_metadata`

Recommended UI-facing projection:

- `id`
- `provider`
- `displayName`
- `externalProfileId`
- `connectedAt`
- `status`
- `metadata`

### MediaAsset

Observed shape:

- `id`
- `asset_type`
- `source_type`
- `job_id`
- `public_url`
- `thumbnail_url`
- `duration`
- `metadata`
- `created_at`

Used in:

- Create
- media library
- published or failed recovery context

### ChatSession

Logical shape based on routes:

- `id`
- `context`
- `projectId`
- `draftId`
- `messages`
- `createdAt`
- `updatedAt`

Used in:

- Create AI companion
- draft editing support

## Entity Relationships

- one `Project` has many `Draft`s
- one `Draft` can become zero or more `ScheduledPost`s
- one `ScheduledPost` can eventually resolve to `PublishedPost` or `FailedPost`
- one `Project` can have one or more `ChatSession`s
- one `Draft` can reference one or more `MediaAsset`s
- one user can have many `ConnectedAccount`s

## Canonical Projection Rules

### For UI

Each screen should use a projection that is optimized for display.

### For data ownership

The underlying domain entity should remain stable even if different sections project it differently.

## Known Model Drift In Current Codebase

- drafts exist both in localStorage and backend project routes,
- calendar events are persisted locally and also implied by schedule APIs,
- connections are cached through a path that does not match the visible route tree,
- published and failed screens use server-backed lists but still keep local fallbacks.

These drifts should be addressed gradually by converging on canonical server-backed entities.
