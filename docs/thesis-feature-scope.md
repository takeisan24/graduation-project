# Thesis Feature Scope

## Basis

- Proposal file: `VuTuanAnh_CNTT4_DeCuongDATN.docx`
- Original SaaS reference: `D:\project\ContentScheduleAI-Demo`
- Current thesis repo: `D:\project\do_an_tot_nghiep`

## Scope Direction

The thesis should now be presented as a **full workflow system** rather than a
minimal planning-only slice.

That means the defense-facing narrative may include:

1. receiving source input
2. generating and refining multi-platform content with AI
3. managing drafts
4. planning on the calendar
5. connecting social accounts
6. publishing and monitoring results
7. reviewing published, failed, and operational states

The system is still **not** framed as a commercial SaaS product. Commercial
elements remain implementation details, not the center of the thesis story.

## Features To Keep In The Defense Narrative

These align with the proposal and also strengthen the credibility of the
end-to-end workflow:

| Feature | Reason to keep |
|---|---|
| Authentication (sign up / sign in / profile) | Required system entry point and user isolation |
| AI content generation from topic / URL / PDF / text | Core thesis objective |
| Multi-platform draft generation | Explicitly aligned with the proposal objective |
| Content strategy (niche / goal / framework) | Shows planning intelligence before generation |
| AI chatbot assistant | Demonstrates iterative refinement with Generative AI |
| Draft management | Necessary bridge between generation and planning |
| Calendar planning and scheduling UI | Central planning surface of the thesis |
| Platform connection management | Supports realistic multi-platform execution |
| Publish lifecycle (`published`, `failed`) | Demonstrates execution feedback and recovery |
| Operations / analytics overview | Summarizes workflow health for system-level evaluation |
| Media library / file upload | Supports practical content creation workflow |
| Responsive bilingual UI | Matches the proposal's UI/UX direction |

## Features To De-Emphasize

These may stay in the repository, but should not dominate the thesis
presentation:

| Feature | How to frame it |
|---|---|
| Credits / usage / limits | Internal resource governance for AI-intensive features |
| Plan / subscription fields | Legacy implementation detail, not business focus |
| Buy-plan / payment / top-up wording | Do not use as a primary thesis narrative |
| Commercial pricing logic | Keep outside the main demo flow |
| Sales-heavy landing-page claims | Replace with system, workflow, and architecture framing |

## Scope Decision Applied In UI

The thesis-facing workspace may actively use:

- `create`
- `calendar`
- `drafts`
- `published`
- `failed`
- `operations`
- `connections`
- `profile`
- `settings`

Pages and flows that should remain secondary during defense:

- `pricing`
- buy-plan or payment-oriented demos
- explicit upgrade / top-up discussions unless asked about implementation detail

## Practical Outcome

The product now presents itself as a graduation-thesis system for:

1. turning one source into multi-platform content
2. refining content with AI assistance
3. organizing and scheduling content visually
4. executing publishing flows across connected platforms
5. monitoring outcomes and handling failures

instead of a commercial SaaS focused on billing, subscriptions, and upsell
mechanics.
