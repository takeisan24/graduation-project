# Published Section Spec

## Goal

The Published section is the archive of successful output. It should give the user confidence that content left the system and reached a real platform destination.

## Primary User Questions

- Which posts were published successfully?
- When and where were they published?
- Can I open the real external post?

## Scope

- list published posts
- filter by platform and date
- open the external post
- inspect short content summary

## Entry Points

- sidebar `Published`
- analytics drill-down

## Core Entities

- `PublishedPost`
- `Platform`
- `PublishedAt`
- `ExternalUrl`
- `Snippet`

## Current API Dependencies

- `GET /api/posts/published`

## UI Layout Blueprint

- top header
- compact filters
- list or table of published items
- optional lightweight detail state

## Primary Components

- published row
- platform badge
- posted timestamp
- short content preview
- external link action

## Key User Flows

### Flow A: Review output

1. user opens Published
2. list loads from server
3. user filters by platform or date
4. user reviews items quickly

### Flow B: Open real post

1. user clicks external link
2. system opens published destination

## State Matrix

- no published posts
- paginated published results
- external URL unavailable
- fetch failure

## UX Polish Checklist

- platform icon or badge visible
- timestamps standardized
- table should remain scannable
- empty state should emphasize that output history will appear here

## What To Remove Or Avoid

- commercial performance framing
- overly decorative charting inside this screen

## Demo Value

This section proves real output exists, which strengthens the system demonstration significantly.

## Implementation Priority

Medium. Strong supporting evidence for the thesis demo.
