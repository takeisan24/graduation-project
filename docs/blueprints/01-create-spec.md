# Create Section Spec

## Goal

The Create section is the main content workspace. It is where the user imports or defines a source, generates platform-specific drafts, refines content, attaches media, and prepares the next workflow step.

## Primary User Questions

- What content am I currently working on?
- Which platforms should this content target?
- How should AI help me refine this content?
- Should I save this as a draft, schedule it, or publish it?

## Scope

The Create section should cover:

- source ingestion,
- AI generation,
- per-platform content editing,
- media selection and attachment,
- save draft,
- schedule handoff,
- publish handoff.

It should not behave like a dashboard.

## Entry Points

- sidebar `Create`
- continue editing from `Drafts`
- edit from `Failed`
- open scheduled item from `Calendar`

## Core Entities

- `Project`
- `Draft`
- `DraftPlatformVariant`
- `ChatSession`
- `MediaAsset`
- `ConnectedAccount`

## Current API Dependencies

- `POST /api/projects`
- `GET /api/projects/[id]/workspace`
- `GET /api/projects/[id]/drafts`
- `GET /api/projects/[id]/drafts/[draftId]`
- `PUT /api/projects/[id]/drafts/[draftId]`
- `DELETE /api/projects/[id]/drafts/[draftId]`
- `POST /api/projects/[id]/drafts/[draftId]/edit`
- `POST /api/projects/[id]/generate`
- `POST /api/ai/generate-from-source`
- `POST /api/ai/generate-text`
- `POST /api/ai/generate-image`
- `GET /api/ai/models`
- `POST /api/chat`
- `GET /api/chat`
- `GET /api/chat/sessions`
- `POST /api/chat/sessions`
- `POST /api/files/upload`
- `GET /api/media-assets`
- `POST /api/media-assets`
- `PATCH /api/media-assets`
- `DELETE /api/media-assets`

## API Recommendations

- Treat `GET /api/projects/[id]/workspace` as the main bootstrap endpoint for the screen.
- Keep draft edits incremental with `PUT /api/projects/[id]/drafts/[draftId]`.
- Keep AI transforms contextual to a draft or project whenever possible.
- Do not expose legacy credit fields in the UI even if routes still return them.

## UI Layout Blueprint

### Desktop

- left rail: source and project context
- center: platform variants and editor canvas
- right panel: AI companion
- bottom action bar: save, schedule, publish

### Tablet

- stacked source and editor
- collapsible AI panel

### Mobile

- source and editor in sequence
- AI actions via sheet or drawer
- sticky bottom action bar

## Primary Components

- source picker
- source preview
- project header
- platform tabs or platform list
- post editor
- media block
- AI assistant panel
- preview section
- action bar

## Key User Flows

### Flow A: Create from source

1. user selects text, URL, PDF, or manual input
2. system creates project
3. user triggers AI generation
4. system returns drafts for target platforms
5. user refines each draft
6. user saves drafts or schedules them

### Flow B: Continue editing existing draft

1. user arrives from Drafts, Failed, or Calendar
2. workspace loads project and draft context
3. editor focuses the chosen draft
4. user edits, saves, or reschedules

## State Matrix

### Empty

- no source selected
- show source options
- no distracting metrics

### Loading

- project bootstrap pending
- AI generation pending
- upload pending
- save pending

### Active

- one or more platform drafts present
- AI companion contextualized

### Error

- generation failed
- upload failed
- draft save failed
- AI edit failed

## Validation Rules

- source must exist before AI generation starts
- draft content should not be empty on save
- media uploads must surface errors clearly
- publish and schedule buttons must reflect whether a platform has valid content

## UX Polish Checklist

- autosave indicator
- last-saved timestamp
- unsaved changes guard
- keyboard-friendly editor
- AI actions grouped by intent
- media preview visible without opening a modal
- platform-specific content clearly separated
- side panel width persistent on desktop

## What To Remove Or Avoid

- dashboard-style cards
- heavy onboarding copy once the user is inside the workspace
- nested modals for everyday edit actions
- any mention of plans, credits, or quotas

## Demo Value

This section proves:

- source-to-content transformation,
- AI-assisted refinement,
- multi-platform adaptation,
- media-supported content editing.

## Implementation Priority

High. This is one of the two most important thesis-facing workspaces.
