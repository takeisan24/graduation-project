"use client"

/**
 * ProjectGate — Cửa "project-first".
 *
 * Hiển thị khi vào trang Tạo bài viết mà CHƯA có dự án active (projectId null).
 * Cho phép: tạo dự án mới (đặt tên tùy chọn) hoặc mở một dự án gần đây.
 * Sau khi có dự án → CreateSection tự render workspace (SourcePanel + Editor + AI Chat).
 */

import { useState, useEffect, useCallback } from 'react'
import { FolderKanban, Plus, ArrowRight, Loader2, Search } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateWorkspaceStore } from '@/store'
import { loadProjectWorkspace } from '@/store/create/loadProjectWorkspace'
import { supabaseClient } from '@/lib/supabaseClient'
import { formatDate } from '@/lib/utils/date'

interface ProjectRow {
  id: string
  name: string
  created_at: string
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabaseClient.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) headers['authorization'] = `Bearer ${session.access_token}`
  return headers
}

export default function ProjectGate() {
  const locale = useLocale()
  const t = useTranslations('CreatePage.projectGate')
  const setWorkspaceProject = useCreateWorkspaceStore((s) => s.setWorkspaceProject)

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/projects', { headers: await authHeaders() })
        const json = await res.json().catch(() => ({}))
        if (mounted) setProjects((json?.data || []) as ProjectRow[])
      } catch {
        /* danh sách gần đây không tải được — không chặn việc tạo mới */
      } finally {
        if (mounted) setLoadingList(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const handleCreate = useCallback(async () => {
    if (creating) return
    setCreating(true)
    setError(null)
    const finalName = name.replace(/\s+/g, ' ').trim() || `${t('defaultNamePrefix')} ${new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN')}`
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ name: finalName, sourceType: 'prompt', sourceContent: null }),
      })
      if (!res.ok) throw new Error('create failed')
      const json = await res.json()
      const project = json?.data
      // projectId được set → CreateSection re-render sang workspace.
      setWorkspaceProject({
        projectId: project?.id || null,
        projectName: project?.name || finalName,
        sourceType: project?.source_type || 'prompt',
        sourceContent: project?.source_content || null,
      })
      // Dự án mới: đặt phạm vi nguồn + dọn editor/chat cho đúng workspace của dự án này.
      if (project?.id) void loadProjectWorkspace(project.id)
    } catch {
      setError(t('createError'))
      setCreating(false)
    }
  }, [creating, name, setWorkspaceProject, locale, t])

  const handleOpen = useCallback((p: ProjectRow) => {
    setOpeningId(p.id)
    setWorkspaceProject({
      projectId: p.id,
      projectName: p.name,
      sourceType: null,
      sourceContent: null,
    })
    // Nạp nguồn + bản nháp của dự án vào workspace.
    void loadProjectWorkspace(p.id)
  }, [setWorkspaceProject])

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center overflow-y-auto bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Tiêu đề */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <FolderKanban className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>

        {/* Tạo dự án mới */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-foreground">
            {t('nameLabel')} <span className="font-normal text-muted-foreground">{t('optional')}</span>
          </label>
          <div className="flex gap-2">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate() }}
              placeholder={t('namePlaceholder')}
              maxLength={80}
              className="h-11"
            />
            <Button onClick={() => void handleCreate()} disabled={creating} className="h-11 shrink-0 gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creating ? t('creating') : t('create')}
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            {t('nameHint')}
          </p>
        </div>

        {/* Dự án gần đây */}
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('allTitle')}</p>
          {loadingList ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <>
              {projects.length > 4 && (
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="h-9 pl-9"
                  />
                </div>
              )}
              {(() => {
                const q = search.trim().toLowerCase()
                const filtered = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects
                if (filtered.length === 0) {
                  return <p className="py-4 text-center text-sm text-muted-foreground">{t('noMatch')}</p>
                }
                return (
                  <div className="max-h-64 space-y-1.5 overflow-y-auto">
                    {filtered.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleOpen(p)}
                        disabled={openingId === p.id}
                        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-secondary/40 disabled:opacity-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                            {p.created_at && <p className="text-xs text-muted-foreground">{formatDate(p.created_at, locale)}</p>}
                          </div>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
                          {openingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{t('open')} <ArrowRight className="h-3.5 w-3.5" /></>}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
