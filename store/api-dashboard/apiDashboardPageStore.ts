/**
 * API Dashboard Page Store
 * 
 * Manages API keys, API stats, and usage history
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/utils/storage';
import { toast } from 'sonner';

interface ApiStats {
  apiCalls: number;
  successRate: number;
  rateLimit: {
    used: number;
    total: number;
    resetTime: string;
  };
}

interface ApiKey {
  id: string;
  name: string;
  type: 'production' | 'development';
  lastUsed: string;
  isActive: boolean;
}

interface ApiDashboardPageState {
  // State
  apiStats: ApiStats;
  apiKeys: ApiKey[];
  // Actions
  handleRegenerateKey: (keyId: string) => void;
  handleCreateKey: () => void;
}

export const useApiDashboardPageStore = create<ApiDashboardPageState>((set, get) => ({
  // Initial state
  apiStats: loadFromLocalStorage<ApiStats>('apiStats', {
    apiCalls: 1247,
    successRate: 98.5,
    rateLimit: { used: 750, total: 1000, resetTime: "2h 15m" }
  }),
  apiKeys: loadFromLocalStorage<ApiKey[]>('apiKeys', [
    { id: '1', name: 'Production Key', type: 'production', lastUsed: '2 hours ago', isActive: true },
    { id: '2', name: 'Development Key', type: 'development', lastUsed: '1 day ago', isActive: true }
  ]),
  
  // Actions
  handleRegenerateKey: (keyId) => {
    const { apiKeys } = get();
    const updatedKeys = apiKeys.map(key =>
      key.id === keyId
        ? { ...key, lastUsed: 'Just now', isActive: true }
        : key
    );
    
    set({ apiKeys: updatedKeys });
    saveToLocalStorage('apiKeys', updatedKeys);
    toast.success('API key đã được tạo lại thành công!');
  },
  
  handleCreateKey: () => {
    const { apiKeys } = get();
    const newKey: ApiKey = {
      id: `${Date.now()}`,
      name: `New Key ${apiKeys.length + 1}`,
      type: 'development',
      lastUsed: 'Never',
      isActive: true
    };

    const updatedKeys = [...apiKeys, newKey];
    set({ apiKeys: updatedKeys });
    saveToLocalStorage('apiKeys', updatedKeys);
    toast.success('API key mới đã được tạo!');
  },
}));

