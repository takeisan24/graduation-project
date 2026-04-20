# Roadmap And Coding Guidance

## Purpose

This file translates the blueprint set into an execution order for future autonomous implementation passes.

## Implementation Priorities

### Priority 1: Core Workspaces

These should be stabilized first:

1. Create
2. Calendar
3. Integration Center

These three define the main thesis story:

- create content,
- connect accounts,
- place content on a schedule.

### Priority 2: Workflow Continuity

Then stabilize:

4. Drafts
5. Failed
6. Published

These sections complete the lifecycle and make the system feel operational rather than static.

### Priority 3: Evidence Layer

Finally refine:

7. System Analytics

This section is useful once the main workflow states are reliable.

## Architecture Work Items

### A. Canonicalize Connections API

Target:

- stop using `/api/late/connections/...`
- standardize on `/api/connections/...`

### B. Clarify Draft Source Of Truth

Target:

- section-level draft list should use backend-backed project drafts as canonical
- local draft state should be limited to temporary UI needs

### C. Clarify Calendar Source Of Truth

Target:

- calendar items should load from `GET /api/schedule`
- local calendar stores should keep only UI mechanics

### D. Strip Credit Concepts From FE Contracts

Target:

- remove all UI dependence on credit, plan, and quota semantics
- treat lingering backend fields as ignored metadata

## Section Implementation Notes

### Create

- preserve editor-first layout
- keep AI panel as a companion, not a blocker
- make save/schedule/publish actions explicit

### Calendar

- left side should remain visually dedicated to the planner
- right side should remain the only detail surface
- avoid popovers for flows already handled by drag-and-drop or the side panel

### Drafts

- keep it lightweight
- optimize for scan and resume

### Published

- optimize for confidence and traceability

### Failed

- optimize for recovery

### System Analytics

- optimize for system evidence, not decoration

### Integration Center

- optimize for clarity around readiness and OAuth outcomes

## Suggested Autonomous Workflow For Future Coding Passes

1. read `00-system-blueprint.md`
2. read the target section spec
3. read `08-cross-cutting-spec.md`
4. implement only the deltas required to move the current screen toward the target state
5. verify routes and API contracts before editing section logic
6. avoid adding new UI language that reintroduces SaaS billing vocabulary

## Definition Of Done For A Section Revamp

A section revamp is only done when:

- the page has one dominant purpose,
- the page uses thesis-facing vocabulary,
- the page has one clear primary CTA per state,
- the layout is consistent with the app shell,
- data ownership is clear,
- the section fits the product lifecycle cleanly.

## Recommended Next Coding Pass

The next autonomous implementation pass should focus on:

1. Create workflow hardening
2. Calendar source-of-truth cleanup
3. Integration Center API canonicalization

These changes will have the highest product-wide leverage.
