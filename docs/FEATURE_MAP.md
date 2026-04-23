# Thesis Feature Map

This document links the official thesis proposal to the implemented system.

## Proposal Title

Xây dựng website hỗ trợ lập kế hoạch và sáng tạo nội dung đa nền tảng sử dụng
công cụ Generative AI.

## Requirement Mapping

| Thesis requirement | Implementation in repository |
|---|---|
| Đăng ký và đăng nhập bảo mật | Supabase Auth, auth pages, protected API flows |
| Tạo nội dung đa nền tảng từ một nguồn đầu vào | Source ingestion, project workspace, AI generation services |
| Chatbot AI trợ lý để tinh chỉnh nội dung | Chat sessions, assistant services, AI chat UI |
| Lịch nội dung trực quan với kéo thả | Calendar components, scheduling APIs, calendar stores |
| Giao diện hiện đại, responsive | Next.js UI, Tailwind, reusable UI primitives, responsive layouts |
| Tích hợp AI tạo sinh | Provider abstraction, Gemini/OpenAI services, prompts |

## Main User Flow

1. User authenticates into the system
2. User creates or opens a project workspace
3. User provides a source input
4. User selects strategy options if needed
5. AI generates draft content for multiple platforms
6. User refines the draft through editor tools or AI chat
7. User plans content on the calendar
8. User connects platform accounts to support realistic execution
9. User publishes or schedules content
10. User reviews drafts, published results, failed items, and workflow status

## Scope Boundaries

Included:

- content generation
- draft refinement
- visual planning
- publishing and recovery workflow
- platform connection management
- operational monitoring
- file and media support
- bilingual user experience

De-emphasized in the thesis narrative:

- commercial monetization logic
- pricing and payment-oriented flows
- billing-oriented usage behavior
