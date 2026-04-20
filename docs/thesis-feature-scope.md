# Thesis Feature Scope

## Basis

- Proposal file: `VuTuanAnh_CNTT4_DeCuongDATN.docx`
- Original SaaS reference: `D:\project\ContentScheduleAI-Demo`
- Current thesis repo: `D:\project\do_an_tot_nghiep`

## Features To Keep

These align directly with the proposal scope "Sang tao & Lap ke hoach":

| Feature | Reason to keep |
|---|---|
| Authentication (sign up / sign in / profile) | Explicitly listed in expected outcomes |
| AI content generation from topic / URL / PDF / text | Core thesis objective |
| Multi-platform draft generation | Explicitly listed in expected outcomes |
| Content strategy (niche / goal / framework) | Strengthens the "planning" part of the thesis |
| AI chatbot assistant | Explicitly listed in expected outcomes |
| Draft management | Needed to review and refine generated content |
| Calendar planning and scheduling UI | Explicitly listed in expected outcomes |
| Media library / file upload | Supports content creation workflow |
| Responsive bilingual UI | Matches the proposal's UI/UX goal |

## Features To Remove Or Hide

These are SaaS-oriented or outside the thesis business scope:

| Feature | Why remove |
|---|---|
| Credits / usage / subscription / plan system | Not required by the proposal |
| API dashboard | Internal SaaS analytics, not thesis scope |
| Buy-plan / payment / top-up mindset | Commercial flow, not needed for a graduation project |
| Publish lifecycle split into published / failed dashboards | The thesis focuses on planning, not full SaaS operations |
| Social account connection management as a primary workflow | Nice-to-have for production SaaS, not core to the proposal |
| getlate fallback polling / publish status sync | Operational integration detail, outside the main thesis scope |

## Scope Decision Applied In UI

The in-app navigation is reduced to:

- `create`
- `calendar`
- `drafts`

Hidden from the thesis-facing flow:

- `published`
- `failed`
- `api-dashboard`
- `settings`

## Practical Outcome

The product now presents itself as a thesis system for:

1. Receiving source input
2. Generating and refining content with AI
3. Managing drafts
4. Planning content visually on a calendar

instead of a commercial SaaS with billing, quotas, and publish-operations overhead.
