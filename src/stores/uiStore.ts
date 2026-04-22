import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UIState {
  // Modal states
  isFeedbackModalOpen: boolean;
  isOnboardingModalOpen: boolean;
  isCommandCenterOpen: boolean;

  // Navigation states
  isMobileMenuOpen: boolean;
  activeDropdown: string | null;

  // Loading states
  isLoading: boolean;
  loadingMessage: string;

  // Actions
  openFeedbackModal: () => void;
  closeFeedbackModal: () => void;
  openOnboardingModal: () => void;
  closeOnboardingModal: () => void;
  toggleCommandCenter: () => void;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  setActiveDropdown: (dropdown: string | null) => void;
  setLoading: (loading: boolean, message?: string) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        // Initial states
        isFeedbackModalOpen: false,
        isOnboardingModalOpen: false,
        isCommandCenterOpen: false,
        isMobileMenuOpen: false,
        activeDropdown: null,
        isLoading: false,
        loadingMessage: '',

        // Actions
        openFeedbackModal: () => set({ isFeedbackModalOpen: true }),
        closeFeedbackModal: () => set({ isFeedbackModalOpen: false }),
        openOnboardingModal: () => set({ isOnboardingModalOpen: true }),
        closeOnboardingModal: () => set({ isOnboardingModalOpen: false }),
        toggleCommandCenter: () => set((state) => ({ isCommandCenterOpen: !state.isCommandCenterOpen })),
        openMobileMenu: () => set({ isMobileMenuOpen: true }),
        closeMobileMenu: () => set({ isMobileMenuOpen: false }),
        setActiveDropdown: (dropdown) => set({ activeDropdown: dropdown }),
        setLoading: (loading, message = '') => set({ isLoading: loading, loadingMessage: message }),
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({
          isOnboardingModalOpen: state.isOnboardingModalOpen,
          // Only persist certain states
        }),
      }
    ),
    {
      name: 'UI Store',
    }
  )
);
