# Drafts Section Spec

## Goal

The Drafts section is the backlog of unfinished or saved content. It should help the user review work-in-progress items quickly and route them back into editing or scheduling.

## Primary User Questions

- Which drafts are still pending?
- Which one was edited most recently?
- Which drafts are ready to schedule?

## Scope

- list and inspect drafts
- filter and sort drafts
- continue editing
- schedule from draft
- delete draft

## Entry Points

- sidebar `Drafts`
- save action from `Create`

## Core Entities

- `Draft`
- `DraftPreview`
- `DraftPlatform`
- `DraftStatus`
- `UpdatedAt`

## Current API And Data Sources

Server-backed routes exist:

- `GET /api/projects/[id]/drafts`
- `GET /api/projects/[id]/drafts/[draftId]`
- `PUT /api/projects/[id]/drafts/[draftId]`
- `DELETE /api/projects/[id]/drafts/[draftId]`

The codebase also contains a local drafts store. The target state should reduce this split and make server-backed drafts the canonical list for the section.

## UI Layout Blueprint

- top header with short description
- search and filter row
- draft list or card grid
- empty state if no drafts exist

## Primary Components

- draft card or row
- platform badge
- snippet preview
- updated-at metadata
- action buttons

## Key User Flows

### Flow A: Continue editing

1. user opens drafts
2. finds a draft
3. chooses continue editing
4. system routes to Create with draft context

### Flow B: Schedule from draft

1. user selects a draft
2. user chooses schedule
3. system routes into scheduling flow or Calendar handoff

### Flow C: Delete draft

1. user chooses delete
2. system removes draft
3. list updates immediately

## State Matrix

- empty list
- recent drafts list
- filtered results
- delete pending
- route handoff pending

## UX Polish Checklist

- preview text limited to one or two lines
- sort by recency by default
- strong platform indicators
- clear distinction between "continue editing" and "schedule"
- low-friction delete confirmation

## What To Remove Or Avoid

- heavy metrics
- long explanation blocks
- redundant side panels

## Demo Value

This section proves the app supports iterative work, not just one-shot generation.

## Implementation Priority

Medium-high. Important for workflow continuity.
