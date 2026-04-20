/**
 * Create Page - Workspace Store
 *
 * Tracks the canonical project context used by the Create workspace.
 */

import { create } from 'zustand';
import { loadFromLocalStorage, saveToLocalStorage, removeFromLocalStorage } from '@/lib/utils/storage';
import { supabaseClient } from '@/lib/supabaseClient';
import { useCreateSourcesStore } from './sources';
import type { SavedSource, SourceMetadata } from '../shared/types';

type WorkspaceSeed = {
  name: string;
  sourceType: string;
  sourceContent: string | null;
};

const WORKSPACE_PROJECT_STORAGE_KEY = 'createWorkspaceProject';

type PersistedWorkspaceProject = {
  projectId: string | null;
  projectName: string | null;
  sourceType: string | null;
  sourceContent: string | null;
};

function normalizeName(input: string | null | undefined, fallback = 'Create Workspace'): string {
  const trimmed = String(input || '').replace(/\s+/g, ' ').trim();
  return (trimmed || fallback).slice(0, 80);
}

export function deriveWorkspaceSeed(): WorkspaceSeed {
  const { sourceToGenerate, savedSources } = useCreateSourcesStore.getState();
  const preferredSource = sourceToGenerate || savedSources[savedSources.length - 1] || null;

  if (!preferredSource) {
    return {
      name: 'Create Workspace',
      sourceType: 'prompt',
      sourceContent: null,
    };
  }

  const metadata: SourceMetadata | undefined = (preferredSource as SavedSource).metadata;
  const attachment = metadata?.attachment;

  let sourceType = 'prompt';
  let sourceContent: string | null = metadata?.userIdea || preferredSource.value || null;

  if (attachment?.type === 'youtube' || attachment?.type === 'tiktok' || attachment?.type === 'article') {
    sourceType = 'url';
    sourceContent = attachment.url || preferredSource.value || null;
  } else if (attachment?.type === 'file') {
    sourceType = 'file';
    sourceContent = attachment.fileName || attachment.url || preferredSource.label || null;
  } else if (attachment?.type === 'text') {
    sourceType = 'prompt';
    sourceContent = metadata?.userIdea || preferredSource.value || null;
  }

  const labelPrefix = preferredSource.label?.split(':')[0]?.trim();
  const name = normalizeName(metadata?.framework?.title || labelPrefix || preferredSource.label);

  return {
    name,
    sourceType,
    sourceContent: sourceContent ? String(sourceContent).slice(0, 5000) : null,
  };
}

interface CreateWorkspaceState {
  projectId: string | null;
  projectName: string | null;
  sourceType: string | null;
  sourceContent: string | null;
  isEnsuringProject: boolean;
  setWorkspaceProject: (project: PersistedWorkspaceProject) => void;
  clearWorkspaceProject: () => void;
  ensureWorkspaceProject: () => Promise<PersistedWorkspaceProject | null>;
  hydrateWorkspaceProject: (projectId: string) => Promise<void>;
}

const initialWorkspace = loadFromLocalStorage<PersistedWorkspaceProject>(WORKSPACE_PROJECT_STORAGE_KEY, {
  projectId: null,
  projectName: null,
  sourceType: null,
  sourceContent: null,
});

export const useCreateWorkspaceStore = create<CreateWorkspaceState>((set, get) => ({
  projectId: initialWorkspace.projectId,
  projectName: initialWorkspace.projectName,
  sourceType: initialWorkspace.sourceType,
  sourceContent: initialWorkspace.sourceContent,
  isEnsuringProject: false,

  setWorkspaceProject: (project) => {
    const normalizedProject: PersistedWorkspaceProject = {
      projectId: project.projectId || null,
      projectName: project.projectName ? normalizeName(project.projectName) : null,
      sourceType: project.sourceType || null,
      sourceContent: project.sourceContent || null,
    };

    set(normalizedProject);
    saveToLocalStorage(WORKSPACE_PROJECT_STORAGE_KEY, normalizedProject);
  },

  clearWorkspaceProject: () => {
    set({
      projectId: null,
      projectName: null,
      sourceType: null,
      sourceContent: null,
      isEnsuringProject: false,
    });
    removeFromLocalStorage(WORKSPACE_PROJECT_STORAGE_KEY);
  },

  ensureWorkspaceProject: async () => {
    const existingProjectId = get().projectId;
    if (existingProjectId) {
      return {
        projectId: existingProjectId,
        projectName: get().projectName,
        sourceType: get().sourceType,
        sourceContent: get().sourceContent,
      };
    }

    set({ isEnsuringProject: true });

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        return null;
      }

      const seed = deriveWorkspaceSeed();
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: seed.name,
          sourceType: seed.sourceType,
          sourceContent: seed.sourceContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(typeof errorData?.error === 'string' ? errorData.error : 'Không thể tạo dự án làm việc.');
      }

      const result = await response.json();
      const project = result?.data;
      const persistedProject: PersistedWorkspaceProject = {
        projectId: project?.id || null,
        projectName: normalizeName(project?.name || seed.name),
        sourceType: project?.source_type || seed.sourceType,
        sourceContent: project?.source_content || seed.sourceContent,
      };

      get().setWorkspaceProject(persistedProject);
      return persistedProject;
    } finally {
      set({ isEnsuringProject: false });
    }
  },

  hydrateWorkspaceProject: async (projectId) => {
    if (!projectId) {
      return;
    }

    const current = get();
    if (current.projectId === projectId && current.projectName) {
      return;
    }

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        get().setWorkspaceProject({
          projectId,
          projectName: current.projectName || 'Draft Project',
          sourceType: current.sourceType,
          sourceContent: current.sourceContent,
        });
        return;
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        get().setWorkspaceProject({
          projectId,
          projectName: current.projectName || 'Draft Project',
          sourceType: current.sourceType,
          sourceContent: current.sourceContent,
        });
        return;
      }

      const result = await response.json();
      const project = result?.data;
      get().setWorkspaceProject({
        projectId,
        projectName: normalizeName(project?.name || current.projectName || 'Draft Project'),
        sourceType: project?.source_type || current.sourceType,
        sourceContent: project?.source_content || current.sourceContent,
      });
    } catch {
      get().setWorkspaceProject({
        projectId,
        projectName: current.projectName || 'Draft Project',
        sourceType: current.sourceType,
        sourceContent: current.sourceContent,
      });
    }
  },
}));
