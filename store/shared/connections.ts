/**
 * Connections Store
 * 
 * Manages social media account connections
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/utils/storage';
import { fetchConnectionsWithCache, clearConnectionsCache } from '@/lib/cache/connectionsCache';
import type { ConnectedAccount } from '../shared/types';

export interface ConnectionsState {
  // State
  connectedAccounts: ConnectedAccount[];
  connectedAccountsLoading: boolean;
  connectedAccountsError: string | null;

  // Actions
  loadConnectedAccounts: (force?: boolean) => Promise<void>;
  refreshConnectedAccounts: () => Promise<void>;
  setConnectedAccounts: (accounts: ConnectedAccount[]) => void;
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  // Initial state - load from localStorage
  connectedAccounts: loadFromLocalStorage<ConnectedAccount[]>('connectedAccounts', []),
  connectedAccountsLoading: false,
  connectedAccountsError: null,

  setConnectedAccounts: (accounts) => {
    const sanitized = accounts || [];
    set({ connectedAccounts: sanitized });
    saveToLocalStorage('connectedAccounts', sanitized);
  },

  loadConnectedAccounts: async (force = false) => {
    const { connectedAccounts, connectedAccountsLoading } = get();
    if (!force && connectedAccounts && connectedAccounts.length > 0) {
      return;
    }

    if (connectedAccountsLoading && !force) {
      return;
    }

    set({
      connectedAccountsLoading: true,
      connectedAccountsError: null
    });

    try {
      const accounts = await fetchConnectionsWithCache(force);
      if (accounts === null) {
        set({
          connectedAccounts: [],
          connectedAccountsLoading: false,
          connectedAccountsError: 'Không thể tải danh sách tài khoản đã kết nối.'
        });
        return;
      }

      set({
        connectedAccounts: accounts,
        connectedAccountsLoading: false,
        connectedAccountsError: null
      });
      saveToLocalStorage('connectedAccounts', accounts);
    } catch (error: any) {
      set({
        connectedAccountsLoading: false,
        connectedAccountsError: error?.message || 'Không thể tải danh sách tài khoản đã kết nối.'
      });
    }
  },

  refreshConnectedAccounts: async () => {
    clearConnectionsCache();
    await get().loadConnectedAccounts(true);
  },
}));

