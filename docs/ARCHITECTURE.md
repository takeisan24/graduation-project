# System Architecture

## Objective

CreatorHub is a graduation-thesis system that supports multi-platform content
planning, AI-assisted content creation, publishing orchestration, and workflow
monitoring inside a single web application.

## Core Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS
- State management: Zustand
- Backend services: Next.js API routes
- Persistence: Supabase PostgreSQL, Auth, Storage
- AI integration: Google Gemini and OpenAI
- Internationalization: next-intl

## Main Layers

### 1. Presentation layer

- `app/[locale]`: routed pages for landing, auth, workspace, and profile flows
- `components/features`: feature-specific UI modules
- `components/shared` and `components/ui`: shared primitives and reusable UI

### 2. Application state layer

- `store/`: Zustand stores split by domain
- Local UI state is handled inside feature components where persistence is not
  required

### 3. API layer

- `app/api/**`: route handlers for auth, AI generation, draft management,
  scheduling, publishing, file handling, monitoring data, and connected
  accounts
- API routes validate inputs, enforce access control, and delegate business
  logic to services

### 4. Domain service layer

- `lib/services/ai`: AI orchestration, generation, extraction, assistant logic
- `lib/services/db`: data access for projects, drafts, profiles, accounts, chat
- `lib/services/posts`: scheduling, publishing, and post lifecycle helpers
- `lib/services/storage`: upload and storage helpers

### 5. Integration layer

- `lib/ai/providers`: provider abstraction for Gemini and OpenAI
- `lib/auth`, `lib/supabase*`: authentication and client setup
- `lib/cache`, `lib/middleware`: infrastructure helpers

## Feature Modules

### Create workspace

Handles source input, strategy selection, content generation, draft editing,
modal flows, and media preview.

### Calendar planning

Provides a visual schedule surface for content planning, status display,
re-scheduling, and drag-and-drop interactions.

### Draft and publish lifecycle

Manages draft lists, publishing transitions, published states, failed recovery
views, and editor re-entry from operational states.

### Integration center

Handles platform account connectivity so the content workflow can move from
planning to actual publishing across multiple channels.

### Operations hub

Summarizes drafts, published items, failed items, platform coverage, and recent
activity to give a system-level view of workflow health.

### AI assistant

Supports iterative content refinement through chat and generation actions tied
to project and draft context.

## Data Flow

1. User provides source input such as topic, URL, text, or PDF
2. API routes normalize and validate the request
3. Service layer extracts context and builds AI prompts
4. AI provider returns generated output
5. Drafts, chat history, files, schedule data, and publishing states are
   persisted in Supabase
6. UI modules read and update the state through stores and API responses

## Thesis Scope Emphasis

The project centers on four practical thesis objectives:

- AI-assisted content ideation and generation
- visual planning and scheduling of multi-platform content
- connected execution across publishing channels
- monitoring and recovery of workflow outcomes

Commercial SaaS concerns such as billing or monetization remain background
implementation detail and are intentionally kept outside the main thesis-facing
narrative.
