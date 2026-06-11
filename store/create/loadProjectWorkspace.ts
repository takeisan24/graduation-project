/**
 * loadProjectWorkspace — nạp dữ liệu của MỘT dự án vào workspace Create.
 *
 * Mô hình "1 dự án = 1 workspace" (đúng báo cáo: content_drafts/chat_sessions FK → projects):
 *  - Cô lập danh sách NGUỒN theo dự án (localStorage keyed theo projectId).
 *  - Nạp BẢN NHÁP của dự án vào các tab editor (từ /api/projects/[id]/workspace, đã có sẵn).
 *  - Reset chat về trống khi đổi dự án (nạp lại lịch sử chat = Đợt 2; endpoint GET /api/chat?projectId đã sẵn).
 *
 * Gọi tại các điểm "mở/đổi dự án" (ProjectGate, ProjectMenu) và khi reload trang (CreateSection mount).
 * KHÔNG gọi phản ứng theo projectId-change để tránh xóa nhầm nội dung đang soạn khi lần lưu đầu
 * tự tạo dự án (ensureWorkspaceProject).
 */

import { supabaseClient } from '@/lib/supabaseClient';
import { useCreatePostsStore } from './posts';
import { useCreateSourcesStore } from './sources';
import { useCreateChatStore } from './chat';
import { useCreateMediaStore } from './media';
import { useCreateWorkspaceStore } from './workspace';

interface BackendDraft {
  id: string;
  platform: string | null;
  text_content: string | null;
  media_urls: string[] | null;
  status?: string;
}

/**
 * Assistant lưu trong DB là JSON thô (```json create_post```). Khi hiển thị lại lịch sử,
 * trích "summary_for_chat" để hiện thân thiện giống lúc chat trực tiếp (không hiện JSON thô).
 */
function friendlyAssistant(raw: string): string {
  const summaries: string[] = [];
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(raw)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim().replace(/,(\s*[}\]])/g, '$1'));
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const it of items) {
        if (it?.action === 'create_post') {
          summaries.push(it.summary_for_chat || `Đã tạo bài đăng trên ${it.platform || 'nền tảng'}.`);
        }
      }
    } catch { /* không phải JSON hợp lệ → bỏ qua */ }
  }
  return summaries.length > 0 ? summaries.join('\n\n') : raw;
}

/**
 * Tự lưu (im lặng) các bài đang mở trong editor về bản nháp của dự án HIỆN TẠI.
 * Gọi TRƯỚC khi rời dự án (chuyển dự án / về gate / tạo dự án mới) để không mất phần gõ dở.
 *
 * Đọc dữ liệu ĐỒNG BỘ ngay đầu hàm (trước mọi await) nên có thể gọi không cần await:
 * dù editor bị clear ngay sau đó, dữ liệu đã được chụp lại an toàn.
 */
export async function autoSaveCurrentWorkspace(): Promise<void> {
  const postsStore = useCreatePostsStore.getState();
  const { openPosts, postContents, postContextMap } = postsStore;
  if (openPosts.length === 0) return;

  // Chụp đồng bộ trước await: dự án hiện tại + media của từng bài.
  const currentProjectId = useCreateWorkspaceStore.getState().projectId;
  const postMedia = useCreateMediaStore.getState().postMedia;
  const snapshot = openPosts.map((post) => ({
    id: post.id,
    platform: post.type,
    content: (postContents[post.id] || '').trim(),
    ctx: postContextMap[post.id],
    mediaUrls: (postMedia[post.id] || []).map((m) => m.preview).filter((u): u is string => !!u),
  }));

  const { data: { session } } = await supabaseClient.auth.getSession();
  const token = session?.access_token;
  if (!token) return;

  for (const p of snapshot) {
    if (!p.content) continue; // không lưu bài rỗng
    try {
      if (p.ctx?.draftId && p.ctx?.projectId) {
        // Đã là bản nháp backend → cập nhật.
        await fetch(`/api/projects/${p.ctx.projectId}/drafts/${p.ctx.draftId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ text_content: p.content, media_urls: p.mediaUrls, platform: p.platform }),
        });
      } else if (currentProjectId) {
        // Bài mới chưa lưu → tạo bản nháp cho dự án hiện tại.
        const res = await fetch(`/api/projects/${currentProjectId}/drafts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ text_content: p.content, media_urls: p.mediaUrls, platform: p.platform, status: 'draft' }),
        });
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json?.data?.id) {
            postsStore.setPostContext(p.id, { source: 'drafts', draftId: String(json.data.id), projectId: currentProjectId });
          }
        }
      }
    } catch (e) {
      console.warn('[autoSaveCurrentWorkspace] Không tự lưu được bài', p.id, e);
    }
  }
}

export async function loadProjectWorkspace(projectId: string): Promise<void> {
  if (!projectId) return;

  const postsStore = useCreatePostsStore.getState();

  // (Gap #4) Chuyển phạm vi nguồn sang dự án này (đọc nguồn riêng của dự án từ localStorage).
  useCreateSourcesStore.getState().setSourcesScope(projectId);

  // Reset editor + chat về trống trước khi nạp dữ liệu dự án.
  postsStore.clearPosts();
  useCreateChatStore.getState().clearChat();

  const { data: { session } } = await supabaseClient.auth.getSession();
  const token = session?.access_token;
  if (!token) return;

  // (Gap #1) Nạp bản nháp của dự án vào tab editor — endpoint /workspace đã trả sẵn drafts.
  try {
    const res = await fetch(`/api/projects/${projectId}/workspace`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      const drafts: BackendDraft[] = Array.isArray(json?.data?.drafts) ? json.data.drafts : [];
      for (const d of drafts) {
        // Chỉ nạp bản nháp đang ở trạng thái 'draft' (bài đã đăng/lên lịch nằm ở mục riêng).
        if ((d.status || 'draft') !== 'draft') continue;
        postsStore.openPostFromUrl(
          d.platform || 'General',
          d.text_content || '',
          undefined,
          Array.isArray(d.media_urls) ? d.media_urls : [],
          undefined,
          undefined,
          { forceNewPost: true, context: { source: 'drafts', draftId: String(d.id), projectId } },
        );
      }
    }
  } catch (e) {
    console.warn('[loadProjectWorkspace] Không nạp được bản nháp dự án:', e);
  }

  // (Đợt 2) Nạp lại lịch sử chat của dự án để hiển thị khi mở lại — endpoint GET /api/chat?projectId đã có.
  try {
    const res = await fetch(`/api/chat?projectId=${encodeURIComponent(projectId)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      const rows: Array<{ role: string; content: string }> = Array.isArray(json?.data?.messages) ? json.data.messages : [];
      if (rows.length > 0) {
        const messages = rows.map((m) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.role === 'user' ? (m.content || '') : friendlyAssistant(m.content || ''),
        }));
        useCreateChatStore.getState().hydrateMessages(messages, json?.data?.sessionId || null);
      }
    }
  } catch (e) {
    console.warn('[loadProjectWorkspace] Không nạp được lịch sử chat:', e);
  }
}
