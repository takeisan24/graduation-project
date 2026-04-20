# Failed Section Spec

## Goal

The Failed section is the recovery workspace. It should help the user identify failed publishing attempts, understand why they failed, and take the next corrective action.

## Primary User Questions

- What failed?
- Why did it fail?
- Should I retry, reschedule, or edit the content?

## Scope

- list failed items
- surface failure reason
- provide recovery actions
- route to editor when necessary

## Entry Points

- sidebar `Failed`
- analytics drill-down

## Core Entities

- `FailedPost`
- `FailureReason`
- `FailedAt`
- `RetryState`
- `RecoveryAction`

## Current API Dependencies

- `GET /api/posts/failed`
- `POST /api/late/posts/[id]/check-status`
- `POST /api/late/posts/[id]/reschedule`

## UI Layout Blueprint

- top header
- compact filter bar
- prioritized failed list
- inline recovery actions

## Primary Components

- failed row or card
- error label
- human-readable reason
- retry action
- reschedule action
- open in editor action

## Key User Flows

### Flow A: Retry

1. user sees failed post
2. user checks status or retries
3. system updates status
4. failed list refreshes

### Flow B: Recover through editing

1. user opens failed item
2. user chooses edit again
3. system routes to Create with relevant content

### Flow C: Reschedule

1. user chooses reschedule
2. system updates planned time
3. failed state transitions appropriately

## State Matrix

- no failed posts
- failed list loaded
- retry pending
- retry success
- retry failed again

## UX Polish Checklist

- reason text should be understandable
- severity or urgency can be sorted
- actions should be few and obvious
- avoid multiple competing cards

## What To Remove Or Avoid

- technical logs as the default presentation
- deep modal trees
- billing-style operational framing

## Demo Value

This section demonstrates resilience and operational thinking, which is especially strong in a thesis setting.

## Implementation Priority

Medium. Not core to the first impression, but highly valuable to the final defense narrative.
