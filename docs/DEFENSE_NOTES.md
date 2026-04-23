# Defense Notes

## Short Project Pitch

CreatorHub is a web-based graduation thesis system that supports content
creators from idea generation to publishing orchestration. The project combines
Generative AI, draft management, calendar planning, platform connections, and
operational monitoring so users can create, refine, schedule, and review
multi-platform content in one place.

## Key Technical Highlights

- Next.js App Router for a unified frontend and backend structure
- Supabase for authentication, PostgreSQL persistence, and storage
- Gemini and OpenAI integration through a provider abstraction layer
- Zustand-based state separation by feature module
- Bilingual interface with next-intl

## Why This Topic Matters

- Content creators often struggle with idea generation and workflow fragmentation
- Existing tools usually solve only one part of the pipeline
- The project focuses on combining creation, planning, execution, and monitoring
  into one coherent workflow

## Suggested Demo Narrative

1. Sign in to the system
2. Create a workspace or open an existing project
3. Paste a topic, URL, or upload a PDF source
4. Select strategy options such as goal, niche, and framework
5. Generate content for multiple platforms with AI
6. Refine a selected draft in the editor or through AI chat
7. Move to the calendar and plan the publishing schedule
8. Show connected accounts that support the publishing flow
9. Publish or schedule content and review the result
10. Open `Published`, `Failed`, and `Operations Hub` to summarize system state

## If Reviewers Ask About Credits Or Plans

- Resource and limit logic exists to protect AI-heavy features and represent
  realistic system constraints.
- Those mechanics are implementation support details, not the main business
  objective of the thesis.
- The thesis emphasis remains AI-assisted content workflow, planning,
  orchestration, and monitoring.

## If Reviewers Ask About Repository History

- The repository is organized into milestone commits to reflect the thesis
  implementation phases clearly.
- The milestone structure follows the approved project proposal and grouped
  development outputs by subsystem.
- Detailed design and implementation decisions are documented in `docs/` and
  `docs/blueprints/`.
