/**
 * Navigation/Layout Store
 * 
 * Manages global navigation state: active section, sidebar, wizard, language
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/utils/storage';
import type { WizardStep } from './types';

interface NavigationState {
  // State
  activeSection: string;
  wizardStep: WizardStep;
  isSidebarOpen: boolean;
  language: 'vi' | 'en';
  
  // Actions
  setActiveSection: (section: string) => void;
  setWizardStep: (step: WizardStep) => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
  setLanguage: (lang: 'vi' | 'en') => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  // Initial state - load from localStorage
  activeSection: loadFromLocalStorage<string>('activeSection', 'create'),
  wizardStep: loadFromLocalStorage<WizardStep>('wizardStep', 'idle'),
  isSidebarOpen: loadFromLocalStorage<boolean>('isSidebarOpen', false),
  language: loadFromLocalStorage<'vi' | 'en'>('language', 'vi'),
  
  // Actions
  setActiveSection: (section) => {
    set({ activeSection: section });
    saveToLocalStorage('activeSection', section);
  },
  setWizardStep: (step) => {
    set({ wizardStep: step });
    saveToLocalStorage('wizardStep', step);
  },
  setIsSidebarOpen: (isOpen) => {
    set({ isSidebarOpen: isOpen });
    saveToLocalStorage('isSidebarOpen', isOpen);
  },
  setLanguage: (lang) => {
    set({ language: lang });
    saveToLocalStorage('language', lang);
  },
}));

