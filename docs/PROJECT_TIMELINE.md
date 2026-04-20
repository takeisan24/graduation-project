# Project Timeline

This document maps the graduation thesis proposal schedule to the public
repository milestones of CreatorHub.

## Proposal Schedule

| Phase | Planned time | Proposal item |
|---|---|---|
| 1 | 15/01/2026 - 28/01/2026 | Nghiên cứu cơ sở lý thuyết, công nghệ nền tảng |
| 2 | 29/01/2026 - 11/02/2026 | Phân tích yêu cầu và thiết kế hệ thống |
| 3 | 12/02/2026 - 25/02/2026 | Cài đặt môi trường và dựng khung dự án |
| 4 | 26/02/2026 - 11/03/2026 | Phát triển module quản lý |
| 5 | 12/03/2026 - 01/04/2026 | Phát triển module AI Generator |
| 6 | 02/04/2026 - 22/04/2026 | Phát triển module lập kế hoạch và chatbot |
| 7 | 23/04/2026 - 15/05/2026 | Kiểm thử, đánh giá và tối ưu hóa |
| 8 | 16/05/2026 - 16/06/2026 | Hoàn thiện báo cáo đồ án |

## Repository Milestones

The public repository is organized into milestone-oriented commits so the
implementation history matches the thesis structure and remains easy to review.

| Milestone commit group | Thesis phase mapping | Main outcome |
|---|---|---|
| Documentation and thesis framing | 1, 2 | Scope, roadmap, architecture, feature plan |
| Project bootstrap and tooling | 3 | Next.js, TypeScript, Tailwind, base config |
| Backend foundation and Supabase integration | 3, 4 | Database, auth, storage, service foundation |
| Core workspace and module management | 4 | Navigation, project workspace, source flows |
| AI provider and generation pipeline | 5 | Gemini/OpenAI integration, prompts, generation services |
| Draft editing and content refinement | 5, 6 | Editor, media flow, draft handling, AI refinement |
| Planning calendar and scheduling | 6 | Calendar UX, scheduling, status flows |
| Chat assistant and connected workflows | 6 | AI chat, conversational refinement, support flows |
| Stabilization, API hardening, UX polish | 7 | Error handling, state cleanup, UI consistency |
| Documentation for defense and release | 8 | README, defense notes, architecture summary |

## Notes For Review

- The repository history is presented by milestone rather than by every local
  development checkpoint.
- Each milestone commit groups a coherent slice of the thesis implementation so
  reviewers can understand the project progression faster.
- Detailed module specifications are documented in `docs/blueprints/`.
