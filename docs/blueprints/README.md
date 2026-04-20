# Product Blueprint Specs

This folder contains the working product specs that define the thesis-facing direction of CreatorHub.

These specs are intended to serve three purposes:

1. Align the product narrative around a graduation-project scope.
2. Provide an implementation-ready blueprint for UI/UX and API behavior.
3. Act as the reference set for future autonomous coding passes.

## Recommended Reading Order

1. [00-system-blueprint.md](./00-system-blueprint.md)
2. [08-cross-cutting-spec.md](./08-cross-cutting-spec.md)
3. [09-roadmap-and-coding-guidance.md](./09-roadmap-and-coding-guidance.md)
4. Supporting specs:
   - [10-data-model-spec.md](./10-data-model-spec.md)
   - [11-navigation-and-routing-spec.md](./11-navigation-and-routing-spec.md)
   - [12-state-ownership-spec.md](./12-state-ownership-spec.md)
   - [13-error-and-edge-case-spec.md](./13-error-and-edge-case-spec.md)
   - [14-demo-scenario-spec.md](./14-demo-scenario-spec.md)
   - [15-section-acceptance-checklists.md](./15-section-acceptance-checklists.md)
5. Section specs:
   - [01-create-spec.md](./01-create-spec.md)
   - [02-calendar-spec.md](./02-calendar-spec.md)
   - [03-drafts-spec.md](./03-drafts-spec.md)
   - [04-published-spec.md](./04-published-spec.md)
   - [05-failed-spec.md](./05-failed-spec.md)
   - [06-system-analytics-spec.md](./06-system-analytics-spec.md)
   - [07-integration-center-spec.md](./07-integration-center-spec.md)

## Scope Framing

The thesis-facing product should present itself as:

- an AI-assisted content creation workspace,
- a multi-platform scheduling and planning tool,
- a draft management system,
- a lightweight operational monitoring tool for publishing status,
- a social integration hub.

The product should not present itself as:

- a SaaS billing product,
- a credit-based upsell funnel,
- a subscription-heavy commercial dashboard.

## How To Use These Specs During Implementation

- Prefer the section specs when working on a concrete screen.
- Prefer the system and cross-cutting specs when making architecture, routing, or API decisions.
- When current code differs from the spec, treat the spec as the target-state unless there is a technical blocker.
- Keep thesis-facing UX clear and minimal even if the backend still contains legacy SaaS fields.
