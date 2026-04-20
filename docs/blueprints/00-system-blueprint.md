# System Blueprint

## Product Statement

CreatorHub should be positioned as an AI-assisted system for creating, organizing, scheduling, and monitoring multi-platform social content.

The product must demonstrate:

- source ingestion,
- AI-assisted content generation,
- per-platform editing,
- draft management,
- calendar-based scheduling,
- publishing-state tracking,
- failure recovery,
- social account integration,
- system-level analytics.

## Thesis Narrative

The strongest thesis narrative is:

1. connect social accounts,
2. import a source,
3. generate multi-platform content with AI,
4. refine and save drafts,
5. schedule content in the calendar,
6. observe published and failed outputs,
7. review system analytics.

This narrative is stronger than a generic "content app" story because it shows a full workflow, integration points, AI support, and operational thinking.

## Core Lifecycle

The core lifecycle should be treated as the backbone of the application:

1. `Source Imported`
2. `Project Created`
3. `Draft Generated`
4. `Draft Edited`
5. `Scheduled`
6. `Publishing`
7. `Published` or `Failed`
8. `Retry / Reschedule / Edit Again`

All major sections should map to this lifecycle.

## Product Layers

### 1. Presentation Layer

User-facing sections:

- Create
- Calendar
- Drafts
- Published
- Failed
- System Analytics
- Integration Center

### 2. Workflow Layer

Core workflow states and transitions:

- project creation
- draft creation and edit
- scheduling
- publish state tracking
- failure recovery

### 3. AI Layer

AI capabilities should be framed as workflow support, not as a separate product:

- generate from source
- generate text variants
- edit existing draft
- chat-based assistance
- image generation

### 4. Integration Layer

This layer is responsible for:

- social account connection,
- OAuth handoff,
- account readiness,
- sync metadata,
- platform availability in scheduling and publishing flows.

### 5. Data and Monitoring Layer

This layer covers:

- projects,
- drafts,
- schedule,
- published posts,
- failed posts,
- files and media assets,
- chat sessions,
- connections.

## Source Of Truth Strategy

The product should distinguish clearly between:

- server-backed domain data,
- local UI state.

### Server-backed domain data

These should come from API-backed sources:

- projects
- drafts
- schedule
- published posts
- failed posts
- connections
- media assets

### Local UI state

These should remain local:

- selected date
- active section panel state
- filter state
- view mode
- drag state
- unsaved input state

The codebase currently has some overlap, especially in drafts and calendar flows. The target architecture should eliminate ambiguity about the true source of truth.

## Canonical API Domains

### Project Workspace

- `POST /api/projects`
- `GET /api/projects/[id]/workspace`
- `GET /api/projects/[id]/drafts`
- `GET /api/projects/[id]/drafts/[draftId]`
- `PUT /api/projects/[id]/drafts/[draftId]`
- `DELETE /api/projects/[id]/drafts/[draftId]`
- `POST /api/projects/[id]/drafts/[draftId]/edit`
- `POST /api/projects/[id]/generate`

### AI

- `POST /api/ai/generate-from-source`
- `POST /api/ai/generate-text`
- `POST /api/ai/generate-image`
- `GET /api/ai/models`
- `POST /api/chat`
- `GET /api/chat`
- `GET /api/chat/sessions`
- `POST /api/chat/sessions`

### Scheduling

- `GET /api/schedule`
- `POST /api/schedule`
- `POST /api/schedule/[draftId]`

Future target:

- `PATCH /api/schedule/[id]`
- `DELETE /api/schedule/[id]`

### Publishing and Monitoring

- `GET /api/posts/published`
- `GET /api/posts/failed`
- `POST /api/late/posts/[id]/check-status`
- `POST /api/late/posts/[id]/reschedule`

### Connections

The current codebase shows an inconsistency between UI calls and route tree location. The route namespace must be canonicalized.

Target contract:

- `GET /api/connections`
- `POST /api/connections/[provider]/start`
- `DELETE /api/connections/[id]`
- `GET /api/auth/oauth/callback`

### Assets

- `POST /api/files/upload`
- `POST /api/files/presign-upload`
- `GET /api/files/signed-url`
- `GET /api/media-assets`
- `POST /api/media-assets`
- `PATCH /api/media-assets`
- `DELETE /api/media-assets`

## Legacy SaaS Cleanup Boundary

Some current backend routes still expose fields such as:

- `creditsRemaining`
- `upgradeRequired`
- subscription and usage limit data

The thesis-facing UI should ignore these concepts entirely. They may remain in backend responses temporarily, but they should not shape the user-facing product language or interaction model.

## Success Criteria

The system blueprint succeeds if:

- each section maps clearly to one stage of the workflow,
- there is no visible billing or plan narrative in the UI,
- data ownership is clear,
- integration and recovery flows are present,
- the demo narrative can be run end-to-end without explanation-heavy detours.
