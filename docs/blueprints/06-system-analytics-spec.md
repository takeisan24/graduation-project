# System Analytics Section Spec

## Goal

The System Analytics section should show that the application operates as a coherent system. It should summarize workflow throughput, distribution, and recent activity without resembling a SaaS billing dashboard.

## Primary User Questions

- How many drafts, scheduled items, published posts, and failed posts exist?
- Which platforms are most active?
- What happened recently in the system?
- Is the workflow currently healthy?

## Scope

- KPI overview
- activity overview
- platform distribution
- recent operational feed
- health snapshot

## Entry Points

- sidebar `System Analytics`

## Core Entities

- `KPI`
- `ActivityItem`
- `PlatformDistribution`
- `WorkflowSummary`
- `HealthSummary`

## Current API Dependencies

- `GET /api/posts/published`
- `GET /api/posts/failed`
- `GET /api/connections`
- `GET /api/schedule`
- draft/project data from workspace or store

## UI Layout Blueprint

- top KPI strip
- main chart zone
- activity feed
- system focus or recommendation block

## Primary Components

- KPI cards
- compact charts
- recent activity list
- health summary

## Key User Flows

### Flow A: Review overview

1. user opens analytics
2. KPIs summarize current workflow state
3. user scans charts and activity feed

### Flow B: Drill from concern to action

1. user notices high failed ratio or low coverage
2. user navigates to Failed, Calendar, or Integration Center

## State Matrix

- empty analytics for a new workspace
- normal operational state
- issue-heavy operational state
- API failure fallback

## UX Polish Checklist

- use only a small number of charts
- avoid overloading the screen with cards
- charts must answer a question, not decorate the page
- activity feed should be written in workflow language

## What To Remove Or Avoid

- credits
- plans
- usage billing
- subscription upgrade framing

## Demo Value

This section helps explain the system from a supervisor or examiner perspective. It shows evidence of operation rather than just UI screens.

## Implementation Priority

Medium. Useful proof layer after core workspaces are stable.
