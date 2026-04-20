# Calendar Section Spec

## Goal

The Calendar section is the planning and orchestration workspace. It should help the user place content on a timeline, inspect daily load, and manage scheduled items without turning into a dashboard.

## Primary User Questions

- What is scheduled this week or month?
- Which days are empty?
- Which posts are pending, published, or failed?
- What should I do with the currently selected day?

## Scope

The Calendar section should cover:

- month and week planning,
- date selection,
- drag-and-drop scheduling,
- agenda-by-day inspection,
- reschedule and delete actions,
- editor handoff when deeper editing is needed.

## Entry Points

- sidebar `Calendar`
- schedule handoff from `Create`
- open draft for planning from `Drafts`

## Core Entities

- `ScheduledPost`
- `CalendarEvent`
- `CalendarDayState`
- `SelectedDate`
- `PlatformFilter`
- `StatusFilter`

## Current API Dependencies

- `GET /api/schedule`
- `POST /api/schedule`
- `POST /api/schedule/[draftId]`
- `POST /api/late/posts/[id]/check-status`
- `POST /api/late/posts/[id]/reschedule`
- `POST /api/late/posts/check-pending`

## Architecture Recommendation

- Use `GET /api/schedule` as the canonical schedule data source.
- Keep local state only for:
  - selected date,
  - view mode,
  - filters,
  - drag interaction state,
  - transient UI hints.

The current codebase still uses local calendar logic heavily. The target state should reduce ambiguity between local store data and server-backed schedule data.

## UI Layout Blueprint

### Desktop

- top toolbar: navigation, today, month/week toggle, platform drag strip
- main left area: calendar grid
- right panel: agenda and quick actions for selected date

### Tablet

- toolbar on top
- calendar first
- agenda below or collapsible

### Mobile

- week-first or compact month navigation
- selected day agenda via sheet

## Primary Components

- calendar toolbar
- monthly grid
- weekly grid
- agenda panel
- compact filters
- selected date header
- quick action strip

## Key User Flows

### Flow A: View and inspect

1. user enters calendar
2. current month or week is visible
3. user selects a day
4. agenda panel shows items for that day

### Flow B: Schedule a draft

1. user drags a platform or draft item into a date
2. system creates schedule entry
3. calendar updates
4. agenda panel reflects the change

### Flow C: Handle an existing scheduled item

1. user selects an event
2. agenda panel updates with detail and actions
3. user reschedules, checks status, removes, or opens editor

## State Matrix

### Empty Calendar

- visible grid
- one main CTA only
- guidance should be brief and actionable

### Partial Calendar

- some days populated
- selected-day agenda visible

### Dense Calendar

- compact event rendering
- agenda panel becomes primary detail surface

### Error States

- schedule fetch failure
- reschedule failure
- status check failure

## UX Rules

- left side should visually be "the calendar", not a stacked dashboard
- do not show duplicate scheduling CTAs
- do not open popups when the right panel can carry the interaction
- quick-add inside individual day cells should be avoided if drag-and-drop is already the primary schedule model

## UX Polish Checklist

- consistent cell height
- aligned weekday header and grid
- strong selected-day state
- compact agenda filters
- one companion panel, not multiple nested cards
- only one primary CTA depending on current state
- explicit empty-day jump action

## What To Remove Or Avoid

- long onboarding blocks inside the planner
- metric-heavy hero blocks above the calendar grid
- popup-heavy event editing
- duplicate actions that compete with drag-and-drop

## Demo Value

This section proves:

- direct manipulation planning,
- visual scheduling,
- day-level coordination,
- operational awareness.

## Implementation Priority

High. This is one of the two most important thesis-facing workspaces.
