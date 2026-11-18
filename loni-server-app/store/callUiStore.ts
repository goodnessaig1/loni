import { create } from 'zustand';

/**
 * How the call is SHOWN, kept apart from callStore (what the call IS) so that minimising, dragging
 * the floating widget or opening the audio menu never touches call state or re-renders the room.
 *
 * Same file in mobile-app and loni-server-app.
 */

export interface PillPosition {
  /** Which screen edge the widget is docked to. */
  side: 'left' | 'right';
  /** Distance from the top of the screen, before safe-area clamping. */
  y: number;
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
  /** The call is over: next call starts full screen. The widget keeps its last position. */
  reset: () => void;
}

export const useCallUiStore = create<CallUiState>((set) => ({
  minimised: false,
  routeSheetOpen: false,
  pill: { side: 'right', y: 120 },
  minimise: () => set({ minimised: true, routeSheetOpen: false }),
  expand: () => set({ minimised: false }),
  setRouteSheetOpen: (open) => set({ routeSheetOpen: open }),
  setPill: (pill) => set({ pill }),
  reset: () => set({ minimised: false, routeSheetOpen: false }),
}));
