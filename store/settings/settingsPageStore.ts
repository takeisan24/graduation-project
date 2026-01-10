/**
 * Settings Page Store
 * 
 * Manages social media account connections and settings
 */

import { create } from 'zustand';
import { useConnectionsStore } from '../shared/connections';
import { useCreditsStore } from '../shared/credits';
import type { ConnectionsState } from '../shared/connections';
import type { CreditsState } from '../shared/credits';

interface SettingsPageState {
  // State (from connections store)
  connectedAccounts: ConnectionsState['connectedAccounts'];
  connectedAccountsLoading: ConnectionsState['connectedAccountsLoading'];
  connectedAccountsError: ConnectionsState['connectedAccountsError'];
  profileLimits: CreditsState['profileLimits'];
  
  // Actions
  loadConnectedAccounts: (force?: boolean) => Promise<void>;
  refreshConnectedAccounts: () => Promise<void>;
  setConnectedAccounts: (accounts: any[]) => void;
}

export const useSettingsPageStore = create<SettingsPageState>((set, get) => {
  // Get connections and credits stores
  const connectionsStore = useConnectionsStore.getState();
  const creditsStore = useCreditsStore.getState();
  
  return {
    // State (delegated to connections store)
    get connectedAccounts() {
      return useConnectionsStore.getState().connectedAccounts;
    },
    get connectedAccountsLoading() {
      return useConnectionsStore.getState().connectedAccountsLoading;
    },
    get connectedAccountsError() {
      return useConnectionsStore.getState().connectedAccountsError;
    },
    get profileLimits() {
      return useCreditsStore.getState().profileLimits;
    },
    
    // Actions (delegated to connections store)
    loadConnectedAccounts: async (force) => {
      await useConnectionsStore.getState().loadConnectedAccounts(force);
    },
    refreshConnectedAccounts: async () => {
      await useConnectionsStore.getState().refreshConnectedAccounts();
    },
    setConnectedAccounts: (accounts) => {
      useConnectionsStore.getState().setConnectedAccounts(accounts);
    },
  };
});

