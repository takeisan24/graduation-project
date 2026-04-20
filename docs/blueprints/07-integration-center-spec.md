# Integration Center Section Spec

## Goal

The Integration Center is the place where the user connects and manages social media accounts used by the content workflow.

## Primary User Questions

- Which social accounts are connected?
- Which platforms are available for planning and publishing?
- When was each account connected or synced?
- How do I connect or disconnect an account?

## Scope

- account connection
- account listing
- platform readiness
- disconnect flow
- integration guidance for blocked OAuth popups

## Entry Points

- sidebar `Integration Center`
- connect-account CTAs from Create or Calendar empty states

## Core Entities

- `Connection`
- `Provider`
- `ProfileIdentity`
- `ConnectionStatus`
- `ConnectedAt`

## Current API Dependencies

Route tree present in the codebase:

- `GET /api/connections`
- `POST /api/connections`
- `DELETE /api/connections/[id]`
- `GET /api/auth/oauth`
- `GET /api/auth/oauth/callback`

## Important Architecture Note

The current UI has shown calls to `/api/late/connections/...`, but the actual route tree uses `/api/connections/...`. This mismatch must be resolved.

### Canonical Target

- `GET /api/connections`
- `POST /api/connections/[provider]/start`
- `DELETE /api/connections/[id]`
- `GET /api/auth/oauth/callback`

## UI Layout Blueprint

- summary cards on top
- connected accounts table in the middle
- provider connection catalog below
- helper block for popup or auth issues

## Primary Components

- summary stats
- accounts table
- provider connect cards
- disconnect actions
- state badges

## Key User Flows

### Flow A: Connect account

1. user chooses provider
2. system opens OAuth flow
3. callback completes
4. account appears in connected list

### Flow B: Disconnect account

1. user selects a connected account
2. user confirms disconnect
3. system removes the connection
4. UI updates immediately

## State Matrix

- no connected accounts
- one or more connected accounts
- connect in progress
- popup blocked
- disconnect pending
- auth callback error

## UX Polish Checklist

- provider cards should explain readiness clearly
- connected accounts should be easy to scan
- popup blocked path should be explicit
- technical error text should be translated into user language

## What To Remove Or Avoid

- credit or limit framing
- too much low-level integration jargon
- hiding OAuth issues without recovery guidance

## Demo Value

This section proves the system is not a static mockup. It demonstrates real integration boundaries and readiness for platform actions.

## Implementation Priority

High-medium. It strongly supports the thesis story and unblocks planning and publishing credibility.
