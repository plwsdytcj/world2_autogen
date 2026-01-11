import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TourStep {
  target: string; // CSS selector for the element to highlight
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourState {
  // Tour visibility
  isOpen: boolean;
  currentStep: number;
  currentTour: string | null;
  
  // Completed tours (persisted)
  completedTours: string[];
  
  // Actions
  startTour: (tourId: string, steps: TourStep[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  closeTour: () => void;
  skipTour: () => void;
  resetTour: (tourId: string) => void;
  resetAllTours: () => void;
  
  // Current tour steps
  steps: TourStep[];
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      currentStep: 0,
      currentTour: null,
      completedTours: [],
      steps: [],

      startTour: (tourId: string, steps: TourStep[]) => {
        const { completedTours } = get();
        // Don't start if already completed (unless reset)
        if (completedTours.includes(tourId)) {
          return;
        }
        set({
          isOpen: true,
          currentStep: 0,
          currentTour: tourId,
          steps,
        });
      },

      nextStep: () => {
        const { currentStep, steps, currentTour } = get();
        if (currentStep < steps.length - 1) {
          set({ currentStep: currentStep + 1 });
        } else {
          // Tour completed
          set((state) => ({
            isOpen: false,
            currentStep: 0,
            currentTour: null,
            steps: [],
            completedTours: currentTour 
              ? [...state.completedTours, currentTour]
              : state.completedTours,
          }));
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      closeTour: () => {
        set({
          isOpen: false,
          currentStep: 0,
          currentTour: null,
          steps: [],
        });
      },

      skipTour: () => {
        const { currentTour } = get();
        set((state) => ({
          isOpen: false,
          currentStep: 0,
          currentTour: null,
          steps: [],
          completedTours: currentTour
            ? [...state.completedTours, currentTour]
            : state.completedTours,
        }));
      },

      resetTour: (tourId: string) => {
        set((state) => ({
          completedTours: state.completedTours.filter((id) => id !== tourId),
        }));
      },

      resetAllTours: () => {
        set({ completedTours: [] });
      },
    }),
    {
      name: 'tour-storage',
      partialize: (state) => ({ completedTours: state.completedTours }),
    }
  )
);

