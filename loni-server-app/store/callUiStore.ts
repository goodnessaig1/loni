import { create } from 'zustand';

/**
 * How the call is SHOWN, kept apart from callStore (what the call IS) so that minimising, dragging
 * the floating widget or opening the audio menu never touches call state or re-renders the room.
 *
 * Same file in mobile-app and loni-server-app.
 */

export interface PillPosition {
  /** Distance from the top of the screen, before safe-area clamping. */
  y: number;
  /** Pushed off the side of the screen (only a small tab shows), like WhatsApp's call window. */
  tucked: 'left' | 'right' | null;
}

interface CallUiState {
  /** The call screen is folded into the floating widget; the call itself keeps running. */
  minimised: boolean;
  /** The audio output menu is open on the call screen. */
  routeSheetOpen: boolean;
  pill: PillPosition;
  minimise: () => void;
  expand: () => void;
  setRouteSheetOpen: (open: boolean) => void;
  setPill: (pill: PillPosition) => void;
  /** The call is over: next call starts full screen, un-tucked. The widget keeps its height. */
  reset: () => void;
}

export const useCallUiStore = create<CallUiState>((set) => ({
  minimised: false,
  routeSheetOpen: false,
  pill: { y: 0, tucked: null },
  minimise: () => set({ minimised: true, routeSheetOpen: false }),
  expand: () => set({ minimised: false }),
  setRouteSheetOpen: (open) => set({ routeSheetOpen: open }),
  setPill: (pill) => set({ pill }),
  reset: () => set((st) => ({ minimised: false, routeSheetOpen: false, pill: { ...st.pill, tucked: null } })),
}));
