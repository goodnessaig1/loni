/**
 * Haptic + sound feedback for the "drag to go online/offline" slider.
 *
 * Modelled on iOS "slide to unlock" / Uber's "slide to confirm": a light
 * tick as the knob passes detents, a firmer bump when it crosses the commit
 * threshold ("you can let go now"), a success buzz + soft chime when the
 * action fires, and a gentle bump if it snaps back uncommitted.
 *
 * Every call is wrapped so a device without a haptic engine (or the web)
 * is a silent no-op.
 */
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

let chime: Audio.Sound | null = null;
let loadingChime = false;

async function ensureChime() {
  if (chime || loadingChime) return;
  loadingChime = true;
  try {
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/notification.mp3'),
      { volume: 0.25 },
    );
    chime = sound;
  } catch {
    /* no audio - haptics still fire */
  } finally {
    loadingChime = false;
  }
}

const safe = (fn: () => Promise<unknown>) => {
  try {
    fn().catch(() => {});
  } catch {
    /* ignore */
  }
};

export const dragFeedback = {
  /** knob grabbed */
  start: () => safe(() => Haptics.selectionAsync()),
  /** knob passed a detent while sliding */
  tick: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** knob crossed the commit threshold - releasing now will toggle */
  armed: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** released without committing - knob springs back */
  cancel: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  /** the toggle fired */
  commit: (withSound = true) => {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    if (withSound) {
      ensureChime().then(() => {
        chime?.replayAsync().catch(() => {});
      });
    }
  },
};
