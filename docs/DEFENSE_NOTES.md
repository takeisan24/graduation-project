# Defense Notes

## Short Project Pitch

CreatorHub is a web-based thesis system that supports content creators from
idea generation to visual planning. The project combines Generative AI with a
calendar-based workflow so users can create, refine, and organize content for
multiple social platforms in one place.

## Key Technical Highlights

- Next.js App Router for a unified frontend and backend structure
- Supabase for authentication, PostgreSQL persistence, and storage
- Gemini and OpenAI integration through a provider abstraction layer
- Zustand-based state separation by feature module
- Bilingual interface with next-intl

## Why This Topic Matters

- Content creators often struggle with idea generation and workflow fragmentation
- Existing tools solve only a part of the pipeline
- The project focuses on combining AI creation and planning into one coherent
  workflow

## Suggested Demo Narrative

1. Sign in to the system
2. Create a workspace or open an existing project
3. Paste a topic, URL, or upload a PDF source
4. Generate content for multiple platforms with AI
5. Refine a selected draft in the editor or through AI chat
6. Move to the calendar and plan the publishing schedule
7. Review drafts and schedule states

## If Reviewers Ask About Repository History

- The repository is organized into milestone commits to reflect the thesis
  implementation phases clearly.
- The milestone structure follows the approved project proposal and grouped
  development outputs by subsystem.
- Detailed design and implementation decisions are documented in `docs/` and
  `docs/blueprints/`.
