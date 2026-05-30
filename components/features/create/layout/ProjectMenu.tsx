"use client"

/**
 * ProjectMenu — quản lý dự án (CRUD) ngay trên thanh công cụ Create.
 *
 * - Tạo (C):  "Dự án mới" → reset workspace để lần lưu kế tiếp tạo project mới.
 * - Xem (R):  liệt kê toàn bộ dự án của người dùng (GET /api/projects).
 * - Sửa (U):  đổi tên dự án hiện hành (PATCH /api/projects/[id]).
 * - Xóa (D):  xóa dự án bất kỳ (DELETE /api/projects/[id], cascade-safe).
 */

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useShallow } from 'zustand/react/shallow'
import { FolderKanban, Pencil, Trash2, Plus, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useCreateWorkspaceStore, useCreateSourcesStore, useCreatePostsStore } from '@/store'
import { deriveWorkspaceSeed } from '@/store/create/workspace'
import { supabaseClient } from '@/lib/supabaseClient'

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

export default function ProjectMenu() {
  const t = useTranslations('CreatePage.createSection.topBarActions.project')

  const { projectId, projectName, setWorkspaceProject, clearWorkspaceProject } = useCreateWorkspaceStore(
    useShallow((s) => ({
      projectId: s.projectId,
      projectName: s.projectName,
      setWorkspaceProject: s.setWorkspaceProject,
      clearWorkspaceProject: s.clearWorkspaceProject,
    })),
  )
  const savedSources = useCreateSourcesStore((s) => s.savedSources)
  const clearSavedSources = useCreateSourcesStore((s) => s.clearSavedSources)
  const clearPosts = useCreatePostsStore((s) => s.clearPosts)

  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const inferredName = savedSources.length > 0 ? deriveWorkspaceSeed().name : null
  const workspaceLabel = projectName || inferredName
  const triggerLabel = projectId
    ? t('current', { name: workspaceLabel || t('default') })
    : workspaceLabel
      ? t('draft', { name: workspaceLabel })
      : t('default')

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/projects', { headers: await authHeaders() })
      if (!res.ok) throw new Error('load failed')
      const json = await res.json()
      const list = (json?.data || []) as ProjectRow[]
      setProjects(list)
    } catch {
      setError(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setConfirmDeleteId(null)
      setIsRenaming(false)
      void loadProjects()
    }
  }

  const resetWorkspace = useCallback(() => {
    clearWorkspaceProject()
    clearPosts()
    clearSavedSources()
  }, [clearWorkspaceProject, clearPosts, clearSavedSources])

  // Tạo (C)
  const handleNewProject = () => {
    resetWorkspace()
    setOpen(false)
  }

  // Sửa (U)
  const startRename = () => {
    setRenameValue(projectName || '')
    setIsRenaming(true)
  }

  const submitRename = async () => {
    const name = renameValue.replace(/\s+/g, ' ').trim()
    if (!projectId || !name || name === projectName) {
      setIsRenaming(false)
      return
    }
    setBusyId(projectId)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('rename failed')
      setWorkspaceProject({
        projectId,
        projectName: name,
        sourceType: useCreateWorkspaceStore.getState().sourceType,
        sourceContent: useCreateWorkspaceStore.getState().sourceContent,
      })
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, name } : p)))
      setIsRenaming(false)
    } catch {
      setError(t('renameFailed'))
    } finally {
      setBusyId(null)
    }
  }

  // Xóa (D)
  const handleDelete = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      })
      if (!res.ok) throw new Error('delete failed')
      setProjects((prev) => prev.filter((p) => p.id !== id))
      setConfirmDeleteId(null)
      // Nếu xóa đúng dự án đang mở → dọn workspace về trạng thái trống
      if (id === projectId) resetWorkspace()
    } catch {
      setError(t('deleteFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('manageAria')}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FolderKanban className="h-3.5 w-3.5 text-primary" />
          <span className="max-w-[220px] truncate">{triggerLabel}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        {/* Dự án hiện hành: đổi tên (Sửa) + xóa (Xóa) */}
        {projectId && (
          <>
            {isRenaming ? (
              <div className="flex items-center gap-1 px-2 py-1.5">
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder={t('renamePlaceholder')}
                  className="h-8 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitRename()
                    if (e.key === 'Escape') setIsRenaming(false)
                  }}
                  maxLength={80}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => void submitRename()} disabled={busyId === projectId}>
                  {busyId === projectId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-emerald-600" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setIsRenaming(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); startRename() }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t('rename')}
                </DropdownMenuItem>
                {confirmDeleteId === projectId ? (
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); void handleDelete(projectId) }}
                    className="text-destructive focus:text-destructive"
                  >
                    {busyId === projectId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    {t('confirmDelete')}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); setConfirmDeleteId(projectId) }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('delete')}
                  </DropdownMenuItem>
                )}
              </>
            )}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Tạo (C) */}
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleNewProject() }}>
          <Plus className="mr-2 h-4 w-4" />
          {t('newProject')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Xem (R) */}
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {t('allProjects')}
        </DropdownMenuLabel>

        {error && <div className="px-2 py-1.5 text-xs text-destructive">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center px-2 py-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="px-2 py-2 text-xs text-muted-foreground">{t('empty')}</div>
        ) : (
          <div className="max-h-56 overflow-y-auto">
            {projects.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm ${p.id === projectId ? 'bg-accent/60' : ''}`}
              >
                <span className="min-w-0 flex-1 truncate" title={p.name}>
                  {p.id === projectId && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}
                  {p.name}
                </span>
                {confirmDeleteId === p.id ? (
                  <button
                    type="button"
                    onClick={() => void handleDelete(p.id)}
                    disabled={busyId === p.id}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10"
                  >
                    {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('confirmDelete')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(p.id)}
                    aria-label={t('delete')}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
